import { Router } from "express";
import { z } from "zod";
import { one, query, transaction } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { conflict, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapAppointment, mapInvoice, mapPatient, mapPrescription } from "../lib/mappers";
import { ageFromBirthDate } from "../lib/helpers";
import { requirePermission } from "../middleware/auth";

const router = Router();

const GENDERS = ["Male", "Female", "Other"] as const;
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] as const;

const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  gender: z.enum(GENDERS),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  phone: z.string().min(7, "A phone number is required").max(30),
  email: z.string().email().max(200).optional().or(z.literal("")),
  bloodGroup: z.enum(BLOOD).default("Unknown"),
  primaryCondition: z.string().max(200).default(""),
  allergies: z.string().max(500).default(""),
  address: z.string().max(300).default(""),
  notes: z.string().max(2000).default(""),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  assignedDoctorId: z.string().uuid().nullable().optional(),
});

async function nextPatientReference(): Promise<string> {
  const year = new Date().getFullYear();
  const row = await one<{ n: string | null }>(
    `SELECT max(split_part(reference, '-', 3))::int AS n FROM patients WHERE reference LIKE $1`,
    [`MC-${year}-%`],
  );
  return `MC-${year}-${String(Number(row?.n || 0) + 1).padStart(5, "0")}`;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "All");
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : null;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const params: unknown[] = [];
    const where: string[] = ["1=1"];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(
        `(lower(p.first_name || ' ' || p.last_name) LIKE $${params.length}
          OR p.reference ILIKE $${params.length}
          OR p.phone LIKE $${params.length})`,
      );
    }
    if (status !== "All") {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (doctorId) {
      params.push(doctorId);
      where.push(`p.assigned_doctor_id = $${params.length}`);
    }

    params.push(limit, offset);
    const rows = await query(
      `SELECT p.*, d.name AS assigned_doctor_name,
              (SELECT count(*) FROM appointments a WHERE a.patient_id = p.id) AS appointment_count,
              (SELECT coalesce(sum(i.total - i.amount_paid), 0) FROM invoices i
                WHERE i.patient_id = p.id AND i.status <> 'Paid' AND i.status <> 'Void') AS outstanding_balance
         FROM patients p
         LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
        WHERE ${where.join(" AND ")}
        ORDER BY p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = await one<{ count: string }>(
      `SELECT count(*) FROM patients p WHERE ${where.join(" AND ")}`,
      params.slice(0, -2),
    );

    return res.json({
      patients: rows.map((r) => ({ ...mapPatient(r), age: ageFromBirthDate(r.birth_date) })),
      total: Number(total?.count || 0),
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await one(
      `SELECT p.*, d.name AS assigned_doctor_name FROM patients p
         LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
        WHERE p.id = $1`,
      [req.params.id],
    );
    if (!row) throw notFound("Patient");

    const [appointments, invoices, prescriptions] = await Promise.all([
      query(
        `SELECT a.*, p.first_name, p.last_name, p.phone AS patient_phone, p.reference AS patient_reference,
                d.name AS doctor_name, d.specialty AS doctor_specialty, s.name AS service_name
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           JOIN doctors d ON d.id = a.doctor_id
           LEFT JOIN services s ON s.id = a.service_id
          WHERE a.patient_id = $1
          ORDER BY a.slot_at DESC LIMIT 50`,
        [req.params.id],
      ),
      query(
        `SELECT i.*, (SELECT json_agg(json_build_object(
                    'id', ii.id, 'description', ii.description, 'quantity', ii.quantity,
                    'unitPrice', ii.unit_price, 'subtotal', ii.subtotal) ORDER BY ii.description)
                  FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items
           FROM invoices i WHERE i.patient_id = $1 ORDER BY i.issued_at DESC LIMIT 50`,
        [req.params.id],
      ),
      query(
        `SELECT rx.*, d.name AS doctor_name,
                (SELECT json_agg(json_build_object(
                     'id', pi.id, 'drugId', pi.drug_id, 'drugName', dr.name,
                     'quantity', pi.quantity, 'dosage', pi.dosage) ORDER BY dr.name)
                   FROM prescription_items pi JOIN drugs dr ON dr.id = pi.drug_id
                  WHERE pi.prescription_id = rx.id) AS items
           FROM prescriptions rx JOIN doctors d ON d.id = rx.doctor_id
          WHERE rx.patient_id = $1 ORDER BY rx.issued_at DESC LIMIT 50`,
        [req.params.id],
      ),
    ]);

    return res.json({
      patient: { ...mapPatient(row), age: ageFromBirthDate(row.birth_date) },
      appointments: appointments.map(mapAppointment),
      invoices: invoices.map(mapInvoice),
      prescriptions: prescriptions.map(mapPrescription),
    });
  }),
);

router.post(
  "/",
  requirePermission("patients", "patients.write"),
  validate(patientSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof patientSchema>;

    if (b.phone) {
      const existing = await one<{ id: string; first_name: string; last_name: string }>(
        `SELECT id, first_name, last_name FROM patients WHERE phone = $1 LIMIT 1`,
        [b.phone.trim()],
      );
      if (existing) {
        throw conflict(
          `A patient with that phone number already exists (${existing.first_name} ${existing.last_name}).`,
        );
      }
    }

    const reference = await nextPatientReference();
    const row = await one(
      `INSERT INTO patients
         (reference, first_name, last_name, gender, birth_date, phone, email, blood_group,
          primary_condition, allergies, address, notes, status, assigned_doctor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        reference,
        b.firstName.trim(),
        b.lastName.trim(),
        b.gender,
        b.birthDate || null,
        b.phone.trim(),
        b.email || null,
        b.bloodGroup,
        b.primaryCondition,
        b.allergies,
        b.address,
        b.notes,
        b.status,
        b.assignedDoctorId || null,
      ],
    );

    await audit(req, "create", "patient", row!.id, { reference });
    return res.status(201).json({ patient: { ...mapPatient(row!), age: ageFromBirthDate(row!.birth_date) } });
  }),
);

router.patch(
  "/:id",
  requirePermission("patients", "patients.write"),
  validate(patientSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof patientSchema>>;
    const existing = await one(`SELECT * FROM patients WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Patient");

    const merged = {
      first_name: b.firstName ?? existing.first_name,
      last_name: b.lastName ?? existing.last_name,
      gender: b.gender ?? existing.gender,
      birth_date: b.birthDate === undefined ? existing.birth_date : b.birthDate || null,
      phone: b.phone ?? existing.phone,
      email: b.email === undefined ? existing.email : b.email || null,
      blood_group: b.bloodGroup ?? existing.blood_group,
      primary_condition: b.primaryCondition ?? existing.primary_condition,
      allergies: b.allergies ?? existing.allergies,
      address: b.address ?? existing.address,
      notes: b.notes ?? existing.notes,
      status: b.status ?? existing.status,
      assigned_doctor_id:
        b.assignedDoctorId === undefined ? existing.assigned_doctor_id : b.assignedDoctorId || null,
    };

    const row = await one(
      `UPDATE patients SET
         first_name=$1, last_name=$2, gender=$3, birth_date=$4, phone=$5, email=$6,
         blood_group=$7, primary_condition=$8, allergies=$9, address=$10, notes=$11,
         status=$12, assigned_doctor_id=$13
       WHERE id=$14 RETURNING *`,
      [
        merged.first_name, merged.last_name, merged.gender, merged.birth_date, merged.phone,
        merged.email, merged.blood_group, merged.primary_condition, merged.allergies,
        merged.address, merged.notes, merged.status, merged.assigned_doctor_id, req.params.id,
      ],
    );

    await audit(req, "update", "patient", req.params.id, { fields: Object.keys(b) });
    return res.json({ patient: { ...mapPatient(row!), age: ageFromBirthDate(row!.birth_date) } });
  }),
);

router.delete(
  "/:id",
  requirePermission("patients", "patients.write"),
  asyncHandler(async (req, res) => {
    const existing = await one(`SELECT id FROM patients WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Patient");

    const open = await one<{ count: string }>(
      `SELECT count(*) FROM invoices WHERE patient_id = $1 AND status IN ('Unpaid','Partial')`,
      [req.params.id],
    );
    if (Number(open?.count || 0) > 0) {
      throw conflict("This patient has unpaid invoices. Settle or void them before archiving.");
    }

    await transaction(async (client) => {
      await client.query(`DELETE FROM patients WHERE id = $1`, [req.params.id]);
    });
    await audit(req, "delete", "patient", req.params.id);
    return res.status(204).end();
  }),
);

export default router;

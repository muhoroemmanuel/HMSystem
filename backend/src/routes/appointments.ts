import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapAppointment } from "../lib/mappers";
import { addDaysISO, dayBounds, fromInstant, toInstant, todayISO, weekdayOf } from "../lib/time";
import { requirePermission } from "../middleware/auth";

const router = Router();

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "NoShow"] as const;

const createSchema = z.object({
  patientId: z.string().uuid("Choose a patient"),
  doctorId: z.string().uuid("Choose a doctor"),
  serviceId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  type: z.enum(["Consultation", "Follow-up", "Check-up", "Emergency", "Procedure"]).default("Consultation"),
  status: z.enum(STATUSES).default("Pending"),
  reason: z.string().max(500).default(""),
  notes: z.string().max(2000).default(""),
});

const SELECT_APPOINTMENT = `
  SELECT a.*, p.first_name, p.last_name, p.phone AS patient_phone, p.reference AS patient_reference,
         d.name AS doctor_name, d.specialty AS doctor_specialty, s.name AS service_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN services s ON s.id = a.service_id
`;

async function zoneOf(): Promise<string> {
  const row = await one<{ timezone: string; default_slot_minutes: number }>(
    `SELECT timezone, default_slot_minutes FROM settings WHERE id = 1`,
  );
  return row?.timezone || "Africa/Nairobi";
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const zone = await zoneOf();
    const status = String(req.query.status || "All");
    const search = String(req.query.search || "").trim().toLowerCase();
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : null;
    const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
    const range = String(req.query.range || "");

    const params: unknown[] = [];
    const where: string[] = ["1=1"];

    if (status !== "All") {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(lower(p.first_name || ' ' || p.last_name) LIKE $${params.length}
          OR lower(d.name) LIKE $${params.length}
          OR a.reference ILIKE $${params.length})`,
      );
    }
    if (doctorId) {
      params.push(doctorId);
      where.push(`a.doctor_id = $${params.length}`);
    }
    if (date) {
      const { start, end } = dayBounds(date, zone);
      params.push(start, end);
      where.push(`a.slot_at >= $${params.length - 1} AND a.slot_at < $${params.length}`);
    } else if (range === "upcoming") {
      params.push(new Date());
      where.push(`a.slot_at >= $${params.length} AND a.status IN ('Pending','Confirmed')`);
    } else if (range === "today") {
      const { start, end } = dayBounds(todayISO(zone), zone);
      params.push(start, end);
      where.push(`a.slot_at >= $${params.length - 1} AND a.slot_at < $${params.length}`);
    }

    const rows = await query(
      `${SELECT_APPOINTMENT} WHERE ${where.join(" AND ")} ORDER BY a.slot_at DESC LIMIT 300`,
      params,
    );

    return res.json({ appointments: rows.map(mapAppointment), today: todayISO(zone) });
  }),
);

/** Day agenda for one doctor - used by the scheduler UI. */
router.get(
  "/agenda",
  asyncHandler(async (req, res) => {
    const zone = await zoneOf();
    const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayISO(zone);
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : null;

    const params: unknown[] = [];
    const { start, end } = dayBounds(date, zone);
    params.push(start, end);
    let sql = `${SELECT_APPOINTMENT} WHERE a.slot_at >= $1 AND a.slot_at < $2`;
    if (doctorId) {
      params.push(doctorId);
      sql += ` AND a.doctor_id = $3`;
    }
    const rows = await query(`${sql} ORDER BY a.slot_at`, params);
    return res.json({ date, appointments: rows.map(mapAppointment) });
  }),
);

router.post(
  "/",
  requirePermission("appointments", "appointments.write"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    const zone = await zoneOf();

    const doctor = await one<{ id: string; status: string; consultation_fee: string }>(
      `SELECT id, status, consultation_fee FROM doctors WHERE id = $1`,
      [b.doctorId],
    );
    if (!doctor) throw notFound("Doctor");
    if (doctor.status !== "active") throw badRequest("That doctor is not currently available");

    const patient = await one<{ id: string }>(`SELECT id FROM patients WHERE id = $1`, [b.patientId]);
    if (!patient) throw notFound("Patient");

    const slotAt = toInstant(b.date, b.time, zone);
    if (b.status !== "Completed" && slotAt.getTime() < Date.now() - 60_000) {
      throw badRequest("You cannot book an appointment in the past");
    }

    const window = await one(
      `SELECT 1 FROM doctor_windows WHERE doctor_id = $1 AND weekday = $2
         AND start_time <= $3::time AND end_time > $3::time`,
      [b.doctorId, weekdayOf(b.date), b.time],
    );
    if (!window) throw badRequest("The doctor does not hold clinic at that time - check their schedule");

    const clash = await one(
      `SELECT id FROM appointments WHERE doctor_id = $1 AND slot_at = $2 AND status <> 'Cancelled'`,
      [b.doctorId, slotAt],
    );
    if (clash) throw badRequest("This doctor already has an appointment in that slot");

    const duplicate = await one(
      `SELECT id FROM appointments WHERE patient_id = $1 AND slot_at = $2 AND status <> 'Cancelled'`,
      [b.patientId, slotAt],
    );
    if (duplicate) throw badRequest("This patient already has an appointment at that time");

    const year = new Date().getFullYear();
    const seq = await one<{ n: string | null }>(
      `SELECT max(split_part(reference, '-', 3))::int AS n FROM appointments WHERE reference LIKE $1`,
      [`APT-${year}-%`],
    );
    const reference = `APT-${year}-${String(Number(seq?.n || 0) + 1).padStart(5, "0")}`;

    const service = b.serviceId
      ? await one<{ price: string; duration_minutes: number }>(
          `SELECT price, duration_minutes FROM services WHERE id = $1`,
          [b.serviceId],
        )
      : null;

    const row = await one(
      `INSERT INTO appointments
         (reference, patient_id, doctor_id, service_id, slot_at, duration_minutes, type, status,
          source, reason, notes, fee, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'staff',$9,$10,$11,$12)
       RETURNING id`,
      [
        reference,
        b.patientId,
        b.doctorId,
        b.serviceId ?? null,
        slotAt,
        b.durationMinutes ?? service?.duration_minutes ?? 30,
        b.type,
        b.status,
        b.reason,
        b.notes,
        service ? Number(service.price) : Number(doctor.consultation_fee || 0),
        req.user?.id ?? null,
      ],
    );

    const full = await one(`${SELECT_APPOINTMENT} WHERE a.id = $1`, [row!.id]);
    await audit(req, "create", "appointment", row!.id, { reference });
    return res.status(201).json({ appointment: mapAppointment(full!) });
  }),
);

const patchSchema = createSchema.partial().extend({
  status: z.enum(STATUSES).optional(),
  cancelledReason: z.string().max(300).optional(),
});

router.patch(
  "/:id",
  requirePermission("appointments", "appointments.write"),
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof patchSchema>;
    const zone = await zoneOf();
    const existing = await one(`SELECT * FROM appointments WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Appointment");

    const date = b.date ?? fromInstant(new Date(existing.slot_at), zone).date;
    const time = b.time ?? fromInstant(new Date(existing.slot_at), zone).time;
    const slotAt = toInstant(date, time, zone);
    const doctorId = b.doctorId ?? existing.doctor_id;
    const status = b.status ?? existing.status;

    if (status !== "Cancelled" && (b.date || b.time || b.doctorId)) {
      const clash = await one(
        `SELECT id FROM appointments
          WHERE doctor_id = $1 AND slot_at = $2 AND status <> 'Cancelled' AND id <> $3`,
        [doctorId, slotAt, req.params.id],
      );
      if (clash) throw badRequest("That slot is already booked for this doctor");
    }

    const row = await one(
      `UPDATE appointments SET
         doctor_id=$1, service_id=$2, slot_at=$3, duration_minutes=$4, type=$5, status=$6,
         reason=$7, notes=$8, cancelled_reason=$9
       WHERE id=$10 RETURNING id`,
      [
        doctorId,
        b.serviceId === undefined ? existing.service_id : b.serviceId,
        slotAt,
        b.durationMinutes ?? existing.duration_minutes,
        b.type ?? existing.type,
        status,
        b.reason ?? existing.reason,
        b.notes ?? existing.notes,
        b.cancelledReason ?? (status === "Cancelled" ? "Cancelled by staff" : existing.cancelled_reason),
        req.params.id,
      ],
    );

    // A completed appointment updates the patient's last visit stamp.
    if (status === "Completed") {
      await query(`UPDATE patients SET last_visit_at = $1 WHERE id = $2`, [slotAt, existing.patient_id]);
    }

    const full = await one(`${SELECT_APPOINTMENT} WHERE a.id = $1`, [row!.id]);
    await audit(req, "update", "appointment", req.params.id, { status });
    return res.json({ appointment: mapAppointment(full!) });
  }),
);

router.delete(
  "/:id",
  requirePermission("appointments", "appointments.write"),
  asyncHandler(async (req, res) => {
    const existing = await one(`SELECT id FROM appointments WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Appointment");
    await query(`DELETE FROM appointments WHERE id = $1`, [req.params.id]);
    await audit(req, "delete", "appointment", req.params.id);
    return res.status(204).end();
  }),
);

/** Upcoming window used by the dashboard "next 7 days" widget. */
router.get(
  "/week",
  asyncHandler(async (req, res) => {
    const zone = await zoneOf();
    const from = todayISO(zone);
    const rows = await query(
      `SELECT to_char(date_trunc('day', a.slot_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
              count(*)::int AS total,
              count(*) FILTER (WHERE a.status = 'Completed')::int AS completed,
              count(*) FILTER (WHERE a.status = 'Cancelled')::int AS cancelled
         FROM appointments a
        WHERE a.slot_at >= $1 AND a.slot_at < $2
        GROUP BY 1 ORDER BY 1`,
      [toInstant(from, "00:00", zone), toInstant(addDaysISO(from, 7), "00:00", zone), zone],
    );
    return res.json({ days: rows });
  }),
);

export default router;

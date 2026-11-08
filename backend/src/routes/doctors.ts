import { Router } from "express";
import { z } from "zod";
import { one, query, transaction } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapDoctor } from "../lib/mappers";
import { requirePermission } from "../middleware/auth";

const router = Router();

const windowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const doctorSchema = z.object({
  name: z.string().min(2, "Enter the doctor's name").max(120),
  specialty: z.string().min(2, "Specialty is required").max(120),
  qualifications: z.string().max(200).default(""),
  bio: z.string().max(2000).default(""),
  phone: z.string().max(30).default(""),
  email: z.string().email().max(200).optional().or(z.literal("")),
  experienceYears: z.number().int().min(0).max(70).default(0),
  consultationFee: z.number().min(0).max(1_000_000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
  isPublic: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#185FA5"),
  windows: z.array(windowSchema).default([]),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT d.*, (SELECT count(*) FROM patients p WHERE p.assigned_doctor_id = d.id) AS patient_count
         FROM doctors d ORDER BY d.status, d.name`,
    );
    const windows = await query(
      `SELECT doctor_id, id, weekday, start_time::text, end_time::text FROM doctor_windows ORDER BY weekday, start_time`,
    );
    const byDoctor = new Map<string, unknown[]>();
    for (const w of windows) {
      const list = byDoctor.get(w.doctor_id) ?? [];
      list.push({
        id: w.id,
        weekday: Number(w.weekday),
        startTime: String(w.start_time).slice(0, 5),
        endTime: String(w.end_time).slice(0, 5),
      });
      byDoctor.set(w.doctor_id, list);
    }
    return res.json({
      doctors: rows.map((r) => ({ ...mapDoctor(r), windows: byDoctor.get(r.id) ?? [] })),
    });
  }),
);

async function replaceWindows(
  client: import("pg").PoolClient,
  doctorId: string,
  windows: z.infer<typeof windowSchema>[],
): Promise<void> {
  await client.query(`DELETE FROM doctor_windows WHERE doctor_id = $1`, [doctorId]);
  for (const w of windows) {
    await client.query(
      `INSERT INTO doctor_windows (doctor_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)`,
      [doctorId, w.weekday, w.startTime, w.endTime],
    );
  }
}

router.post(
  "/",
  requirePermission("doctors", "doctors.write"),
  validate(doctorSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof doctorSchema>;
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO doctors
           (name, specialty, qualifications, bio, phone, email, experience_years,
            consultation_fee, status, is_public, color)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          b.name.trim(), b.specialty.trim(), b.qualifications, b.bio, b.phone,
          b.email || "", b.experienceYears, b.consultationFee, b.status, b.isPublic, b.color,
        ],
      );
      const doctorId = inserted.rows[0]!.id;
      await replaceWindows(client, doctorId, b.windows);
      return doctorId;
    });

    const row = await one(`SELECT * FROM doctors WHERE id = $1`, [id]);
    await audit(req, "create", "doctor", id, { name: b.name });
    return res.status(201).json({
      doctor: {
        ...mapDoctor(row!),
        windows: b.windows.map((w) => ({ ...w, id: "" })),
      },
    });
  }),
);

router.patch(
  "/:id",
  requirePermission("doctors", "doctors.write"),
  validate(doctorSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof doctorSchema>>;
    const existing = await one(`SELECT * FROM doctors WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Doctor");

    await transaction(async (client) => {
      await client.query(
        `UPDATE doctors SET
           name=$1, specialty=$2, qualifications=$3, bio=$4, phone=$5, email=$6,
           experience_years=$7, consultation_fee=$8, status=$9, is_public=$10, color=$11
         WHERE id=$12`,
        [
          b.name ?? existing.name,
          b.specialty ?? existing.specialty,
          b.qualifications ?? existing.qualifications,
          b.bio ?? existing.bio,
          b.phone ?? existing.phone,
          b.email === undefined ? existing.email : b.email || "",
          b.experienceYears ?? existing.experience_years,
          b.consultationFee ?? existing.consultation_fee,
          b.status ?? existing.status,
          b.isPublic ?? existing.is_public,
          b.color ?? existing.color,
          req.params.id,
        ],
      );
      if (b.windows) await replaceWindows(client, String(req.params.id), b.windows);
    });

    const row = await one(`SELECT * FROM doctors WHERE id = $1`, [req.params.id]);
    const windows = await query(
      `SELECT id, weekday, start_time::text, end_time::text FROM doctor_windows
        WHERE doctor_id = $1 ORDER BY weekday, start_time`,
      [req.params.id],
    );
    await audit(req, "update", "doctor", req.params.id);
    return res.json({
      doctor: {
        ...mapDoctor(row!),
        windows: windows.map((w) => ({
          id: w.id,
          weekday: Number(w.weekday),
          startTime: String(w.start_time).slice(0, 5),
          endTime: String(w.end_time).slice(0, 5),
        })),
      },
    });
  }),
);

export default router;

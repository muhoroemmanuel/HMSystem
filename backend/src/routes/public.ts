import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { mapDoctor, mapService, mapSettings } from "../lib/mappers";
import { addDaysISO, fromInstant, timeToMinutes, todayISO, toInstant, tz, weekdayOf } from "../lib/time";
import { num } from "../lib/helpers";

/**
 * Public, unauthenticated endpoints used by the marketing/booking site.
 * Only non-sensitive, explicitly public data is exposed here.
 */
const router = Router();

router.get(
  "/site",
  asyncHandler(async (_req, res) => {
    const settingsRow = await one(`SELECT * FROM settings WHERE id = 1`);
    const services = await query(
      `SELECT * FROM services WHERE is_active = true ORDER BY sort_order, name`,
    );
    const doctors = await query(
      `SELECT d.*, (SELECT count(*) FROM patients p WHERE p.assigned_doctor_id = d.id) AS patient_count
         FROM doctors d
        WHERE d.is_public = true AND d.status = 'active'
        ORDER BY d.name`,
    );

    const openingHours = (settingsRow?.opening_hours ?? {}) as Record<string, { open?: string; close?: string }>;

    return res.json({
      settings: settingsRow ? mapSettings(settingsRow) : null,
      services: services.map(mapService),
      doctors: doctors.map(mapDoctor),
      openingHours,
    });
  }),
);

/** Availability for a doctor over the next N days (default 14). */
router.get(
  "/availability/:doctorId",
  asyncHandler(async (req, res) => {
    const doctor = await one<{ id: string; name: string }>(`SELECT id, name FROM doctors WHERE id = $1`, [
      req.params.doctorId,
    ]);
    if (!doctor) throw notFound("Doctor");

    const settingsRow = await one(`SELECT default_slot_minutes, timezone FROM settings WHERE id = 1`);
    const slotMinutes = settingsRow?.default_slot_minutes ?? 30;
    const zone = settingsRow?.timezone || tz();

    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 60);
    const from = typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
      ? req.query.from
      : todayISO(zone);

    const windows = await query<{ weekday: number; start_time: string; end_time: string }>(
      `SELECT weekday, start_time::text, end_time::text FROM doctor_windows WHERE doctor_id = $1`,
      [doctor.id],
    );

    const booked = await query<{ slot_at: string }>(
      `SELECT slot_at FROM appointments
        WHERE doctor_id = $1 AND status <> 'Cancelled'
          AND slot_at >= $2 AND slot_at < $3`,
      [doctor.id, toInstant(from, "00:00", zone), toInstant(addDaysISO(from, days), "00:00", zone)],
    );
    const takenSlots = new Set(booked.map((b) => new Date(b.slot_at).toISOString()));

    const result: { date: string; weekday: number; slots: string[] }[] = [];
    const now = Date.now();

    for (let i = 0; i < days; i += 1) {
      const date = addDaysISO(from, i);
      const weekday = weekdayOf(date);
      const dayWindows = windows.filter((w) => Number(w.weekday) === weekday);
      const slots: string[] = [];

      for (const w of dayWindows) {
        const start = timeToMinutes(w.start_time);
        const end = timeToMinutes(w.end_time);
        for (let m = start; m + slotMinutes <= end; m += slotMinutes) {
          const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          const instant = toInstant(date, time, zone);
          if (instant.getTime() <= now) continue;
          if (takenSlots.has(instant.toISOString())) continue;
          slots.push(time);
        }
      }

      if (slots.length) result.push({ date, weekday, slots });
    }

    return res.json({ doctorId: doctor.id, doctorName: doctor.name, slotMinutes, days: result });
  }),
);

const bookingSchema = z.object({
  doctorId: z.string().uuid("Select a doctor"),
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  phone: z
    .string()
    .min(7, "Enter a reachable phone number")
    .max(30)
    .regex(/^[+()\-\s\d]+$/, "Phone can only contain digits, spaces and + - ( )"),
  email: z.string().email("Enter a valid email").max(200).optional().or(z.literal("")),
  gender: z.enum(["Male", "Female", "Other"]).default("Female"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  reason: z.string().max(500).default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Please accept the privacy notice" }) }),
});

/** Public self-service booking. Creates (or reuses) a patient record + appointment. */
router.post(
  "/book",
  validate(bookingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof bookingSchema>;

    const settingsRow = await one<{ timezone: string; default_slot_minutes: number; clinic_name: string }>(
      `SELECT timezone, default_slot_minutes, clinic_name FROM settings WHERE id = 1`,
    );
    const zone = settingsRow?.timezone || tz();

    const doctor = await one<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM doctors WHERE id = $1`,
      [body.doctorId],
    );
    if (!doctor || doctor.status !== "active") throw badRequest("That doctor is not accepting bookings");

    const slotAt = toInstant(body.date, body.time, zone);
    if (slotAt.getTime() < Date.now()) throw badRequest("That time has already passed - pick a later slot");

    const weekday = weekdayOf(body.date);
    const window = await one(
      `SELECT 1 FROM doctor_windows WHERE doctor_id = $1 AND weekday = $2
         AND start_time <= $3::time AND end_time > $3::time`,
      [doctor.id, weekday, body.time],
    );
    if (!window) throw badRequest("That doctor does not hold clinic at that time");

    const clash = await one(
      `SELECT 1 FROM appointments WHERE doctor_id = $1 AND slot_at = $2 AND status <> 'Cancelled'`,
      [doctor.id, slotAt],
    );
    if (clash) throw badRequest("That slot was just taken - please choose another");

    const service = body.serviceId
      ? await one<{ id: string; name: string; price: string | number; duration_minutes: number }>(
          `SELECT id, name, price, duration_minutes FROM services WHERE id = $1 AND is_active = true`,
          [body.serviceId],
        )
      : null;

    const patient = await query<{ id: string; reference: string; first_name: string }>(
      `INSERT INTO patients (reference, first_name, last_name, gender, birth_date, phone, email, primary_condition)
       VALUES ('TMP-' || replace(gen_random_uuid()::text, '-', ''), $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, reference, first_name`,
      [
        body.firstName.trim(),
        body.lastName.trim(),
        body.gender,
        body.birthDate || null,
        body.phone.trim(),
        body.email ? body.email.trim() : null,
        body.reason.trim(),
      ],
    );
    const patientId = patient[0]!.id;

    // Assign a stable, human friendly patient number (e.g. MC-2026-00123).
    const seq = await one<{ n: string | null }>(
      `SELECT max(split_part(reference, '-', 3))::int AS n FROM patients WHERE reference LIKE $1`,
      [`MC-${new Date().getFullYear()}-%`],
    );
    const reference = `MC-${new Date().getFullYear()}-${String(Number(seq?.n || 0) + 1).padStart(5, "0")}`;
    const aptSeq = await one<{ n: string | null }>(
      `SELECT max(split_part(reference, '-', 3))::int AS n FROM appointments WHERE reference LIKE $1`,
      [`APT-${new Date().getFullYear()}-%`],
    );
    const aptReference = `APT-${new Date().getFullYear()}-${String(Number(aptSeq?.n || 0) + 1).padStart(5, "0")}`;

    const inserted = await query<{ id: string }>(
      `UPDATE patients SET reference = $1 WHERE id = $2 RETURNING id`,
      [reference, patientId],
    );

    const appointment = await query<{ id: string; reference: string; slot_at: string }>(
      `INSERT INTO appointments
         (reference, patient_id, doctor_id, service_id, slot_at, duration_minutes, type, status,
          source, reason, fee, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, 'Consultation', 'Pending', 'public', $7, $8, $9)
       RETURNING id, reference, slot_at`,
      [
        aptReference,
        patientId,
        doctor.id,
        service?.id ?? null,
        slotAt,
        service?.duration_minutes ?? settingsRow?.default_slot_minutes ?? 30,
        body.reason.trim(),
        service ? num(service.price) : 0,
        body.phone.trim(),
      ],
    );

    const appt = appointment[0]!;
    const local = fromInstant(new Date(appt.slot_at), zone);

    return res.status(201).json({
      appointment: {
        id: appt.id,
        reference: appt.reference,
        date: local.date,
        time: local.time,
        doctorName: doctor.name,
        serviceName: service?.name ?? "Consultation",
        status: "Pending",
      },
      patient: {
        id: inserted[0]?.id ?? patientId,
        reference,
        name: `${body.firstName.trim()} ${body.lastName.trim()}`,
      },
      message: `Request received. ${settingsRow?.clinic_name || "We"} will call ${body.phone.trim()} to confirm.`,
    });
  }),
);

const lookupSchema = z.object({
  reference: z.string().min(4).max(40),
  contact: z.string().min(6).max(30),
});

/**
 * Public booking lookup. Requires BOTH the reference and the phone number used
 * so booking references cannot be enumerated.
 */
router.post(
  "/lookup",
  validate(lookupSchema),
  asyncHandler(async (req, res) => {
    const { reference, contact } = req.body as z.infer<typeof lookupSchema>;
    const zone = (await one<{ timezone: string }>(`SELECT timezone FROM settings WHERE id = 1`))?.timezone || tz();

    const normalisePhone = (value: string) => value.replace(/[^\d]/g, "").slice(-9);

    const row = await one<{
      reference: string;
      slot_at: string;
      doctor_name: string;
      first_name: string;
      last_name: string;
      type: string;
      status: string;
      contact_phone: string | null;
      patient_phone: string;
    }>(
      `SELECT a.reference, a.slot_at, a.type, a.status, a.contact_phone,
              d.name AS doctor_name, p.first_name, p.last_name, p.phone AS patient_phone
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN patients p ON p.id = a.patient_id
        WHERE upper(a.reference) = upper($1)`,
      [reference.trim()],
    );

    if (!row) throw notFound("Booking");
    const stored = normalisePhone(row.contact_phone || row.patient_phone);
    if (stored !== normalisePhone(contact)) throw notFound("Booking");

    const local = fromInstant(new Date(row.slot_at), zone);
    return res.json({
      appointment: {
        reference: row.reference,
        date: local.date,
        time: local.time,
        doctorName: row.doctor_name,
        patientName: `${row.first_name} ${row.last_name}`.trim(),
        type: row.type,
        status: row.status,
      },
    });
  }),
);

export default router;

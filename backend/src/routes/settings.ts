import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { audit } from "../lib/audit";
import { mapService, mapSettings } from "../lib/mappers";
import { requirePermission } from "../middleware/auth";

const router = Router();

const settingsSchema = z.object({
  clinicName: z.string().min(2, "Clinic name is required").max(120),
  tagline: z.string().max(160).default(""),
  about: z.string().max(4000).default(""),
  location: z.string().max(160).default(""),
  address: z.string().max(300).default(""),
  phone: z.string().max(30).default(""),
  emergencyPhone: z.string().max(30).default(""),
  email: z.string().email().max(200).optional().or(z.literal("")),
  currency: z.string().min(1).max(8).default("KES"),
  vatRate: z.number().min(0).max(1).default(0.16),
  defaultSlotMinutes: z.number().int().min(5).max(240).default(30),
  timezone: z.string().min(3).max(60).default("Africa/Nairobi"),
  mpesaPaybill: z.string().max(30).default(""),
  openingHours: z.record(z.object({ open: z.string().optional(), close: z.string().optional() })).default({}),
  bookingLeadDays: z.number().int().min(1).max(365).default(30),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const row = await one(`SELECT * FROM settings WHERE id = 1`);
    return res.json({ settings: row ? mapSettings(row) : null });
  }),
);

router.put(
  "/",
  requirePermission("settings", "settings.write"),
  validate(settingsSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof settingsSchema>>;
    const existing = await one(`SELECT * FROM settings WHERE id = 1`);
    const merged = {
      clinic_name: b.clinicName ?? existing?.clinic_name ?? "Your Clinic",
      tagline: b.tagline ?? existing?.tagline ?? "",
      about: b.about ?? existing?.about ?? "",
      location: b.location ?? existing?.location ?? "",
      address: b.address ?? existing?.address ?? "",
      phone: b.phone ?? existing?.phone ?? "",
      emergency_phone: b.emergencyPhone ?? existing?.emergency_phone ?? "",
      email: b.email === undefined ? existing?.email ?? "" : b.email || "",
      currency: b.currency ?? existing?.currency ?? "KES",
      vat_rate: b.vatRate ?? existing?.vat_rate ?? 0.16,
      default_slot_minutes: b.defaultSlotMinutes ?? existing?.default_slot_minutes ?? 30,
      timezone: b.timezone ?? existing?.timezone ?? "Africa/Nairobi",
      mpesa_paybill: b.mpesaPaybill ?? existing?.mpesa_paybill ?? "",
      opening_hours: b.openingHours ?? existing?.opening_hours ?? {},
      booking_lead_days: b.bookingLeadDays ?? existing?.booking_lead_days ?? 30,
    };

    const row = await one(
      `INSERT INTO settings (id, clinic_name, tagline, about, location, address, phone, emergency_phone,
                             email, currency, vat_rate, default_slot_minutes, timezone, mpesa_paybill,
                             opening_hours, booking_lead_days)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         clinic_name = EXCLUDED.clinic_name, tagline = EXCLUDED.tagline, about = EXCLUDED.about,
         location = EXCLUDED.location, address = EXCLUDED.address, phone = EXCLUDED.phone,
         emergency_phone = EXCLUDED.emergency_phone, email = EXCLUDED.email,
         currency = EXCLUDED.currency, vat_rate = EXCLUDED.vat_rate,
         default_slot_minutes = EXCLUDED.default_slot_minutes, timezone = EXCLUDED.timezone,
         mpesa_paybill = EXCLUDED.mpesa_paybill, opening_hours = EXCLUDED.opening_hours,
         booking_lead_days = EXCLUDED.booking_lead_days, updated_at = now()
       RETURNING *`,
      [
        merged.clinic_name, merged.tagline, merged.about, merged.location, merged.address,
        merged.phone, merged.emergency_phone, merged.email, merged.currency, merged.vat_rate,
        merged.default_slot_minutes, merged.timezone, merged.mpesa_paybill,
        JSON.stringify(merged.opening_hours), merged.booking_lead_days,
      ],
    );

    await audit(req, "update", "settings", "1", { fields: Object.keys(b) });
    return res.json({ settings: mapSettings(row!) });
  }),
);

// ---------------------------------------------------------------------------
// Services catalogue
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  name: z.string().min(2, "Service name is required").max(120),
  summary: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
  category: z.string().max(80).default("General"),
  price: z.number().min(0).max(10_000_000).default(0),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  icon: z.string().max(8).default("🩺"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "service";

router.get(
  "/services",
  asyncHandler(async (_req, res) => {
    const rows = await query(`SELECT * FROM services ORDER BY sort_order, name`);
    return res.json({ services: rows.map(mapService) });
  }),
);

router.post(
  "/services",
  requirePermission("settings", "settings.write"),
  validate(serviceSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof serviceSchema>;
    const base = slugify(b.name);
    const existing = await one<{ slug: string }>(`SELECT slug FROM services WHERE slug LIKE $1`, [`${base}%`]);
    const slug = existing ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

    const row = await one(
      `INSERT INTO services (slug, name, summary, description, category, price, duration_minutes, icon, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [slug, b.name, b.summary, b.description, b.category, b.price, b.durationMinutes, b.icon, b.isActive, b.sortOrder],
    );
    await audit(req, "create", "service", row!.id, { name: b.name });
    return res.status(201).json({ service: mapService(row!) });
  }),
);

router.patch(
  "/services/:id",
  requirePermission("settings", "settings.write"),
  validate(serviceSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof serviceSchema>>;
    const existing = await one(`SELECT * FROM services WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ message: "Service not found" });

    const row = await one(
      `UPDATE services SET name=$1, summary=$2, description=$3, category=$4, price=$5,
         duration_minutes=$6, icon=$7, is_active=$8, sort_order=$9
       WHERE id=$10 RETURNING *`,
      [
        b.name ?? existing.name, b.summary ?? existing.summary, b.description ?? existing.description,
        b.category ?? existing.category, b.price ?? existing.price,
        b.durationMinutes ?? existing.duration_minutes, b.icon ?? existing.icon,
        b.isActive ?? existing.is_active, b.sortOrder ?? existing.sort_order, req.params.id,
      ],
    );
    await audit(req, "update", "service", req.params.id);
    return res.json({ service: mapService(row!) });
  }),
);

router.delete(
  "/services/:id",
  requirePermission("settings", "settings.write"),
  asyncHandler(async (req, res) => {
    await query(`UPDATE services SET is_active = false WHERE id = $1`, [req.params.id]);
    await audit(req, "archive", "service", req.params.id);
    return res.status(204).end();
  }),
);

export default router;

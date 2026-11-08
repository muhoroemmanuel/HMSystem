import { Router } from "express";
import { z } from "zod";
import { one, query, transaction } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, conflict, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapDrug, mapPrescription, mapSale } from "../lib/mappers";
import { requirePermission } from "../middleware/auth";
import { num } from "../lib/helpers";

const router = Router();

const drugSchema = z.object({
  name: z.string().min(2, "Enter the drug name").max(160),
  genericName: z.string().max(160).default(""),
  category: z.string().max(80).default("General"),
  form: z.string().max(60).default("Tablet"),
  strength: z.string().max(60).default(""),
  price: z.number().min(0).max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  minStock: z.number().int().min(0).max(1_000_000).default(0),
  supplier: z.string().max(160).default(""),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  prescriptionRequired: z.boolean().default(false),
  barcode: z.string().max(60).nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get(
  "/drugs",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim().toLowerCase();
    const params: unknown[] = [];
    let where = "1=1";
    if (search) {
      params.push(`%${search}%`);
      where = `(lower(name) LIKE $1 OR lower(generic_name) LIKE $1 OR coalesce(barcode,'') ILIKE $1)`;
    }
    const rows = await query(
      `SELECT * FROM drugs WHERE ${where} ORDER BY (stock <= min_stock) DESC, name LIMIT 500`,
      params,
    );
    return res.json({ drugs: rows.map(mapDrug) });
  }),
);

router.post(
  "/drugs",
  requirePermission("pharmacy", "pharmacy.write"),
  validate(drugSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof drugSchema>;
    const row = await one(
      `INSERT INTO drugs
         (name, generic_name, category, form, strength, price, stock, min_stock, supplier,
          expiry_date, prescription_required, barcode, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        b.name.trim(), b.genericName, b.category, b.form, b.strength, b.price, b.stock,
        b.minStock, b.supplier, b.expiryDate || null, b.prescriptionRequired,
        b.barcode || null, b.isActive,
      ],
    );
    await audit(req, "create", "drug", row!.id, { name: b.name });
    return res.status(201).json({ drug: mapDrug(row!) });
  }),
);

router.patch(
  "/drugs/:id",
  requirePermission("pharmacy", "pharmacy.write"),
  validate(drugSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof drugSchema>>;
    const existing = await one(`SELECT * FROM drugs WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound("Drug");

    const row = await one(
      `UPDATE drugs SET
         name=$1, generic_name=$2, category=$3, form=$4, strength=$5, price=$6, stock=$7,
         min_stock=$8, supplier=$9, expiry_date=$10, prescription_required=$11, barcode=$12, is_active=$13
       WHERE id=$14 RETURNING *`,
      [
        b.name ?? existing.name,
        b.genericName ?? existing.generic_name,
        b.category ?? existing.category,
        b.form ?? existing.form,
        b.strength ?? existing.strength,
        b.price ?? existing.price,
        b.stock ?? existing.stock,
        b.minStock ?? existing.min_stock,
        b.supplier ?? existing.supplier,
        b.expiryDate === undefined ? existing.expiry_date : b.expiryDate || null,
        b.prescriptionRequired ?? existing.prescription_required,
        b.barcode === undefined ? existing.barcode : b.barcode || null,
        b.isActive ?? existing.is_active,
        req.params.id,
      ],
    );
    await audit(req, "update", "drug", req.params.id);
    return res.json({ drug: mapDrug(row!) });
  }),
);

// ---------------------------------------------------------------------------
// Sales (point of sale)
// ---------------------------------------------------------------------------
const saleSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(160).optional(),
  items: z
    .array(z.object({ drugId: z.string().uuid(), quantity: z.number().int().positive().max(10_000) }))
    .min(1, "Add at least one drug to the sale"),
  discount: z.number().min(0).max(1_000_000).default(0),
  paymentMethod: z.enum(["M-Pesa", "Card", "Cash", "Insurance", "Bank"]),
});

router.get(
  "/sales",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT s.*, u.name AS sold_by_name,
              (SELECT json_agg(json_build_object(
                  'id', si.id, 'drugId', si.drug_id, 'drugName', si.drug_name,
                  'quantity', si.quantity, 'unitPrice', si.unit_price, 'subtotal', si.subtotal))
                 FROM sale_items si WHERE si.sale_id = s.id) AS items
         FROM sales s LEFT JOIN users u ON u.id = s.sold_by
        ORDER BY s.sold_at DESC LIMIT 200`,
    );
    return res.json({ sales: rows.map(mapSale) });
  }),
);

router.post(
  "/sales",
  requirePermission("pharmacy", "pharmacy.write"),
  validate(saleSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof saleSchema>;
    const settings = await one<{ vat_rate: string; currency: string }>(
      `SELECT vat_rate, currency FROM settings WHERE id = 1`,
    );
    const vatRate = num(settings?.vat_rate);

    const result = await transaction(async (client) => {
      // Lock the rows so two tills cannot oversell the same stock.
      const ids = b.items.map((i) => i.drugId);
      const drugs = await client.query<{
        id: string;
        name: string;
        price: string;
        stock: number;
        prescription_required: boolean;
        is_active: boolean;
      }>(
        `SELECT id, name, price, stock, prescription_required, is_active
           FROM drugs WHERE id = ANY($1::uuid[]) FOR UPDATE`,
        [ids],
      );
      const byId = new Map(drugs.rows.map((d) => [d.id, d]));

      let subtotal = 0;
      let needsRx = false;
      const lines: { drugId: string; name: string; qty: number; price: number; subtotal: number }[] = [];

      for (const item of b.items) {
        const drug = byId.get(item.drugId);
        if (!drug || !drug.is_active) throw badRequest("One of the selected drugs is no longer available");
        if (drug.stock < item.quantity) {
          throw conflict(`Only ${drug.stock} × ${drug.name} left in stock`);
        }
        const price = num(drug.price);
        const lineTotal = price * item.quantity;
        subtotal += lineTotal;
        if (drug.prescription_required) needsRx = true;
        lines.push({ drugId: drug.id, name: drug.name, qty: item.quantity, price, subtotal: lineTotal });
      }

      const discount = Math.min(b.discount, subtotal);
      const taxable = subtotal - discount;
      const vatAmount = Math.round(taxable * vatRate * 100) / 100;
      const total = Math.round((taxable + vatAmount) * 100) / 100;

      const year = new Date().getFullYear();
      const seq = await client.query<{ n: string | null }>(
        `SELECT max(split_part(reference, '-', 3))::int AS n FROM sales WHERE reference LIKE $1`,
        [`SAL-${year}-%`],
      );
      const reference = `SAL-${year}-${String(Number(seq.rows[0]?.n || 0) + 1).padStart(5, "0")}`;

      let customerName = b.customerName?.trim() || "Walk-in";
      if (b.patientId) {
        const patient = await client.query<{ first_name: string; last_name: string }>(
          `SELECT first_name, last_name FROM patients WHERE id = $1`,
          [b.patientId],
        );
        if (!patient.rows[0]) throw notFound("Patient");
        customerName = `${patient.rows[0].first_name} ${patient.rows[0].last_name}`.trim();
      }

      const sale = await client.query<{ id: string }>(
        `INSERT INTO sales
           (reference, patient_id, customer_name, subtotal, discount, vat_amount, total,
            payment_method, prescription_required, sold_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          reference, b.patientId ?? null, customerName, subtotal, discount, vatAmount,
          total, b.paymentMethod, needsRx, req.user?.id ?? null,
        ],
      );
      const saleId = sale.rows[0]!.id;

      for (const line of lines) {
        await client.query(
          `INSERT INTO sale_items (sale_id, drug_id, drug_name, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [saleId, line.drugId, line.name, line.qty, line.price, line.subtotal],
        );
        await client.query(`UPDATE drugs SET stock = stock - $1 WHERE id = $2`, [line.qty, line.drugId]);
      }

      return { saleId, reference, total };
    });

    const row = await one(
      `SELECT s.*, u.name AS sold_by_name,
              (SELECT json_agg(json_build_object(
                  'id', si.id, 'drugId', si.drug_id, 'drugName', si.drug_name,
                  'quantity', si.quantity, 'unitPrice', si.unit_price, 'subtotal', si.subtotal))
                 FROM sale_items si WHERE si.sale_id = s.id) AS items
         FROM sales s LEFT JOIN users u ON u.id = s.sold_by WHERE s.id = $1`,
      [result.saleId],
    );
    await audit(req, "sale", "sale", result.saleId, { total: result.total });
    return res.status(201).json({ sale: mapSale(row!) });
  }),
);

// ---------------------------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------------------------
const prescriptionSchema = z.object({
  patientId: z.string().uuid("Choose a patient"),
  doctorId: z.string().uuid("Choose a doctor"),
  notes: z.string().max(1000).default(""),
  items: z
    .array(
      z.object({
        drugId: z.string().uuid(),
        quantity: z.number().int().positive().max(10_000),
        dosage: z.string().max(160).default(""),
      }),
    )
    .min(1, "Add at least one drug"),
});

router.get(
  "/prescriptions",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "All");
    const params: unknown[] = [];
    let where = "1=1";
    if (status !== "All") {
      params.push(status);
      where = `rx.status = $1`;
    }
    const rows = await query(
      `SELECT rx.*, p.first_name || ' ' || p.last_name AS patient_name, d.name AS doctor_name,
              (SELECT json_agg(json_build_object(
                  'id', pi.id, 'drugId', pi.drug_id, 'drugName', dr.name,
                  'quantity', pi.quantity, 'dosage', pi.dosage) ORDER BY dr.name)
                 FROM prescription_items pi JOIN drugs dr ON dr.id = pi.drug_id
                WHERE pi.prescription_id = rx.id) AS items
         FROM prescriptions rx
         JOIN patients p ON p.id = rx.patient_id
         JOIN doctors d ON d.id = rx.doctor_id
        WHERE ${where}
        ORDER BY rx.issued_at DESC LIMIT 200`,
      params,
    );
    return res.json({ prescriptions: rows.map(mapPrescription) });
  }),
);

router.post(
  "/prescriptions",
  requirePermission("pharmacy", "pharmacy.write"),
  validate(prescriptionSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof prescriptionSchema>;
    const year = new Date().getFullYear();

    const id = await transaction(async (client) => {
      const seq = await client.query<{ n: string | null }>(
        `SELECT max(split_part(reference, '-', 3))::int AS n FROM prescriptions WHERE reference LIKE $1`,
        [`RX-${year}-%`],
      );
      const reference = `RX-${year}-${String(Number(seq.rows[0]?.n || 0) + 1).padStart(5, "0")}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO prescriptions (reference, patient_id, doctor_id, notes)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [reference, b.patientId, b.doctorId, b.notes],
      );
      const rxId = inserted.rows[0]!.id;
      for (const item of b.items) {
        await client.query(
          `INSERT INTO prescription_items (prescription_id, drug_id, quantity, dosage) VALUES ($1,$2,$3,$4)`,
          [rxId, item.drugId, item.quantity, item.dosage],
        );
      }
      return rxId;
    });

    await audit(req, "create", "prescription", id);
    const row = await one(
      `SELECT rx.*, p.first_name || ' ' || p.last_name AS patient_name, d.name AS doctor_name,
              (SELECT json_agg(json_build_object(
                  'id', pi.id, 'drugId', pi.drug_id, 'drugName', dr.name,
                  'quantity', pi.quantity, 'dosage', pi.dosage) ORDER BY dr.name)
                 FROM prescription_items pi JOIN drugs dr ON dr.id = pi.drug_id
                WHERE pi.prescription_id = rx.id) AS items
         FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id JOIN doctors d ON d.id = rx.doctor_id
        WHERE rx.id = $1`,
      [id],
    );
    return res.status(201).json({ prescription: mapPrescription(row!) });
  }),
);

router.post(
  "/prescriptions/:id/dispense",
  requirePermission("pharmacy", "pharmacy.write"),
  asyncHandler(async (req, res) => {
    const rx = await one<{ id: string; status: string }>(
      `SELECT id, status FROM prescriptions WHERE id = $1`,
      [req.params.id],
    );
    if (!rx) throw notFound("Prescription");
    if (rx.status !== "Pending") throw badRequest(`This prescription is already ${rx.status.toLowerCase()}`);

    await transaction(async (client) => {
      const items = await client.query<{ drug_id: string; quantity: number; name: string; stock: number }>(
        `SELECT pi.drug_id, pi.quantity, d.name, d.stock
           FROM prescription_items pi JOIN drugs d ON d.id = pi.drug_id
          WHERE pi.prescription_id = $1 FOR UPDATE OF d`,
        [rx.id],
      );
      for (const item of items.rows) {
        if (item.stock < item.quantity) {
          throw conflict(`Not enough stock for ${item.name} (need ${item.quantity}, have ${item.stock})`);
        }
        await client.query(`UPDATE drugs SET stock = stock - $1 WHERE id = $2`, [
          item.quantity,
          item.drug_id,
        ]);
      }
      await client.query(
        `UPDATE prescriptions SET status = 'Dispensed', dispensed_at = now(), dispensed_by = $1 WHERE id = $2`,
        [req.user?.id ?? null, rx.id],
      );
    });

    await audit(req, "dispense", "prescription", rx.id);
    const row = await one(
      `SELECT rx.*, p.first_name || ' ' || p.last_name AS patient_name, d.name AS doctor_name,
              (SELECT json_agg(json_build_object(
                  'id', pi.id, 'drugId', pi.drug_id, 'drugName', dr.name,
                  'quantity', pi.quantity, 'dosage', pi.dosage) ORDER BY dr.name)
                 FROM prescription_items pi JOIN drugs dr ON dr.id = pi.drug_id
                WHERE pi.prescription_id = rx.id) AS items
         FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id JOIN doctors d ON d.id = rx.doctor_id
        WHERE rx.id = $1`,
      [rx.id],
    );
    return res.json({ prescription: mapPrescription(row!) });
  }),
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { one, query, transaction } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapInvoice } from "../lib/mappers";
import { requirePermission } from "../middleware/auth";
import { num } from "../lib/helpers";

const router = Router();

const itemSchema = z.object({
  description: z.string().min(1, "Describe the service").max(200),
  quantity: z.number().positive().max(1000).default(1),
  unitPrice: z.number().min(0).max(10_000_000),
});

const invoiceSchema = z.object({
  patientId: z.string().uuid("Choose a patient"),
  appointmentId: z.string().uuid().nullable().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
  notes: z.string().max(1000).default(""),
  dueAt: z.string().datetime().nullable().optional(),
  vatRate: z.number().min(0).max(1).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive("Enter an amount greater than zero").max(10_000_000),
  method: z.enum(["M-Pesa", "Card", "Cash", "Insurance", "Bank"]),
  reference: z.string().max(120).default(""),
});

const INVOICE_JOIN = `
  SELECT i.*, p.first_name || ' ' || p.last_name AS patient_name, p.reference AS patient_reference,
         (SELECT json_agg(json_build_object(
             'id', ii.id, 'description', ii.description, 'quantity', ii.quantity,
             'unitPrice', ii.unit_price, 'subtotal', ii.subtotal) ORDER BY ii.description)
            FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items,
         (SELECT json_agg(json_build_object(
             'id', pay.id, 'amount', pay.amount, 'method', pay.method, 'reference', pay.reference,
             'receivedAt', pay.received_at, 'receivedByName', u.name) ORDER BY pay.received_at)
            FROM payments pay LEFT JOIN users u ON u.id = pay.received_by
           WHERE pay.invoice_id = i.id) AS payments
    FROM invoices i JOIN patients p ON p.id = i.patient_id
`;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "All");
    const search = String(req.query.search || "").trim();
    const params: unknown[] = [];
    const where: string[] = ["1=1"];
    if (status !== "All") {
      params.push(status);
      where.push(`i.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(
        `(lower(p.first_name || ' ' || p.last_name) LIKE $${params.length} OR i.reference ILIKE $${params.length})`,
      );
    }
    const rows = await query(
      `${INVOICE_JOIN} WHERE ${where.join(" AND ")} ORDER BY i.issued_at DESC LIMIT 300`,
      params,
    );

    const totals = await one<{ billed: string; collected: string; outstanding: string; unpaid: string }>(
      `SELECT coalesce(sum(total),0) AS billed,
              coalesce(sum(amount_paid),0) AS collected,
              coalesce(sum(total - amount_paid) FILTER (WHERE status IN ('Unpaid','Partial')),0) AS outstanding,
              count(*) FILTER (WHERE status = 'Unpaid') AS unpaid
         FROM invoices WHERE status <> 'Void'`,
    );

    return res.json({
      invoices: rows.map(mapInvoice),
      summary: {
        billed: num(totals?.billed),
        collected: num(totals?.collected),
        outstanding: num(totals?.outstanding),
        unpaidCount: num(totals?.unpaid),
      },
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await one(`${INVOICE_JOIN} WHERE i.id = $1`, [req.params.id]);
    if (!row) throw notFound("Invoice");
    return res.json({ invoice: mapInvoice(row) });
  }),
);

router.post(
  "/",
  requirePermission("billing", "billing.write"),
  validate(invoiceSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof invoiceSchema>;

    const settings = await one<{ vat_rate: string; currency: string }>(
      `SELECT vat_rate, currency FROM settings WHERE id = 1`,
    );
    const vatRate = b.vatRate ?? num(settings?.vat_rate);

    const patient = await one(`SELECT id FROM patients WHERE id = $1`, [b.patientId]);
    if (!patient) throw notFound("Patient");

    const subtotal = b.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    const year = new Date().getFullYear();
    const seq = await one<{ n: string | null }>(
      `SELECT max(split_part(reference, '-', 3))::int AS n FROM invoices WHERE reference LIKE $1`,
      [`INV-${year}-%`],
    );
    const reference = `INV-${year}-${String(Number(seq?.n || 0) + 1).padStart(5, "0")}`;

    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO invoices (reference, patient_id, appointment_id, subtotal, vat_amount, total, notes, due_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          reference, b.patientId, b.appointmentId ?? null, subtotal, vatAmount, total,
          b.notes, b.dueAt ?? null, req.user?.id ?? null,
        ],
      );
      const invoiceId = inserted.rows[0]!.id;
      for (const item of b.items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5)`,
          [invoiceId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice],
        );
      }
      return invoiceId;
    });

    const row = await one(`${INVOICE_JOIN} WHERE i.id = $1`, [id]);
    await audit(req, "create", "invoice", id, { reference, total });
    return res.status(201).json({ invoice: mapInvoice(row!) });
  }),
);

router.post(
  "/:id/payments",
  requirePermission("billing", "billing.write"),
  validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof paymentSchema>;
    const invoice = await one<{ id: string; total: string; amount_paid: string; status: string }>(
      `SELECT id, total, amount_paid, status FROM invoices WHERE id = $1`,
      [req.params.id],
    );
    if (!invoice) throw notFound("Invoice");
    if (invoice.status === "Void") throw badRequest("This invoice has been voided");

    const outstanding = num(invoice.total) - num(invoice.amount_paid);
    if (b.amount > outstanding + 0.01) {
      throw badRequest(`That is more than the outstanding balance of ${outstanding.toFixed(2)}`);
    }

    const result = await transaction(async (client) => {
      await client.query(
        `INSERT INTO payments (invoice_id, amount, method, reference, received_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoice.id, b.amount, b.method, b.reference, req.user?.id ?? null],
      );

      const paid = await client.query<{ paid: string }>(
        `SELECT coalesce(sum(amount),0) AS paid FROM payments WHERE invoice_id = $1`,
        [invoice.id],
      );
      const amountPaid = num(paid.rows[0]?.paid);
      const status = amountPaid >= num(invoice.total) - 0.01 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid";
      await client.query(`UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3`, [
        amountPaid,
        status,
        invoice.id,
      ]);
      return { amountPaid, status };
    });

    const row = await one(`${INVOICE_JOIN} WHERE i.id = $1`, [invoice.id]);
    await audit(req, "payment", "invoice", invoice.id, { amount: b.amount, method: b.method });
    return res.json({ invoice: mapInvoice(row!), payment: result });
  }),
);

router.post(
  "/:id/void",
  requirePermission("billing", "billing.write"),
  asyncHandler(async (req, res) => {
    const invoice = await one<{ id: string; amount_paid: string }>(
      `SELECT id, amount_paid FROM invoices WHERE id = $1`,
      [req.params.id],
    );
    if (!invoice) throw notFound("Invoice");
    if (num(invoice.amount_paid) > 0) throw badRequest("Refund the recorded payments before voiding");

    await query(`UPDATE invoices SET status = 'Void' WHERE id = $1`, [req.params.id]);
    await audit(req, "void", "invoice", req.params.id);
    const row = await one(`${INVOICE_JOIN} WHERE i.id = $1`, [req.params.id]);
    return res.json({ invoice: mapInvoice(row!) });
  }),
);

export default router;

import { Router } from "express";
const router = Router();

const sampleInvoices = [
  { id: "B001", patientId: "P001", items: ["Consultation", "Blood Test"], amount: 4800, paidAmount: 4800, status: "Paid", paymentMethod: "M-Pesa", issuedAt: "2024-12-10" },
];

router.get("/", (_req, res) => res.json(sampleInvoices));
router.post("/", (req, res) => {
  const invoice = { id: `B${String(sampleInvoices.length + 1).padStart(3, "0")}`, paidAmount: 0, status: "Unpaid", issuedAt: new Date().toISOString().slice(0, 10), ...req.body };
  sampleInvoices.push(invoice);
  res.status(201).json(invoice);
});
router.post("/:id/pay", (req, res) => {
  const invoice = sampleInvoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const amount = Number(req.body.amount || invoice.amount - invoice.paidAmount);
  invoice.paidAmount += amount;
  invoice.status = invoice.paidAmount >= invoice.amount ? "Paid" : "Partial";
  invoice.paymentMethod = req.body.method || invoice.paymentMethod || "M-Pesa";
  res.json(invoice);
});

export default router;

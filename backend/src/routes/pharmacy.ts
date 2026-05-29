import { Router } from "express";
const router = Router();

const sampleDrugs = [
  { id: "RX001", name: "Amlodipine 5mg", genericName: "Amlodipine Besylate", category: "Antihypertensives", form: "Tablet", strength: "5mg", price: 45, stock: 240, minStock: 50, supplier: "Cosmos Pharma", expiryDate: "2026-03", prescriptionRequired: true, barcode: "5901234123457" },
];
const sampleSales = [
  { id: "S001", reference: "TXN-2412-001", patientName: "Walk-in", items: 3, subtotal: 1200, discount: 0, vat: 192, total: 1392, method: "M-Pesa", time: "08:45", prescription: false },
];

router.get("/drugs", (_req, res) => res.json(sampleDrugs));
router.post("/drugs", (req, res) => {
  const drug = { id: `RX${String(sampleDrugs.length + 1).padStart(3, "0")}`, ...req.body };
  sampleDrugs.push(drug);
  res.status(201).json(drug);
});
router.get("/sales", (_req, res) => res.json(sampleSales));
router.post("/sales", (req, res) => {
  const sale = { id: `S${String(sampleSales.length + 1).padStart(3, "0")}`, ...req.body };
  sampleSales.unshift(sale);
  sampleDrugs.forEach((drug) => {
    const item = sale.items.find((i: any) => i.id === drug.id);
    if (item) drug.stock = Math.max(0, drug.stock - item.qty);
  });
  res.status(201).json(sale);
});

export default router;

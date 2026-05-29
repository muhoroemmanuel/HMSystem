import { Router } from "express";
const router = Router();

const samplePatients = [
  { id: "P001", name: "Amara Okonkwo", age: 34, gender: "Female", phone: "+254712345678", email: "amara@email.com", bloodGroup: "O+", status: "Active", primaryCondition: "Hypertension", assignedDoctorId: "D001", lastVisitAt: "2024-12-10" },
];

router.get("/", (_req, res) => res.json(samplePatients));
router.post("/", (req, res) => {
  const patient = { id: `P${String(samplePatients.length + 1).padStart(3, "0")}`, ...req.body };
  samplePatients.push(patient);
  res.status(201).json(patient);
});
router.get("/:id", (req, res) => {
  const patient = samplePatients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  res.json(patient);
});

export default router;

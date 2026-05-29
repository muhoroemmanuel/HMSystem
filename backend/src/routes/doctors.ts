import { Router } from "express";
const router = Router();

const sampleDoctors = [
  { id: "D001", name: "Dr. Samuel Kiprotich", specialty: "Internal Medicine", phone: "+254712111000", email: "s.kiprotich@hospital.ke", status: "On Duty", experienceYears: 12, rating: 4.8 },
];

router.get("/", (_req, res) => res.json(sampleDoctors));
router.post("/", (req, res) => {
  const doctor = { id: `D${String(sampleDoctors.length + 1).padStart(3, "0")}`, ...req.body };
  sampleDoctors.push(doctor);
  res.status(201).json(doctor);
});

export default router;

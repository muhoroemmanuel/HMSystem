import { Router } from "express";
const router = Router();

const sampleAppointments = [
  { id: "A001", patientId: "P001", doctorId: "D001", date: "2024-12-18", time: "09:00", type: "Consultation", status: "Confirmed" },
];

router.get("/", (_req, res) => res.json(sampleAppointments));
router.post("/", (req, res) => {
  const appointment = { id: `A${String(sampleAppointments.length + 1).padStart(3, "0")}`, status: "Pending", ...req.body };
  sampleAppointments.push(appointment);
  res.status(201).json(appointment);
});
router.patch("/:id/status", (req, res) => {
  const appointment = sampleAppointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ message: "Appointment not found" });
  appointment.status = req.body.status || appointment.status;
  res.json(appointment);
});

export default router;

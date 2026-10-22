import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// VIDEO_PROVIDER_SEAM: mint video token here when provider chosen (Daily/Agora/Jitsi).

const sampleAppointments = [
  { id: "A001", patientId: "P001", doctorId: "D001", date: "2024-12-18", time: "09:00", type: "Consultation", status: "Confirmed" },
];

router.get("/", (_req, res) => res.json(sampleAppointments));
router.post("/", async (req, res) => {
  const { patient, doctor, date, time, type } = req.body;
  const id = `A${String(sampleAppointments.length + 1).padStart(3, "0")}`;
  const roomName = `hms-appt-${id}`;
  const appointment: any = { id, patient, doctor, date, time, type, status: "Pending", roomName, videoEnabled: false };

  sampleAppointments.push(appointment);
  res.status(201).json(appointment);
});
router.patch("/:id/status", (req, res) => {
  const appointment = sampleAppointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ message: "Appointment not found" });
  appointment.status = req.body.status || appointment.status;
  res.json(appointment);
});

router.get("/:id/video-token", async (req, res) => {
  const appointment = sampleAppointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ message: "Appointment not found" });

  // VIDEO_PROVIDER_SEAM: no provider configured yet — frontend shows "Video coming soon".
  return res.status(501).json({ message: "Video provider not configured yet" });
});

export default router;

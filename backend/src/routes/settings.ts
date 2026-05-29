import { Router } from "express";
const router = Router();

let systemSettings = {
  hospitalName: "Kenyatta National Hospital",
  location: "Nairobi, Kenya",
  currency: "KES",
  defaultAppointmentDuration: "30 minutes",
};

router.get("/", (_req, res) => res.json(systemSettings));
router.put("/", (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };
  res.json(systemSettings);
});

export default router;

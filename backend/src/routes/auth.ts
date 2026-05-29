import { Router } from "express";
const router = Router();

router.post("/login", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  res.json({ token: "fake-jwt-token", user: { id: "u1", name: "Admin User", role: "admin", email } });
});

router.get("/me", (_req, res) => {
  res.json({ user: { id: "u1", name: "Admin User", role: "admin", email: "admin@hospital.local" } });
});

export default router;

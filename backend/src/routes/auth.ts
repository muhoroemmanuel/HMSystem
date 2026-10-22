import { Router } from "express";
import { authenticate, createToken, revokeToken, tokenFromHeader, verifyToken } from "../middleware/authStore";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const user = authenticate(String(email), String(password));
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  const token = createToken(user);
  return res.json({ token, user });
});

router.post("/logout", (req, res) => {
  revokeToken(tokenFromHeader(req.headers.authorization));
  res.status(204).end();
});

router.get("/me", (req, res) => {
  const user = verifyToken(tokenFromHeader(req.headers.authorization));
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  return res.json({ user });
});

export default router;

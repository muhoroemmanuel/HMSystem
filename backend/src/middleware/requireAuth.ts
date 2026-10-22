import { NextFunction, Request, Response } from "express";
import { tokenFromHeader, verifyToken } from "../middleware/authStore";

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = verifyToken(tokenFromHeader(req.headers.authorization));
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = user;
  return next();
}

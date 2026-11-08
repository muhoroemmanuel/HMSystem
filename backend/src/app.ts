import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import patientRoutes from "./routes/patients";
import appointmentRoutes from "./routes/appointments";
import doctorRoutes from "./routes/doctors";
import billingRoutes from "./routes/billing";
import pharmacyRoutes from "./routes/pharmacy";
import settingsRoutes from "./routes/settings";
import userRoutes from "./routes/users";
import dashboardRoutes from "./routes/dashboard";

import { requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/validate";

export function createApp() {
  const app = express();

  // Behind Render/Railway/Nginx etc. so req.ip and rate limits are accurate.
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  if (trustProxy > 0) app.set("trust proxy", trustProxy);

  app.disable("x-powered-by");
  app.use(
    helmet({
      // The SPA is served by Vite/its own host; keep the API usable cross-origin.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  const origins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: origins.length ? origins : true,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  const envNumber = (name: string, fallback: number) => {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  };

  // Limits are per client IP. Clinics often have several staff behind one
  // address, so these are deliberately generous; tune them in .env.
  const loginLimiter = rateLimit({
    windowMs: envNumber("LOGIN_RATE_WINDOW_MINUTES", 15) * 60 * 1000,
    limit: envNumber("LOGIN_RATE_LIMIT", 40),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: "Too many failed sign-in attempts. Please wait a few minutes." },
  });

  const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: envNumber("BOOKING_RATE_LIMIT", 30),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many booking requests from this address. Please call the clinic." },
  });

  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  app.get("/api/health", async (_req, res) => {
    const { one } = await import("./db");
    try {
      await one("SELECT 1");
      res.json({ status: "ok", time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded", message: "Database unavailable" });
    }
  });

  // Public site + booking (no auth)
  app.use("/api/public", bookingLimiter, publicRoutes);

  // Auth
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth", authRoutes);

  // Everything below needs a session
  app.use("/api/patients", requireAuth, writeLimiter, patientRoutes);
  app.use("/api/appointments", requireAuth, writeLimiter, appointmentRoutes);
  app.use("/api/doctors", requireAuth, doctorRoutes);
  app.use("/api/billing", requireAuth, writeLimiter, billingRoutes);
  app.use("/api/pharmacy", requireAuth, writeLimiter, pharmacyRoutes);
  app.use("/api/settings", requireAuth, settingsRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import patientRoutes from "./routes/patients";
import appointmentRoutes from "./routes/appointments";
import billingRoutes from "./routes/billing";
import pharmacyRoutes from "./routes/pharmacy";
import doctorRoutes from "./routes/doctors";
import settingsRoutes from "./routes/settings";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

export default app;

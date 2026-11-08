import { Router } from "express";
import { one, query } from "../db";
import { asyncHandler } from "../middleware/validate";
import { addDaysISO, dayBounds, toInstant, todayISO } from "../lib/time";
import { num } from "../lib/helpers";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

/**
 * Everything the dashboard needs in a single round trip. Figures are computed
 * from live data - no placeholder numbers anywhere.
 */
router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const settings = await one<{ timezone: string; currency: string }>(
      `SELECT timezone, currency FROM settings WHERE id = 1`,
    );
    const zone = settings?.timezone || "Africa/Nairobi";
    const today = todayISO(zone);
    const { start, end } = dayBounds(today, zone);

    const [
      patients,
      todayAppointments,
      pending,
      completedToday,
      revenue,
      revenueLast30,
      outstanding,
      lowStock,
      expiredSoon,
      upcoming,
      weekly,
      bySpecialty,
      newPatients,
    ] = await Promise.all([
      one<{ total: string; active: string; new_this_month: string }>(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE status = 'Active') AS active,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS new_this_month
           FROM patients`,
      ),
      one<{ count: string }>(
        `SELECT count(*) FROM appointments WHERE slot_at >= $1 AND slot_at < $2 AND status <> 'Cancelled'`,
        [start, end],
      ),
      one<{ count: string }>(`SELECT count(*) FROM appointments WHERE status = 'Pending'`),
      one<{ count: string }>(
        `SELECT count(*) FROM appointments WHERE slot_at >= $1 AND slot_at < $2 AND status = 'Completed'`,
        [start, end],
      ),
      one<{ collected: string; billed: string }>(
        `SELECT coalesce(sum(amount_paid),0) AS collected, coalesce(sum(total),0) AS billed
           FROM invoices WHERE status <> 'Void' AND issued_at >= date_trunc('month', now())`,
      ),
      one<{ collected: string }>(
        `SELECT coalesce(sum(amount),0) AS collected FROM payments WHERE received_at >= now() - interval '30 days'`,
      ),
      one<{ outstanding: string; count: string }>(
        `SELECT coalesce(sum(total - amount_paid),0) AS outstanding, count(*) AS count
           FROM invoices WHERE status IN ('Unpaid','Partial')`,
      ),
      one<{ count: string }>(`SELECT count(*) FROM drugs WHERE is_active AND stock <= min_stock`),
      one<{ count: string }>(
        `SELECT count(*) FROM drugs WHERE is_active AND expiry_date IS NOT NULL
           AND expiry_date <= (now() + interval '90 days')::date`,
      ),
      query(
        `SELECT a.id, a.reference, a.slot_at, a.status, a.type,
                p.first_name || ' ' || p.last_name AS patient_name,
                d.name AS doctor_name
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           JOIN doctors d ON d.id = a.doctor_id
          WHERE a.slot_at >= now() AND a.status IN ('Pending','Confirmed')
          ORDER BY a.slot_at LIMIT 6`,
      ),
      query<{ day: string; total: number }>(
        `SELECT to_char(date_trunc('day', slot_at AT TIME ZONE $3), 'Dy') AS day, count(*)::int AS total
           FROM appointments
          WHERE slot_at >= $1 AND slot_at < $2
          GROUP BY 1, date_trunc('day', slot_at AT TIME ZONE $3)
          ORDER BY date_trunc('day', slot_at AT TIME ZONE $3)`,
        [toInstant(addDaysISO(today, -6), "22:00", zone), toInstant(addDaysISO(today, 1), "00:00", zone), zone],
      ),
      query<{ specialty: string; total: number }>(
        `SELECT d.specialty, count(*)::int AS total
           FROM appointments a JOIN doctors d ON d.id = a.doctor_id
          WHERE a.slot_at >= now() - interval '30 days' AND a.status <> 'Cancelled'
          GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      ),
      query<{ day: string; total: number }>(
        `SELECT to_char(date_trunc('month', created_at), 'Mon') AS day, count(*)::int AS total
           FROM patients WHERE created_at >= now() - interval '6 months'
          GROUP BY 1, date_trunc('month', created_at) ORDER BY date_trunc('month', created_at)`,
      ),
    ]);

    return res.json({
      currency: settings?.currency ?? "KES",
      date: today,
      patients: {
        total: num(patients?.total),
        active: num(patients?.active),
        newThisMonth: num(patients?.new_this_month),
      },
      appointments: {
        today: num(todayAppointments?.count),
        pending: num(pending?.count),
        completedToday: num(completedToday?.count),
      },
      revenue: {
        thisMonthCollected: num(revenue?.collected),
        thisMonthBilled: num(revenue?.billed),
        last30Days: num(revenueLast30?.collected),
        outstanding: num(outstanding?.outstanding),
        unpaidInvoices: num(outstanding?.count),
      },
      inventory: {
        lowStock: num(lowStock?.count),
        expiringSoon: num(expiredSoon?.count),
      },
      upcoming: upcoming.map((u) => ({
        id: u.id,
        reference: u.reference,
        slotAt: u.slot_at,
        status: u.status,
        type: u.type,
        patientName: u.patient_name,
        doctorName: u.doctor_name,
      })),
      charts: {
        weekly: weekly,
        bySpecialty: bySpecialty,
        newPatients: newPatients,
      },
    });
  }),
);

export default router;

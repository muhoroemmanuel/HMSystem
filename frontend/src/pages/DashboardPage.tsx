import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { compactMoney, formatDate, formatTime, money } from "../lib/format";
import { Badge, EmptyState, MetricCard, PageLoader, Icon } from "../components/ui";
import { useAuth } from "../context/AuthContext";

interface Summary {
  currency: string;
  date: string;
  patients: { total: number; active: number; newThisMonth: number };
  appointments: { today: number; pending: number; completedToday: number };
  revenue: {
    thisMonthCollected: number;
    thisMonthBilled: number;
    last30Days: number;
    outstanding: number;
    unpaidInvoices: number;
  };
  inventory: { lowStock: number; expiringSoon: number };
  upcoming: {
    id: string;
    reference: string;
    slotAt: string;
    status: string;
    type: string;
    patientName: string;
    doctorName: string;
  }[];
  charts: {
    weekly: { day: string; total: number }[];
    bySpecialty: { specialty: string; total: number }[];
    newPatients: { day: string; total: number }[];
  };
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Summary>("/dashboard/summary")
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PageLoader label="Loading your clinic at a glance…" />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const currency = data.currency;
  const isNewClinic =
    data.patients.total === 0 && data.appointments.today === 0 && data.revenue.thisMonthBilled === 0;

  const maxWeekly = Math.max(1, ...data.charts.weekly.map((d) => d.total));
  const maxSpecialty = Math.max(1, ...data.charts.bySpecialty.map((d) => d.total));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <div className="page-subtitle">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · here's how the clinic is doing"}
          </div>
        </div>
        <div className="page-actions">
          {can("appointments.write") ? (
            <Link className="btn btn-primary" to="/app/appointments">
              <Icon name="plus" size={15} />
              New appointment
            </Link>
          ) : null}
          {can("patients.write") ? (
            <Link className="btn btn-outline" to="/app/patients">
              Register patient
            </Link>
          ) : null}
        </div>
      </div>

      {isNewClinic ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
              <span className="metric-icon" style={{ background: "var(--blue-050)", color: "var(--blue-600)" }}>
                <Icon name="dashboard" size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, marginBottom: 5 }}>Your clinic is set up and ready</h3>
                <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 14 }}>
                  There is no data yet — every number below comes straight from your database, so it
                  starts at zero. Add clinicians and their weekly availability first, then you can start
                  booking.
                </p>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <Link className="btn btn-primary btn-sm" to="/app/doctors">
                    Add your clinicians
                  </Link>
                  <Link className="btn btn-outline btn-sm" to="/app/services">
                    Review the service list
                  </Link>
                  <Link className="btn btn-outline btn-sm" to="/app/settings">
                    Clinic contact details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid-4">
        <MetricCard
          label="Total patients"
          value={data.patients.total}
          foot={`${data.patients.active} active · ${data.patients.newThisMonth} new this month`}
          icon={<Icon name="patients" size={17} />}
        />
        <MetricCard
          label="Appointments today"
          value={data.appointments.today}
          foot={`${data.appointments.completedToday} completed · ${data.appointments.pending} awaiting confirmation`}
          icon={<Icon name="calendar" size={17} />}
          tint="var(--purple-050)"
          color="var(--purple-600)"
        />
        <MetricCard
          label="Collected this month"
          value={compactMoney(data.revenue.thisMonthCollected, currency)}
          foot={`Billed ${compactMoney(data.revenue.thisMonthBilled, currency)}`}
          icon={<Icon name="billing" size={17} />}
          tint="var(--teal-050)"
          color="var(--teal-600)"
        />
        <MetricCard
          label="Outstanding"
          value={compactMoney(data.revenue.outstanding, currency)}
          foot={`${data.revenue.unpaidInvoices} unpaid invoice${data.revenue.unpaidInvoices === 1 ? "" : "s"}`}
          icon={<Icon name="alert" size={17} />}
          tint="var(--amber-050)"
          color="var(--amber-600)"
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Appointments this week</span>
            <span className="small muted">Last 7 days</span>
          </div>
          <div className="card-body">
            {data.charts.weekly.length === 0 ? (
              <EmptyState icon="📅" title="No appointments in the last 7 days" />
            ) : (
              <div className="chart-bars">
                {data.charts.weekly.map((d) => (
                  <div className="chart-bar-wrap" key={d.day}>
                    <span className="chart-bar-value">{d.total}</span>
                    <div
                      className="chart-bar"
                      style={{ height: `${Math.max(4, (d.total / maxWeekly) * 86)}%` }}
                    />
                    <span className="chart-bar-label">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming appointments</span>
            <Link className="btn btn-ghost btn-sm" to="/app/appointments">
              View all
            </Link>
          </div>
          <div className="card-body" style={{ padding: "8px 18px 14px" }}>
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="Nothing booked yet"
                hint="Appointments booked by staff or through the public site appear here."
              />
            ) : (
              data.upcoming.map((a) => (
                <Link
                  key={a.id}
                  to="/app/appointments"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <div className="stat-row" style={{ gap: 12 }}>
                    <div style={{ minWidth: 62 }}>
                      <div className="strong" style={{ fontSize: 12.5, color: "var(--blue-600)" }}>
                        {formatTime(a.slotAt)}
                      </div>
                      <div className="small muted">{formatDate(a.slotAt, { day: "numeric", month: "short" })}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong" style={{ fontSize: 13 }}>
                        {a.patientName}
                      </div>
                      <div className="small muted">
                        {a.type} · {a.doctorName}
                      </div>
                    </div>
                    <Badge status={a.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Consultations by specialty</span>
          </div>
          <div className="card-body">
            {data.charts.bySpecialty.length === 0 ? (
              <EmptyState icon="🩺" title="No consultations yet" />
            ) : (
              data.charts.bySpecialty.map((s, i) => (
                <div className="stat-row" key={s.specialty}>
                  <span style={{ minWidth: 108, fontSize: 12.5, color: "var(--ink-500)" }}>
                    {s.specialty}
                  </span>
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(s.total / maxSpecialty) * 100}%`,
                        background: ["#185FA5", "#0F6E56", "#534AB7", "#854F0B", "#A32D2D"][i % 5],
                      }}
                    />
                  </div>
                  <span className="strong small" style={{ minWidth: 24, textAlign: "right" }}>
                    {s.total}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Pharmacy alerts</span>
            <Link className="btn btn-ghost btn-sm" to="/app/pharmacy">
              Open
            </Link>
          </div>
          <div className="card-body">
            <div className="stat-row">
              <span style={{ fontSize: 20 }}>📦</span>
              <div style={{ flex: 1 }}>
                <div className="strong" style={{ fontSize: 13 }}>
                  Low stock items
                </div>
                <div className="small muted">At or below the reorder level</div>
              </div>
              <span className="strong" style={{ color: "var(--amber-600)" }}>
                {data.inventory.lowStock}
              </span>
            </div>
            <div className="stat-row">
              <span style={{ fontSize: 20 }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div className="strong" style={{ fontSize: 13 }}>
                  Expiring in 90 days
                </div>
                <div className="small muted">Review or return to the supplier</div>
              </div>
              <span className="strong" style={{ color: "var(--red-600)" }}>
                {data.inventory.expiringSoon}
              </span>
            </div>
            <div className="stat-row">
              <span style={{ fontSize: 20 }}>💰</span>
              <div style={{ flex: 1 }}>
                <div className="strong" style={{ fontSize: 13 }}>
                  Collected (30 days)
                </div>
                <div className="small muted">All payment methods</div>
              </div>
              <span className="strong" style={{ color: "var(--teal-600)" }}>
                {money(data.revenue.last30Days, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">New patients</span>
            <span className="small muted">6 months</span>
          </div>
          <div className="card-body">
            {data.charts.newPatients.length === 0 ? (
              <EmptyState icon="🧑‍🤝‍🧑" title="No registrations yet" />
            ) : (
              <div className="chart-bars" style={{ height: 110 }}>
                {data.charts.newPatients.map((d) => {
                  const max = Math.max(1, ...data.charts.newPatients.map((x) => x.total));
                  return (
                    <div className="chart-bar-wrap" key={d.day}>
                      <span className="chart-bar-value">{d.total}</span>
                      <div
                        className="chart-bar"
                        style={{
                          height: `${Math.max(4, (d.total / max) * 78)}%`,
                          background: "var(--teal-600)",
                        }}
                      />
                      <span className="chart-bar-label">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

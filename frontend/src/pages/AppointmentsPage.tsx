import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDateTime, formatTime, isoDate, money } from "../lib/format";
import {
  Badge,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  PageLoader,
  SearchBox,
  Tabs,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface Appointment {
  id: string;
  reference: string;
  patientId: string;
  patientName: string;
  patientReference: string | null;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string | null;
  serviceId: string | null;
  serviceName: string | null;
  slotAt: string;
  date: string | null;
  time: string | null;
  durationMinutes: number;
  type: string;
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled" | "NoShow";
  source: "staff" | "public";
  reason: string;
  notes: string;
  fee: number;
  contactPhone: string | null;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

interface Patient {
  id: string;
  name: string;
  reference: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

const TYPES = ["Consultation", "Follow-up", "Check-up", "Emergency", "Procedure"];

export default function AppointmentsPage() {
  const toast = useToast();
  const { can } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "agenda">("list");

  const [agendaDate, setAgendaDate] = useState(isoDate());
  const [agenda, setAgenda] = useState<Appointment[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    serviceId: "",
    date: isoDate(),
    time: "09:00",
    type: "Consultation",
    status: "Pending",
    reason: "",
    notes: "",
  });

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status !== "All") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const data = await api.get<{ appointments: Appointment[] }>(`/appointments?${params}`);
      setAppointments(data.appointments);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    Promise.all([
      api.get<{ doctors: Doctor[] }>("/doctors"),
      api.get<{ patients: Patient[] }>("/patients?limit=200"),
    ])
      .then(([d, p]) => {
        setDoctors(d.doctors.filter((x: any) => x.status === "active"));
        setPatients(p.patients);
      })
      .catch(() => undefined);
    api
      .get<{ services: Service[] }>("/settings/services")
      .then((s) => setServices(s.services.filter((x) => x.isActive)))
      .catch(() => undefined);
  }, []);

  const loadAgenda = useCallback(async () => {
    setAgendaLoading(true);
    try {
      const data = await api.get<{ appointments: Appointment[] }>(`/appointments/agenda?date=${agendaDate}`);
      setAgenda(data.appointments);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAgendaLoading(false);
    }
  }, [agendaDate, toast]);

  useEffect(() => {
    if (view === "agenda") void loadAgenda();
  }, [view, loadAgenda]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of appointments) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [appointments]);

  async function create() {
    setSaving(true);
    setFormError("");
    try {
      await api.post("/appointments", {
        ...form,
        serviceId: form.serviceId || null,
      });
      toast.success("Appointment scheduled");
      setShowForm(false);
      setForm({ ...form, patientId: "", reason: "", notes: "" });
      await load();
      if (view === "agenda") await loadAgenda();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: Appointment, next: Appointment["status"], reason?: string) {
    try {
      await api.patch(`/appointments/${a.id}`, {
        status: next,
        ...(reason ? { cancelledReason: reason } : {}),
      });
      toast.success(`Appointment ${next.toLowerCase()}`);
      setSelected(null);
      setCancelReason("");
      await load();
      if (view === "agenda") await loadAgenda();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const rows = view === "list" ? appointments : agenda;

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={
          view === "list"
            ? `${appointments.length} shown · ${counts.Confirmed || 0} confirmed · ${counts.Pending || 0} awaiting`
            : `Agenda for ${formatDate(agendaDate, { weekday: "long", day: "numeric", month: "long" })}`
        }
        actions={
          <>
            <Tabs
              options={[
                { key: "list", label: "All" },
                { key: "agenda", label: "Day agenda" },
              ]}
              value={view}
              onChange={(v) => setView(v as "list" | "agenda")}
            />
            {can("appointments.write") ? (
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Icon name="plus" size={15} /> Schedule
              </button>
            ) : null}
          </>
        }
      />

      {view === "list" ? (
        <div className="filters">
          <SearchBox value={search} onChange={setSearch} placeholder="Search patient, clinician or reference…" width={310} />
          <Tabs
            options={[
              { key: "All", label: "All" },
              { key: "Pending", label: "Pending", count: counts.Pending },
              { key: "Confirmed", label: "Confirmed", count: counts.Confirmed },
              { key: "Completed", label: "Completed", count: counts.Completed },
              { key: "Cancelled", label: "Cancelled", count: counts.Cancelled },
            ]}
            value={status}
            onChange={setStatus}
          />
        </div>
      ) : (
        <div className="filters">
          <input
            className="input"
            type="date"
            value={agendaDate}
            onChange={(e) => setAgendaDate(e.target.value)}
            style={{ maxWidth: 190 }}
          />
          <button className="btn btn-outline btn-sm" onClick={() => setAgendaDate(isoDate())}>
            Today
          </button>
          <span className="spacer small muted">{agenda.length} appointments</span>
        </div>
      )}

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card-flush">
        {loading || (view === "agenda" && agendaLoading) ? (
          <PageLoader label="Loading appointments…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="📅"
            title={view === "agenda" ? "Nothing booked for this day" : "No appointments found"}
            hint="Appointments booked here and on the public website both appear in this list."
          />
        ) : view === "list" ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Patient</th>
                  <th>Clinician</th>
                  <th>When</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code className="mono">{a.reference}</code>
                    </td>
                    <td>
                      <div className="strong" style={{ fontSize: 13 }}>
                        {a.patientName}
                      </div>
                      <div className="small muted">{a.patientPhone || a.contactPhone || "—"}</div>
                    </td>
                    <td className="small">{a.doctorName}</td>
                    <td>
                      <div className="small">{formatDate(a.slotAt)}</div>
                      <span className="tag" style={{ background: "var(--blue-050)", color: "var(--blue-700)" }}>
                        {formatTime(a.slotAt)}
                      </span>
                    </td>
                    <td>
                      <span className="tag">{a.type}</span>
                    </td>
                    <td>
                      <span className="small muted">{a.source === "public" ? "🌐 Online" : "🏥 Staff"}</span>
                    </td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        {a.status === "Pending" && can("appointments.write") ? (
                          <button className="btn btn-outline btn-sm" style={{ color: "var(--teal-600)" }} onClick={() => changeStatus(a, "Confirmed")}>
                            Confirm
                          </button>
                        ) : null}
                        {a.status === "Confirmed" && can("appointments.write") ? (
                          <button className="btn btn-outline btn-sm" style={{ color: "var(--teal-600)" }} onClick={() => changeStatus(a, "Completed")}>
                            Complete
                          </button>
                        ) : null}
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(a)}>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body">
            {agenda.map((a) => (
              <div
                key={a.id}
                className="stat-row"
                style={{ gap: 14, cursor: "pointer" }}
                onClick={() => setSelected(a)}
              >
                <div style={{ minWidth: 58 }}>
                  <div className="strong" style={{ color: "var(--blue-600)", fontSize: 13 }}>
                    {formatTime(a.slotAt)}
                  </div>
                  <div className="small muted">{a.durationMinutes} min</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 13.5 }}>
                    {a.patientName}
                  </div>
                  <div className="small muted">
                    {a.doctorName} · {a.type}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </div>
                </div>
                <Badge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- create */}
      {showForm ? (
        <Modal
          title="Schedule an appointment"
          subtitle="Slots are validated against the clinician's weekly availability"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={create}
                disabled={saving || !form.patientId || !form.doctorId || !form.date || !form.time}
              >
                {saving ? <span className="spinner" /> : null}
                {saving ? "Scheduling…" : "Schedule appointment"}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-group">
            <label className="form-label" htmlFor="patient">
              Patient <span className="req">*</span>
            </label>
            <select id="patient" className="input" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
              <option value="">Choose a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.reference}
                </option>
              ))}
            </select>
            {patients.length === 0 ? (
              <div className="form-hint">No patients registered yet. Register one from the Patients page first.</div>
            ) : null}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="clinician">
                Clinician <span className="req">*</span>
              </label>
              <select id="clinician" className="input" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                <option value="">Choose a clinician…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialty}
                  </option>
                ))}
              </select>
              {doctors.length === 0 ? (
                <div className="form-hint">Add a clinician and their availability first.</div>
              ) : null}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="service-optional">Service (optional)</label>
              <select id="service-optional"
                className="input"
                value={form.serviceId}
                onChange={(e) => {
                  const svc = services.find((s) => s.id === e.target.value);
                  setForm({ ...form, serviceId: e.target.value, type: svc ? "Consultation" : form.type });
                }}
              >
                <option value="">No specific service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {money(s.price, "KES")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="date">
                Date <span className="req">*</span>
              </label>
              <input id="date" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="time">
                Time <span className="req">*</span>
              </label>
              <input id="time" className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="type">Type</label>
              <select id="type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Pending</option>
                <option>Confirmed</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reason">Reason</label>
            <input id="reason" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Blood pressure review" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="internal-notes">Internal notes</label>
            <textarea id="internal-notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </Modal>
      ) : null}

      {/* -------------------------------------------------------- details */}
      {selected ? (
        <Modal
          title={`Appointment ${selected.reference}`}
          subtitle={`${selected.patientName} with ${selected.doctorName}`}
          onClose={() => {
            setSelected(null);
            setCancelReason("");
          }}
          footer={
            can("appointments.write") ? (
              <>
                {selected.status === "Pending" ? (
                  <button className="btn btn-success" onClick={() => changeStatus(selected, "Confirmed")}>
                    Confirm
                  </button>
                ) : null}
                {selected.status === "Confirmed" ? (
                  <button className="btn btn-success" onClick={() => changeStatus(selected, "Completed")}>
                    Mark completed
                  </button>
                ) : null}
                {selected.status !== "Cancelled" && selected.status !== "Completed" ? (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (!cancelReason.trim()) {
                        toast.error("Add a short cancellation reason first");
                        return;
                      }
                      void changeStatus(selected, "Cancelled", cancelReason.trim());
                    }}
                  >
                    Cancel appointment
                  </button>
                ) : null}
                <span style={{ flex: 1 }} />
                <button className="btn btn-outline" onClick={() => setSelected(null)}>
                  Close
                </button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            )
          }
        >
          <div className="row" style={{ marginBottom: 14 }}>
            <Badge status={selected.status} />
            <span className="tag">{selected.type}</span>
            <span className="tag">{selected.source === "public" ? "Booked online" : "Booked by staff"}</span>
          </div>
          <div className="summary-line">
            <span>When</span>
            <span>{formatDateTime(selected.slotAt)}</span>
          </div>
          <div className="summary-line">
            <span>Duration</span>
            <span>{selected.durationMinutes} minutes</span>
          </div>
          <div className="summary-line">
            <span>Patient</span>
            <span>
              {selected.patientName} {selected.patientReference ? `(${selected.patientReference})` : ""}
            </span>
          </div>
          <div className="summary-line">
            <span>Contact</span>
            <span>{selected.patientPhone || selected.contactPhone || "—"}</span>
          </div>
          <div className="summary-line">
            <span>Clinician</span>
            <span>
              {selected.doctorName} {selected.doctorSpecialty ? `· ${selected.doctorSpecialty}` : ""}
            </span>
          </div>
          {selected.serviceName ? (
            <div className="summary-line">
              <span>Service</span>
              <span>{selected.serviceName}</span>
            </div>
          ) : null}
          <div className="summary-line">
            <span>Fee</span>
            <span>{money(selected.fee, "KES")}</span>
          </div>
          {selected.reason ? (
            <div className="summary-line">
              <span>Reason</span>
              <span>{selected.reason}</span>
            </div>
          ) : null}
          {selected.notes ? (
            <div className="summary-line">
              <span>Notes</span>
              <span>{selected.notes}</span>
            </div>
          ) : null}

          {can("appointments.write") &&
          selected.status !== "Cancelled" &&
          selected.status !== "Completed" ? (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="cancellation-reason">Cancellation reason</label>
              <input id="cancellation-reason"
                className="input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Patient called to reschedule"
              />
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

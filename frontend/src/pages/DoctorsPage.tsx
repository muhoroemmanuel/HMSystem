import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { money, WEEKDAYS_SHORT } from "../lib/format";
import {
  Avatar,
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

interface Window {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualifications: string;
  bio: string;
  phone: string;
  email: string;
  experienceYears: number;
  consultationFee: number;
  status: "active" | "inactive";
  isPublic: boolean;
  color: string;
  patientCount?: number;
  windows: Window[];
}

const EMPTY = {
  name: "",
  specialty: "",
  qualifications: "",
  bio: "",
  phone: "",
  email: "",
  experienceYears: 0,
  consultationFee: 0,
  status: "active" as "active" | "inactive",
  isPublic: true,
  color: "#185FA5",
  windows: [] as Window[],
};

export default function DoctorsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<{ doctors: Doctor[] }>("/doctors");
      setDoctors(data.doctors);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = doctors.filter(
    (d) =>
      (status === "All" || (status === "active" ? d.status === "active" : d.status === "inactive")) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.specialty.toLowerCase().includes(search.toLowerCase())),
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, windows: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }] });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setForm({
      name: d.name,
      specialty: d.specialty,
      qualifications: d.qualifications,
      bio: d.bio,
      phone: d.phone,
      email: d.email,
      experienceYears: d.experienceYears,
      consultationFee: d.consultationFee,
      status: d.status,
      isPublic: d.isPublic,
      color: d.color,
      windows: d.windows.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })),
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setFormError("");
    const invalid = form.windows.find((w) => w.endTime <= w.startTime);
    if (invalid) {
      setFormError("Each availability window must end after it starts.");
      setSaving(false);
      return;
    }
    try {
      const payload = { ...form, email: form.email || undefined };
      if (editing) {
        await api.patch(`/doctors/${editing.id}`, payload);
        toast.success(`${form.name} updated`);
      } else {
        await api.post("/doctors", payload);
        toast.success(`${form.name} added`);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(weekday: number) {
    const existing = form.windows.filter((w) => w.weekday === weekday);
    if (existing.length) {
      setForm({ ...form, windows: form.windows.filter((w) => w.weekday !== weekday) });
    } else {
      setForm({
        ...form,
        windows: [...form.windows, { weekday, startTime: "09:00", endTime: "17:00" }].sort(
          (a, b) => a.weekday - b.weekday,
        ),
      });
    }
  }

  function updateWindow(weekday: number, patch: Partial<Window>) {
    setForm({
      ...form,
      windows: form.windows.map((w) => (w.weekday === weekday ? { ...w, ...patch } : w)),
    });
  }

  return (
    <>
      <PageHeader
        title="Clinicians"
        subtitle={`${doctors.length} on record · availability drives online booking`}
        actions={
          can("doctors.write") ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={15} /> Add clinician
            </button>
          ) : null
        }
      />

      <div className="filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or specialty…" width={280} />
        <Tabs
          options={[
            { key: "All", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <PageLoader label="Loading clinicians…" />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🩺"
            title="No clinicians yet"
            hint="Add each clinician and their weekly availability. Until that is done nobody can be booked — online or at reception."
            action={
              can("doctors.write") ? (
                <button className="btn btn-primary btn-sm" onClick={openCreate}>
                  Add the first clinician
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((d) => (
            <div className="card" key={d.id}>
              <div className="card-body">
                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <Avatar name={d.name} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <h3 style={{ fontSize: 15 }}>{d.name}</h3>
                      <Badge status={d.status === "active" ? "active" : "inactive"} />
                      {d.isPublic ? <span className="tag">On website</span> : null}
                    </div>
                    <div className="small" style={{ color: "var(--blue-600)", fontWeight: 600 }}>
                      {d.specialty}
                    </div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {d.qualifications || `${d.experienceYears} years experience`}
                      {d.phone ? ` · ${d.phone}` : ""}
                    </div>
                  </div>
                </div>

                <div className="divider" />
                <div className="small strong" style={{ marginBottom: 7 }}>
                  Weekly availability
                </div>
                {d.windows.length === 0 ? (
                  <div className="small" style={{ color: "var(--amber-600)" }}>
                    No availability set — this clinician cannot be booked.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {d.windows.map((w) => (
                      <span key={`${w.weekday}-${w.startTime}`} className="tag" style={{ background: "var(--blue-050)", color: "var(--blue-700)" }}>
                        {WEEKDAYS_SHORT[w.weekday]} {w.startTime}–{w.endTime}
                      </span>
                    ))}
                  </div>
                )}

                <div className="divider" />
                <div className="row" style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
                  <span>
                    👤 <strong>{d.patientCount ?? 0}</strong> patients
                  </span>
                  <span>
                    💳 <strong>{money(d.consultationFee, "KES")}</strong> consult
                  </span>
                  <span className="spacer" />
                  {can("doctors.write") ? (
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <Modal
          title={editing ? `Edit ${editing.name}` : "Add a clinician"}
          subtitle="Availability controls which slots patients can book"
          onClose={() => setShowForm(false)}
          wide
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.specialty.trim()}>
                {saving ? <span className="spinner" /> : null}
                {saving ? "Saving…" : "Save clinician"}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="full-name">
                Full name <span className="req">*</span>
              </label>
              <input id="full-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Amina Wanjiru" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="specialty">
                Specialty <span className="req">*</span>
              </label>
              <input id="specialty" className="input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Internal Medicine" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone</label>
              <input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="years-of-experience">Years of experience</label>
              <input id="years-of-experience"
                className="input"
                type="number"
                min={0}
                max={70}
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="consultation-fee-kes">Consultation fee (KES)</label>
              <input id="consultation-fee-kes"
                className="input"
                type="number"
                min={0}
                value={form.consultationFee}
                onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qualifications">Qualifications</label>
            <input id="qualifications" className="input" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="MBChB, MMed (Internal Medicine)" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="short-bio-shown-on-the-website">Short bio (shown on the website)</label>
            <textarea id="short-bio-shown-on-the-website" className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="status-visibility">Status & visibility</label>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <select id="status-visibility" className="input" style={{ maxWidth: 160 }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="checkbox" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
                <span>Show this clinician on the public website</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weekly availability</label>
            <div className="small muted" style={{ marginBottom: 9 }}>
              Tick the days this clinician holds clinic, then set the hours.
            </div>
            {WEEKDAYS_SHORT.map((label, weekday) => {
              const win = form.windows.find((w) => w.weekday === weekday);
              return (
                <div key={weekday} className="row" style={{ gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${win ? "btn-primary" : "btn-outline"}`}
                    style={{ minWidth: 62 }}
                    onClick={() => toggleDay(weekday)}
                  >
                    {label}
                  </button>
                  {win ? (
                    <>
                      <input
                        className="input"
                        type="time"
                        style={{ maxWidth: 130 }}
                        value={win.startTime}
                        onChange={(e) => updateWindow(weekday, { startTime: e.target.value })}
                      />
                      <span className="muted small">to</span>
                      <input
                        className="input"
                        type="time"
                        style={{ maxWidth: 130 }}
                        value={win.endTime}
                        onChange={(e) => updateWindow(weekday, { endTime: e.target.value })}
                      />
                    </>
                  ) : (
                    <span className="small muted">Not available</span>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

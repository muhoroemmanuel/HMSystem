import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDateTime, money } from "../lib/format";
import {
  Avatar,
  Badge,
  DetailRow,
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

interface Patient {
  id: string;
  reference: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  age: number | null;
  phone: string;
  email: string | null;
  bloodGroup: string;
  primaryCondition: string;
  allergies: string;
  address: string;
  notes: string;
  status: "Active" | "Inactive";
  assignedDoctorId: string | null;
  assignedDoctorName: string | null;
  lastVisitAt: string | null;
  appointmentCount?: number;
  outstandingBalance?: number;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  gender: "Female" as "Male" | "Female" | "Other",
  birthDate: "",
  phone: "",
  email: "",
  bloodGroup: "Unknown",
  primaryCondition: "",
  allergies: "",
  address: "",
  notes: "",
  status: "Active" as "Active" | "Inactive",
  assignedDoctorId: "" as string,
};

const BLOOD_GROUPS = ["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<Patient | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "All") params.set("status", status);
      const data = await api.get<{ patients: Patient[] }>(`/patients?${params}`);
      setPatients(data.patients);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api
      .get<{ doctors: Doctor[] }>("/doctors")
      .then((d) => setDoctors(d.doctors))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender as any,
      birthDate: p.birthDate || "",
      phone: p.phone,
      email: p.email || "",
      bloodGroup: p.bloodGroup,
      primaryCondition: p.primaryCondition,
      allergies: p.allergies,
      address: p.address,
      notes: p.notes,
      status: p.status,
      assignedDoctorId: p.assignedDoctorId || "",
    });
    setFormError("");
    setShowForm(true);
  };

  async function save() {
    setSaving(true);
    setFormError("");
    const payload = {
      ...form,
      email: form.email || undefined,
      birthDate: form.birthDate || undefined,
      assignedDoctorId: form.assignedDoctorId || null,
    };
    try {
      if (editing) {
        await api.patch(`/patients/${editing.id}`, payload);
        toast.success(`${form.firstName} ${form.lastName} updated`);
      } else {
        await api.post("/patients", payload);
        toast.success(`${form.firstName} ${form.lastName} registered`);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(p: Patient) {
    setSelected(p);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api.get(`/patients/${p.id}`);
      setDetail(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function archive(p: Patient) {
    if (!window.confirm(`Archive ${p.name}? This removes their record and history.`)) return;
    try {
      await api.del(`/patients/${p.id}`);
      toast.success("Patient archived");
      setSelected(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Patient registry"
        subtitle={`${patients.length} patient${patients.length === 1 ? "" : "s"} shown`}
        actions={
          can("patients.write") ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={15} /> Register patient
            </button>
          ) : null
        }
      />

      <div className="filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, ID or phone…" width={290} />
        <Tabs
          options={[
            { key: "All", label: "All" },
            { key: "Active", label: "Active" },
            { key: "Inactive", label: "Inactive" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card-flush">
        {loading ? (
          <PageLoader label="Loading patients…" />
        ) : patients.length === 0 ? (
          <EmptyState
            icon="🧑‍🤝‍🧑"
            title="No patients yet"
            hint="Register your first patient, or they will appear here automatically when someone books online."
            action={
              can("patients.write") ? (
                <button className="btn btn-primary btn-sm" onClick={openCreate}>
                  Register a patient
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>ID</th>
                  <th>Age</th>
                  <th>Blood</th>
                  <th>Condition</th>
                  <th>Clinician</th>
                  <th>Last visit</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="row" style={{ gap: 9 }}>
                        <Avatar name={p.name} />
                        <div style={{ minWidth: 0 }}>
                          <div className="strong" style={{ fontSize: 13 }}>
                            {p.name}
                          </div>
                          <div className="small muted">{p.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="mono">{p.reference}</code>
                    </td>
                    <td>{p.age !== null ? `${p.age}y` : "—"}</td>
                    <td>
                      <span className="tag" style={{ background: "var(--red-050)", color: "var(--red-600)" }}>
                        {p.bloodGroup}
                      </span>
                    </td>
                    <td style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.primaryCondition || "—"}
                    </td>
                    <td className="small">{p.assignedDoctorName || "Unassigned"}</td>
                    <td className="small">{formatDate(p.lastVisitAt)}</td>
                    <td>
                      <Badge status={p.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => openDetail(p)}>
                          View
                        </button>
                        {can("patients.write") ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- form */}
      {showForm ? (
        <Modal
          title={editing ? "Edit patient" : "Register a patient"}
          subtitle={editing ? editing.name : "A patient number is assigned automatically"}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()}
              >
                {saving ? <span className="spinner" /> : null}
                {saving ? "Saving…" : editing ? "Save changes" : "Register patient"}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="first-name">
                First name <span className="req">*</span>
              </label>
              <input id="first-name" className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="last-name">
                Last name <span className="req">*</span>
              </label>
              <input id="last-name" className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone <span className="req">*</span></label>
              <input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gender">Gender</label>
              <select id="gender" className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as any })}>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="date-of-birth">Date of birth</label>
              <input id="date-of-birth" className="input" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="blood-group">Blood group</label>
              <select id="blood-group" className="input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                {BLOOD_GROUPS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="assigned-clinician">Assigned clinician</label>
            <select id="assigned-clinician" className="input" value={form.assignedDoctorId} onChange={(e) => setForm({ ...form, assignedDoctorId: e.target.value })}>
              <option value="">Unassigned</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="primary-condition">Primary condition</label>
            <input id="primary-condition" className="input" value={form.primaryCondition} onChange={(e) => setForm({ ...form, primaryCondition: e.target.value })} placeholder="e.g. Hypertension" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="allergies">Allergies</label>
            <input id="allergies" className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. Penicillin" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <input id="address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="notes">Notes</label>
            <textarea id="notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </Modal>
      ) : null}

      {/* -------------------------------------------------------- detail */}
      {selected ? (
        <Modal
          title={selected.name}
          subtitle={`${selected.reference} · ${selected.gender}${selected.age !== null ? `, ${selected.age} years` : ""}`}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          wide
          footer={
            <>
              {can("patients.write") ? (
                <button className="btn btn-danger btn-sm" onClick={() => archive(selected)}>
                  Archive
                </button>
              ) : null}
              <span style={{ flex: 1 }} />
              {can("patients.write") ? (
                <button className="btn btn-outline" onClick={() => { setSelected(null); openEdit(selected); }}>
                  Edit details
                </button>
              ) : null}
              <button
                className="btn btn-outline"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
              >
                Close
              </button>
            </>
          }
        >
          {detailLoading ? (
            <PageLoader label="Loading full record…" />
          ) : !detail ? null : (
            <>
              <div className="grid-2" style={{ marginBottom: 4 }}>
                <div>
                  <DetailRow label="Phone" value={detail.patient.phone} />
                  <DetailRow label="Email" value={detail.patient.email || "—"} />
                  <DetailRow label="Blood group" value={detail.patient.bloodGroup} />
                  <DetailRow label="Date of birth" value={formatDate(detail.patient.birthDate)} />
                  <DetailRow label="Allergies" value={detail.patient.allergies || "None recorded"} />
                </div>
                <div>
                  <DetailRow label="Clinician" value={detail.patient.assignedDoctorName || "Unassigned"} />
                  <DetailRow label="Condition" value={detail.patient.primaryCondition || "—"} />
                  <DetailRow label="Last visit" value={formatDate(detail.patient.lastVisitAt)} />
                  <DetailRow
                    label="Outstanding"
                    value={
                      <span style={{ color: detail.patient.outstandingBalance > 0 ? "var(--red-600)" : "inherit" }}>
                        {money(
                          detail.invoices.reduce((s: number, i: any) => s + (i.status === "Paid" || i.status === "Void" ? 0 : i.balance), 0),
                          "KES",
                        )}
                      </span>
                    }
                  />
                  <DetailRow label="Address" value={detail.patient.address || "—"} />
                </div>
              </div>

              <div className="divider" />
              <h4 style={{ fontSize: 13.5, marginBottom: 10 }}>Appointment history</h4>
              {detail.appointments.length === 0 ? (
                <p className="small muted">No appointments recorded.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Clinician</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.appointments.slice(0, 6).map((a: any) => (
                        <tr key={a.id}>
                          <td className="small">{formatDateTime(a.slotAt)}</td>
                          <td className="small">{a.doctorName}</td>
                          <td className="small">{a.type}</td>
                          <td>
                            <Badge status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="divider" />
              <h4 style={{ fontSize: 13.5, marginBottom: 10 }}>Invoices</h4>
              {detail.invoices.length === 0 ? (
                <p className="small muted">No invoices raised.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Issued</th>
                        <th className="num">Total</th>
                        <th className="num">Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.invoices.slice(0, 6).map((i: any) => (
                        <tr key={i.id}>
                          <td>
                            <code className="mono">{i.reference}</code>
                          </td>
                          <td className="small">{formatDate(i.issuedAt)}</td>
                          <td className="num">{money(i.total, "KES")}</td>
                          <td className="num">{money(i.balance, "KES")}</td>
                          <td>
                            <Badge status={i.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="divider" />
              <h4 style={{ fontSize: 13.5, marginBottom: 10 }}>Prescriptions</h4>
              {detail.prescriptions.length === 0 ? (
                <p className="small muted">No prescriptions recorded.</p>
              ) : (
                detail.prescriptions.slice(0, 4).map((rx: any) => (
                  <div key={rx.id} className="stat-row">
                    <div style={{ flex: 1 }}>
                      <div className="strong small">
                        {rx.reference} · {formatDate(rx.issuedAt)}
                      </div>
                      <div className="small muted">
                        {rx.items?.map((it: any) => `${it.drugName} ×${it.quantity}`).join(", ") || "—"}
                      </div>
                    </div>
                    <Badge status={rx.status} />
                  </div>
                ))
              )}
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}

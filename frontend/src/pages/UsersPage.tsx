import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDateTime, timeAgo } from "../lib/format";
import {
  Avatar,
  Badge,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  PageLoader,
  Tabs,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId: string;
  status: "active" | "suspended";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

interface AuditEntry {
  id: number;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

const ROLES = ["admin", "doctor", "receptionist", "billing", "pharmacist"];

export default function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState("staff");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "receptionist", password: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, r] = await Promise.all([
        api.get<{ users: User[] }>("/users"),
        api.get<{ roles: Role[] }>("/users/roles"),
      ]);
      setUsers(u.users);
      setRoles(r.roles);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "audit") return;
    api
      .get<{ entries: AuditEntry[] }>("/users/audit?limit=120")
      .then((d) => setAudit(d.entries))
      .catch((err) => setError(err.message));
  }, [tab]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", role: "receptionist", password: "" });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role, password: "" });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          name: form.name,
          phone: form.phone,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success("Staff account updated");
      } else {
        await api.post("/users", form);
        toast.success("Staff account created — share the password securely");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(u: User) {
    const next = u.status === "active" ? "suspended" : "active";
    if (!window.confirm(`${next === "suspended" ? "Suspend" : "Reactivate"} ${u.name}'s account?`)) return;
    try {
      await api.patch(`/users/${u.id}`, { status: next });
      toast.success(`Account ${next}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Who can sign in, and what they are allowed to do"
        actions={
          <>
            <Tabs
              options={[
                { key: "staff", label: "Accounts", count: users.length },
                { key: "roles", label: "Roles", count: roles.length },
                { key: "audit", label: "Audit log" },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "staff" ? (
              <button className="btn btn-primary" onClick={openCreate}>
                <Icon name="plus" size={15} /> Add staff
              </button>
            ) : null}
          </>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? <PageLoader label="Loading accounts…" /> : null}

      {!loading && tab === "staff" ? (
        <div className="card card-flush">
          {users.length === 0 ? (
            <EmptyState icon="👥" title="No staff accounts" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Last sign-in</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row" style={{ gap: 9 }}>
                          <Avatar name={u.name} />
                          <div>
                            <div className="strong" style={{ fontSize: 13 }}>
                              {u.name}
                              {u.id === currentUser?.id ? <span className="small muted"> (you)</span> : null}
                            </div>
                            {u.phone ? <div className="small muted">{u.phone}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="small">{u.email}</td>
                      <td>
                        <Badge status={u.role} label={u.role} />
                      </td>
                      <td className="small">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                      <td>
                        <Badge status={u.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>
                            Edit
                          </button>
                          {u.id !== currentUser?.id ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(u)}>
                              {u.status === "active" ? "Suspend" : "Reactivate"}
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
      ) : null}

      {!loading && tab === "roles" ? (
        <div className="grid-2">
          {roles.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-body">
                <div className="row" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14.5, textTransform: "capitalize" }}>{r.name}</h3>
                  {r.isSystem ? <span className="tag">System</span> : null}
                </div>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  {r.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {r.permissions.length === 0 ? (
                    <span className="small muted">No module access</span>
                  ) : (
                    r.permissions.map((p) => (
                      <span key={p} className="tag" style={{ background: "var(--blue-050)", color: "var(--blue-700)" }}>
                        {p}
                      </span>
                    ))
                  )}
                </div>
                <div className="divider" />
                <div className="small muted">
                  {users.filter((u) => u.role === r.name).length} account
                  {users.filter((u) => u.role === r.name).length === 1 ? "" : "s"} with this role
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === "audit" ? (
        <div className="card card-flush">
          {audit.length === 0 ? (
            <EmptyState icon="📜" title="No activity recorded yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id}>
                      <td className="small" title={formatDateTime(e.createdAt)}>
                        {timeAgo(e.createdAt)}
                      </td>
                      <td className="small strong">{e.userName}</td>
                      <td>
                        <span className="tag">{e.action}</span>
                      </td>
                      <td className="small">{e.entity}</td>
                      <td className="small muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {Object.keys(e.detail || {}).length ? JSON.stringify(e.detail) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {showForm ? (
        <Modal
          title={editing ? `Edit ${editing.name}` : "Add a staff account"}
          subtitle={editing ? "Leave the password blank to keep the current one" : "Passwords must be at least 10 characters"}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !form.name.trim() || (!editing && (!form.email.trim() || form.password.length < 10))}
              >
                {saving ? <span className="spinner" /> : null}
                {saving ? "Saving…" : editing ? "Save changes" : "Create account"}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-group">
            <label className="form-label" htmlFor="full-name">
              Full name <span className="req">*</span>
            </label>
            <input id="full-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email <span className="req">*</span>
            </label>
            <input id="email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={Boolean(editing)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone</label>
              <input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="role">Role</label>
              <select id="role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="field">
              {editing ? "New password (optional)" : "Temporary password"}
            </label>
            <input id="field"
              className="input"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "Leave blank to keep current" : "At least 10 characters"}
            />
            <div className="form-hint">Share it privately. The user is prompted to change it after signing in.</div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { money } from "../lib/format";
import { Badge, EmptyState, Icon, Modal, PageHeader, PageLoader } from "../components/ui";
import { useToast } from "../context/ToastContext";

interface Service {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  price: number;
  durationMinutes: number;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY = {
  name: "",
  summary: "",
  description: "",
  category: "General",
  price: 0,
  durationMinutes: 30,
  icon: "🩺",
  isActive: true,
  sortOrder: 0,
};

export default function ServicesPage() {
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ services: Service[] }>("/settings/services");
      setServices(data.services);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: services.length + 1 });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      summary: s.summary,
      description: s.description,
      category: s.category,
      price: s.price,
      durationMinutes: s.durationMinutes,
      icon: s.icon,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.patch(`/settings/services/${editing.id}`, form);
        toast.success("Service updated");
      } else {
        await api.post("/settings/services", form);
        toast.success("Service added — it is live on the website");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api.patch(`/settings/services/${s.id}`, { isActive: !s.isActive });
      toast.success(s.isActive ? `${s.name} hidden from the website` : `${s.name} published`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Service catalogue"
        subtitle="These are the services shown on your public website and offered when booking"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={15} /> Add service
          </button>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <PageLoader label="Loading services…" />
      ) : services.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🩺"
            title="No services yet"
            hint="Add the services your clinic offers — patients pick from this list when booking online."
            action={
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                Add the first service
              </button>
            }
          />
        </div>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th>Duration</th>
                  <th>Website</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="strong" style={{ fontSize: 13 }}>
                        {s.icon} {s.name}
                      </div>
                      <div className="small muted">{s.summary}</div>
                    </td>
                    <td>
                      <span className="tag">{s.category}</span>
                    </td>
                    <td className="num">{s.price > 0 ? money(s.price, "KES") : "Free"}</td>
                    <td className="small">{s.durationMinutes} min</td>
                    <td>
                      <Badge status={s.isActive ? "Active" : "Inactive"} label={s.isActive ? "Published" : "Hidden"} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(s)}>
                          {s.isActive ? "Hide" : "Publish"}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm ? (
        <Modal
          title={editing ? `Edit ${editing.name}` : "Add a service"}
          subtitle="Published services appear on the public website immediately"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <span className="spinner" /> : null}
                {saving ? "Saving…" : "Save service"}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="service-name">
                Service name <span className="req">*</span>
              </label>
              <input id="service-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="General Consultation" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <input id="category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Primary Care" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="short-summary-shown-on-cards">Short summary (shown on cards)</label>
            <input id="short-summary-shown-on-cards" className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="See a doctor about any new or ongoing concern." />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="full-description">Full description</label>
            <textarea id="full-description" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="price-kes">Price (KES)</label>
              <input id="price-kes" className="input" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="duration-minutes">Duration (minutes)</label>
              <input id="duration-minutes" className="input" type="number" min={5} max={480} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) || 30 })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="icon-emoji">Icon (emoji)</label>
              <input id="icon-emoji" className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="display-order">Display order</label>
              <input id="display-order" className="input" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <span>Show this service on the public website and allow online booking</span>
          </label>
        </Modal>
      ) : null}
    </>
  );
}

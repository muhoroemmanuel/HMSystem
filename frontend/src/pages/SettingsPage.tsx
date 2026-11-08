import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { WEEKDAYS_SHORT } from "../lib/format";
import { Icon, PageHeader, PageLoader } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface Settings {
  clinicName: string;
  tagline: string;
  about: string;
  location: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  currency: string;
  vatRate: number;
  defaultSlotMinutes: number;
  timezone: string;
  mpesaPaybill: string;
  openingHours: Record<string, { open?: string; close?: string }>;
  bookingLeadDays: number;
}

const EMPTY: Settings = {
  clinicName: "",
  tagline: "",
  about: "",
  location: "",
  address: "",
  phone: "",
  emergencyPhone: "",
  email: "",
  currency: "KES",
  vatRate: 0.16,
  defaultSlotMinutes: 30,
  timezone: "Africa/Nairobi",
  mpesaPaybill: "",
  openingHours: {},
  bookingLeadDays: 30,
};

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    api
      .get<{ settings: Settings | null }>("/settings")
      .then((d) => {
        if (d.settings) setForm({ ...EMPTY, ...d.settings });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await api.put<{ settings: Settings }>("/settings", form);
      setForm({ ...EMPTY, ...data.settings });
      toast.success("Clinic settings saved");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwdError("");
    if (pwd.newPassword !== pwd.confirm) {
      setPwdError("The new passwords do not match");
      return;
    }
    setPwdBusy(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      });
      toast.success("Password changed — please sign in again on your next visit");
      setPwd({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setPwdError((err as ApiError).message);
    } finally {
      setPwdBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading clinic settings…" />;

  return (
    <>
      <PageHeader
        title="Clinic settings"
        subtitle="These details power the public website, invoices and opening hours"
        actions={
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : <Icon name="check" size={15} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Identity</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="clinic-name">Clinic name</label>
              <input id="clinic-name" className="input" value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tagline-hero-headline">Tagline (hero headline)</label>
              <input id="tagline-hero-headline" className="input" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Compassionate care, close to home" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="about-the-clinic">About the clinic</label>
              <textarea id="about-the-clinic"
                className="input"
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                placeholder="A short paragraph shown on the homepage."
                style={{ minHeight: 100 }}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="town-region">Town / region</label>
                <input id="town-region" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="street-address">Street address</label>
                <input id="street-address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Contact</span>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="main-phone">Main phone</label>
                <input id="main-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emergency-line">Emergency line</label>
                <input id="emergency-line" className="input" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="m-pesa-paybill">M-Pesa paybill</label>
                <input id="m-pesa-paybill" className="input" value={form.mpesaPaybill} onChange={(e) => setForm({ ...form, mpesaPaybill: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="currency">Currency</label>
                <select id="currency" className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {["KES", "UGX", "TZS", "USD", "EUR", "GBP"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="form-label">Opening hours</label>
            {DAY_KEYS.map((day) => {
              const window = form.openingHours[day] || {};
              const open = window.open || "";
              return (
                <div key={day} className="row" style={{ gap: 8, marginBottom: 7 }}>
                  <span className="small strong" style={{ minWidth: 34 }}>
                    {day}
                  </span>
                  <input
                    className="input"
                    type="time"
                    style={{ maxWidth: 122 }}
                    value={open}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        openingHours: {
                          ...form.openingHours,
                          [day]: { ...window, open: e.target.value },
                        },
                      })
                    }
                  />
                  <span className="muted small">to</span>
                  <input
                    className="input"
                    type="time"
                    style={{ maxWidth: 122 }}
                    value={window.close || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        openingHours: {
                          ...form.openingHours,
                          [day]: { ...window, close: e.target.value },
                        },
                      })
                    }
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const next = { ...form.openingHours };
                      delete next[day];
                      setForm({ ...form, openingHours: next });
                    }}
                    aria-label={`Clear ${day}`}
                  >
                    Clear
                  </button>
                </div>
              );
            })}
            <div className="form-hint">Leave a day blank to mark it closed.</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Booking & billing</span>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="appointment-slot-minutes">Appointment slot (minutes)</label>
                <input id="appointment-slot-minutes"
                  className="input"
                  type="number"
                  min={5}
                  max={240}
                  value={form.defaultSlotMinutes}
                  onChange={(e) => setForm({ ...form, defaultSlotMinutes: Number(e.target.value) || 30 })}
                />
                <div className="form-hint">Used to generate bookable times from clinician availability.</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vat-rate">VAT rate</label>
                <input id="vat-rate"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={Math.round(form.vatRate * 10000) / 100}
                  onChange={(e) => setForm({ ...form, vatRate: (Number(e.target.value) || 0) / 100 })}
                />
                <div className="form-hint">Applies to invoices and pharmacy sales ({Math.round(form.vatRate * 100)}%).</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="timezone">Timezone</label>
                <input id="timezone" className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                <div className="form-hint">IANA name, e.g. Africa/Nairobi.</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="booking-window-days-ahead">Booking window (days ahead)</label>
                <input id="booking-window-days-ahead"
                  className="input"
                  type="number"
                  min={1}
                  max={365}
                  value={form.bookingLeadDays}
                  onChange={(e) => setForm({ ...form, bookingLeadDays: Number(e.target.value) || 30 })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Your password</span>
          </div>
          <div className="card-body">
            <p className="small muted" style={{ marginBottom: 14 }}>
              Signed in as <strong>{user?.email}</strong>. Changing your password signs out every other
              device.
            </p>
            {pwdError ? <div className="alert alert-error">{pwdError}</div> : null}
            <div className="form-group">
              <label className="form-label" htmlFor="current-password">Current password</label>
              <input id="current-password"
                className="input"
                type="password"
                value={pwd.currentPassword}
                onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
                autoComplete="current-password"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New password</label>
                <input id="new-password"
                  className="input"
                  type="password"
                  value={pwd.newPassword}
                  onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-new-password">Confirm new password</label>
                <input id="confirm-new-password"
                  className="input"
                  type="password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              className="btn btn-outline"
              onClick={changePassword}
              disabled={pwdBusy || !pwd.currentPassword || pwd.newPassword.length < 10}
            >
              {pwdBusy ? <span className="spinner spinner-dark" /> : null}
              {pwdBusy ? "Updating…" : "Change password"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

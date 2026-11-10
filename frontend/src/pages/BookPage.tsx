import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { money } from "../lib/format";
import { Icon } from "../components/ui";

interface Service {
  id: string;
  name: string;
  summary: string;
  description: string;
  price: number;
  durationMinutes: number;
  icon: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  experienceYears: number;
  consultationFee: number;
}

interface SiteSettings {
  clinicName: string;
  currency: string;
  phone: string;
  defaultSlotMinutes: number;
}

interface DaySlots {
  date: string;
  weekday: number;
  slots: string[];
}

interface Confirmation {
  appointment: {
    reference: string;
    date: string;
    time: string;
    doctorName: string;
    serviceName: string;
    status: string;
  };
  patient: { reference: string; name: string };
  message: string;
}

const STEPS = ["Service", "Doctor", "Date & time", "Your details"];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m || 1) - 1, d || 1);
  return { dow: DOW[date.getDay()], day: d!, month: MONTHS[(m || 1) - 1], weekday: date.getDay() };
}

export default function BookPage() {
  const [params] = useSearchParams();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingSite, setLoadingSite] = useState(true);
  // A failed request and an empty catalogue are different problems: one means
  // "we could not ask", the other "the clinic has not added anything yet".
  // Showing both at once told patients there were no services when in fact the
  // API was unreachable.
  const [loadFailed, setLoadFailed] = useState(false);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>(params.get("service") || "");
  const [doctorId, setDoctorId] = useState<string>("");

  const [days, setDays] = useState<DaySlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    gender: "Female" as "Male" | "Female" | "Other",
    birthDate: "",
    reason: "",
    consent: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    api
      .get<{ settings: SiteSettings | null; services: Service[]; doctors: Doctor[] }>("/public/site")
      .then((data) => {
        setSettings(data.settings);
        setServices(data.services);
        setDoctors(data.doctors);
        if (data.settings) {
          document.title = `Book an appointment · ${data.settings.clinicName}`;
        }
      })
      .catch((err) => {
        setLoadFailed(true);
        setError(err.message);
      })
      .finally(() => setLoadingSite(false));
  }, []);

  const service = services.find((s) => s.id === serviceId) || null;
  const doctor = doctors.find((d) => d.id === doctorId) || null;

  // Load availability whenever a doctor is chosen.
  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setDays([]);
    setDate("");
    setTime("");
    api
      .get<{ days: DaySlots[] }>(`/public/availability/${doctorId}?days=21`)
      .then((data) => {
        if (cancelled) return;
        setDays(data.days);
        if (data.days[0]) setDate(data.days[0].date);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  const slotsForDate = useMemo(() => days.find((d) => d.date === date)?.slots ?? [], [days, date]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(serviceId);
    if (step === 1) return Boolean(doctorId);
    if (step === 2) return Boolean(date && time);
    return Boolean(form.firstName.trim() && form.lastName.trim() && form.phone.trim() && form.consent);
  }, [step, serviceId, doctorId, date, time, form]);

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const data = await api.post<Confirmation>("/public/book", {
        doctorId,
        serviceId: serviceId || undefined,
        date,
        time,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        reason: form.reason,
        consent: form.consent,
      });
      setConfirmation(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      // The chosen slot may have been taken while filling in details.
      if (e.status === 400 && /slot/i.test(e.message)) {
        setTime("");
        setStep(2);
        if (doctorId) {
          const refreshed = await api
            .get<{ days: DaySlots[] }>(`/public/availability/${doctorId}?days=21`)
            .catch(() => null);
          if (refreshed) setDays(refreshed.days);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    const c = confirmation.appointment;
    const d = dayLabel(c.date);
    return (
      <div className="booking-page">
        <div className="booking-wrap" style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="success-panel">
              <div className="success-icon">
                <Icon name="check" size={28} />
              </div>
              <h1 style={{ fontSize: 22 }}>Appointment requested</h1>
              <p style={{ color: "var(--ink-500)", marginTop: 6, fontSize: 13.5 }}>{confirmation.message}</p>

              <div className="confirm-box">
                <div className="summary-line">
                  <span>Reference</span>
                  <span className="mono strong">{c.reference}</span>
                </div>
                <div className="summary-line">
                  <span>When</span>
                  <span>
                    {d.dow} {d.day} {d.month} · {c.time}
                  </span>
                </div>
                <div className="summary-line">
                  <span>Clinician</span>
                  <span>{c.doctorName}</span>
                </div>
                <div className="summary-line">
                  <span>Service</span>
                  <span>{c.serviceName}</span>
                </div>
                <div className="summary-line">
                  <span>Status</span>
                  <span style={{ color: "var(--amber-600)", fontWeight: 600 }}>Awaiting confirmation</span>
                </div>
              </div>

              <div className="alert alert-info" style={{ textAlign: "left" }}>
                <span>💡</span>
                <span>
                  Keep your reference <strong className="mono">{c.reference}</strong>. You can check the
                  status any time on the{" "}
                  <Link to="/my-appointment">booking lookup</Link> page.
                </span>
              </div>

              <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
                <Link className="btn btn-outline" to="/">
                  Back to home
                </Link>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setConfirmation(null);
                    setStep(0);
                    setTime("");
                    setForm({
                      firstName: "",
                      lastName: "",
                      phone: "",
                      email: "",
                      gender: "Female",
                      birthDate: "",
                      reason: "",
                      consent: false,
                    });
                  }}
                >
                  Book another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <Link className="brand-row" to="/" style={{ color: "inherit" }}>
            <span className="brand-mark" style={{ color: "#fff" }}>
              <Icon name="stethoscope" size={19} />
            </span>
            <span>
              <span className="brand-name" style={{ color: "var(--ink-900)" }}>
                {settings?.clinicName || "MedCore Clinic"}
              </span>
              <span className="brand-sub" style={{ color: "var(--ink-400)" }}>
                Appointment booking
              </span>
            </span>
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/my-appointment">
            Check an existing booking
          </Link>
        </div>

        <div className="booking-head">
          <h1>Book an appointment</h1>
          <p>Choose a service and a time that works for you. We'll call to confirm.</p>
        </div>

        <div className="steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => {
                if (i < step) setStep(i);
              }}
              style={{ cursor: i < step ? "pointer" : "default" }}
            >
              <span className="step-num">{i < step ? "✓" : i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        {error ? (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="card">
          <div className="card-body">
            {loadingSite ? (
              <div className="page-loading">
                <span className="spinner spinner-dark" /> Loading…
              </div>
            ) : null}

            {/* STEP 1 — service */}
            {!loadingSite && step === 0 ? (
              <>
                {loadFailed ? (
                  <div className="alert alert-error">
                    <span>⚠️</span>
                    <span>
                      We could not load the booking form. Check your connection and{" "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => window.location.reload()}
                      >
                        try again
                      </button>
                      , or call{" "}
                      {settings?.phone ? (
                        <a href={`tel:${settings.phone}`}>{settings.phone}</a>
                      ) : (
                        "the clinic"
                      )}{" "}
                      to book.
                    </span>
                  </div>
                ) : services.length === 0 ? (
                  <div className="alert alert-info">
                    No services are listed yet. Please call{" "}
                    {settings?.phone ? <a href={`tel:${settings.phone}`}>{settings.phone}</a> : "the clinic"} to
                    book.
                  </div>
                ) : (
                  <div className="choice-grid">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        className={`choice ${serviceId === s.id ? "selected" : ""}`}
                        onClick={() => setServiceId(s.id)}
                      >
                        <div className="choice-name">
                          {s.icon} {s.name}
                        </div>
                        <div className="choice-meta">{s.summary || `${s.durationMinutes} minutes`}</div>
                        <div className="choice-price">
                          {s.price > 0 ? money(s.price, settings?.currency) : "Free"} ·{" "}
                          {s.durationMinutes} min
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {/* STEP 2 — doctor */}
            {!loadingSite && step === 1 ? (
              <>
                {doctors.length === 0 ? (
                  <div className="alert alert-info">
                    Clinician profiles are not published yet. Please call the clinic to book.
                  </div>
                ) : (
                  <div className="choice-grid">
                    {doctors.map((d) => (
                      <button
                        key={d.id}
                        className={`choice ${doctorId === d.id ? "selected" : ""}`}
                        onClick={() => setDoctorId(d.id)}
                      >
                        <div className="choice-name">{d.name}</div>
                        <div className="choice-meta">{d.specialty}</div>
                        <div className="choice-price">{d.experienceYears} yrs experience</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {/* STEP 3 — date + time */}
            {!loadingSite && step === 2 ? (
              <>
                {loadingSlots ? (
                  <div className="page-loading">
                    <span className="spinner spinner-dark" /> Finding open slots…
                  </div>
                ) : days.length === 0 ? (
                  <div className="alert alert-warn">
                    <span>📅</span>
                    <span>
                      {doctor?.name || "This clinician"} has no open slots in the next three weeks. Please
                      choose another clinician
                      {settings?.phone ? (
                        <>
                          , or call <a href={`tel:${settings.phone}`}>{settings.phone}</a>
                        </>
                      ) : null}
                      .
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="form-label">Choose a day</div>
                    <div className="day-list">
                      {days.map((d) => {
                        const l = dayLabel(d.date);
                        return (
                          <button
                            key={d.date}
                            className={`day-chip ${date === d.date ? "selected" : ""}`}
                            onClick={() => {
                              setDate(d.date);
                              setTime("");
                            }}
                          >
                            <div className="day-chip-dow">{l.dow}</div>
                            <div className="day-chip-day">{l.day}</div>
                            <div className="day-chip-count">
                              {d.slots.length} slot{d.slots.length === 1 ? "" : "s"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="form-label" style={{ marginTop: 18 }}>
                      Available times
                    </div>
                    <div className="slot-grid">
                      {slotsForDate.map((s) => (
                        <button
                          key={s}
                          className={`slot ${time === s ? "selected" : ""}`}
                          onClick={() => setTime(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : null}

            {/* STEP 4 — details */}
            {!loadingSite && step === 3 ? (
              <>
                <div className="alert alert-info">
                  <span>🔒</span>
                  <span>
                    We only ask for what we need to register you and reach you about this appointment.
                  </span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="first-name">
                      First name <span className="req">*</span>
                    </label>
                    <input id="first-name"
                      className="input"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="last-name">
                      Last name <span className="req">*</span>
                    </label>
                    <input id="last-name"
                      className="input"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">
                      Phone <span className="req">*</span>
                    </label>
                    <input id="phone"
                      className="input"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+254 7XX XXX XXX"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email-optional">Email (optional)</label>
                    <input id="email-optional"
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="gender">Gender</label>
                    <select id="gender"
                      className="input"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
                    >
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="date-of-birth-optional">Date of birth (optional)</label>
                    <input id="date-of-birth-optional"
                      className="input"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reason-for-visit-optional">Reason for visit (optional)</label>
                  <textarea id="reason-for-visit-optional"
                    className="input"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Briefly describe what brings you in, so the clinician can prepare."
                  />
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  />
                  <span>
                    I agree to {settings?.clinicName || "the clinic"} storing my details to arrange this
                    appointment, and to being contacted about it. <span className="req">*</span>
                  </span>
                </label>

                <div className="divider" />
                <div className="summary-line">
                  <span>Service</span>
                  <span>{service?.name || "Consultation"}</span>
                </div>
                <div className="summary-line">
                  <span>Clinician</span>
                  <span>{doctor?.name || "Next available"}</span>
                </div>
                <div className="summary-line">
                  <span>When</span>
                  <span>
                    {date ? `${dayLabel(date).dow} ${dayLabel(date).day} ${dayLabel(date).month}` : "—"}
                    {time ? ` · ${time}` : ""}
                  </span>
                </div>
                {service && service.price > 0 ? (
                  <div className="summary-line">
                    <span>Indicative fee</span>
                    <span>{money(service.price, settings?.currency)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {step < 3 ? (
            <div className="modal-footer" style={{ borderTop: "1px solid var(--line-soft)" }}>
              {step > 0 ? (
                <button className="btn btn-outline" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              ) : null}
              <button className="btn btn-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
                Continue
              </button>
            </div>
          ) : (
            <div className="modal-footer" style={{ borderTop: "1px solid var(--line-soft)" }}>
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                Back
              </button>
              <button className="btn btn-primary" disabled={!canContinue || submitting} onClick={submit}>
                {submitting ? <span className="spinner" /> : null}
                {submitting ? "Requesting…" : "Request appointment"}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-400)", marginTop: 18 }}>
          For a medical emergency, call{" "}
          {settings?.phone ? <a href={`tel:${settings.phone}`}>{settings.phone}</a> : "the clinic"} or go to
          your nearest emergency department.
        </p>
      </div>
    </div>
  );
}

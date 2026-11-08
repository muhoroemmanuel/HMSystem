import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, initials } from "../lib/format";
import { Icon } from "../components/ui";

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
  openingHours: Record<string, { open?: string; close?: string }>;
}

interface Service {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  price: number;
  durationMinutes: number;
  icon: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualifications: string;
  bio: string;
  experienceYears: number;
  consultationFee: number;
}

const VALUES = [
  {
    icon: "🤝",
    title: "Care that knows your name",
    body: "We keep one record per patient, so every clinician you meet already knows your history.",
  },
  {
    icon: "🔬",
    title: "Same-day diagnostics",
    body: "Most blood and rapid tests are run on site, with results reviewed before you leave.",
  },
  {
    icon: "📱",
    title: "Book in under a minute",
    body: "Choose a service, pick a time that suits you, and we call you back to confirm.",
  },
  {
    icon: "🔒",
    title: "Your records stay private",
    body: "Access is role-based and every change is logged. Your notes are never shared without your consent.",
  },
];

const HOUR_LABELS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export default function LandingPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ settings: Settings | null; services: Service[]; doctors: Doctor[] }>("/public/site")
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setServices(data.services);
        setDoctors(data.doctors);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const clinicName = settings?.clinicName || "MedCore Clinic";
  const hours = settings?.openingHours || {};

  return (
    <div className="landing">
      <nav className="site-nav">
        <div className="site-nav-inner">
          <Link to="/" className="brand-row" style={{ color: "inherit" }}>
            <span className="brand-mark" style={{ color: "#fff" }}>
              <Icon name="stethoscope" size={19} />
            </span>
            <span>
              <span className="brand-name" style={{ color: "var(--ink-900)" }}>
                {clinicName}
              </span>
              <span className="brand-sub" style={{ color: "var(--ink-400)" }}>
                Patient portal
              </span>
            </span>
          </Link>

          <div className="site-links">
            <a className="site-link" href="#services">
              Services
            </a>
            <a className="site-link" href="#team">
              Our team
            </a>
            <a className="site-link" href="#visit">
              Visit us
            </a>
            <Link className="btn btn-outline btn-sm" to="/staff">
              Staff sign in
            </Link>
            <Link className="btn btn-primary btn-sm" to="/book" style={{ marginLeft: 4 }}>
              Book appointment
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-inner">
          <div>
            <span className="hero-badge">
              <span aria-hidden>●</span> Now accepting new patients
            </span>
            <h1>{settings?.tagline || "Care that feels personal, close to home."}</h1>
            <p>
              {settings?.about ||
                `${clinicName} brings together consultations, diagnostics and pharmacy under one roof — with a medical record that follows you across every visit.`}
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/book">
                Book an appointment
              </Link>
              <a className="btn btn-lg" href="#services" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
                See what we offer
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-value">{services.length || 8}</div>
                <div className="hero-stat-label">Services</div>
              </div>
              <div>
                <div className="hero-stat-value">{doctors.length || "—"}</div>
                <div className="hero-stat-label">Clinicians</div>
              </div>
              <div>
                <div className="hero-stat-value">Same day</div>
                <div className="hero-stat-label">Lab results</div>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <h3>Opening hours</h3>
            <div className="hero-card-sub">
              {settings?.address || settings?.location || "Call us to confirm today's hours"}
            </div>
            {Object.keys(hours).length === 0 ? (
              <div className="hero-hours-row">
                <span>Mon – Fri</span>
                <span>8:00 – 17:00</span>
              </div>
            ) : (
              Object.entries(hours).map(([day, window]) => (
                <div className="hero-hours-row" key={day}>
                  <span>{HOUR_LABELS[day] ?? day}</span>
                  <span>
                    {window.open && window.close ? `${window.open} – ${window.close}` : "Closed"}
                  </span>
                </div>
              ))
            )}
            {settings?.phone ? (
              <div style={{ marginTop: 16 }}>
                <a
                  className="btn btn-block"
                  href={`tel:${settings.phone}`}
                  style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
                >
                  📞 {settings.phone}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="section" id="services">
        <div className="section-head">
          <div className="section-eyebrow">What we offer</div>
          <h2>Care for every stage of life</h2>
          <p className="section-lead">
            From a quick consultation to long-term chronic care, our team covers the essentials — and
            refers you onward when something needs a specialist we don't have.
          </p>
        </div>

        {loading ? (
          <div className="page-loading">
            <span className="spinner spinner-dark" /> Loading services…
          </div>
        ) : error ? (
          <div className="alert alert-error">We could not load our services right now. {error}</div>
        ) : services.length === 0 ? (
          <div className="alert alert-info">
            Our service list is being updated. Please call us and we'll help you book the right
            appointment.
          </div>
        ) : (
          <div className="service-grid">
            {services.map((s) => (
              <div className="service-card" key={s.id}>
                <div className="service-icon">{s.icon || "🩺"}</div>
                <h3>{s.name}</h3>
                <p>{s.summary || s.description}</p>
                <div className="service-meta">
                  <span>
                    <span className="tag">{s.category}</span>
                  </span>
                  <span className="service-price">
                    {s.price > 0 ? money(s.price, settings?.currency) : "Free"}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-400)" }}>⏱ {s.durationMinutes} minutes</div>
                <Link className="btn btn-outline btn-sm btn-block" to={`/book?service=${s.id}`}>
                  Book this service
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section" id="team" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div className="section-eyebrow">Our team</div>
          <h2>People who will look after you</h2>
          <p className="section-lead">
            Every clinician here works from the same record, so you never have to explain your history
            twice.
          </p>
        </div>
        {doctors.length === 0 ? (
          <div className="alert alert-info">
            Clinician profiles are being added. Please call the clinic to ask who is available.
          </div>
        ) : (
          <div className="doctor-grid">
            {doctors.map((d) => (
              <div className="doctor-card" key={d.id}>
                <div className="avatar avatar-lg" style={{ background: "var(--teal-050)", color: "var(--teal-600)" }}>
                  {initials(d.name)}
                </div>
                <h3>{d.name}</h3>
                <div className="doctor-specialty">{d.specialty}</div>
                <p>{d.bio || d.qualifications || `${d.experienceYears} years of experience.`}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="value-grid">
          {VALUES.map((v) => (
            <div className="value-card" key={v.title}>
              <div style={{ fontSize: 22 }}>{v.icon}</div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="visit" style={{ paddingTop: 0 }}>
        <div className="site-cta">
          <h2>Ready when you are</h2>
          <p>
            Book online in under a minute and we'll call you back to confirm your slot. No account
            needed.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary btn-lg" to="/book">
              Book an appointment
            </Link>
            {settings?.phone ? (
              <a className="btn btn-lg" href={`tel:${settings.phone}`} style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                Call {settings.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <div className="brand-row" style={{ marginBottom: 10 }}>
              <span className="brand-mark" style={{ color: "#fff" }}>
                <Icon name="stethoscope" size={19} />
              </span>
              <span className="brand-name" style={{ color: "var(--ink-900)" }}>
                {clinicName}
              </span>
            </div>
            <p>{settings?.address || settings?.location || "Address to be added"}</p>
            <p style={{ fontSize: 12, color: "var(--ink-400)" }}>
              © {new Date().getFullYear()} {clinicName}. All rights reserved.
            </p>
          </div>
          <div>
            <h4>Contact</h4>
            {settings?.phone ? <a href={`tel:${settings.phone}`}>{settings.phone}</a> : <p>Phone to be added</p>}
            {settings?.emergencyPhone ? (
              <a href={`tel:${settings.emergencyPhone}`}>Emergency: {settings.emergencyPhone}</a>
            ) : null}
            {settings?.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
          </div>
          <div>
            <h4>Patients</h4>
            <Link to="/book">Book an appointment</Link>
            <Link to="/my-appointment">Check a booking</Link>
            <a href="#services">Our services</a>
          </div>
          <div>
            <h4>Staff</h4>
            <Link to="/staff">Staff sign in</Link>
            <p style={{ fontSize: 12, color: "var(--ink-400)" }}>
              For authorised clinic staff only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

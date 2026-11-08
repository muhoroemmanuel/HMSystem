import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Icon, Badge } from "../components/ui";

interface LookupResult {
  reference: string;
  date: string;
  time: string;
  doctorName: string;
  patientName: string;
  type: string;
  status: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m || 1) - 1, d || 1);
  return `${date.toLocaleDateString("en-GB", { weekday: "long" })} ${d} ${MONTHS[(m || 1) - 1]} ${y}`;
}

export default function LookupPage() {
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotFound(false);
    setResult(null);
    setBusy(true);
    try {
      const data = await api.post<{ appointment: LookupResult }>("/public/lookup", {
        reference: reference.trim().toUpperCase(),
        contact: contact.trim(),
      });
      setResult(data.appointment);
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 404) setNotFound(true);
      else setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-page">
      <div className="booking-wrap" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <Link className="brand-row" to="/" style={{ color: "inherit" }}>
            <span className="brand-mark" style={{ color: "#fff" }}>
              <Icon name="stethoscope" size={19} />
            </span>
            <span className="brand-name" style={{ color: "var(--ink-900)" }}>
              Back to clinic
            </span>
          </Link>
          <Link className="btn btn-primary btn-sm" to="/book">
            Book appointment
          </Link>
        </div>

        <div className="booking-head">
          <h1>Check a booking</h1>
          <p>Enter the reference we gave you and the phone number you booked with.</p>
        </div>

        <div className="card">
          <div className="card-body">
            {error ? (
              <div className="alert alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            ) : null}

            {notFound ? (
              <div className="alert alert-warn">
                <span>🔍</span>
                <span>
                  We couldn't find a booking with those details. Check the reference (it looks like{" "}
                  <code className="mono">APT-2026-00012</code>) or call the clinic.
                </span>
              </div>
            ) : null}

            {result ? (
              <>
                <div className="alert alert-success">
                  <span>✅</span>
                  <span>Booking found.</span>
                </div>
                <div className="summary-line">
                  <span>Reference</span>
                  <span className="mono strong">{result.reference}</span>
                </div>
                <div className="summary-line">
                  <span>Patient</span>
                  <span>{result.patientName}</span>
                </div>
                <div className="summary-line">
                  <span>When</span>
                  <span>
                    {prettyDate(result.date)} · {result.time}
                  </span>
                </div>
                <div className="summary-line">
                  <span>Clinician</span>
                  <span>{result.doctorName}</span>
                </div>
                <div className="summary-line">
                  <span>Type</span>
                  <span>{result.type}</span>
                </div>
                <div className="summary-line">
                  <span>Status</span>
                  <span>
                    <Badge status={result.status} />
                  </span>
                </div>
                {result.status === "Pending" ? (
                  <div className="alert alert-info" style={{ marginTop: 16 }}>
                    <span>📞</span>
                    <span>
                      Your slot is reserved. The clinic will call you to confirm. If you need to change it,
                      please call rather than booking a second time.
                    </span>
                  </div>
                ) : null}
                <button
                  className="btn btn-outline btn-block"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    setResult(null);
                    setReference("");
                    setContact("");
                  }}
                >
                  Look up another booking
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="booking-reference">Booking reference</label>
                  <input id="booking-reference"
                    className="input mono"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="APT-2026-00001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone-number-used-to-book">Phone number used to book</label>
                  <input id="phone-number-used-to-book"
                    className="input"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    required
                  />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy || !reference || !contact}>
                  {busy ? <span className="spinner" /> : null}
                  {busy ? "Looking…" : "Find my booking"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-400)", marginTop: 16 }}>
          Lost your reference? Call the clinic and we'll find your appointment by phone number.
        </p>
      </div>
    </div>
  );
}

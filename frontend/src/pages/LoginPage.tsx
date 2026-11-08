import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../components/ui";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const from = (location.state as { from?: string } | null)?.from || "/app";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="brand-row" style={{ color: "inherit" }}>
          <span className="brand-mark" style={{ color: "#fff" }}>
            <Icon name="stethoscope" size={19} />
          </span>
          <span>
            <span className="brand-name">MedCore HMS</span>
            <span className="brand-sub">Clinic operations</span>
          </span>
        </Link>

        <div>
          <h2>One record for every patient, every visit.</h2>
          <p>
            Reception, clinicians, billing and pharmacy all work from the same live data — no
            double entry, no paper trail.
          </p>
        </div>

        <div className="auth-points">
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="calendar" size={14} />
            </span>
            <span>Availability-aware scheduling that prevents double bookings.</span>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="billing" size={14} />
            </span>
            <span>Invoices, part-payments and M-Pesa references in one ledger.</span>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="pharmacy" size={14} />
            </span>
            <span>Stock that decrements the moment medicine is dispensed.</span>
          </div>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1>Staff sign in</h1>
          <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 22 }}>
            Use the account your clinic administrator created for you.
          </p>

          {error ? (
            <div className="alert alert-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || !email || !password} style={{ marginTop: 6 }}>
              {busy ? <span className="spinner" /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="auth-hint">
            <strong>First time running this?</strong>
            <br />
            Run <code>npm run db:seed</code> in <code>backend/</code> to create the administrator
            account. Its email and password come from <code>backend/.env</code>.
          </div>

          <div style={{ marginTop: 18, fontSize: 12.5, color: "var(--ink-400)" }}>
            <Link to="/">← Back to the clinic website</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { formatDate, initials } from "../lib/format";

/* ------------------------------------------------------------------ Icons */
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" />
        <path d="M16.5 5.5a3 3 0 0 1 0 5.6M18 20c0-2.6-.9-4.2-2.3-5.1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </>
    ),
    stethoscope: (
      <>
        <path d="M6 3v5a4 4 0 0 0 8 0V3" />
        <path d="M10 12v3a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2" />
        <circle cx="19" cy="11" r="2" />
      </>
    ),
    pharmacy: (
      <>
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M12 12v5M9.5 14.5h5" />
      </>
    ),
    billing: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    users: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 20c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6L6 18" />,
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M20 6 9 17l-5-5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 9v5M12 17.5v.5" />
      </>
    ),
    baggage: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    home: (
      <>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M21 3l-9 9" />
        <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" rx="2" />
        <path d="M6 17h12v4H6z" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  );
}

/* ------------------------------------------------------------------ Badge */
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  Active: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  Inactive: { bg: "var(--line-soft)", color: "var(--ink-500)" },
  Confirmed: { bg: "var(--blue-050)", color: "var(--blue-700)" },
  Pending: { bg: "var(--amber-050)", color: "var(--amber-600)" },
  Completed: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  Cancelled: { bg: "var(--red-050)", color: "var(--red-600)" },
  NoShow: { bg: "var(--line-soft)", color: "var(--ink-500)" },
  Paid: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  Partial: { bg: "var(--amber-050)", color: "var(--amber-600)" },
  Unpaid: { bg: "var(--red-050)", color: "var(--red-600)" },
  Void: { bg: "var(--line-soft)", color: "var(--ink-400)" },
  Dispensed: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  active: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  inactive: { bg: "var(--line-soft)", color: "var(--ink-500)" },
  suspended: { bg: "var(--red-050)", color: "var(--red-600)" },
  admin: { bg: "var(--purple-050)", color: "var(--purple-600)" },
  doctor: { bg: "var(--blue-050)", color: "var(--blue-700)" },
  receptionist: { bg: "var(--amber-050)", color: "var(--amber-600)" },
  billing: { bg: "var(--teal-050)", color: "var(--teal-600)" },
  pharmacist: { bg: "var(--purple-050)", color: "var(--purple-600)" },
  patient: { bg: "var(--line-soft)", color: "var(--ink-500)" },
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const style = BADGE_STYLES[status] ?? { bg: "var(--line-soft)", color: "var(--ink-500)" };
  return (
    <span className="badge" style={{ background: style.bg, color: style.color }}>
      {label ?? status}
    </span>
  );
}

/* ------------------------------------------------------------------ Metric */
export function MetricCard({
  label,
  value,
  foot,
  icon,
  tint = "var(--blue-050)",
  color = "var(--blue-600)",
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon: ReactNode;
  tint?: string;
  color?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" style={{ background: tint, color }}>
          {icon}
        </span>
      </div>
      <div className="metric-value">{value}</div>
      {foot ? <div className="metric-foot">{foot}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? "modal-lg" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Other */
export function Avatar({ name, size }: { name: string; size?: "lg" }) {
  return <span className={`avatar ${size === "lg" ? "avatar-lg" : ""}`}>{initials(name)}</span>;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="page-loading">
      <span className="spinner spinner-dark" />
      {label}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div style={{ fontWeight: 600, color: "var(--ink-500)" }}>{title}</div>
      {hint ? <div style={{ marginTop: 4, fontSize: 12.5 }}>{hint}</div> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  width?: number;
}) {
  return (
    <div className="search" style={width ? { minWidth: width, width } : undefined}>
      <Icon name="search" size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Tabs({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="pill-tabs">
      {options.map((o) => (
        <button
          key={o.key}
          className={`pill-tab ${value === o.key ? "active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="summary-line">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function Today() {
  return <>{formatDate(new Date().toISOString(), { weekday: "short", day: "numeric", month: "short" })}</>;
}

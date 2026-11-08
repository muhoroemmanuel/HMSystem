import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Icon } from "./ui";

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  permission?: string;
  group: string;
  badgeKey?: "appointments" | "pharmacy" | "billing";
}

const NAV: NavEntry[] = [
  { to: "/app", label: "Dashboard", icon: "dashboard", group: "Overview" },
  { to: "/app/patients", label: "Patients", icon: "patients", permission: "patients", group: "Clinical" },
  {
    to: "/app/appointments",
    label: "Appointments",
    icon: "calendar",
    permission: "appointments",
    group: "Clinical",
    badgeKey: "appointments",
  },
  { to: "/app/doctors", label: "Clinicians", icon: "stethoscope", permission: "doctors", group: "Clinical" },
  {
    to: "/app/pharmacy",
    label: "Pharmacy",
    icon: "pharmacy",
    permission: "pharmacy",
    group: "Clinical",
    badgeKey: "pharmacy",
  },
  {
    to: "/app/billing",
    label: "Billing",
    icon: "billing",
    permission: "billing",
    group: "Finance",
    badgeKey: "billing",
  },
  { to: "/app/services", label: "Services", icon: "baggage", permission: "settings", group: "Settings" },
  { to: "/app/users", label: "Staff & roles", icon: "users", permission: "users", group: "Settings" },
  { to: "/app/settings", label: "Clinic settings", icon: "settings", permission: "settings", group: "Settings" },
];

const TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/patients": "Patients",
  "/app/appointments": "Appointments",
  "/app/doctors": "Clinicians",
  "/app/pharmacy": "Pharmacy",
  "/app/billing": "Billing",
  "/app/services": "Service catalogue",
  "/app/users": "Staff & roles",
  "/app/settings": "Clinic settings",
};

const GROUPS = ["Overview", "Clinical", "Finance", "Settings"];

export default function AppShell() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [badges, setBadges] = useState<{ appointments: number; pharmacy: number; billing: number }>({
    appointments: 0,
    pharmacy: 0,
    billing: 0,
  });

  // Light-touch counters for the sidebar badges, refreshed on navigation.
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ appointments: { pending: number }; inventory: { lowStock: number }; revenue: { unpaidInvoices: number } }>(
        "/dashboard/summary",
      )
      .then((data) => {
        if (cancelled) return;
        setBadges({
          appointments: data.appointments.pending,
          pharmacy: data.inventory.lowStock,
          billing: data.revenue.unpaidInvoices,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // Close the mobile sidebar on navigation handled by CSS; nothing else needed.

  const items = NAV.filter((n) => !n.permission || can(n.permission));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-row">
            <span className="brand-mark" style={{ color: "#fff" }}>
              <Icon name="stethoscope" size={19} />
            </span>
            <span>
              <span className="brand-name">MedCore HMS</span>
              <span className="brand-sub">Clinic operations</span>
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                <div className="nav-section">{group}</div>
                {groupItems.map((item) => {
                  const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/app"}
                      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                    >
                      <Icon name={item.icon} size={17} />
                      <span>{item.label}</span>
                      {badge > 0 ? <span className="nav-badge">{badge}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}

          <div className="nav-section">Public site</div>
          <a className="nav-item" href="/" target="_blank" rel="noreferrer">
            <Icon name="external" size={17} />
            <span>View website</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
            <div className="user-chip-text" style={{ minWidth: 0 }}>
              <div className="user-chip-name">{user?.name}</div>
              <div className="user-chip-role">{user?.role}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm btn-block"
            style={{ marginTop: 8 }}
            onClick={async () => {
              await logout();
              navigate("/staff", { replace: true });
            }}
          >
            <Icon name="logout" size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{TITLES[location.pathname] ?? "MedCore HMS"}</div>
          <span className="topbar-meta">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <a className="btn btn-outline btn-sm" href="/" target="_blank" rel="noreferrer">
            <Icon name="external" size={13} />
            Website
          </a>
        </header>
        <main className="content">
          <Outlet context={{ refreshBadges: () => setBadges((b) => ({ ...b })) }} />
        </main>
      </div>
    </div>
  );
}

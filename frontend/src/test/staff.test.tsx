import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import DashboardPage from "../pages/DashboardPage";
import PatientsPage from "../pages/PatientsPage";
import AppointmentsPage from "../pages/AppointmentsPage";
import BillingPage from "../pages/BillingPage";
import PharmacyPage from "../pages/PharmacyPage";
import DoctorsPage from "../pages/DoctorsPage";
import SettingsPage from "../pages/SettingsPage";
import { api } from "../lib/api";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@medcore.ke";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "ChangeMe-Now-2026";

/**
 * Renders staff screens as a signed-in administrator. The sign-in goes through
 * the real AuthContext + API so permissions are exercised exactly as in the app
 * (write buttons only appear when the user is allowed to use them).
 */
function SignedIn({ children }: { children: ReactNode }) {
  const { user, login } = useAuth();
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (user) return;
    login(ADMIN_EMAIL, ADMIN_PASSWORD).catch((err) => setFailed((err as Error).message));
  }, [user, login]);

  if (failed) return <div>login failed: {failed}</div>;
  if (!user) return <div>signing in…</div>;
  return <>{children}</>;
}

function renderStaff(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/app"]}>
          <Routes>
            <Route path="/app" element={<SignedIn>{ui}</SignedIn>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe("staff dashboard", () => {
  it("loads live figures and greets the signed-in user", async () => {
    renderStaff(<DashboardPage />);

    await waitFor(
      () => expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/good (morning|afternoon|evening)/i),
      { timeout: 15000 },
    );

    expect(screen.getByText(/total patients/i)).toBeInTheDocument();
    expect(screen.getByText(/appointments today/i)).toBeInTheDocument();
    expect(screen.getByText(/collected this month/i)).toBeInTheDocument();
    expect(screen.getByText(/^outstanding$/i)).toBeInTheDocument();
  });
});

describe("patients screen", () => {
  it("lists patients from the database and opens the registration form", async () => {
    const user = userEvent.setup();
    renderStaff(<PatientsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /register patient/i })).toBeInTheDocument(), {
      timeout: 15000,
    });

    // Grace Wairimu is created by the API smoke tests / booking flow.
    await waitFor(() => expect(screen.getAllByText(/Grace Wairimu|No patients yet/).length).toBeGreaterThan(0), {
      timeout: 15000,
    });

    await user.click(screen.getByRole("button", { name: /register patient/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/patient number is assigned automatically/i)).toBeInTheDocument();
  });

  it("registers a new patient through the form and shows them in the list", async () => {
    const user = userEvent.setup();
    const surname = `Test${Date.now().toString().slice(-6)}`;
    renderStaff(<PatientsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /register patient/i })).toBeInTheDocument(), {
      timeout: 15000,
    });
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    const dialog = screen.getByRole("dialog");
    await user.type(dialog.querySelector("#first-name") as HTMLElement, "Browser");
    await user.type(dialog.querySelector("#last-name") as HTMLElement, surname);
    await user.type(dialog.querySelector("#phone") as HTMLElement, `+2547${Date.now().toString().slice(-8)}`);

    const submit = dialog.querySelector("button.btn-primary") as HTMLElement;
    await user.click(submit);

    await waitFor(() => expect(screen.getByText(new RegExp(surname))).toBeInTheDocument(), { timeout: 15000 });
  });
});

describe("appointments screen", () => {
  it("switches to the day agenda", async () => {
    const user = userEvent.setup();
    renderStaff(<AppointmentsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /day agenda/i })).toBeInTheDocument(), {
      timeout: 15000,
    });
    await user.click(screen.getByRole("button", { name: /day agenda/i }));

    await waitFor(() => expect(screen.getByText(/agenda for/i)).toBeInTheDocument(), { timeout: 15000 });
  });

  it("opens the scheduling modal", async () => {
    const user = userEvent.setup();
    renderStaff(<AppointmentsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /^schedule$/i })).toBeInTheDocument(), {
      timeout: 15000,
    });
    await user.click(screen.getByRole("button", { name: /^schedule$/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/slots are validated/i);
  });
});

describe("clinicians screen", () => {
  it("shows the weekly availability editor", async () => {
    const user = userEvent.setup();
    renderStaff(<DoctorsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /add clinician/i })).toBeInTheDocument(), {
      timeout: 15000,
    });
    await user.click(screen.getByRole("button", { name: /add clinician/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/weekly availability/i);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByRole("button", { name: day })).toBeInTheDocument();
    }
  });
});

describe("billing screen", () => {
  it("renders totals and the invoice builder", async () => {
    const user = userEvent.setup();
    renderStaff(<BillingPage />);

    await waitFor(() => expect(screen.getByText(/total billed/i)).toBeInTheDocument(), { timeout: 15000 });
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/line items/i);
  });
});

describe("pharmacy screen", () => {
  it("shows the till and switches to inventory", async () => {
    const user = userEvent.setup();
    renderStaff(<PharmacyPage />);

    await waitFor(() => expect(screen.getAllByText(/current sale/i).length).toBeGreaterThan(0), { timeout: 15000 });
    await user.click(screen.getByRole("button", { name: /^inventory$/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /add drug/i })).toBeInTheDocument(), {
      timeout: 15000,
    });
  });
});

describe("settings screen", () => {
  it("loads clinic identity fields from the database", async () => {
    renderStaff(<SettingsPage />);

    await waitFor(() => expect(screen.getByText(/clinic name/i)).toBeInTheDocument(), { timeout: 15000 });
    const site = await api.get<{ settings: { clinicName: string } }>("/public/site");
    expect(screen.getByDisplayValue(site.settings.clinicName)).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";

function renderPage(ui: React.ReactNode, path = "/") {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/staff" element={<LoginPage />} />
            <Route path="/app" element={<div>staff app</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe("public website", () => {
  it("renders the clinic name, tagline and services from the database", async () => {
    renderPage(<LandingPage />);

    // settings + services come from /api/public/site
    await waitFor(() => expect(screen.getAllByText("Kampi Medical Centre").length).toBeGreaterThan(0));

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.length).toBeGreaterThan(5);

    // Services section lists real catalogue entries
    await waitFor(() => expect(screen.getByText("General Consultation")).toBeInTheDocument());
    expect(screen.getByText("Laboratory Tests")).toBeInTheDocument();

    // Every service card has a working call-to-action
    const bookLinks = screen.getAllByRole("link", { name: /book this service/i });
    expect(bookLinks.length).toBeGreaterThan(3);
    expect(bookLinks[0]).toHaveAttribute("href", expect.stringContaining("/book?service="));
  });

  it("shows the booking call-to-action and staff sign-in route", async () => {
    renderPage(<LandingPage />);
    await waitFor(() => expect(screen.getAllByText("Kampi Medical Centre").length).toBeGreaterThan(0));

    const primary = screen.getAllByRole("link", { name: /book an appointment/i });
    expect(primary.length).toBeGreaterThan(0);
    expect(primary[0]).toHaveAttribute("href", "/book");
    expect(screen.getAllByRole("link", { name: /staff sign in/i })[0]).toHaveAttribute("href", "/staff");
  });
});

describe("staff sign in", () => {
  it("rejects a wrong password with a readable error", async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />, "/staff");

    await user.type(screen.getByLabelText(/email/i), "admin@medcore.ke");
    await user.type(screen.getByLabelText(/password/i), "definitely-wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it("signs a valid user in and routes them to the app", async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />, "/staff");

    await user.type(screen.getByLabelText(/email/i), process.env.TEST_ADMIN_EMAIL || "admin@medcore.ke");
    await user.type(
      screen.getByLabelText(/password/i),
      process.env.TEST_ADMIN_PASSWORD || "ChangeMe-Now-2026",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("staff app")).toBeInTheDocument(), { timeout: 8000 });
  });
});

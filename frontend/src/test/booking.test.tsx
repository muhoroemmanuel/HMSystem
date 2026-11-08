import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import BookPage from "../pages/BookPage";
import LookupPage from "../pages/LookupPage";
import { api } from "../lib/api";

function renderBook() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/book"]}>
          <Routes>
            <Route path="/book" element={<BookPage />} />
            <Route path="/my-appointment" element={<LookupPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

/** Finds the first doctor that actually has open slots right now. */
async function firstBookableDoctor() {
  const site = await api.get<{ doctors: { id: string; name: string }[] }>("/public/site");
  for (const doctor of site.doctors) {
    const availability = await api.get<{ days: { date: string; slots: string[] }[] }>(
      `/public/availability/${doctor.id}?days=21`,
    );
    const day = availability.days.find((d) => d.slots.length > 0);
    if (day) return { doctor, day };
  }
  return null;
}

describe("public booking journey", () => {
  it("walks a patient from service choice to a confirmed request", async () => {
    const slot = await firstBookableDoctor();
    expect(slot, "expected at least one clinician with availability").not.toBeNull();

    const user = userEvent.setup();
    renderBook();

    // Step 1 — service
    await waitFor(() => expect(screen.getByText(/General Consultation/)).toBeInTheDocument(), {
      timeout: 15000,
    });
    await user.click(screen.getByRole("button", { name: /general consultation/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Step 2 — clinician
    await waitFor(() => expect(screen.getByText(new RegExp(slot!.doctor.name, "i"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(slot!.doctor.name, "i") }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Step 3 — date and time
    await waitFor(() => expect(screen.getAllByRole("button", { name: /\d\d:\d\d/ }).length).toBeGreaterThan(0), {
      timeout: 15000,
    });
    await user.click(screen.getAllByRole("button", { name: /\d\d:\d\d/ })[0]!);
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Step 4 — details
    const stamp = Date.now().toString().slice(-6);
    await user.type(screen.getByLabelText(/first name/i), "Site");
    await user.type(screen.getByLabelText(/last name/i), `Visitor${stamp}`);
    await user.type(screen.getByLabelText(/^phone/i), `+2547${stamp}00`);
    await user.click(screen.getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: /request appointment/i }));

    // Confirmation
    await waitFor(() => expect(screen.getByText(/appointment requested/i)).toBeInTheDocument(), {
      timeout: 15000,
    });
    expect(screen.getAllByText(/APT-\d{4}-\d{5}/).length).toBeGreaterThan(0);
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument();
  });

  it("lets a patient look their booking up by reference and phone", async () => {
    // Create a booking directly through the API so we know its reference.
    const slot = await firstBookableDoctor();
    expect(slot).not.toBeNull();

    const stamp = Date.now().toString().slice(-6);
    const phone = `+2547${stamp}11`;
    const created = await api.post<{ appointment: { reference: string } }>("/public/book", {
      doctorId: slot!.doctor.id,
      date: slot!.day.date,
      time: slot!.day.slots[0],
      firstName: "Lookup",
      lastName: `Test${stamp}`,
      phone,
      consent: true,
      gender: "Female",
    });

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/my-appointment"]}>
            <Routes>
              <Route path="/my-appointment" element={<LookupPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText(/booking reference/i), created.appointment.reference);
    await user.type(screen.getByLabelText(/phone number used to book/i), phone);
    await user.click(screen.getByRole("button", { name: /find my booking/i }));

    await waitFor(() => expect(screen.getByText(/booking found/i)).toBeInTheDocument(), { timeout: 15000 });
    expect(screen.getAllByText(created.appointment.reference).length).toBeGreaterThan(0);
  });

  it("refuses to reveal a booking when the phone number does not match", async () => {
    const slot = await firstBookableDoctor();
    const stamp = Date.now().toString().slice(-6);
    const created = await api.post<{ appointment: { reference: string } }>("/public/book", {
      doctorId: slot!.doctor.id,
      date: slot!.day.date,
      time: slot!.day.slots[0],
      firstName: "Privacy",
      lastName: `Check${stamp}`,
      phone: `+2547${stamp}22`,
      consent: true,
      gender: "Male",
    });

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/my-appointment"]}>
            <Routes>
              <Route path="/my-appointment" element={<LookupPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText(/booking reference/i), created.appointment.reference);
    await user.type(screen.getByLabelText(/phone number used to book/i), "+254700000000");
    await user.click(screen.getByRole("button", { name: /find my booking/i }));

    await waitFor(() => expect(screen.getByText(/couldn't find a booking/i)).toBeInTheDocument(), {
      timeout: 15000,
    });
    expect(screen.queryByText(/booking found/i)).not.toBeInTheDocument();
  });
});

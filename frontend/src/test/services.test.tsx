import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import BookPage from "../pages/BookPage";
import { api } from "../lib/api";

function renderBook() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/book"]}>
          <BookPage />
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe("booking page services", () => {
  it("lists the clinic's services so a patient can pick one", async () => {
    const site = await api.get<{ services: { name: string }[] }>("/public/site");
    expect(site.services.length).toBeGreaterThan(0);

    renderBook();
    // The service name also appears in the page's own heading, so match the
    // button that a patient actually clicks.
    await waitFor(
      () => expect(screen.getByRole("button", { name: new RegExp(site.services[0]!.name, "i") })).toBeInTheDocument(),
      { timeout: 15000 },
    );
    // And it must not claim the list is empty.
    expect(screen.queryByText(/no services are listed yet/i)).toBeNull();
  });
});

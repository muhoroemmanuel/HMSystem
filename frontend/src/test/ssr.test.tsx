import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import LandingPage from "../pages/LandingPage";
import BookPage from "../pages/BookPage";
import LookupPage from "../pages/LookupPage";
import LoginPage from "../pages/LoginPage";

describe("server render smoke test", () => {
  const pages = [
    ["/", <LandingPage />],
    ["/book", <BookPage />],
    ["/my-appointment", <LookupPage />],
    ["/staff", <LoginPage />],
  ] as const;

  for (const [path, page] of pages) {
    it(`renders ${path} without crashing`, () => {
      const html = renderToString(
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
          </AuthProvider>
        </ToastProvider>,
      );
      expect(html.length).toBeGreaterThan(200);
    });
  }
});

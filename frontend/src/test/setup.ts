import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * These tests run the real UI against a real, running API
 * (see src/test/README.md). `fetch` is proxied straight to the backend so the
 * cookie-based refresh flow works exactly as it does in the browser.
 */
const API_ORIGIN = process.env.TEST_API_ORIGIN || "http://127.0.0.1:4000";

const realFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const absolute = url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
  return realFetch(absolute, init);
}) as typeof fetch;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

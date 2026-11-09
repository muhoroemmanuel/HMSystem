import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * These tests run the real UI against a real, running API
 * (see src/test/README.md). `fetch` is proxied straight to the backend so the
 * cookie-based refresh flow works exactly as it does in the browser.
 *
 * Because they need a live server, running them with nothing listening makes
 * every single test fail with the same unhelpful message. The check below
 * turns that into one clear instruction instead of twenty stack traces.
 */
const API_ORIGIN = process.env.TEST_API_ORIGIN || "http://127.0.0.1:4000";

const realFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const absolute = url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
  return realFetch(absolute, init);
}) as typeof fetch;

beforeAll(async () => {
  let reachable = false;
  try {
    const res = await realFetch(`${API_ORIGIN}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    reachable = res.ok;
  } catch {
    reachable = false;
  }

  if (reachable) return;

  throw new Error(
    [
      "",
      "  ✗ The API is not running at " + API_ORIGIN + ".",
      "",
      "  These tests drive the real interface against a real server, so nothing",
      "  can pass until one is up. Pick one of these:",
      "",
      "    npm run test:e2e     run everything with a throwaway database (recommended)",
      "",
      "    or start the app first, in another terminal:",
      "    npm run dev          then re-run this command",
      "",
      "  Running `npm run test` alone is only correct while `npm run dev`",
      "  is already running elsewhere.",
      "",
    ].join("\n"),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

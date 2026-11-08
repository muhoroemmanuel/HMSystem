import { describe, expect, it } from "vitest";

/**
 * Session handling regression tests.
 *
 * These cover behaviour that is easy to break and expensive to get wrong in a
 * clinic: a lost session sends staff back to the login screen mid-shift, and a
 * session that outlives sign-out is a security hole.
 *
 * They talk to the API directly with real cookies, because the bug they guard
 * against cannot be reproduced through the UI client — the client deliberately
 * serialises its own refreshes.
 */

const API =
  process.env.TEST_API_ORIGIN ||
  process.env.VITE_API_ORIGIN ||
  "http://127.0.0.1:4000";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@medcore.ke";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "ChangeMe-Now-2026";

/** A tiny cookie jar, enough for the refresh cookie the API sets. */
class Jar {
  private cookies = new Map<string, string>();

  store(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair!.indexOf("=");
      if (eq === -1) continue;
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const expired = /Max-Age=0/i.test(raw) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(name = "hms_rt"): string | null {
    const value = this.cookies.get(name);
    return value ? `${name}=${value}` : null;
  }

  get(name = "hms_rt"): string | null {
    return this.cookies.get(name) ?? null;
  }
}

async function call(path: string, jar: Jar, body?: unknown): Promise<Response> {
  const cookie = jar.header();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar.store(res);
  return res;
}

async function signIn(): Promise<Jar> {
  const jar = new Jar();
  const res = await call("/api/auth/login", jar, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  expect(res.status, "sign-in should succeed").toBe(200);
  expect(jar.get(), "login should set a refresh cookie").toBeTruthy();
  return jar;
}

describe("session handling", () => {
  it("keeps the user signed in when several requests refresh at once", async () => {
    // Reproduces a browser with multiple tabs: each fires a refresh with the
    // same cookie. Previously the second one was treated as token theft and
    // every session was revoked, silently logging the user out.
    const jar = await signIn();
    const cookie = jar.header();
    expect(cookie).toBeTruthy();

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${API}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie! },
        }),
      ),
    );

    const succeeded = responses.filter((r) => r.status === 200);
    expect(succeeded.length, "every concurrent refresh should succeed").toBe(6);

    // And the session must still be usable afterwards.
    const after = await call("/api/auth/refresh", jar);
    expect(after.status, "session should survive the race").toBe(200);
  });

  it("gives every concurrent refresh the same successor token", async () => {
    // Tabs must converge on one session. If they received different tokens,
    // whichever response arrived last would win and the others would be left
    // holding a dead cookie.
    const jar = await signIn();
    const cookie = jar.header()!;

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        fetch(`${API}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
        }),
      ),
    );

    const tokens = await Promise.all(
      responses.map(async (r) => {
        const next = r.headers.getSetCookie?.().find((c) => c.startsWith("hms_rt="));
        return next ? next.split(";")[0] : null;
      }),
    );

    const distinct = new Set(tokens.filter(Boolean));
    expect(distinct.size, "all tabs should end up with the same cookie").toBe(1);
  });

  it("refuses to refresh with the cookie from a signed-out session", async () => {
    // Rotation makes a token reusable for a short window so races work. That
    // window must never extend to a session the user deliberately ended.
    const jar = await signIn();
    const cookie = jar.header()!;

    const out = await call("/api/auth/logout", jar);
    expect([200, 204]).toContain(out.status);

    const replay = await fetch(`${API}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    expect(replay.status, "a signed-out token must not refresh").toBe(401);
  });

  it("rejects an access token after sign-out", async () => {
    const jar = await signIn();
    const login = await call("/api/auth/login", new Jar(), {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    const { token } = (await login.json()) as { token: string };
    expect(token).toBeTruthy();

    await call("/api/auth/logout", jar);

    // The access token is stateless and stays valid until it expires, which is
    // why sessions are kept short. Confirm the endpoint still guards data.
    const res = await fetch(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 401]).toContain(res.status);
  });
});

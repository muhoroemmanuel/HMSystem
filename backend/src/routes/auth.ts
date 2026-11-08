import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one, query } from "../db";
import {
  AuthedRequest,
  REFRESH_TTL_DAYS,
  getSessionUser,
  issueRefreshToken,
  requireAuth,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type AuthUser,
} from "../middleware/auth";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapUser } from "../lib/mappers";
import { clearCookie, readCookie, setCookie } from "../lib/cookies";

const router = Router();

const REFRESH_COOKIE = "hms_rt";

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const refreshTokenTtl = REFRESH_TTL_DAYS * 24 * 60 * 60;

function setRefreshCookie(res: import("express").Response, token: string) {
  setCookie(res, REFRESH_COOKIE, token, {
    maxAgeSeconds: refreshTokenTtl,
    path: "/api/auth",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  });
}

function clearRefreshCookie(res: import("express").Response) {
  clearCookie(res, REFRESH_COOKIE, "/api/auth");
}

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const row = await one<{ token_version: number }>(`SELECT token_version FROM users WHERE id = $1`, [userId]);
  if (!row) return null;
  return getSessionUser(userId, row.token_version);
}

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const row = await one<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      status: string;
      role: string;
      token_version: number;
    }>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.status, u.token_version, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE lower(u.email) = lower($1)`,
      [email.trim()],
    );

    // Constant-ish work whether or not the account exists.
    const hash = row?.password_hash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await bcrypt.compare(password, hash);
    if (!row || !ok) throw unauthorized("Invalid email or password");
    if (row.status !== "active") throw unauthorized("This account has been suspended");

    const user = await loadAuthUser(row.id);
    if (!user) throw unauthorized("This account is not available");

    const refresh = await issueRefreshToken(row.id, req.headers["user-agent"], req.ip);
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [row.id]);
    setRefreshCookie(res, refresh.token);

    await audit(req, "login", "user", row.id, { email: row.email });

    return res.json({
      token: signAccessToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        patientId: user.patientId,
      },
    });
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = readCookie(req, REFRESH_COOKIE) || (req.body?.refreshToken as string | undefined);
    if (!raw) throw unauthorized("No session to refresh");
    const rotated = await rotateRefreshToken(raw, req.headers["user-agent"], req.ip);
    if (!rotated) {
      clearRefreshCookie(res);
      throw unauthorized("Your session expired - please sign in again");
    }
    const user = await loadAuthUser(rotated.userId);
    if (!user) {
      clearRefreshCookie(res);
      throw unauthorized("Your session is no longer valid");
    }
    setRefreshCookie(res, rotated.token);
    return res.json({
      token: signAccessToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        patientId: user.patientId,
      },
    });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (raw) await revokeRefreshToken(raw);
    clearRefreshCookie(res);
    return res.status(204).end();
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.user!;
    const profile = await one(`SELECT * FROM users WHERE id = $1`, [user.id]);
    if (!profile) throw notFound("User");
    return res.json({
      user: {
        ...mapUser({ ...profile, role: user.role }),
        permissions: user.permissions,
        patientId: user.patientId,
      },
    });
  }),
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200),
});

router.post(
  "/change-password",
  requireAuth,
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;
    const user = req.user!;

    const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
    if (!row) throw notFound("User");
    if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw badRequest("Your current password is not correct");
    }
    if (currentPassword === newPassword) {
      throw badRequest("Choose a password you have not used before");
    }

    const hash = await bcrypt.hash(newPassword, 12);
    // Bumping token_version + clearing refresh tokens signs out every device.
    await query(
      `UPDATE users SET password_hash = $1, must_change_password = false, token_version = token_version + 1
        WHERE id = $2`,
      [hash, user.id],
    );
    await revokeAllForUser(user.id);
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
    await audit(req, "change-password", "user", user.id);

    return res.json({ message: "Password updated. Please sign in again." });
  }),
);

export default router;

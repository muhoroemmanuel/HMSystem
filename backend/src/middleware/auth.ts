import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { one, query } from "../db";
import { forbidden, unauthorized } from "../lib/errors";

export type RoleName = "admin" | "doctor" | "receptionist" | "billing" | "pharmacist" | "patient";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  permissions: string[];
  patientId: string | null;
  tokenVersion: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "20m";
export const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_DAYS || 14);

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a random string of at least 32 characters. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  return value;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      tv: user.tokenVersion,
    },
    secret(),
    { expiresIn: ACCESS_TTL as jwt.SignOptions["expiresIn"], issuer: "medcore-hms" },
  );
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function newRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function issueRefreshToken(
  userId: string,
  userAgent: string | undefined,
  ip: string | undefined,
  explicitToken?: string,
): Promise<{ id: string; token: string }> {
  const token = explicitToken ?? newRefreshToken();
  // A deterministic successor may already have been inserted by the request
  // that won the race; keep that row rather than failing on the unique index.
  const row = await one<{ id: string }>(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)
     ON CONFLICT (token_hash) DO UPDATE SET token_hash = EXCLUDED.token_hash
     RETURNING id`,
    [userId, sha256(token), userAgent?.slice(0, 300) ?? null, ip ?? null, String(REFRESH_TTL_DAYS)],
  );
  return { id: row!.id, token };
}

/**
 * How long a client may replay an already-rotated refresh cookie and still be
 * given the successor token. Browsers fire requests in parallel, so a second
 * refresh arriving a few hundred milliseconds late is completely normal.
 * Without this window that ordinary race looks identical to token theft and
 * logs the user out mid-shift.
 */
const REFRESH_REUSE_GRACE_MS = Number(process.env.REFRESH_REUSE_GRACE_SECONDS || 120) * 1000;

/**
 * Derives the successor to a refresh token.
 *
 * Rotation is a *chain*: each token maps to exactly one next token, computed
 * with a server-side key. That makes rotation idempotent — every request that
 * presents the same token computes the same successor, so a lost race can be
 * answered with a usable token instead of an error, and all tabs converge.
 *
 * An attacker holding a stolen token cannot derive the successor without this
 * key, and replaying the stolen token after the grace window still trips theft
 * detection.
 */
function deriveSuccessor(rawToken: string): string {
  const key = process.env.REFRESH_DERIVE_KEY || process.env.JWT_SECRET || "";
  return createHmac("sha256", key).update(`refresh-chain:${rawToken}`).digest("base64url");
}

interface TokenRow {
  id: string;
  user_id: string;
  revoked_at: string | null;
  expires_at: string;
  replaced_by: string | null;
}

/**
 * Exchanges a refresh token for its successor.
 *
 * The UPDATE only matches while `revoked_at` is still NULL, so exactly one
 * request performs the rotation and the rest observe it as already done.
 *
 * - Inside the grace window a replay is answered with the successor token, so
 *   two tabs refreshing at the same moment both stay signed in.
 * - A revoked token outside the window, or one that was revoked without being
 *   rotated (deliberate sign-out, password reset), is treated as theft: every
 *   session for that account ends.
 */
export async function rotateRefreshToken(
  rawToken: string,
  userAgent: string | undefined,
  ip: string | undefined,
): Promise<{ userId: string; token: string } | null> {
  const row = await one<TokenRow>(
    `SELECT id, user_id, revoked_at, expires_at, replaced_by
       FROM refresh_tokens WHERE token_hash = $1`,
    [sha256(rawToken)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  if (row.revoked_at) {
    return replay(row, rawToken, userAgent, ip);
  }

  // Prepare the successor before touching the old row, so the rotation itself
  // can be a single statement. Revoking first and linking afterwards leaves a
  // window where another request sees a revoked token with no successor and
  // mistakes an ordinary race for theft.
  const successor = deriveSuccessor(rawToken);
  const issued = await issueRefreshToken(row.user_id, userAgent, ip, successor);

  const claimed = await one<{ id: string }>(
    `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2
      WHERE id = $1 AND revoked_at IS NULL
      RETURNING id`,
    [row.id, issued.id],
  );

  if (claimed) return { userId: row.user_id, token: successor };

  // Lost the race: the winner has already set both columns atomically.
  const current = await one<TokenRow>(
    `SELECT id, user_id, revoked_at, expires_at, replaced_by
       FROM refresh_tokens WHERE id = $1`,
    [row.id],
  );
  if (!current?.revoked_at) return null;
  return replay(current, rawToken, userAgent, ip);
}

/**
 * A token that has already been rotated. Hand back its successor while the
 * client is merely late; otherwise assume the token was stolen.
 */
async function replay(
  row: TokenRow,
  rawToken: string,
  userAgent: string | undefined,
  ip: string | undefined,
): Promise<{ userId: string; token: string } | null> {
  const revokedAt = row.revoked_at ? new Date(row.revoked_at).getTime() : 0;
  const withinGrace = Date.now() - revokedAt <= REFRESH_REUSE_GRACE_MS;

  // Only a token that was rotated has a successor. A token revoked any other
  // way (sign-out, password change, "sign out everywhere") must never work
  // again, no matter how recently it happened.
  const rotated = row.replaced_by !== null;

  if (rotated && withinGrace) {
    const successor = deriveSuccessor(rawToken);
    const issued = await issueRefreshToken(row.user_id, userAgent, ip, successor);
    return { userId: row.user_id, token: successor };
  }

  // Reuse of a rotation outside the window, or replay of a deliberately ended
  // session: assume theft and end every session for this account.
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [row.user_id],
  );
  return null;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [sha256(rawToken)]);
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
    userId,
  ]);
}

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return undefined;
  return token;
}

async function loadUser(userId: string): Promise<AuthUser | null> {
  const row = await one<{
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    token_version: number;
    status: string;
    patient_id: string | null;
  }>(
    `SELECT u.id, u.name, u.email, r.name AS role, r.permissions, u.token_version, u.status,
            (SELECT p.id FROM patients p WHERE p.user_id = u.id) AS patient_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId],
  );
  if (!row || row.status !== "active") return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as RoleName,
    permissions: row.permissions ?? [],
    tokenVersion: row.token_version,
    patientId: row.patient_id,
  };
}

export async function getSessionUser(userId: string, tokenVersion: number): Promise<AuthUser | null> {
  const user = await loadUser(userId);
  if (!user || user.tokenVersion !== tokenVersion) return null;
  return user;
}

/** Requires a valid access token. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) throw unauthorized();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret(), { issuer: "medcore-hms" }) as jwt.JwtPayload;
    } catch {
      throw unauthorized("Your session expired - please sign in again");
    }
    const user = await getSessionUser(String(payload.sub), Number(payload.tv ?? 0));
    if (!user) throw unauthorized("Your session is no longer valid");
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Permission gate. Permissions come from the `roles` table so admins can be
 * granted new capabilities without a redeploy.
 */
export function requirePermission(...needed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(unauthorized());
    if (user.role === "admin") return next();
    const has = needed.every((p) => user.permissions.includes(p));
    if (!has) return next(forbidden(`This action needs the "${needed.join(", ")}" permission`));
    return next();
  };
}

export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden("This action is limited to staff"));
    return next();
  };
}

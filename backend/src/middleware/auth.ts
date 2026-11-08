import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
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
): Promise<string> {
  const token = newRefreshToken();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
    [userId, sha256(token), userAgent?.slice(0, 300) ?? null, ip ?? null, String(REFRESH_TTL_DAYS)],
  );
  return token;
}

export async function rotateRefreshToken(
  rawToken: string,
  userAgent: string | undefined,
  ip: string | undefined,
): Promise<{ userId: string; token: string } | null> {
  const row = await one<{ id: string; user_id: string; revoked_at: string | null; expires_at: string }>(
    `SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [sha256(rawToken)],
  );
  if (!row) return null;
  if (row.revoked_at) {
    // Re-use of a revoked token: assume theft, kill every session for the user.
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
      row.user_id,
    ]);
    return null;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
  const token = await issueRefreshToken(row.user_id, userAgent, ip);
  return { userId: row.user_id, token };
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

import { createHash, randomUUID } from "crypto";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SeedUser extends AuthUser {
  salt: string;
  passwordHash: string;
}

const hashPassword = (password: string, salt: string): string =>
  createHash("sha256").update(`${salt}:${password}`).digest("hex");

const SEED: Array<AuthUser & { password: string }> = [
  { id: "u1", name: "Alice Mutiso", email: "admin@hms.ke", role: "admin", password: "admin123" },
  { id: "u2", name: "Dr. Samuel Kiprotich", email: "doctor@hms.ke", role: "doctor", password: "doctor123" },
  { id: "u3", name: "Sara Atieno", email: "reception@hms.ke", role: "receptionist", password: "front123" },
  { id: "u4", name: "Brian Otieno", email: "billing@hms.ke", role: "billing", password: "bills123" },
  { id: "u5", name: "Purity Njeri", email: "pharmacy@hms.ke", role: "pharmacist", password: "rx123" },
];

const USERS: SeedUser[] = SEED.map((user) => {
  const salt = randomUUID();
  return {
    id: user.id,
    name: user.name,
    email: user.email.toLowerCase(),
    role: user.role,
    salt,
    passwordHash: hashPassword(user.password, salt),
  };
});

const tokens = new Map<string, AuthUser>();

export function authenticate(email: string, password: string): AuthUser | null {
  const user = USERS.find((u) => u.email === email.trim().toLowerCase());
  if (!user) return null;
  if (hashPassword(password, user.salt) !== user.passwordHash) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function createToken(user: AuthUser): string {
  const token = randomUUID();
  tokens.set(token, user);
  return token;
}

export function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  return tokens.get(token) || null;
}

export function revokeToken(token: string | undefined): void {
  if (token) tokens.delete(token);
}

export function tokenFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return undefined;
  return parts[1];
}
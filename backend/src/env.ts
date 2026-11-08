import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader.
 *
 * The repo ships without secrets, and `dotenv` would otherwise have to be a
 * dependency of every entry point. This keeps `npm run dev`, `db:migrate` and
 * `db:seed` working with a plain `.env` file and zero surprises.
 */
export function loadEnv(file = path.resolve(process.cwd(), ".env")): void {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Small helpers shared by every route. */

/** Converts pg numeric (returned as string) into a number. */
export const num = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** `YYYY-MM-DD` for a Date, using a specific IANA timezone. */
export function dateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Minutes since midnight for a Date in a timezone. */
export function minutesInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

/** Weekday (0=Sunday) for a Date in a timezone. */
export function weekdayInZone(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

/** `HH:MM` -> minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
}

/** minutes since midnight -> `HH:MM` */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Combines a `YYYY-MM-DD` date, a `HH:MM` time and a UTC offset into a Date.
 * Kept offset-explicit so appointments land on the intended wall clock time
 * regardless of the server's own timezone.
 */
export function zonedDateTime(dateISO: string, time: string, offsetMinutes: number): Date {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const utc = Date.UTC(y!, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0, 0);
  return new Date(utc - offsetMinutes * 60_000);
}

/** `YYYY-MM-DD` -> Date at UTC midnight (for date columns). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, (m || 1) - 1, d || 1));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Full name helper used in several joins. */
export const fullName = (first: string, last: string) => `${first} ${last}`.trim();

export function ageFromBirthDate(birth: string | Date | null): number | null {
  if (!birth) return null;
  const d = typeof birth === "string" ? new Date(birth) : birth;
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

/** Deterministic pretty reference: KES 1,250 */
export function money(amount: number, currency = "KES"): string {
  return `${currency} ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

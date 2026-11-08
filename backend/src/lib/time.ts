/**
 * Timezone-aware helpers.
 *
 * Appointments are stored as `timestamptz` (an absolute instant). All the
 * human-facing maths - "what does 09:00 at the clinic mean in UTC", "which
 * slots are free on the 14th" - happens on the clinic's wall clock.
 */

export const DEFAULT_TZ = "Africa/Nairobi";

export function tz(): string {
  return process.env.CLINIC_TIMEZONE || DEFAULT_TZ;
}

/** Offset (minutes) of `timeZone` at the given local wall clock. */
export function zoneOffsetMinutes(dateISO: string, time: string, timeZone = tz()): number {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y!, (mo || 1) - 1, d || 1, h || 0, mi || 0));

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asIfUtc - guess.getTime()) / 60_000);
}

/** Local wall clock (`YYYY-MM-DD`, `HH:MM`) -> absolute Date. */
export function toInstant(dateISO: string, time: string, timeZone = tz()): Date {
  const offset = zoneOffsetMinutes(dateISO, time, timeZone);
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, (mo || 1) - 1, d || 1, h || 0, mi || 0) - offset * 60_000);
}

/** Absolute Date -> `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` on the clinic clock. */
export function fromInstant(date: Date, timeZone = tz()): { date: string; time: string; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdayName = get("weekday");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName),
  };
}

export function todayISO(timeZone = tz()): string {
  return fromInstant(new Date(), timeZone).date;
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y!, (m || 1) - 1, d || 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Weekday for a `YYYY-MM-DD` string (0 = Sunday). Pure calendar maths. */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y!, (m || 1) - 1, d || 1)).getUTCDay();
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Start/end instants covering a local calendar day, for SQL range filters. */
export function dayBounds(dateISO: string, timeZone = tz()): { start: Date; end: Date } {
  return {
    start: toInstant(dateISO, "00:00", timeZone),
    end: toInstant(addDaysISO(dateISO, 1), "00:00", timeZone),
  };
}

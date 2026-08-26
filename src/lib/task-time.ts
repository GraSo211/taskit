export type DateKey = string;

export type DateKeyWindow = { start: DateKey; end: DateKey };

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
}

function makeUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}

export function parseDateKey(value: string): { year: number; month: number; day: number } {
  if (typeof value !== "string") throw new Error("Date must use YYYY-MM-DD");
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = makeUtcDate(year, month, day);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date");
  }
  return { year, month, day };
}

export function isValidDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string") return false;
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function validateDateKey(value: string): DateKey {
  parseDateKey(value);
  return value;
}

/** PostgreSQL DATE values are represented by Prisma as UTC-midnight Dates. */
export function dateKeyToDbDate(value: string): Date {
  const { year, month, day } = parseDateKey(value);
  return makeUtcDate(year, month, day);
}

/** Read UTC calendar fields only; a DATE is never treated as an instant. */
export function dbDateToDateKey(value: Date): DateKey {
  assertValidDate(value);
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(value: DateKey, days: number): DateKey {
  const date = dateKeyToDbDate(value);
  if (!Number.isInteger(days)) throw new Error("days must be an integer");
  date.setUTCDate(date.getUTCDate() + days);
  return dbDateToDateKey(date);
}

export function weekdayOfDateKey(value: DateKey): number {
  return dateKeyToDbDate(value).getUTCDay();
}

export function getMondayWeekWindow(value: DateKey): DateKeyWindow {
  const mondayOffset = (weekdayOfDateKey(value) + 6) % 7;
  const start = addDays(value, -mondayOffset);
  return { start, end: addDays(start, 7) };
}

export function normalizeTimezone(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Timezone must be a valid IANA timezone");
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value.trim() })
      .resolvedOptions().timeZone;
  } catch {
    throw new Error("Timezone must be a valid IANA timezone");
  }
}

export function localDateKey(now: Date, timezone: string): DateKey {
  assertValidDate(now);
  const normalizedTimezone = normalizeTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return validateDateKey(`${values.year}-${values.month}-${values.day}`);
}

/** Return the actual next local midnight, including DST-short/long days. */
export function nextLocalDateChange(timezone: string, now = new Date()): Date {
  const start = new Date(now.getTime());
  const currentKey = localDateKey(start, timezone);
  let distance = 60 * 60 * 1000;
  let end = new Date(start.getTime() + distance);
  while (localDateKey(end, timezone) === currentKey && distance < 4 * 24 * 60 * 60 * 1000) {
    distance *= 2;
    end = new Date(start.getTime() + distance);
  }
  if (localDateKey(end, timezone) === currentKey) {
    throw new Error("Unable to find next local date boundary");
  }

  let low = start.getTime();
  let high = end.getTime();
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDateKey(new Date(middle), timezone) === currentKey) low = middle;
    else high = middle;
  }
  return new Date(high);
}

// Compatibility spellings used by the client boundary watcher.
export const normalizeTimeZone = normalizeTimezone;

export const dateKeyToDate = dateKeyToDbDate;
export const dateToDateKey = dbDateToDateKey;
export const getDateKeyWeekWindow = getMondayWeekWindow;
export const dateKeyToDb = dateKeyToDbDate;
export const dbDateToKey = dbDateToDateKey;
export const getWeekday = weekdayOfDateKey;

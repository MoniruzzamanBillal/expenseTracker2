/**
 * Helpers for the user-editable transaction date ("occurredAt", server spec 21 /
 * client spec 48).
 *
 * Timezone note: the server groups transactions by their UTC calendar date
 * (getUTCDate/getUTCMonth) while the device displays them in local time. To make a
 * picked calendar day land on the same day in BOTH, a past date is pinned to LOCAL
 * NOON — noon ± the device offset stays inside the same UTC day for every realistic
 * timezone, so the stored instant's UTC date equals the picked day and local display
 * agrees. "Today" instead uses the real current time so a just-added entry sorts
 * naturally among the day's other entries.
 */

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** A picked Date (date-only) → the ISO string to send to the server as occurredAt. */
export const toOccurredAtISO = (picked: Date): string => {
  const now = new Date();
  if (isSameLocalDay(picked, now)) {
    return now.toISOString();
  }
  const noon = new Date(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    12,
    0,
    0,
    0,
  );
  return noon.toISOString();
};

/**
 * Initial value for the date picker. Prefers occurredAt, falls back to createdAt (older
 * rows / offline entries that predate occurredAt), and finally to today. Never returns an
 * Invalid Date.
 */
export const parseOccurredAt = (
  occurredAt?: string | null,
  createdAt?: string | null,
): Date => {
  const raw = occurredAt ?? createdAt;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

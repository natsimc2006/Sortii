/**
 * Week date utilities for Sortii.
 * All day indices use 0=Monday … 6=Sunday.
 */

const DAYS_ORDER = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
] as const;

/** 0=Monday … 6=Sunday (remaps JS Sunday 0 → 6) */
export function getTodayDayIndex(): number {
  const d = new Date().getDay(); // JS: 0=Sun, 1=Mon … 6=Sat
  return d === 0 ? 6 : d - 1;
}

/** True Thursday through Sunday — the "shop window" for next week */
export function isShopWindow(): boolean {
  return getTodayDayIndex() >= 3;
}

/** Monday 00:00 → Sunday 23:59 of the current calendar week */
export function getThisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const idx = getTodayDayIndex();
  const monday = new Date(now);
  monday.setDate(now.getDate() - idx);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** Monday 00:00 → Sunday 23:59 of next calendar week */
export function getNextWeekRange(): { start: Date; end: Date } {
  const { start, end } = getThisWeekRange();
  const s = new Date(start); s.setDate(s.getDate() + 7);
  const e = new Date(end);   e.setDate(e.getDate() + 7);
  return { start: s, end: e };
}

/** ISO date string (YYYY-MM-DD) for next week's Monday */
export function getNextWeekMondayISO(): string {
  const { start } = getNextWeekRange();
  return start.toISOString().split("T")[0]!;
}

/** Days from today (inclusive) through Sunday — ordered Mon-Sun indices */
export function getRemainingDayIndices(): number[] {
  const today = getTodayDayIndex();
  return DAYS_ORDER.map((_, i) => i).filter((i) => i >= today);
}

export { DAYS_ORDER };

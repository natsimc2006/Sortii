/**
 * weeklyAggregate.ts
 * Cross-module aggregation layer for Sortii.
 * Pure functions — no async, no React. Pass all data in as params.
 */

import { Appointment } from "./appointmentStore";
import { Bill, computeBillStatus } from "./billStore";
import { FamilyState } from "./familyTypes";

// ── Shared types ───────────────────────────────────────────────────────────────

export type SourceType   = "meal" | "juggle" | "appointment" | "bill";
export type UrgencyLevel = "normal" | "heads_up" | "important";
export type Severity     = "gentle" | "heads_up" | "important";
export type DateBucket   = "overdue" | "today" | "tomorrow" | "this_week" | "later";

export interface TimelineItem {
  id:            string;
  sourceType:    SourceType;
  title:         string;
  date?:         string;        // YYYY-MM-DD
  time?:         string;        // HH:MM
  assignedTo?:   string;        // human-readable name
  status?:       string;
  secondaryText?: string;
  urgencyLevel:  UrgencyLevel;
  rawSourceId:   string;
}

export interface ReminderItem {
  id:          string;
  sourceType:  SourceType;
  sourceId:    string;
  title:       string;
  displayText: string;
  severity:    Severity;
  date?:       string;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

export function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m! - 1), d!);
}

/** Convert a day name ("Monday") to this week's YYYY-MM-DD date string. */
export function getDayDateStr(dayName: string): string {
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const today       = new Date();
  const todayDow    = today.getDay();                          // 0=Sun … 6=Sat
  const todayMon    = todayDow === 0 ? 6 : todayDow - 1;      // 0=Mon … 6=Sun
  const targetIdx   = DAYS.indexOf(dayName);
  if (targetIdx < 0) return "";
  const diff = targetIdx - todayMon;
  const date = new Date(today);
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDateBucket(dateStr: string): DateBucket {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = parseDate(dateStr);
  const diff  = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)   return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 6)  return "this_week";
  return "later";
}

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h!) || isNaN(m!)) return hhmm;
  const period = h! >= 12 ? "pm" : "am";
  const hour   = h! % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

export function formatDateLabel(dateStr: string): string {
  const bucket = getDateBucket(dateStr);
  if (bucket === "today")    return "Today";
  if (bucket === "tomorrow") return "Tomorrow";
  if (bucket === "overdue")  return "Overdue";
  const d = parseDate(dateStr);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
}

// ── Appointments → timeline ────────────────────────────────────────────────────

export function appointmentsToTimeline(appts: Appointment[]): TimelineItem[] {
  return appts
    .filter((a) => !a.isDone && !a.isCancelled)
    .map((a): TimelineItem => {
      const bucket       = getDateBucket(a.date);
      const hasUnfinishedPrep = a.checklist.length > 0 && a.checklist.some((c) => !c.done);
      return {
        id:            `appt_${a.id}`,
        sourceType:    "appointment",
        title:         a.title,
        date:          a.date,
        time:          a.startTime,
        assignedTo:    a.person || undefined,
        status:        hasUnfinishedPrep ? "Needs prep" : undefined,
        secondaryText: [a.locationName, a.suburb].filter(Boolean).join(", ") || undefined,
        urgencyLevel:  bucket === "overdue" ? "important"
                     : bucket === "today" || bucket === "tomorrow" ? "heads_up"
                     : "normal",
        rawSourceId:   a.id,
      };
    });
}

// ── Bills → timeline ───────────────────────────────────────────────────────────

export function billsToTimeline(bills: Bill[]): TimelineItem[] {
  return bills
    .filter((b) => !b.isPaid)
    .map((b): TimelineItem => {
      const status = computeBillStatus(b);
      return {
        id:            `bill_${b.id}`,
        sourceType:    "bill",
        title:         b.title,
        date:          b.dueDate,
        assignedTo:    b.assignedTo || undefined,
        status,
        secondaryText: `$${b.amount.toFixed(2)}`,
        urgencyLevel:  status === "Overdue" ? "important"
                     : status === "Due Soon" ? "heads_up"
                     : "normal",
        rawSourceId:   b.id,
      };
    });
}

// ── Meals → timeline ───────────────────────────────────────────────────────────

export function mealsToTimeline(
  plan:    Array<{ day: string; slot: string; recipeId: string | null }>,
  recipes: Array<{ id: string; name: string }>
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const entry of plan) {
    if (entry.slot !== "dinner" || !entry.recipeId) continue;
    const date = getDayDateStr(entry.day);
    if (!date) continue;
    if (parseDate(date) < today) continue;
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe) continue;
    items.push({
      id:            `meal_${entry.day}`,
      sourceType:    "meal",
      title:         recipe.name,
      date,
      secondaryText: "Dinner",
      urgencyLevel:  "normal",
      rawSourceId:   entry.recipeId,
    });
  }
  return items;
}

// ── Family events → timeline ───────────────────────────────────────────────────

export function juggleToTimeline(familyState: FamilyState): TimelineItem[] {
  const items: TimelineItem[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const event of familyState.events) {
    const date = getDayDateStr(event.day);
    if (!date) continue;
    if (parseDate(date) < today) continue;

    // Resolve assigned driver name
    const driver = event.driverId
      ? familyState.members.find((m) => m.id === event.driverId)
      : undefined;

    // Resolve involved people names
    const involvedNames = event.personIds
      .map((pid) => familyState.members.find((m) => m.id === pid)?.name)
      .filter(Boolean)
      .join(", ");

    const bucket = getDateBucket(date);
    items.push({
      id:            `juggle_${event.id}`,
      sourceType:    "juggle",
      title:         event.title,
      date,
      time:          event.time || undefined,
      assignedTo:    driver?.name || involvedNames || undefined,
      secondaryText: event.location || undefined,
      urgencyLevel:  bucket === "today" ? "heads_up" : "normal",
      rawSourceId:   event.id,
    });
  }
  return items;
}

// ── Combine + sort all items ───────────────────────────────────────────────────

export function buildTimelineItems(params: {
  plan:         Array<{ day: string; slot: string; recipeId: string | null }>;
  recipes:      Array<{ id: string; name: string }>;
  appointments: Appointment[];
  bills:        Bill[];
  familyState:  FamilyState;
}): TimelineItem[] {
  const { plan, recipes, appointments, bills, familyState } = params;
  return [
    ...mealsToTimeline(plan, recipes),
    ...juggleToTimeline(familyState),
    ...appointmentsToTimeline(appointments),
    ...billsToTimeline(bills),
  ].sort((a, b) => {
    const da = a.date ?? "9999-12-31";
    const db = b.date ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    // urgency: important first within same day
    const uOrder = { important: 0, heads_up: 1, normal: 2 };
    if (a.urgencyLevel !== b.urgencyLevel) return uOrder[a.urgencyLevel] - uOrder[b.urgencyLevel];
    return (a.time ?? "00:00").localeCompare(b.time ?? "00:00");
  });
}

// ── Group by date bucket ───────────────────────────────────────────────────────

export function groupByBucket(items: TimelineItem[]): Record<DateBucket, TimelineItem[]> {
  const out: Record<DateBucket, TimelineItem[]> = {
    overdue: [], today: [], tomorrow: [], this_week: [], later: [],
  };
  for (const item of items) {
    out[item.date ? getDateBucket(item.date) : "later"].push(item);
  }
  return out;
}

// ── Weekly summary copy ────────────────────────────────────────────────────────

export function generateWeeklySummary(
  items: TimelineItem[],
  bills: Bill[]
): { headline: string; chips: string[] } {
  const today     = todayStr();
  const upcoming  = items.filter((i) => i.date && i.date >= today);

  const overdueBills = bills.filter((b) => computeBillStatus(b) === "Overdue").length;
  const dueSoonBills = bills.filter((b) => computeBillStatus(b) === "Due Soon").length;
  const apptCount    = upcoming.filter((i) => i.sourceType === "appointment").length;
  const juggleCount  = upcoming.filter((i) => i.sourceType === "juggle").length;
  const mealCount    = upcoming.filter((i) => i.sourceType === "meal").length;
  const billCount    = upcoming.filter((i) => i.sourceType === "bill").length;
  const prepCount    = upcoming.filter((i) => i.status === "Needs prep").length;

  // Busiest day detection
  const dayMap: Record<string, number> = {};
  for (const item of upcoming) {
    if (item.date) dayMap[item.date] = (dayMap[item.date] ?? 0) + 1;
  }
  let busiestDate  = "";
  let busiestCount = 0;
  for (const [date, count] of Object.entries(dayMap)) {
    if (count > busiestCount) { busiestCount = count; busiestDate = date; }
  }

  let headline: string;
  if (overdueBills > 0) {
    headline = `${overdueBills > 1 ? "A couple of" : "One"} bill${overdueBills > 1 ? "s" : ""} need${overdueBills === 1 ? "s" : ""} attention.`;
  } else if (upcoming.length === 0) {
    headline = "Nothing major coming up. Frankly, love that for you.";
  } else if (upcoming.length <= 2) {
    headline = "Surprisingly civilised so far.";
  } else if (busiestCount >= 3 && busiestDate) {
    const d       = parseDate(busiestDate);
    const dayName = DAYS_SHORT[d.getDay()] ?? "";
    headline = `${dayName}'s doing a bit much.`;
  } else if (prepCount >= 2) {
    headline = "A few bits need sorting before then.";
  } else if (upcoming.length <= 6) {
    headline = "A few moving parts, but manageable.";
  } else {
    headline = "This week's got a bit on.";
  }

  const chips: string[] = [];
  if (mealCount > 0)              chips.push(`${mealCount} meal${mealCount > 1 ? "s" : ""} planned`);
  if (juggleCount > 0)            chips.push(`${juggleCount} juggle item${juggleCount > 1 ? "s" : ""}`);
  if (apptCount > 0)              chips.push(`${apptCount} appointment${apptCount > 1 ? "s" : ""}`);
  if (dueSoonBills + overdueBills > 0) chips.push(`${dueSoonBills + overdueBills} bill${dueSoonBills + overdueBills > 1 ? "s" : ""} due`);
  if (prepCount > 0)              chips.push(`${prepCount} need${prepCount > 1 ? "" : "s"} prep`);

  return { headline, chips };
}

// ── Derive reminders ───────────────────────────────────────────────────────────

export function deriveReminders(params: {
  appointments: Appointment[];
  bills:        Bill[];
  familyState:  FamilyState;
}): ReminderItem[] {
  const reminders: ReminderItem[] = [];
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr_ = todayStr();

  // ── Appointment reminders
  for (const appt of params.appointments) {
    if (appt.isDone || appt.isCancelled) continue;
    const apptDate = parseDate(appt.date);
    const diffDays = Math.floor((apptDate.getTime() - today.getTime()) / 86_400_000);

    if (diffDays < 0) continue;

    if (diffDays === 0 && appt.reminderEnabled) {
      reminders.push({
        id: `r_appt_today_${appt.id}`, sourceType: "appointment", sourceId: appt.id,
        title: appt.title,
        displayText: `${appt.title} is today${appt.startTime ? ` at ${fmt12h(appt.startTime)}` : ""}${appt.person ? ` — for ${appt.person}` : ""}.`,
        severity: "important", date: appt.date,
      });
    } else if (diffDays === 1 && appt.reminderEnabled) {
      reminders.push({
        id: `r_appt_tomorrow_${appt.id}`, sourceType: "appointment", sourceId: appt.id,
        title: appt.title,
        displayText: `${appt.title} tomorrow${appt.startTime ? ` at ${fmt12h(appt.startTime)}` : ""}${appt.person ? ` — for ${appt.person}` : ""}.`,
        severity: "heads_up", date: appt.date,
      });
    }

    if (appt.checklist.length > 0 && appt.checklist.some((c) => !c.done) && diffDays <= 3) {
      reminders.push({
        id: `r_prep_${appt.id}`, sourceType: "appointment", sourceId: appt.id,
        title: appt.title,
        displayText: `${appt.title} has unfinished prep${diffDays === 0 ? " — it's today" : diffDays === 1 ? " — tomorrow" : ""}.`,
        severity: diffDays <= 1 ? "important" : "heads_up", date: appt.date,
      });
    }
  }

  // ── Bill reminders
  for (const bill of params.bills) {
    if (bill.isPaid) continue;
    const status   = computeBillStatus(bill);
    const billDate = parseDate(bill.dueDate);
    const diffDays = Math.floor((billDate.getTime() - today.getTime()) / 86_400_000);

    if (status === "Overdue") {
      reminders.push({
        id: `r_bill_overdue_${bill.id}`, sourceType: "bill", sourceId: bill.id,
        title: bill.title,
        displayText: `${bill.title} — $${bill.amount.toFixed(0)} — past due.`,
        severity: "important", date: bill.dueDate,
      });
    } else if (diffDays >= 0 && diffDays <= 3) {
      reminders.push({
        id: `r_bill_soon_${bill.id}`, sourceType: "bill", sourceId: bill.id,
        title: bill.title,
        displayText: `${bill.title} — $${bill.amount.toFixed(0)} — due ${diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`}.`,
        severity: "heads_up", date: bill.dueDate,
      });
    }
  }

  // ── Juggle today reminders
  for (const event of params.familyState.events) {
    const date = getDayDateStr(event.day);
    if (date !== todayStr_) continue;
    const driverName = event.driverId
      ? params.familyState.members.find((m) => m.id === event.driverId)?.name
      : undefined;
    const involvedNames = event.personIds
      .map((pid) => params.familyState.members.find((m) => m.id === pid)?.name)
      .filter(Boolean)
      .join(", ");
    const forStr = driverName ? ` — ${driverName} on it` : involvedNames ? ` — for ${involvedNames}` : "";
    reminders.push({
      id: `r_juggle_${event.id}`, sourceType: "juggle", sourceId: event.id,
      title: event.title,
      displayText: `${event.title} later today${event.time ? ` at ${fmt12h(event.time)}` : ""}${forStr}.`,
      severity: "heads_up", date,
    });
  }

  const sOrder: Record<Severity, number> = { important: 0, heads_up: 1, gentle: 2 };
  return reminders.sort((a, b) => sOrder[a.severity] - sOrder[b.severity]);
}

// ── Filter helpers ─────────────────────────────────────────────────────────────

export type SourceFilter = "all" | "meal" | "juggle" | "appointment" | "bill";

export function filterItems(
  items:        TimelineItem[],
  sourceFilter: SourceFilter,
  personFilter: string
): TimelineItem[] {
  return items.filter((item) => {
    if (sourceFilter !== "all" && item.sourceType !== sourceFilter) return false;
    if (personFilter !== "all") {
      const assigned = item.assignedTo?.toLowerCase() ?? "";
      if (!assigned.includes(personFilter.toLowerCase())) return false;
    }
    return true;
  });
}

export function severityColor(severity: Severity): string {
  if (severity === "important") return "#C04040";
  if (severity === "heads_up")  return "#D29A22";
  return "#2A8F88";
}

export function sourceColor(type: SourceType): string {
  if (type === "appointment") return "#5E3A4C";
  if (type === "bill")        return "#4A7B5E";
  if (type === "juggle")      return "#2A8F88";
  return "#D29A22";
}

export function sourceLabel(type: SourceType): string {
  if (type === "appointment") return "Appt";
  if (type === "bill")        return "Bill";
  if (type === "juggle")      return "Juggle";
  return "Meal";
}

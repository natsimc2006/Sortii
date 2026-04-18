import { DayOfWeek, FamilyEvent, FamilyMember, FamilyState } from "./familyTypes";

export const ALL_DAYS: DayOfWeek[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

// ── Time helpers ──────────────────────────────────────────────────────────────

export function timeToMins(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0") || 0;
  const m = parseInt(parts[1] ?? "0") || 0;
  return h * 60 + m;
}

export function formatTime(t: string): string {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0") || 0;
  const m = parseInt(parts[1] ?? "0") || 0;
  const period = h >= 12 ? "pm" : "am";
  const displayH = h % 12 || 12;
  return m === 0
    ? `${displayH}${period}`
    : `${displayH}:${m.toString().padStart(2, "0")}${period}`;
}

export function parseTime(input: string): string {
  if (!input) return "";
  const s = input.trim().toLowerCase().replace(/\s/g, "");

  const t24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (t24) {
    const h = parseInt(t24[1]!);
    const m = parseInt(t24[2]!);
    if (h >= 0 && h < 24 && m >= 0 && m < 60)
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1]!);
    const m = ampm[2] ? parseInt(ampm[2]) : 0;
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60)
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  return "";
}

// ── Output types ──────────────────────────────────────────────────────────────

export type InsightType = "conflict" | "tight" | "busy" | "solo" | "child_clash";
export type BusynessLevel = "clear" | "quiet" | "steady" | "busy";

export interface FamilyInsight {
  type: InsightType;
  day?: DayOfWeek;
  message: string;
}

export interface WeekSummaryData {
  totalEvents: number;
  weekendCount: number;
  busynessLevel: BusynessLevel;
  driverCount: number;
  unassignedCount: number;
}

export interface FamilyWeekResult {
  eventsByDay: Record<DayOfWeek, FamilyEvent[]>;
  weekendEvents: FamilyEvent[];
  daysWithEvents: DayOfWeek[];
  insights: FamilyInsight[];
  weekSummary: WeekSummaryData;
  planSplit: Map<string, DayOfWeek[]>;
  dashboardLine: string;
  dashboardSub: string;
  sharePlanText: string;
}

// ── Main compute function ─────────────────────────────────────────────────────

export function computeFamilyWeek(state: FamilyState): FamilyWeekResult {
  const { events, members } = state;

  // Group events by day, sorted by time
  const eventsByDay = {} as Record<DayOfWeek, FamilyEvent[]>;
  for (const day of ALL_DAYS) eventsByDay[day] = [];
  for (const e of events) {
    if (eventsByDay[e.day]) eventsByDay[e.day].push(e);
  }
  for (const day of ALL_DAYS) {
    eventsByDay[day].sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
  }

  const weekendEvents = [...eventsByDay.Saturday, ...eventsByDay.Sunday];
  const daysWithEvents = ALL_DAYS.filter((d) => eventsByDay[d].length > 0);
  const insights: FamilyInsight[] = [];

  // ── 1. Driver overlap / tight timing ──────────────────────────────────────
  for (const day of ALL_DAYS) {
    const dayEvs = eventsByDay[day];
    for (let i = 0; i < dayEvs.length - 1; i++) {
      const a = dayEvs[i]!;
      const b = dayEvs[i + 1]!;
      if (!a.driverId || a.driverId !== b.driverId) continue;
      const aEndMins = a.endTime
        ? timeToMins(a.endTime)
        : timeToMins(a.time) + 60;
      const gap = timeToMins(b.time) - aEndMins;
      if (gap < 0) {
        insights.push({
          type: "conflict",
          day,
          message: `${day}: ${a.title} and ${b.title} overlap for the same driver.`,
        });
      } else if (gap < 30) {
        insights.push({
          type: "tight",
          day,
          message: `${day}: Back-to-back — ${a.title} then ${b.title}. Tight timing.`,
        });
      }
    }
  }

  // ── 2. Child in two places at the same time ────────────────────────────────
  const children = members.filter((m) => m.role === "child");
  for (const child of children) {
    for (const day of ALL_DAYS) {
      const childEvs = eventsByDay[day].filter((e) =>
        e.personIds.includes(child.id)
      );
      // Check each pair for overlapping times
      for (let i = 0; i < childEvs.length - 1; i++) {
        const a = childEvs[i]!;
        const b = childEvs[i + 1]!;
        const aEndMins = a.endTime
          ? timeToMins(a.endTime)
          : timeToMins(a.time) + 60;
        const gap = timeToMins(b.time) - aEndMins;
        if (gap < 0) {
          insights.push({
            type: "child_clash",
            day,
            message: `${child.name} is in two places at once on ${day} — ${a.title} and ${b.title}.`,
          });
        } else if (gap < 20) {
          insights.push({
            type: "tight",
            day,
            message: `${day}: ${child.name} goes from ${a.title} straight to ${b.title}. Very tight.`,
          });
        }
      }
    }
  }

  // ── 3. Busy day (3+ events on one day) ────────────────────────────────────
  for (const day of ALL_DAYS) {
    if (eventsByDay[day].length >= 3) {
      insights.push({
        type: "busy",
        day,
        message: `${day}: Three or more things on. One of the heavier days this week.`,
      });
    }
  }

  // ── 4. Solo adult covering multiple busy days ──────────────────────────────
  const adults = members.filter((m) => m.role === "adult");
  if (adults.length === 1 && events.length >= 4) {
    const busyDays = ALL_DAYS.filter((d) => eventsByDay[d].length >= 2);
    if (busyDays.length >= 2) {
      insights.push({
        type: "solo",
        message: `Multiple busy days — just the one adult holding it together. Noted.`,
      });
    }
  }

  // ── Plan split (who drives which days) ────────────────────────────────────
  const planSplit = buildPlanSplit(eventsByDay, members);

  // ── Week summary object ───────────────────────────────────────────────────
  const totalEvents = events.length;
  const weekendCount = weekendEvents.length;
  const busynessLevel: BusynessLevel =
    totalEvents === 0 ? "clear"
    : totalEvents <= 2 ? "quiet"
    : totalEvents <= 5 ? "steady"
    : "busy";

  const unassignedCount = events.filter(
    (e) => !e.driverId && e.personIds.length > 0
  ).length;

  const weekSummary: WeekSummaryData = {
    totalEvents,
    weekendCount,
    busynessLevel,
    driverCount: planSplit.size,
    unassignedCount,
  };

  // ── Dashboard copy ────────────────────────────────────────────────────────
  const dashboardLine = buildDashboardLine(events, weekendEvents, insights);
  const dashboardSub  = buildDashboardSub(events, insights);
  const sharePlanText = buildSharePlan(eventsByDay, members);

  return {
    eventsByDay,
    weekendEvents,
    daysWithEvents,
    insights,
    weekSummary,
    planSplit,
    dashboardLine,
    dashboardSub,
    sharePlanText,
  };
}

// ── Plan split — who drives which days ───────────────────────────────────────

export function buildPlanSplit(
  eventsByDay: Record<DayOfWeek, FamilyEvent[]>,
  members: FamilyMember[]
): Map<string, DayOfWeek[]> {
  const split = new Map<string, DayOfWeek[]>();
  for (const day of ALL_DAYS) {
    const seen = new Set<string>();
    for (const ev of eventsByDay[day]) {
      if (!ev.driverId || seen.has(ev.driverId)) continue;
      seen.add(ev.driverId);
      const existing = split.get(ev.driverId) ?? [];
      split.set(ev.driverId, [...existing, day]);
    }
  }
  return split;
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

function buildDashboardLine(
  events: FamilyEvent[],
  weekendEvents: FamilyEvent[],
  insights: FamilyInsight[]
): string {
  if (events.length === 0) return "Nothing on the family radar this week.";

  const childClash  = insights.find((i) => i.type === "child_clash");
  const conflict    = insights.find((i) => i.type === "conflict");
  const tight       = insights.find((i) => i.type === "tight");

  if (childClash?.day)  return `${childClash.day}: one child in two places. Worth sorting.`;
  if (conflict?.day)    return `${conflict.day} needs a bit of thought. Some overlap.`;

  if (weekendEvents.length >= 3) {
    return `${weekendEvents.length} things this weekend. Worth mapping it out.`;
  }
  if (weekendEvents.length === 2) {
    const weekendTight = insights.some(
      (i) => (i.day === "Saturday" || i.day === "Sunday") && i.type === "tight"
    );
    return weekendTight
      ? "2 activities this weekend. Timing's a bit tight."
      : "2 activities this weekend. Saturday solves itself.";
  }
  if (weekendEvents.length === 1) {
    return `One thing this weekend. ${events.length > 1 ? "Week's otherwise fine." : "That's the lot."}`;
  }

  if (tight?.day) return `${tight.day} is back-to-back. Worth knowing.`;

  if (events.length === 1) return "One thing on this week. Simple enough.";
  if (events.length <= 3) return "A couple of things this week. All manageable.";
  if (events.length <= 5) return `${events.length} things this week. A steady one.`;
  return `${events.length} things on. Busy, but it's all in one place now.`;
}

function buildDashboardSub(
  events: FamilyEvent[],
  insights: FamilyInsight[]
): string {
  if (events.length === 0) return "A rare and peaceful sight.";
  const hasIssue = insights.some(
    (i) => i.type === "conflict" || i.type === "child_clash"
  );
  if (hasIssue) return "Tap to see what needs attention →";
  const hasTight = insights.some((i) => i.type === "tight");
  if (hasTight) return "Tap to see the details →";
  return "Tap to see the plan →";
}

// ── Share plan text ───────────────────────────────────────────────────────────

function buildSharePlan(
  eventsByDay: Record<DayOfWeek, FamilyEvent[]>,
  members: FamilyMember[]
): string {
  const lines: string[] = ["📅 Family plan this week:", ""];

  for (const day of ALL_DAYS) {
    const dayEvs = eventsByDay[day];
    if (dayEvs.length === 0) continue;
    lines.push(`${day}:`);
    for (const e of dayEvs) {
      const time    = formatTime(e.time);
      const endTime = e.endTime ? ` – ${formatTime(e.endTime)}` : "";
      const driver  = e.driverId
        ? (members.find((m) => m.id === e.driverId)?.name ?? null)
        : null;
      const who = e.personIds
        .map((id) => members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      let line = `  ${time}${endTime} — ${e.title}`;
      if (who) line += ` (${who})`;
      if (driver) line += ` — ${driver} driving`;
      if (e.location) line += ` @ ${e.location}`;
      if (e.carpoolContact) line += ` · carpool: ${e.carpoolContact}`;
      if (e.repeat !== "none") line += ` [repeats ${e.repeat}]`;
      lines.push(line);
    }
    lines.push("");
  }

  // Plan split summary
  const split = buildPlanSplit(eventsByDay, members);
  if (split.size > 0) {
    lines.push("Who's covering what:");
    for (const [driverId, days] of split.entries()) {
      const driver = members.find((m) => m.id === driverId);
      if (driver) lines.push(`  ${driver.name}: ${days.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("— Sent from Sortii.");
  return lines.join("\n");
}

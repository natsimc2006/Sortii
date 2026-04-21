import { Appointment } from "./appointmentStore";
import { FamilyState } from "./familyTypes";
import { Bill } from "./billStore";

export interface BusynessData {
  weekScore: number;
  dayScores: Record<string, number>;
  easyNightDay: string | null;
}

const ALL_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function getCurrentWeekRange(): { startMs: number; endMs: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const jsDay = today.getDay();
  const daysFromMon = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { startMs: monday.getTime(), endMs: sunday.getTime() };
}

function dateStrToMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

function dateStrToDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const jsDay = date.getDay();
  return ALL_DAYS[jsDay === 0 ? 6 : jsDay - 1]!;
}

export function computeBusynessData(
  appointments: Appointment[],
  familyState: FamilyState,
  bills: Bill[]
): BusynessData {
  const { startMs, endMs } = getCurrentWeekRange();

  // Appointments within this week, not done/cancelled
  const weekAppts = appointments.filter((a) => {
    if (a.isDone || a.isCancelled) return false;
    const ms = dateStrToMs(a.date);
    return ms >= startMs && ms <= endMs;
  });

  // One-off bills due this week, not paid
  const weekBills = bills.filter((b) => {
    if (b.isPaid || b.billType !== "oneOff") return false;
    const ms = dateStrToMs(b.dueDate);
    return ms >= startMs && ms <= endMs;
  });

  const familyEvents = familyState.events;

  // ── Per-day scores ────────────────────────────────────────────────────────
  const dayScores: Record<string, number> = {};
  for (const day of ALL_DAYS) {
    const famCount  = familyEvents.filter((e) => e.day === day).length;
    const apptCount = weekAppts.filter((a) => dateStrToDayName(a.date) === day).length;
    const hasAvailBlock = weekAppts.some(
      (a) =>
        dateStrToDayName(a.date) === day &&
        a.availabilityBlock &&
        a.availabilityBlock.personIds.length > 0
    );
    dayScores[day] = famCount + apptCount + (hasAvailBlock ? 1 : 0);
  }

  // ── Weekly score ──────────────────────────────────────────────────────────
  let weekScore = 0;

  // +1 per family event this week
  weekScore += familyEvents.length;

  // +1 per appointment this week
  weekScore += weekAppts.length;

  // +1 per one-off bill due this week
  weekScore += weekBills.length;

  // +1 per availability conflict (appt block + family event on same day involving same person)
  for (const appt of weekAppts) {
    if (!appt.availabilityBlock || !appt.availabilityBlock.personIds.length) continue;
    const apptDay = dateStrToDayName(appt.date);
    const blockedIds = appt.availabilityBlock.personIds;
    const dayFamEvents = familyEvents.filter((e) => e.day === apptDay);
    for (const fev of dayFamEvents) {
      const hasConflict = blockedIds.some(
        (pid) => fev.personIds.includes(pid) || fev.driverId === pid
      );
      if (hasConflict) {
        weekScore += 1;
        break;
      }
    }
  }

  // +2 per day where any family member appears in 3+ events
  for (const day of ALL_DAYS) {
    const dayFamEvents = familyEvents.filter((e) => e.day === day);
    const personCounts: Record<string, number> = {};
    for (const fev of dayFamEvents) {
      for (const pid of fev.personIds) {
        personCounts[pid] = (personCounts[pid] ?? 0) + 1;
      }
      if (fev.driverId) {
        personCounts[fev.driverId] = (personCounts[fev.driverId] ?? 0) + 1;
      }
    }
    const hasCrowdedDay = Object.values(personCounts).some((n) => n >= 3);
    if (hasCrowdedDay) weekScore += 2;
  }

  // +2 per appointment with both cost flag AND availability block
  for (const appt of weekAppts) {
    if (
      appt.appointmentCost && appt.appointmentCost > 0 &&
      appt.availabilityBlock && appt.availabilityBlock.personIds.length > 0
    ) {
      weekScore += 2;
    }
  }

  // ── Easy night day ────────────────────────────────────────────────────────
  let easyNightDay: string | null = null;
  if (weekScore >= 5) {
    let maxScore = -1;
    for (const day of ALL_DAYS) {
      const s = dayScores[day] ?? 0;
      if (s > maxScore) {
        maxScore = s;
        easyNightDay = day;
      }
    }
    if (!easyNightDay) easyNightDay = "Wednesday";
  }

  return { weekScore, dayScores, easyNightDay };
}

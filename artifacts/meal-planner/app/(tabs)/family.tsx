import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ALL_DAYS,
  BusynessLevel,
  FamilyInsight,
  FamilyWeekResult,
  WeekSummaryData,
  computeFamilyWeek,
  formatTime,
  parseTime,
} from "@/utils/familyEngine";
import {
  CarpoolContactEntry,
  DayOfWeek,
  FamilyEvent,
  FamilyMember,
  FamilyState,
  MEMBER_COLORS,
  RepeatType,
} from "@/utils/familyTypes";
import { loadFamilyState, saveFamilyState } from "@/utils/familyStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SortiiCalEvent, FAMILY_PUSHED_KEY } from "@/utils/calendarTypes";
import { loadFamilyPushedEvents, removeEventFromFamily } from "@/utils/appointmentService";
import { loadAppointments, saveAppointments, Appointment } from "@/utils/appointmentStore";
import { solveJuggle } from "@/services/juggleSolver";
import { getDriveTimes, buildTravelContext } from "@/services/travelTime";

// ── Brand tokens ───────────────────────────────────────────────────────────────
const TEAL         = "#2A8F88";
const TEAL_TINT    = "#E6F3F0";
const GOLD         = "#D29A22";
const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : 58;
const PLUM       = "#5E3A4C";
const ORANGE     = "#E07B3A";
const BG         = "#FFFFFF";
const CARD_BG    = "#FFFDF9";
const BORDER     = "#E6E1D7";
const TEXT       = "#2B2B2B";
const TEXT_MUTED = "#888888";

const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

import { SK } from "@/utils/storageKeys";
import { getCurrentUserId } from "@/utils/currentUser";

function juggleKey(weekOffset: number = 0) {
  const base = SK.juggle(getCurrentUserId());
  return weekOffset === 0 ? base : `${base}_w${weekOffset}`;
}
const HELPERS_KEY       = "@sortii_helpers_v1";

// ── Family helpers ─────────────────────────────────────────────────────────────
export interface FamilyHelper {
  id: string;
  name: string;
  contact?: string;
}

// ── Travel timing helper ───────────────────────────────────────────────────────
function timeToMinsLocal(hhmm: string): number {
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(":");
  return (parseInt(hStr ?? "0") || 0) * 60 + (parseInt(mStr ?? "0") || 0);
}

function getTravelHint(
  a: FamilyEvent,
  b: FamilyEvent,
  juggleDriverMap: Map<string, string>,
): string | null {
  const dA = juggleDriverMap.get(a.id);
  const dB = juggleDriverMap.get(b.id);
  if (!dA || dA !== dB) return null;
  if (!a.location || !b.location) return null;
  if (a.location.trim().toLowerCase() === b.location.trim().toLowerCase()) return null;
  const aEnd = a.endTime ? timeToMinsLocal(a.endTime) : timeToMinsLocal(a.time) + 60;
  const gap  = timeToMinsLocal(b.time) - aEnd;
  if (gap < 0 || gap > 45) return null;
  if (gap <= 15) return `Tight run for ${dA} between here and ${b.location} 👀`;
  return `~${gap} mins between these for ${dA} — should be fine.`;
}

// ── Juggle AI result types ─────────────────────────────────────────────────────
export interface JuggleEventItem {
  id: string;
  child: string | null;
  activity: string;
  location: string | null;
  day: "Saturday" | "Sunday" | "Weekday";
  start_time: string;
  end_time: string;
  assigned_adult: string;
  adult_must_stay: boolean;
  child_colour_index: number;
}
export interface JuggleConflict {
  id: string;
  type: "overlap" | "unassigned" | "tight";
  severity: "tight" | "warning" | "impossible";
  description: string;
  involved_events: string[];
  involved_adults: string[];
  suggested_contacts: string[];
  recommendation: string;
  options: string[];
}
export interface JuggleScheduleItem {
  time: string;
  child: string | null;
  activity: string;
  location: string | null;
  event_id: string;
}
export interface JuggleFreeWindow {
  from: string;
  to: string;
  duration_minutes: number;
  is_end_of_day: boolean;
}
export interface JuggleAdultPlan {
  adult: string;
  can_drive: boolean;
  schedule: JuggleScheduleItem[];
  free_windows: JuggleFreeWindow[];
}
export interface JuggleResult {
  weekend_summary: {
    total_events: number;
    conflicts_resolved: number;
    tight_windows: number;
    impossible_clashes: number;
  };
  events: JuggleEventItem[];
  conflicts: JuggleConflict[];
  adult_plans: JuggleAdultPlan[];
  travel_estimates: unknown[];
  least_painful_version: { applicable: boolean };
  smart_note: string | null;
  solvedAt: number;
  swapOverrides?: Record<string, string>;
}

const REPEAT_LABELS: Record<RepeatType, string> = {
  none: "One-off", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly",
};

const DAY_ORDER: Partial<Record<DayOfWeek, number>> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function _toMins(hhmm: string | undefined): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function _fromMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Travel time matrix (minutes) — key is "locationA|locationB" sorted alphabetically lowercase
const TRAVEL_MATRIX: Record<string, number> = {
  "morisset|rathmines": 12,
  "rathmines|warners bay": 10,
  "morisset|warners bay": 15,
};

function getTravelTime(locA: string | null | undefined, locB: string | null | undefined): number {
  if (!locA || !locB) return 15;
  const a = locA.trim().toLowerCase();
  const b = locB.trim().toLowerCase();
  if (a === b) return 0;
  const key = [a, b].sort().join("|");
  return TRAVEL_MATRIX[key] ?? 15;
}

const MEDICAL_KEYWORDS = ["doctor", "doctors", "gp", "dentist", "hospital", "physio", "appointment"];

function isMedicalAppointment(title: string): boolean {
  const t = title.toLowerCase();
  return MEDICAL_KEYWORDS.some((k) => t.includes(k));
}

// ── On-device juggle solver (no network required) ─────────────────────────────
function solveJuggleOnDevice(
  adults: FamilyMember[],
  events: FamilyEvent[],
  calEvents: SortiiCalEvent[],
  memberLookup: Map<string, FamilyMember>,
): JuggleResult {
  if (adults.length === 0) {
    return {
      weekend_summary: { total_events: 0, conflicts_resolved: 0, tight_windows: 0, impossible_clashes: 0 },
      events: [], conflicts: [], adult_plans: [], travel_estimates: [],
      least_painful_version: { applicable: false }, smart_note: null, solvedAt: Date.now(),
    };
  }

  // Assign each event — prefer the adult in personIds, fall back to load-balance
  const adultLoadMap = new Map<string, Map<DayOfWeek, number>>();
  for (const a of adults) adultLoadMap.set(a.id, new Map());
  const assignments = new Map<string, string>(); // eventId → adultId

  for (const ev of events) {
    // Check if an adult is explicitly named in personIds
    const explicitAdult = ev.personIds
      .map((id) => memberLookup.get(id))
      .find((m) => m?.role === "adult");

    let chosen: FamilyMember;
    if (explicitAdult) {
      chosen = explicitAdult;
    } else {
      let best = adults[0]!;
      let bestLoad = Infinity;
      for (const a of adults) {
        const load = adultLoadMap.get(a.id)?.get(ev.day) ?? 0;
        if (load < bestLoad) { bestLoad = load; best = a; }
      }
      chosen = best;
    }
    assignments.set(ev.id, chosen.id);
    const dayMap = adultLoadMap.get(chosen.id)!;
    dayMap.set(ev.day, (dayMap.get(ev.day) ?? 0) + 1);
  }

  // Build juggle event items
  const juggleEvents: JuggleEventItem[] = events.map((ev, idx) => {
    const adultId = assignments.get(ev.id) ?? adults[0]!.id;
    const adultMember = adults.find((a) => a.id === adultId) ?? adults[0]!;
    const child = ev.personIds
      .map((id) => memberLookup.get(id))
      .find((m) => m?.role === "child")?.name ?? null;
    const dayType: "Saturday" | "Sunday" | "Weekday" =
      ev.day === "Saturday" ? "Saturday"
      : ev.day === "Sunday" ? "Sunday"
      : "Weekday";
    return {
      id: ev.id, child, activity: ev.title,
      location: ev.location || null, day: dayType,
      start_time: ev.time || "09:00",
      end_time: ev.endTime || "",
      assigned_adult: adultMember.name,
      adult_must_stay: false, child_colour_index: idx % 6,
    };
  });

  // Detect overlaps per adult per day
  const conflicts: JuggleConflict[] = [];
  const adultEventsMap = new Map<string, FamilyEvent[]>();
  for (const [evId, adultId] of assignments.entries()) {
    const ev = events.find((e) => e.id === evId);
    if (!ev) continue;
    if (!adultEventsMap.has(adultId)) adultEventsMap.set(adultId, []);
    adultEventsMap.get(adultId)!.push(ev);
  }
  for (const [adultId, evList] of adultEventsMap.entries()) {
    const adult = adults.find((a) => a.id === adultId);
    if (!adult) continue;
    const byDay = new Map<DayOfWeek, FamilyEvent[]>();
    for (const ev of evList) {
      if (!byDay.has(ev.day)) byDay.set(ev.day, []);
      byDay.get(ev.day)!.push(ev);
    }
    for (const [day, dayEvs] of byDay.entries()) {
      const sorted = dayEvs.slice().sort((a, b) => _toMins(a.time) - _toMins(b.time));
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i]!; const b = sorted[i + 1]!;
        const aEnd = _toMins(a.endTime) || _toMins(a.time) + 60;
        const bStart = _toMins(b.time);
        if (bStart < aEnd) {
          const bEnd = _toMins(b.endTime) || _toMins(b.time) + 60;
          const aIsRecurring = a.repeat !== "none";
          const bIsRecurring = b.repeat !== "none";
          const aIsMedical = isMedicalAppointment(a.title);
          const bIsMedical = isMedicalAppointment(b.title);
          const aChild = a.personIds.map((id) => memberLookup.get(id)).find((m) => m?.role === "child")?.name ?? null;
          const aEndLabel = a.endTime ? a.endTime : _fromMins(_toMins(a.time) + 60);

          // ── Priority 1: Find adults who can cover via handoff ──────────────
          const handoffCandidates: Array<{ adult: FamilyMember; lastEvent: FamilyEvent | null; availableAt: number }> = [];
          for (const oa of adults) {
            if (oa.id === adultId) continue;
            const oaDayEvs = (adultEventsMap.get(oa.id) ?? []).filter((e) => e.day === day);
            // Skip if this adult is busy during the conflict window
            const hasConflict = oaDayEvs.some((e) => {
              const eStart = _toMins(e.time);
              const eEnd = _toMins(e.endTime) || _toMins(e.time) + 60;
              return eStart < bEnd && eEnd > bStart;
            });
            if (hasConflict) continue;
            // Find their last event ending before bStart
            const eventsBefore = oaDayEvs
              .filter((e) => { const eEnd = _toMins(e.endTime) || _toMins(e.time) + 60; return eEnd <= bStart; })
              .sort((e1, e2) => {
                const e1End = _toMins(e1.endTime) || _toMins(e1.time) + 60;
                const e2End = _toMins(e2.endTime) || _toMins(e2.time) + 60;
                return e2End - e1End;
              });
            if (eventsBefore.length === 0) {
              handoffCandidates.push({ adult: oa, lastEvent: null, availableAt: 0 });
            } else {
              const lastEv = eventsBefore[0]!;
              const lastEvEnd = _toMins(lastEv.endTime) || _toMins(lastEv.time) + 60;
              // DISABLED — local travel validation overrides Claude's handoff reasoning.
              // The travel check below was causing false "not possible" flags because
              // it doesn't account for adult availability and uses an approximate matrix.
              // Claude handles travel estimation via the system prompt.
              /*
              const travel = getTravelTime(lastEv.location, a.location);
              if (lastEvEnd + travel <= aEnd) {
                handoffCandidates.push({ adult: oa, lastEvent: lastEv, availableAt: lastEvEnd });
              }
              */
              handoffCandidates.push({ adult: oa, lastEvent: lastEv, availableAt: lastEvEnd });
            }
          }

          const description = `${adult.name} has overlapping commitments on ${day}.\n${a.title} runs until ${aEndLabel}. ${b.title} is at ${b.time}.`;
          let recommendation = "";

          if (handoffCandidates.length > 0) {
            // Priority 1 — handoff is possible
            const best = handoffCandidates[0]!;
            const coverVerb = aChild
              ? `collect ${aChild} from ${a.title} at ${aEndLabel}`
              : `cover ${a.title} at ${aEndLabel}`;
            if (best.lastEvent) {
              const lastEvEndLabel = _fromMins(best.availableAt);
              recommendation = `${best.adult.name} finishes ${best.lastEvent.title} at ${lastEvEndLabel} — they could ${coverVerb} while ${adult.name} heads to ${b.title}.`;
            } else {
              recommendation = `${best.adult.name} is free — they could ${coverVerb} while ${adult.name} heads to ${b.title}.`;
            }
          } else if (aIsRecurring && !bIsRecurring && !bIsMedical) {
            // Priority 2a — reschedule the one-off (b), never reschedule recurring
            recommendation = `${b.title} is a one-off — moving it to after ${aEndLabel} keeps everything else in place.`;
          } else if (!aIsRecurring && bIsRecurring && !aIsMedical) {
            // Priority 2b — reschedule the one-off (a), never reschedule recurring
            recommendation = `${a.title} is a one-off — moving it to avoid clashing with the regular ${b.title} keeps everything in place.`;
          } else if (aIsMedical || bIsMedical) {
            // Priority 3 — medical appointment is fixed, no handoff available
            recommendation = "This one needs sorting manually.";
          } else {
            // Priority 2c — both non-recurring, no handoff
            recommendation = `Both "${a.title}" and "${b.title}" are on at the same time — which takes priority?`;
          }

          conflicts.push({
            id: `overlap-${a.id}-${b.id}`, type: "overlap", severity: "warning",
            description,
            involved_events: [a.id, b.id], involved_adults: [adult.name],
            suggested_contacts: handoffCandidates.map((h) => h.adult.name),
            recommendation,
            options: [],
          });
        }
      }
    }
  }

  // Build adult_plans
  const adultPlans: JuggleAdultPlan[] = adults.map((adult) => {
    const evList = adultEventsMap.get(adult.id) ?? [];
    const schedule: JuggleScheduleItem[] = evList
      .sort((a, b) => {
        const dd = (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0);
        return dd !== 0 ? dd : _toMins(a.time) - _toMins(b.time);
      })
      .map((ev) => {
        const child = ev.personIds
          .map((id) => memberLookup.get(id))
          .find((m) => m?.role === "child")?.name ?? null;
        return { time: ev.time || "09:00", child, activity: ev.title, location: ev.location || null, event_id: ev.id };
      });
    return { adult: adult.name, can_drive: true, schedule, free_windows: [] };
  });

  const totalEvents = juggleEvents.length + calEvents.length;
  const smartNote = totalEvents === 0 ? null
    : conflicts.length > 0
    ? `${conflicts.length} overlap${conflicts.length > 1 ? "s" : ""} to sort — see below.`
    : totalEvents === 1 ? "One event. One adult. Done."
    : "All events assigned. Nothing clashing.";

  return {
    weekend_summary: {
      total_events: totalEvents,
      conflicts_resolved: 0,
      tight_windows: 0,
      impossible_clashes: conflicts.filter((c) => c.severity === "impossible").length,
    },
    events: juggleEvents, conflicts, adult_plans: adultPlans,
    travel_estimates: [], least_painful_version: { applicable: false },
    smart_note: smartNote, solvedAt: Date.now(),
  };
}

const BUSYNESS_CONFIG: Record<BusynessLevel, { label: string; color: string }> = {
  clear:  { label: "Clear week",  color: TEXT_MUTED },
  quiet:  { label: "Quiet week",  color: TEAL },
  steady: { label: "Steady week", color: GOLD },
  busy:   { label: "Busy week",   color: ORANGE },
};

// ── Local-timezone date helpers ────────────────────────────────────────────────
// ALWAYS use these instead of .toISOString() for date strings —
// toISOString() converts to UTC which gives the wrong date for AU/NZ users.
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAYS_JS_TO_SORTII: DayOfWeek[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const DAY_TO_JS: Record<DayOfWeek, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

// Monday-anchored offset (Mon=0 … Sun=6) — used to anchor dates to the correct calendar week.
const DAY_FROM_MON: Record<DayOfWeek, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

/**
 * Returns the YYYY-MM-DD date for `dayName` in the Mon-Sun week that is
 * `weekOffset` weeks ahead of the current week (0 = this week, 1 = next week).
 * Always uses local-timezone arithmetic — never toISOString().
 */
function dateForDayInWeek(dayName: DayOfWeek, weekOffset: number = 0): string {
  const now = new Date();
  const jsDay = now.getDay();
  const diffToMon = jsDay === 0 ? -6 : 1 - jsDay; // days from today to this Monday
  const monDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon + weekOffset * 7);
  const d = new Date(monDate.getFullYear(), monDate.getMonth(), monDate.getDate() + DAY_FROM_MON[dayName]);
  return localDateStr(d);
}

// ── Blank event draft ──────────────────────────────────────────────────────────
function blankDraft(): Omit<FamilyEvent, "id"> {
  return {
    title: "", day: "Monday", time: "", endTime: "", location: "",
    personIds: [], driverId: undefined, carpoolContact: "", carpoolContacts: [],
    repeat: "none", notes: "",
    isAppointment: false,
    assignedAdult: "",
    priority: "must",
  };
}

// ── MemberChip ─────────────────────────────────────────────────────────────────
function MemberChip({
  member, selected, onPress, small,
}: { member: FamilyMember; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const bg = selected ? member.color : member.color + "18";
  const fg = selected ? "#fff" : member.color;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.memberChip,
        { backgroundColor: bg, borderColor: member.color + (selected ? "00" : "44") },
        small && styles.memberChipSmall,
      ]}
    >
      <Text style={[styles.memberChipText, { color: fg }, small && styles.memberChipTextSmall]}>
        {member.name}
      </Text>
      {member.role === "adult" && (
        <View style={[styles.roleDot, { backgroundColor: selected ? "#ffffff88" : member.color + "88" }]} />
      )}
    </TouchableOpacity>
  );
}

// ── WeekSummaryCard ────────────────────────────────────────────────────────────
function WeekSummaryCard({ summary }: { summary: WeekSummaryData }) {
  if (summary.totalEvents === 0) return null;
  const { label: busynessLabel, color: busynessColor } = BUSYNESS_CONFIG[summary.busynessLevel];

  return (
    <View style={styles.weekSummaryCard}>
      <View style={styles.weekSummaryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{summary.totalEvents}</Text>
          <Text style={styles.statLabel}>{summary.totalEvents === 1 ? "event" : "events"}</Text>
        </View>
        {summary.weekendCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: GOLD }]}>{summary.weekendCount}</Text>
            <Text style={styles.statLabel}>this weekend</Text>
          </View>
        )}
        {summary.driverCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: TEAL }]}>{summary.driverCount}</Text>
            <Text style={styles.statLabel}>{summary.driverCount === 1 ? "driver" : "drivers"}</Text>
          </View>
        )}
        <View style={[styles.busynessPill, { backgroundColor: busynessColor + "18", borderColor: busynessColor + "44" }]}>
          <View style={[styles.busynessDot, { backgroundColor: busynessColor }]} />
          <Text style={[styles.busynessText, { color: busynessColor }]}>{busynessLabel}</Text>
        </View>
      </View>
      {summary.unassignedCount > 0 && (
        <View style={styles.unassignedNote}>
          <Text style={[styles.unassignedNoteText, { fontStyle: "italic" }]}>
            Tap Sort to assign drivers →
          </Text>
        </View>
      )}
    </View>
  );
}

// ── PlanSplitSection ───────────────────────────────────────────────────────────
function PlanSplitSection({
  planSplit,
  members,
}: {
  planSplit: Map<string, DayOfWeek[]>;
  members: FamilyMember[];
}) {
  if (planSplit.size === 0) return null;

  return (
    <View style={styles.planSplitCard}>
      <View style={styles.planSplitHeader}>
        <Feather name="navigation" size={13} color={TEAL} />
        <Text style={styles.planSplitTitle}>Who's covering what</Text>
      </View>
      {Array.from(planSplit.entries()).map(([driverId, days]) => {
        const driver = members.find((m) => m.id === driverId);
        if (!driver) return null;
        return (
          <View key={driverId} style={styles.planSplitRow}>
            <View style={[styles.planSplitDot, { backgroundColor: driver.color }]} />
            <Text style={styles.planSplitName}>{driver.name}</Text>
            <View style={styles.planSplitDays}>
              {days.map((d) => (
                <View
                  key={d}
                  style={[
                    styles.planSplitDayChip,
                    { borderColor: driver.color + "44", backgroundColor: driver.color + "14" },
                  ]}
                >
                  <Text style={[styles.planSplitDayText, { color: driver.color }]}>
                    {DAY_ABBR[d]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── InsightsSection ────────────────────────────────────────────────────────────
function InsightsSection({ insights }: { insights: FamilyInsight[] }) {
  if (insights.length === 0) return null;

  const iconMap: Record<string, string> = {
    conflict:    "alert-triangle",
    child_clash: "alert-circle",
    tight:       "clock",
    busy:        "layers",
    solo:        "user",
  };
  const colorMap: Record<string, string> = {
    conflict:    "#C0392B",
    child_clash: "#C0392B",
    tight:       ORANGE,
    busy:        GOLD,
    solo:        PLUM,
  };

  return (
    <View style={styles.insightsCard}>
      <View style={styles.insightsHeader}>
        <Feather name="zap" size={13} color={ORANGE} />
        <Text style={styles.insightsTitle}>Worth knowing</Text>
      </View>
      {insights.map((ins, i) => (
        <View key={i} style={styles.insightRow}>
          <Feather
            name={(iconMap[ins.type] ?? "info") as any}
            size={13}
            color={colorMap[ins.type] ?? TEXT_MUTED}
          />
          <Text style={styles.insightText}>{ins.message}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Light insight (always-on "worth knowing" for quiet weeks) ─────────────────
function getLightInsight(result: FamilyWeekResult): string | null {
  if (result.weekSummary.totalEvents === 0) return null;
  if (result.insights.length > 0) return null; // real insights take precedence
  const { totalEvents, weekendCount, busynessLevel } = result.weekSummary;
  if (totalEvents === 1) return "One event only. Nothing to worry about.";
  if (weekendCount >= 2 && busynessLevel === "quiet") return "Weekend looks busy. Nothing clashing though.";
  if (weekendCount === 1 && busynessLevel === "quiet") return "One thing this weekend. Should sort itself.";
  if (busynessLevel === "quiet") return "Two things on. Nothing that doesn't fit.";
  if (busynessLevel === "steady" && weekendCount === 0) return "Everything fits neatly this week.";
  if (busynessLevel === "steady") return "A steady week with nothing clashing.";
  if (busynessLevel === "busy") return "A full week — but it's all in one place now.";
  return "Everything currently fits.";
}

// ── JuggleProcessingOverlay ────────────────────────────────────────────────────
const JUGGLE_LINES = [
  "Untangling the family juggle…",
  "Working out who goes where.",
  "Finding the least painful version.",
  "Checking if anyone gets a breather.",
];

function JuggleProcessingOverlay() {
  const lineIndex = useRef(0);
  const [lineText, setLineText] = useState(JUGGLE_LINES[0]!);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        lineIndex.current = (lineIndex.current + 1) % JUGGLE_LINES.length;
        setLineText(JUGGLE_LINES[lineIndex.current]!);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.juggleOverlay}>
      <Animated.View style={[styles.jugglePulse, { transform: [{ scale: pulseAnim }] }]}>
        <Feather name="navigation" size={28} color="#fff" />
      </Animated.View>
      <Animated.Text style={[styles.juggleLineText, { opacity: fadeAnim }]}>
        {lineText}
      </Animated.Text>
      <Text style={styles.juggleSubText}>This usually takes a few seconds.</Text>
    </View>
  );
}

// ── JuggleResultsContent — full results screen ────────────────────────────────
function JuggleResultsContent({
  juggleResult,
  members,
  carpoolContacts,
  onClose,
  onSortAgain,
  onShare,
  onSwapApplied,
}: {
  juggleResult: JuggleResult;
  members: FamilyMember[];
  carpoolContacts: CarpoolContact[];
  onClose: () => void;
  onSortAgain: () => void;
  onShare: (text: string) => void;
  onSwapApplied?: (event_id: string, adult: string) => void;
}) {
  type TravelEstimate = {
    from_event_id: string; to_event_id: string;
    status: "comfortable" | "tight" | "impossible";
    estimated_drive_display: string; note: string | null;
  };
  const ws            = juggleResult.weekend_summary ?? { total_events: 0, conflicts_resolved: 0, tight_windows: 0, impossible_clashes: 0 };
  const adultPlans    = juggleResult.adult_plans ?? [];
  const conflicts     = juggleResult.conflicts ?? [];
  const travelEstimates = (juggleResult.travel_estimates ?? []) as TravelEstimate[];
  const swapOverrides = juggleResult.swapOverrides ?? {};
  const planRows = adultPlans.flatMap((p) =>
    p.schedule.map((s) => {
      const evtItem = (juggleResult.events ?? []).find((e) => e.id === s.event_id);
      return {
        time:     s.time,
        endTime:  evtItem?.end_time ?? null as string | null,
        adult:    swapOverrides[s.event_id] ?? p.adult,
        child:    s.child,
        activity: s.activity,
        location: s.location,
        event_id: s.event_id,
      };
    })
  ).sort((a, b) => a.time.localeCompare(b.time));

  const impossible = ws.impossible_clashes ?? 0;
  const tight      = ws.tight_windows ?? 0;

  const [swapRow, setSwapRow]   = useState<typeof planRows[0] | null>(null);
  const [swapPick, setSwapPick] = useState<string>("");

  const adultMembers = members.filter((m) => m.role === "adult");

  // Map each adult → short schedule blurb (their current plan rows)
  const adultRowSummary = React.useMemo(() => {
    const map: Record<string, string> = {};
    planRows.forEach((r) => {
      const blurb = `${r.activity} ${r.time}${r.endTime ? `–${r.endTime}` : ""}`;
      map[r.adult] = map[r.adult] ? `${map[r.adult]}, ${blurb}` : blurb;
    });
    return map;
  }, [planRows]);

  // Returns true if the given adult already covers another row at the same time
  function hasTimeConflict(eventId: string, adult: string, time: string): boolean {
    return planRows.some(
      (r) => r.event_id !== eventId && r.adult === adult && r.time === time
    );
  }

  function buildShareText() {
    const lines: string[] = ["WEEKEND PLAN", ""];
    adultPlans.forEach((p) =>
      p.schedule.forEach((s) => {
        const who = s.child ? `${p.adult} → ${s.child}` : p.adult;
        lines.push(`${s.time}  ${who} · ${s.activity}${s.location ? ` · ${s.location}` : ""}`);
      })
    );
    if (conflicts.length > 0) {
      lines.push("", "⚠ NEEDS SORTING:");
      conflicts.forEach((c) => {
        lines.push(c.description);
        c.options.forEach((o) => lines.push(`· ${o}`));
      });
    }
    if (juggleResult.smart_note) lines.push("", juggleResult.smart_note);
    lines.push("", "Made with Sortii.");
    return lines.join("\n");
  }

  // Dashboard headline — narrative sentence built from adult plans
  const dashHeadline = (() => {
    if (impossible > 0) return "Almost there — one thing needs your call.";
    if (adultPlans.length === 0) return "Sorted.";
    const parts = adultPlans.map((plan) => {
      const first = plan.adult.split(" ")[0];
      const primaryActivity = plan.schedule[0]?.activity ?? "their thing";
      return `${first} has ${primaryActivity}`;
    });
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1) + ".")
      .join(" ") + " Done.";
  })();

  const dashSummaryLine = (() => {
    const parts: string[] = [];
    if (ws.total_events > 0) parts.push(`${ws.total_events} ${ws.total_events === 1 ? "event" : "events"}`);
    if (impossible > 0)       parts.push(`${impossible} ${impossible === 1 ? "clash" : "clashes"} to sort`);
    else if (tight > 0)       parts.push(`${tight} tight window${tight > 1 ? "s" : ""}, manageable`);
    else                      parts.push("nothing clashing");
    if (ws.conflicts_resolved > 0 && impossible === 0) parts.push(`${ws.conflicts_resolved} sorted ✓`);
    return parts.join("  ·  ");
  })();

  // Chip colour config
  const dashBg = impossible > 0 ? "#FDF2F0" : tight > 0 ? "#FFFBF0" : "#EDFAF6";
  const dashAccent = impossible > 0 ? "#C0695A" : tight > 0 ? GOLD : TEAL;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 0, paddingBottom: 120 }}>
      {/* ── 1. Hero dashboard ── */}
      <View style={[styles.resultDashboard, { backgroundColor: dashBg, borderBottomColor: dashAccent + "22" }]}>
        {/* Coloured accent bar */}
        <View style={[styles.resultDashboardBar, { backgroundColor: dashAccent }]} />
        <View style={styles.resultDashboardBody}>
          <Text style={styles.resultDashboardHeadline}>{dashHeadline}</Text>
          <Text style={styles.resultDashboardSub}>{dashSummaryLine}</Text>
          {/* Stat chips row */}
          <View style={styles.resultDashboardChips}>
            <View style={[styles.resultChip, { backgroundColor: TEAL + "18", borderColor: TEAL + "33" }]}>
              <Text style={[styles.resultChipText, { color: TEAL }]}>
                {ws.total_events} {ws.total_events === 1 ? "event" : "events"}
              </Text>
            </View>
            {impossible > 0 && (
              <View style={[styles.resultChip, { backgroundColor: "#F7E9E8", borderColor: "#EDD5D0" }]}>
                <Text style={[styles.resultChipText, { color: "#C0695A" }]}>
                  {impossible} {impossible === 1 ? "clash" : "clashes"}
                </Text>
              </View>
            )}
            {tight > 0 && (
              <View style={[styles.resultChip, { backgroundColor: "#E6F3F0", borderColor: TEAL + "33" }]}>
                <Text style={[styles.resultChipText, { color: TEAL }]}>
                  {tight} tight {tight === 1 ? "window" : "windows"}
                </Text>
              </View>
            )}
            {ws.conflicts_resolved > 0 && impossible === 0 && conflicts.length === 0 && (
              <View style={[styles.resultChip, { backgroundColor: TEAL + "18", borderColor: TEAL + "33" }]}>
                <Text style={[styles.resultChipText, { color: TEAL }]}>
                  {ws.conflicts_resolved} sorted ✓
                </Text>
              </View>
            )}
            {impossible === 0 && conflicts.length > 0 && (
              <View style={[styles.resultChip, { backgroundColor: GOLD, borderColor: GOLD }]}>
                <Text style={[styles.resultChipText, { color: "#fff" }]}>
                  {conflicts.length} {conflicts.length === 1 ? "clash" : "clashes"} to sort
                </Text>
              </View>
            )}
            {impossible === 0 && tight === 0 && conflicts.length === 0 && (
              <View style={[styles.resultChip, { backgroundColor: TEAL + "18", borderColor: TEAL + "33" }]}>
                <Text style={[styles.resultChipText, { color: TEAL }]}>all clear ✓</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16, paddingTop: 18 }}>

      {/* ── 2. WHO'S DOING THE RUNNING ── */}
      {adultPlans.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={styles.juggleSectionLabel}>WHO'S GOT WHAT</Text>
          {adultPlans.map((plan) => {
            const member = members.find((m) => m.name === plan.adult);
            return (
              <View key={plan.adult} style={[styles.juggleAdultCard, { borderLeftColor: member?.color ?? TEAL }]}>
                <View style={styles.juggleAdultCardHeader}>
                  <View style={[styles.juggleAdultDot, { backgroundColor: member?.color ?? TEAL }]} />
                  <Text style={styles.juggleAdultName}>{plan.adult}</Text>
                </View>
                {plan.schedule.map((s, i) => {
                  const evtForTime = (juggleResult.events ?? []).find((e) => e.id === s.event_id);
                  // FIX 1 — collapse "11:30–11:30" to "11:30"
                  const timeDisplay =
                    !evtForTime?.end_time || evtForTime.end_time === s.time
                      ? s.time
                      : `${s.time}–${evtForTime.end_time}`;
                  // FIX 3 — pick-up entries show the child's venue, not the travel origin
                  const actLower = s.activity.toLowerCase();
                  const isPickup =
                    actLower.includes("pick up") ||
                    actLower.includes("pickup") ||
                    actLower.includes("collect");
                  const displayLocation =
                    isPickup && evtForTime?.location ? evtForTime.location : s.location;
                  return (
                  <View key={i} style={styles.juggleScheduleRow}>
                    <View style={styles.juggleTimePill}>
                      <Text style={styles.juggleTimePillText}>{timeDisplay}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={styles.juggleScheduleActivity}>{s.activity}</Text>
                      {s.child ? <Text style={styles.juggleScheduleChild}>with {s.child}</Text> : null}
                      {displayLocation ? <Text style={styles.juggleScheduleLocation}>{displayLocation}</Text> : null}
                    </View>
                  </View>
                  );
                })}
                {(() => {
                  const insight = buildFreeWindowInsight(plan);
                  return insight ? (
                    <Text style={styles.juggleFreeWindow}>{insight}</Text>
                  ) : null;
                })()}
              </View>
            );
          })}
        </View>
      )}

      {/* ── 4. Tight spot / conflicts ── */}
      {conflicts.length > 0 && (
        <View style={styles.juggleConflictCard}>
          <Text style={styles.juggleConflictLabel}>HEADS UP</Text>
          {conflicts.map((c, i) => (
            <View key={i} style={i > 0 ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3E0DC" } : undefined}>
              <Text style={styles.juggleConflictDesc}>⚠ {c.description}</Text>
              {c.recommendation ? <Text style={styles.juggleConflictRec}>{c.recommendation}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* ── 5. Worth knowing (smart_note) ── */}
      {juggleResult.smart_note ? (
        <View style={{
          backgroundColor: PLUM + "12", borderRadius: 12,
          padding: 14, borderLeftWidth: 3, borderLeftColor: PLUM,
        }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: PLUM, letterSpacing: 0.8, marginBottom: 4 }}>
            WORTH KNOWING
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: PLUM, lineHeight: 19 }}>
            {juggleResult.smart_note}
          </Text>
        </View>
      ) : null}

      {/* ── 5b. Simple week note (passive, no CTA) ── */}
      {(() => {
        const allChildOnly = adultPlans.length > 0 && adultPlans.every((p) => p.schedule.every((s) => !!s.child));
        const showNote =
          adultMembers.length >= 2 &&
          ws.total_events >= 1 &&
          ws.total_events <= 2 &&
          tight === 0 &&
          impossible === 0 &&
          conflicts.length === 0 &&
          allChildOnly;
        if (!showNote) return null;
        return (
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#AAA", lineHeight: 19, paddingHorizontal: 4 }}>
            Either one of you could cover both — so the other gets a free morning if it works out.
          </Text>
        );
      })()}

      {/* ── 6. Actions ── */}
      <View style={styles.resultActionsRow}>
        <TouchableOpacity
          style={styles.resultShareBtn}
          onPress={() => onShare(buildShareText())}
          activeOpacity={0.85}
        >
          <Feather name="send" size={14} color="#fff" />
          <Text style={styles.resultShareBtnText}>Share full plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.resultSortAgainBtn}
          onPress={onSortAgain}
          activeOpacity={0.85}
        >
          <Feather name="refresh-cw" size={13} color={TEAL} />
          <Text style={styles.resultSortAgainBtnText}>Sort again</Text>
        </TouchableOpacity>
      </View>

      {/* ── Add another activity ── */}
      <TouchableOpacity
        style={styles.resultAddActivityBtn}
        onPress={onClose}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={14} color={TEAL} />
        <Text style={styles.resultAddActivityBtnText}>Add something</Text>
      </TouchableOpacity>

      </View>{/* end paddingHorizontal wrapper */}
    </ScrollView>

    {/* ── Swap bottom sheet ── */}
    <Modal
        visible={!!swapRow}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapRow(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setSwapRow(null)}
        />
        <View style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 36,
          gap: 16,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        }}>
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#DDD", alignSelf: "center", marginBottom: 4 }} />
          <Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, color: "#1C1C1E" }}>
            Who should cover this?
          </Text>
          {swapRow && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#6E6E73" }}>
              {swapRow.activity}{swapRow.child ? ` · ${swapRow.child}` : ""}{swapRow.time ? ` · ${swapRow.time}` : ""}
            </Text>
          )}
          <View style={{ gap: 8 }}>
            {adultMembers.map((adult) => {
              const selected = swapPick === adult.name;
              const summary  = adultRowSummary[adult.name];
              return (
                <TouchableOpacity
                  key={adult.id}
                  onPress={() => setSwapPick(adult.name)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: selected ? TEAL : "#E5E5EA",
                    backgroundColor: selected ? TEAL + "10" : "#FAFAF8",
                    gap: 12,
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: adult.color ?? TEAL }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1C1C1E" }}>{adult.name}</Text>
                    {summary ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6E6E73" }} numberOfLines={1}>
                        {summary}
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6E6E73" }}>Nothing on yet</Text>
                    )}
                  </View>
                  {selected && <Feather name="check" size={16} color={TEAL} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => setSwapRow(null)}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 10,
                borderWidth: 1, borderColor: "#E5E5EA",
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: "#6E6E73" }}>Never mind</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (swapRow && swapPick && onSwapApplied) {
                  onSwapApplied(swapRow.event_id, swapPick);
                }
                setSwapRow(null);
              }}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 10,
                backgroundColor: GOLD,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" }}>Swap →</Text>
            </TouchableOpacity>
          </View>
        </View>
    </Modal>
    </View>
  );
}

// ── SavedToast ─────────────────────────────────────────────────────────────────
type BannerType = "first" | "subsequent" | "edited";

function SavedToast({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,  duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[styles.savedToast, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Text style={styles.savedToastText}>Saved. We've sorted the week around it.</Text>
    </Animated.View>
  );
}

// ── WeekSortedCard — the planner payoff hero card ─────────────────────────────
function WeekSortedCard({
  result,
  onReview,
  onShare,
  onAddAnother,
}: {
  result: FamilyWeekResult;
  onReview: () => void;
  onShare: () => void;
  onAddAnother: () => void;
}) {
  const { totalEvents, weekendCount, driverCount, busynessLevel } = result.weekSummary;

  const statParts: string[] = [];
  statParts.push(`${totalEvents} ${totalEvents === 1 ? "event" : "events"}`);
  if (driverCount > 0) statParts.push(`${driverCount} ${driverCount === 1 ? "driver" : "drivers"}`);
  if (weekendCount > 0) statParts.push(`${weekendCount} this weekend`);

  const insight =
    result.insights.length > 0
      ? result.insights[0]!.message
      : getLightInsight(result) ?? "Nothing clashing. Looks manageable.";

  const hasIssue = result.insights.some(
    (i) => i.type === "conflict" || i.type === "child_clash"
  );

  return (
    <View style={[styles.weekSortedCard, hasIssue && styles.weekSortedCardWarn]}>
      <View style={styles.weekSortedHeader}>
        <View style={[styles.weekSortedTick, hasIssue && { backgroundColor: ORANGE }]}>
          <Feather name={hasIssue ? "alert-triangle" : "check"} size={11} color="#fff" />
        </View>
        <Text style={styles.weekSortedTitle}>
          {hasIssue ? "This week — a couple of things to sort." : "This week, sorted."}
        </Text>
      </View>
      <Text style={styles.weekSortedStats}>{statParts.join("  ·  ")}</Text>
      <Text style={styles.weekSortedInsight}>{insight}</Text>
      <View style={styles.weekSortedActions}>
        <TouchableOpacity style={styles.weekSortedReviewBtn} onPress={onReview} activeOpacity={0.85}>
          <Feather name="list" size={13} color="#fff" />
          <Text style={styles.weekSortedReviewBtnText}>Review full plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekSortedShareBtn} onPress={onShare} activeOpacity={0.85}>
          <Feather name="send" size={13} color={TEAL} />
          <Text style={styles.weekSortedShareBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekSortedAddBtn} onPress={onAddAnother} activeOpacity={0.8}>
          <Feather name="plus" size={12} color={TEXT_MUTED} />
          <Text style={styles.weekSortedAddBtnText}>Add more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── PlanSummarySheet — the review destination ─────────────────────────────────
function PlanSummarySheet({
  visible,
  result,
  members,
  onClose,
  onShare,
  onAddAnother,
}: {
  visible: boolean;
  result: FamilyWeekResult | null;
  members: FamilyMember[];
  onClose: () => void;
  onShare: () => void;
  onAddAnother: () => void;
}) {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(800)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(overlayOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 800, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !result) return null;

  const { totalEvents, weekendCount, driverCount, busynessLevel } = result.weekSummary;
  const { label: busynessLabel, color: busynessColor } = BUSYNESS_CONFIG[busynessLevel];
  const lightInsight = getLightInsight(result);
  const hasRealInsights = result.insights.length > 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOp }]}>
        <Pressable style={styles.formOverlay} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.formSheet,
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16, maxHeight: "92%" },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTitleRow}>
          <View>
            <Text style={styles.sheetTitle}>Your plan this week</Text>
            <Text style={styles.sheetSubTitle}>
              {totalEvents === 0 ? "Nothing on yet." : `${totalEvents} ${totalEvents === 1 ? "event" : "events"} · ${busynessLabel.toLowerCase()}`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
        >
          {/* Stats row */}
          {totalEvents > 0 && (
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryStatNum}>{totalEvents}</Text>
                <Text style={styles.summaryStatLabel}>{totalEvents === 1 ? "event" : "events"}</Text>
              </View>
              {weekendCount > 0 && (
                <View style={styles.summaryStatBox}>
                  <Text style={[styles.summaryStatNum, { color: GOLD }]}>{weekendCount}</Text>
                  <Text style={styles.summaryStatLabel}>weekend</Text>
                </View>
              )}
              {driverCount > 0 && (
                <View style={styles.summaryStatBox}>
                  <Text style={[styles.summaryStatNum, { color: TEAL }]}>{driverCount}</Text>
                  <Text style={styles.summaryStatLabel}>{driverCount === 1 ? "driver" : "drivers"}</Text>
                </View>
              )}
              <View style={[styles.busynessPill, { backgroundColor: busynessColor + "18", borderColor: busynessColor + "44" }]}>
                <View style={[styles.busynessDot, { backgroundColor: busynessColor }]} />
                <Text style={[styles.busynessText, { color: busynessColor }]}>{busynessLabel}</Text>
              </View>
            </View>
          )}

          {/* Worth knowing */}
          <View style={styles.summaryInsightBlock}>
            <Text style={styles.summaryBlockLabel}>WORTH KNOWING</Text>
            {hasRealInsights ? (
              result.insights.map((ins, i) => {
                const iconMap: Record<string, string> = {
                  conflict: "alert-triangle", child_clash: "alert-circle",
                  tight: "clock", busy: "layers", solo: "user",
                };
                const colorMap: Record<string, string> = {
                  conflict: "#C0392B", child_clash: "#C0392B",
                  tight: ORANGE, busy: GOLD, solo: PLUM,
                };
                return (
                  <View key={i} style={styles.summaryInsightRow}>
                    <Feather name={(iconMap[ins.type] ?? "info") as any} size={13} color={colorMap[ins.type] ?? TEXT_MUTED} />
                    <Text style={styles.summaryInsightText}>{ins.message}</Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.summaryInsightRow}>
                <Feather name="check-circle" size={13} color={TEAL} />
                <Text style={styles.summaryInsightText}>{lightInsight ?? "Everything currently fits."}</Text>
              </View>
            )}
          </View>

          {/* Who's covering what */}
          {result.planSplit.size > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryBlockLabel}>WHO'S COVERING WHAT</Text>
              {Array.from(result.planSplit.entries()).map(([driverId, days]) => {
                const driver = members.find((m) => m.id === driverId);
                if (!driver) return null;
                return (
                  <View key={driverId} style={styles.summaryPlanRow}>
                    <View style={[styles.planSplitDot, { backgroundColor: driver.color }]} />
                    <Text style={styles.summaryPlanName}>{driver.name}</Text>
                    <Text style={styles.summaryPlanDays}>{days.join(", ")}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Events by day — compact */}
          {result.daysWithEvents.length > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryBlockLabel}>THIS WEEK</Text>
              {result.daysWithEvents.map((day) => (
                <View key={day} style={styles.summaryDayBlock}>
                  <Text style={[styles.summaryDayLabel, (day === "Saturday" || day === "Sunday") && { color: GOLD }]}>
                    {day}
                  </Text>
                  {result.eventsByDay[day].map((ev) => {
                    const driver = ev.driverId ? members.find((m) => m.id === ev.driverId) : null;
                    const involved = ev.personIds.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean);
                    return (
                      <View key={ev.id} style={styles.summaryEventRow}>
                        <View style={styles.summaryEventTimePill}>
                          <Text style={styles.summaryEventTime}>{formatTime(ev.time)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryEventTitle}>{ev.title}</Text>
                          <Text style={styles.summaryEventMeta}>
                            {[
                              ev.location,
                              driver ? `${driver.name} driving` : null,
                              involved.length ? involved.join(", ") : null,
                            ].filter(Boolean).join("  ·  ")}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Unassigned note */}
          {result.weekSummary.unassignedCount > 0 && (
            <View style={styles.summaryUnassignedNote}>
              <Feather name="alert-circle" size={13} color={TEXT_MUTED} />
              <Text style={styles.summaryUnassignedText}>
                {result.weekSummary.unassignedCount} {result.weekSummary.unassignedCount === 1 ? "event has" : "events have"} no driver assigned yet. Tap the event to edit.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Actions */}
        <View style={styles.summaryActions}>
          <TouchableOpacity style={styles.summaryShareBtn} onPress={onShare} activeOpacity={0.85}>
            <Feather name="send" size={14} color="#fff" />
            <Text style={styles.summaryShareBtnText}>Share plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryAddBtn} onPress={onAddAnother} activeOpacity={0.85}>
            <Feather name="plus" size={14} color={TEAL} />
            <Text style={styles.summaryAddBtnText}>Add another event</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ── EventCard ──────────────────────────────────────────────────────────────────
function EventCard({
  event, members, onEdit, onDelete, aiDriver,
}: {
  event: FamilyEvent;
  members: FamilyMember[];
  onEdit: () => void;
  onDelete: () => void;
  aiDriver?: string;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const driverDisplay = aiDriver ?? (event.driverId ? members.find((m) => m.id === event.driverId)?.name : null);
  const involved = event.personIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as FamilyMember[];
  const timeLabel = formatTime(event.time);
  const endLabel  = event.endTime ? `–${formatTime(event.endTime)}` : "";

  function showActions() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Edit event", "Remove event"], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (idx) => { if (idx === 1) onEdit(); if (idx === 2) onDelete(); }
      );
    } else if (Platform.OS === "android") {
      Alert.alert(event.title, undefined, [
        { text: "Edit event", onPress: onEdit },
        { text: "Remove event", onPress: onDelete, style: "destructive" },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      setMenuOpen((v) => !v);
    }
  }

  return (
    <View style={[styles.eventCard, menuOpen && { zIndex: 50 }]}>
      <View style={styles.eventCardMain}>
        <View style={styles.eventTimePill}>
          <Text style={styles.eventTimeText}>{timeLabel}</Text>
          {endLabel ? <Text style={styles.eventTimeEnd}> {endLabel}</Text> : null}
        </View>
        <View style={styles.eventCardBody}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.eventMeta}>
            {event.location ? (
              <View style={styles.eventMetaItem}>
                <Feather name="map-pin" size={11} color={TEXT_MUTED} />
                <Text style={styles.eventMetaText}>{event.location}</Text>
              </View>
            ) : null}
            {driverDisplay ? (
              <View style={styles.eventMetaItem}>
                <Text style={[styles.eventMetaText, { color: TEAL }]}>✦ {driverDisplay}</Text>
              </View>
            ) : null}
            {event.repeat !== "none" ? (
              <View style={styles.eventMetaItem}>
                <Feather name="repeat" size={11} color={TEXT_MUTED} />
                <Text style={styles.eventMetaText}>{REPEAT_LABELS[event.repeat]}</Text>
              </View>
            ) : null}
          </View>
          {involved.length > 0 && (
            <View style={styles.eventInvolvedRow}>
              {involved.map((m) => (
                <MemberChip key={m.id} member={m} small />
              ))}
            </View>
          )}
        </View>
        <View style={{ zIndex: 60 }}>
          <TouchableOpacity
            style={styles.eventMenuBtn}
            onPress={showActions}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="more-horizontal" size={16} color={menuOpen ? TEAL : TEXT_MUTED} />
          </TouchableOpacity>
          {menuOpen && (
            <View style={styles.eventInlineMenu}>
              <TouchableOpacity
                style={styles.eventInlineMenuItem}
                onPress={() => { setMenuOpen(false); onEdit(); }}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={13} color={TEXT} />
                <Text style={styles.eventInlineMenuText}>Edit</Text>
              </TouchableOpacity>
              <View style={styles.eventInlineMenuDivider} />
              <TouchableOpacity
                style={styles.eventInlineMenuItem}
                onPress={() => { setMenuOpen(false); onDelete(); }}
                activeOpacity={0.75}
              >
                <Feather name="trash-2" size={13} color="#C0695A" />
                <Text style={[styles.eventInlineMenuText, { color: "#C0695A" }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── DaySection ─────────────────────────────────────────────────────────────────
function DaySection({
  day, events, members, onEditEvent, onDeleteEvent, juggleDriverMap,
}: {
  day: DayOfWeek;
  events: FamilyEvent[];
  members: FamilyMember[];
  onEditEvent: (e: FamilyEvent) => void;
  onDeleteEvent: (id: string) => void;
  juggleDriverMap?: Map<string, string>;
}) {
  const isWeekend = day === "Saturday" || day === "Sunday";
  return (
    <View style={styles.daySection}>
      <View style={[styles.dayHeader, isWeekend && styles.dayHeaderWeekend]}>
        <Text style={[styles.dayLabel, isWeekend && { color: GOLD }]}>{day}</Text>
        <View style={[styles.eventCountBadge, isWeekend && { backgroundColor: GOLD + "18" }]}>
          <Text style={[styles.eventCountText, isWeekend && { color: GOLD }]}>
            {events.length}
          </Text>
        </View>
      </View>
      <View style={styles.daySectionEvents}>
        {events.map((ev, idx) => (
          <React.Fragment key={ev.id}>
            <EventCard
              event={ev}
              members={members}
              onEdit={() => onEditEvent(ev)}
              onDelete={() => onDeleteEvent(ev.id)}
              aiDriver={juggleDriverMap?.get(ev.id)}
            />
            {idx < events.length - 1 && (
              <View style={styles.dayEventConnector} />
            )}
            {juggleDriverMap && idx < events.length - 1 && (() => {
              const hint = getTravelHint(ev, events[idx + 1]!, juggleDriverMap);
              if (!hint) return null;
              return (
                <View style={styles.travelHintRow}>
                  <Feather name="navigation" size={11} color={ORANGE} />
                  <Text style={styles.travelHintText}>{hint}</Text>
                </View>
              );
            })()}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Time formatting helper (12h, no padding zeros) ───────────────────────────
function fmt12h(hhmm: string): string {
  const parts = hhmm.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// ── Free-window insight builder ───────────────────────────────────────────────
// Returns a natural-language schedule insight, or null if nothing worth showing.
// Never mentions raw minute counts or midnight-anchored times.
function buildFreeWindowInsight(plan: JuggleAdultPlan): string | null {
  const schedule = [...plan.schedule].sort((a, b) => a.time.localeCompare(b.time));
  if (schedule.length === 0) return null;

  // --- Try AI free_windows, but filter out midnight-anchored or suspiciously large ones ---
  const aiWindows = (plan.free_windows ?? []).filter(
    (w) => w.from >= "06:00" && w.duration_minutes <= 480
  );

  // Prefer a clear end-of-day window from AI data
  const endWin = aiWindows.find((w) => w.is_end_of_day && w.duration_minutes >= 30);
  if (endWin) return `Clear stretch after ${fmt12h(endWin.from)}.`;

  // Mid-day gap from AI data
  const midWin = aiWindows.find((w) => !w.is_end_of_day && w.duration_minutes >= 30);
  if (midWin) {
    const dur = midWin.duration_minutes;
    const from = fmt12h(midWin.from);
    const to   = fmt12h(midWin.to);
    if (dur >= 75) return `Good window ${from}–${to}.`;
    return `Quick window ${from}–${to}.`;
  }

  // --- Fall back: compute from schedule start times ---
  const last = schedule[schedule.length - 1]!;
  const [lh, lm] = last.time.split(":").map(Number);
  if (!isNaN(lh!) && !isNaN(lm!)) {
    const lastMin = lh! * 60 + lm!;
    if (lastMin < 960) {
      // Last event before 4pm — afternoon opens up
      return schedule.length >= 2
        ? `Afternoon opens up after ${fmt12h(last.time)}.`
        : `Clear stretch after ${fmt12h(last.time)}.`;
    }
  }

  // Check if events are tightly packed (all gaps < 30 min)
  if (schedule.length >= 3) {
    let allTight = true;
    for (let i = 0; i < schedule.length - 1; i++) {
      const [ah, am] = schedule[i]!.time.split(":").map(Number);
      const [bh, bm] = schedule[i + 1]!.time.split(":").map(Number);
      if (!isNaN(ah!) && !isNaN(bh!)) {
        const gap = (bh! * 60 + bm!) - (ah! * 60 + am!);
        if (gap >= 30) { allTight = false; break; }
      }
    }
    if (allTight) return "A little tight through the middle.";
  }

  return null;
}

// ── Time-picker options (7:00 AM → 6:30 PM, 30-min slots) ────────────────────
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 7; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) break;
      const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      const label = m === 0 ? `${displayH}:00 ${period}` : `${displayH}:30 ${period}`;
      opts.push({ value, label });
    }
  }
  return opts;
})();

function labelForTime(value: string): string {
  return TIME_OPTIONS.find((o) => o.value === value)?.label ?? formatTime(value);
}

function suggestedEnd(startValue: string): string | undefined {
  if (!startValue) return undefined;
  const idx = TIME_OPTIONS.findIndex((o) => o.value === startValue);
  if (idx === -1) return undefined;
  return TIME_OPTIONS[idx + 2]?.value;
}

function TimePickerSheet({
  visible, selectedValue, suggestedValue, onSelect, onDone,
}: {
  visible: boolean;
  selectedValue: string;
  suggestedValue?: string;
  onSelect: (value: string) => void;
  onDone: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.tpOverlay} onPress={onDone} />
      <View style={styles.tpSheet}>
        <View style={styles.tpHeader}>
          <Text style={styles.tpTitle}>What time?</Text>
          <TouchableOpacity onPress={onDone} activeOpacity={0.75}>
            <Text style={styles.tpDoneBtn}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tpGrid}>
          {TIME_OPTIONS.map((opt) => {
            const isSel  = selectedValue === opt.value;
            const isSugg = !isSel && opt.value === suggestedValue;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.tpCell, isSel && styles.tpCellSel, isSugg && styles.tpCellSugg]}
                onPress={() => { onSelect(opt.value); onDone(); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.tpCellText, isSel && styles.tpCellTextSel]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ── AddEventSheet ──────────────────────────────────────────────────────────────
export interface CarpoolContact { id: string; name: string; phone: string; }

function AddEventSheet({
  visible,
  members,
  initialDraft,
  carpoolContacts,
  onAddCarpoolContact,
  onClose,
  onSave,
}: {
  visible: boolean;
  members: FamilyMember[];
  initialDraft?: Partial<FamilyEvent> | null;
  carpoolContacts: CarpoolContact[];
  onAddCarpoolContact: (c: CarpoolContact) => void;
  onClose: () => void;
  onSave: (draft: Omit<FamilyEvent, "id">) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(600)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;

  const [draft, setDraft] = useState<Omit<FamilyEvent, "id">>(blankDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [showDiscard, setShowDiscard] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerFor, setTimePickerFor]         = useState<"start" | "end">("start");
  const [addingContact, setAddingContact]         = useState(false);
  const [newContactName, setNewContactName]       = useState("");
  const [newContactPhone, setNewContactPhone]     = useState("");
  const [carpoolEntryName, setCarpoolEntryName]   = useState("");
  const [carpoolEntryMobile, setCarpoolEntryMobile] = useState("");
  const carpoolNameRef = React.useRef<TextInput>(null);

  // Derived: is the form valid enough to save?
  const isFormValid = draft.title.trim().length > 0 && draft.time.trim().length > 0 && (draft.endTime ?? "").trim().length > 0;

  // Derived: does the form have any data entered?
  const formHasData = draft.title.trim().length > 0
    || draft.time.trim().length > 0
    || (draft.location ?? "").trim().length > 0
    || (draft.notes ?? "").trim().length > 0
    || draft.personIds.length > 0;

  function handleClosePress() {
    if (formHasData && !showDiscard) {
      setShowDiscard(true);
    } else {
      setShowDiscard(false);
      onClose();
    }
  }

  useEffect(() => {
    if (visible) {
      setDraft(initialDraft ? { ...blankDraft(), ...initialDraft } : blankDraft());
      setErrors([]);
      setCarpoolEntryName("");
      setCarpoolEntryMobile("");
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(overlayOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function setField<K extends keyof typeof draft>(key: K, val: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function togglePerson(id: string) {
    Keyboard.dismiss();
    setDraft((d) => {
      const wasSelected = d.personIds.includes(id);
      const newPersonIds = wasSelected
        ? d.personIds.filter((x) => x !== id)
        : [...d.personIds, id];
      const member = members.find((m) => m.id === id);
      // FIX 1: for appointment + adult member, lock assignedAdult to themselves
      let assignedAdult = d.assignedAdult;
      if (d.isAppointment && member?.role === "adult") {
        assignedAdult = wasSelected ? "" : member.name;
      }
      return { ...d, personIds: newPersonIds, assignedAdult };
    });
  }

  function handleSave() {
    const errs: string[] = [];
    if (!draft.title.trim()) errs.push("Add a title for this event.");
    if (!draft.time.trim())  errs.push("Tap the Start time field to pick a time.");
    if (!draft.endTime?.trim()) errs.push("Add an end time so we can check for clashes.");
    if (errs.length) { setErrors(errs); return; }

    const parsedTime = parseTime(draft.time) || draft.time;
    const parsedEnd  = draft.endTime?.trim() ? (parseTime(draft.endTime) || draft.endTime) : undefined;

    // FIX 2: if an adult is the attending person for an appointment, self-assign them silently
    const adultAttendee = draft.personIds
      .map((id) => members.find((m) => m.id === id))
      .find((m) => m?.role === "adult");
    const correctedAssignedAdult =
      draft.isAppointment && adultAttendee
        ? adultAttendee.name
        : draft.assignedAdult?.trim() || undefined;

    onSave({
      ...draft,
      title: draft.title.trim(),
      time: parsedTime,
      endTime: parsedEnd || undefined,
      location: draft.location?.trim() || undefined,
      carpoolContact: draft.carpoolContact?.trim() || undefined,
      carpoolContacts: draft.carpoolContacts?.length ? draft.carpoolContacts : undefined,
      notes: draft.notes?.trim() || undefined,
      driverId: undefined,
      assignedAdult: correctedAssignedAdult,
    });
  }

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOp }]}>
        <Pressable style={styles.formOverlay} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.formSheet,
          { transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitle}>
            {initialDraft?.id ? "Edit event" : "Add event"}
          </Text>
          <TouchableOpacity onPress={handleClosePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* Discard confirmation — inline, no blocking modal */}
        {showDiscard && (
          <View style={styles.discardConfirm}>
            <Text style={styles.discardConfirmText}>Discard this event?</Text>
            <View style={styles.discardConfirmBtns}>
              <TouchableOpacity onPress={() => { setShowDiscard(false); onClose(); }}>
                <Text style={styles.discardConfirmYes}>Yes, discard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDiscard(false)}>
                <Text style={styles.discardConfirmNo}>Keep editing</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18, paddingBottom: 16 }}
          >
            {errors.length > 0 && (
              <View style={styles.errorBox}>
                {errors.map((e, i) => <Text key={i} style={styles.errorText}>{e}</Text>)}
              </View>
            )}

            {/* Event type toggle */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([{ val: false, label: "Activity" }, { val: true, label: "Appointment" }] as const).map(({ val, label }) => {
                  const active = !!draft.isAppointment === val;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.repeatChip, active && styles.repeatChipSelected]}
                      onPress={() => { Keyboard.dismiss(); setField("isAppointment", val); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.repeatChipText, active && styles.repeatChipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {draft.isAppointment && (
                <Text style={[styles.formHint, { marginTop: 4 }]}>
                  This person must attend — Sortii won't suggest cover for it.
                </Text>
              )}
            </View>

            {/* Title */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>What's on?</Text>
              <TextInput
                style={styles.formInput}
                value={draft.title}
                onChangeText={(v) => setField("title", v)}
                placeholder="Football practice, dentist, birthday party…"
                placeholderTextColor="#bbb"
                returnKeyType="next"
              />
            </View>

            {/* Who's involved */}
            {members.length > 0 && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Who needs to be there?</Text>
                <View style={styles.chipGroup}>
                  {members.map((m) => (
                    <MemberChip
                      key={m.id}
                      member={m}
                      selected={draft.personIds.includes(m.id)}
                      onPress={() => togglePerson(m.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* WHO'S RESPONSIBLE FOR THIS? — adult selector or locked for personal appts */}
            {members.some((m) => m.role === "adult") && (() => {
              const lockedAdult = draft.isAppointment
                ? members.find((m) => draft.personIds.includes(m.id) && m.role === "adult")
                : null;
              return (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>WHO'S RESPONSIBLE FOR THIS?</Text>
                  {!lockedAdult && (
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic", marginBottom: 6 }}>
                      Optional — we'll figure it out if you leave this blank.
                    </Text>
                  )}
                  {lockedAdult ? (
                    <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" }}>
                      {lockedAdult.name} — it's their appointment
                    </Text>
                  ) : (
                    <View style={styles.chipGroup}>
                      {members.filter((m) => m.role === "adult").map((m) => {
                        const active = draft.assignedAdult === m.name;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.repeatChip, active && styles.repeatChipSelected]}
                            onPress={() => {
                              Keyboard.dismiss();
                              setField("assignedAdult", active ? "" : m.name);
                            }}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.repeatChipText, active && styles.repeatChipTextSelected]}>
                              {m.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Day */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Which day?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ALL_DAYS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, draft.day === d && styles.dayChipSelected]}
                      onPress={() => { Keyboard.dismiss(); setField("day", d); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dayChipText, draft.day === d && styles.dayChipTextSelected]}>
                        {DAY_ABBR[d]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Times */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>What time?</Text>
              <View style={styles.formRow}>
                <TouchableOpacity
                  style={[styles.formTimeField, { flex: 1 }]}
                  onPress={() => { Keyboard.dismiss(); setTimePickerFor("start"); setTimePickerVisible(true); }}
                  activeOpacity={0.75}
                >
                  <Text style={draft.time ? styles.formTimeFieldText : styles.formTimeFieldPlaceholder}>
                    {draft.time ? labelForTime(draft.time) : "Start time"}
                  </Text>
                  <Feather name="clock" size={14} color={TEXT_MUTED} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formTimeField, { flex: 1 }]}
                  onPress={() => { Keyboard.dismiss(); setTimePickerFor("end"); setTimePickerVisible(true); }}
                  activeOpacity={0.75}
                >
                  <Text style={draft.endTime ? styles.formTimeFieldText : styles.formTimeFieldPlaceholder}>
                    {draft.endTime ? labelForTime(draft.endTime) : "End time"}
                  </Text>
                  <Feather name="clock" size={14} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View style={[styles.formField, { zIndex: 20 }]}>
              <Text style={styles.formLabel}>Location (optional)</Text>
              <LocationAutocomplete
                value={draft.location ?? ""}
                onSelect={(v) => setField("location", v)}
                inputStyle={styles.formInput}
              />
            </View>

            {/* HOW IMPORTANT IS THIS? — priority toggle */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>HOW IMPORTANT IS THIS?</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([
                  { val: "must" as const, label: "Must happen" },
                  { val: "nice" as const, label: "Nice if possible" },
                ] as const).map(({ val, label }) => {
                  const active = (draft.priority ?? "must") === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.repeatChip, active && styles.repeatChipSelected]}
                      onPress={() => { Keyboard.dismiss(); setField("priority", val); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.repeatChipText, active && styles.repeatChipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* WHO COULD HELP WITH THIS? — per-event carpool contacts */}
            <View style={styles.formField}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Who could help with this?
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#777", marginBottom: 10 }}>
                Add a name and number for someone who could do a pickup run.
              </Text>

              {/* Already-added contacts */}
              {(draft.carpoolContacts ?? []).map((c, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="user" size={13} color={TEAL} />
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: TEXT }}>
                      {c.name}{(c.phone || c.mobile) ? ` · ${c.phone || c.mobile}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const next = (draft.carpoolContacts ?? []).filter((_, i) => i !== idx);
                      setField("carpoolContacts", next);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Quick-pick chips from the global carpool contacts list */}
              {carpoolContacts.filter((gc) =>
                !(draft.carpoolContacts ?? []).some((dc) => dc.name.toLowerCase() === gc.name.toLowerCase())
              ).length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#aaa", marginBottom: 6 }}>
                    Saved contacts — tap to add:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {carpoolContacts
                      .filter((gc) =>
                        !(draft.carpoolContacts ?? []).some(
                          (dc) => dc.name.toLowerCase() === gc.name.toLowerCase()
                        )
                      )
                      .map((gc) => (
                        <TouchableOpacity
                          key={gc.id}
                          onPress={() => {
                            const childForEvent = draft.personIds
                              .map((id) => members.find((m) => m.id === id))
                              .find((m) => m?.role === "child")?.name ?? "";
                            const entry: CarpoolContactEntry = {
                              name: gc.name,
                              relationship: "contact",
                              canHelpWith: childForEvent ? [childForEvent] : [],
                              phone: gc.phone,
                              notes: "",
                            };
                            setField("carpoolContacts", [...(draft.carpoolContacts ?? []), entry]);
                            Keyboard.dismiss();
                          }}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 4,
                            backgroundColor: TEAL + "14", borderWidth: 1, borderColor: TEAL + "40",
                            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
                          }}
                          activeOpacity={0.75}
                        >
                          <Feather name="user-check" size={11} color={TEAL} />
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: TEAL }}>
                            {gc.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}

              {/* Input row for a new contact */}
              <TextInput
                ref={carpoolNameRef}
                style={[styles.formInput, { marginBottom: 8 }]}
                value={carpoolEntryName}
                onChangeText={setCarpoolEntryName}
                placeholder="Name"
                placeholderTextColor="#bbb"
                returnKeyType="next"
              />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={carpoolEntryMobile}
                  onChangeText={setCarpoolEntryMobile}
                  placeholder="Mobile (optional)"
                  placeholderTextColor="#bbb"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!carpoolEntryName.trim()) return;
                    const childForEvent = draft.personIds
                      .map((id) => members.find((m) => m.id === id))
                      .find((m) => m?.role === "child")?.name ?? "";
                    const newEntry: CarpoolContactEntry = {
                      name: carpoolEntryName.trim(),
                      relationship: "contact",
                      canHelpWith: childForEvent ? [childForEvent] : [],
                      phone: carpoolEntryMobile.trim(),
                      notes: "",
                    };
                    const next = [...(draft.carpoolContacts ?? []), newEntry];
                    setField("carpoolContacts", next);
                    // Auto-save to global list if name not already there
                    const alreadySaved = carpoolContacts.some(
                      (gc) => gc.name.toLowerCase() === carpoolEntryName.trim().toLowerCase()
                    );
                    if (!alreadySaved) {
                      onAddCarpoolContact({
                        id: Date.now().toString(),
                        name: carpoolEntryName.trim(),
                        phone: carpoolEntryMobile.trim(),
                      });
                    }
                    setCarpoolEntryName("");
                    setCarpoolEntryMobile("");
                    Keyboard.dismiss();
                  }}
                  style={[styles.carpoolAddBtn, !carpoolEntryName.trim() && { opacity: 0.4 }]}
                  disabled={!carpoolEntryName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.carpoolAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* "+ Add another" shown when at least one contact exists and inputs are empty */}
              {(draft.carpoolContacts ?? []).length > 0 && !carpoolEntryName.trim() && (
                <TouchableOpacity
                  onPress={() => carpoolNameRef.current?.focus()}
                  style={{ marginTop: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: TEAL, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    + Add another contact
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Repeat */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Does this repeat?</Text>
              <View style={styles.chipGroup}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.repeatChip, draft.repeat === r && styles.repeatChipSelected]}
                    onPress={() => { Keyboard.dismiss(); setField("repeat", r); }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.repeatChipText,
                        draft.repeat === r && styles.repeatChipTextSelected,
                      ]}
                    >
                      {REPEAT_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes / ANYTHING ELSE? */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ANYTHING ELSE?</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={draft.notes ?? ""}
                onChangeText={(v) => setField("notes", v)}
                placeholder="e.g. parking takes 10 min, or starts 15 min late most weeks"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            {/* Bottom spacer so last field can scroll above the sticky footer */}
            <View style={{ height: 180 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Time picker bottom sheet — overlays the form */}
        <TimePickerSheet
          visible={timePickerVisible}
          selectedValue={timePickerFor === "start" ? draft.time : (draft.endTime ?? "")}
          suggestedValue={timePickerFor === "end" ? suggestedEnd(draft.time) : undefined}
          onSelect={(val) => setField(timePickerFor === "start" ? "time" : "endTime", val)}
          onDone={() => setTimePickerVisible(false)}
        />

        {/* Sticky footer — outside ScrollView, stays at bottom */}
        <View style={[styles.sheetFooter, { paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>
              {initialDraft?.id ? "Save changes ✓" : "Add event ✓"}
            </Text>
          </TouchableOpacity>
          {!isFormValid && (
            <Text style={styles.validationHint}>Need a name, start time and end time.</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// ── ManagePeopleSection ────────────────────────────────────────────────────────
function ManagePeopleSection({
  members, onAdd, onRemove,
}: {
  members: FamilyMember[];
  onAdd: (name: string, role: "adult" | "child") => void;
  onRemove: (id: string) => void;
}) {
  // Collapsed by default once setup is complete; expanded when empty
  const [expanded, setExpanded] = useState(members.length === 0);
  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState("");
  const [role, setRole]     = useState<"adult" | "child">("child");

  function confirm() {
    if (!name.trim()) return;
    onAdd(name.trim(), role);
    setName(""); setRole("child"); setAdding(false);
    Keyboard.dismiss();
  }

  const hasAdults      = members.some((m) => m.role === "adult");
  const hasChildren    = members.some((m) => m.role === "child");
  const needsAdultHint = hasChildren && !hasAdults;

  // ── Collapsed summary row (when members exist and not expanded)
  if (members.length > 0 && !expanded) {
    const names = members.map((m) => m.name).join(", ");
    return (
      <TouchableOpacity
        style={styles.peopleCollapsedRow}
        onPress={() => setExpanded(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.peopleCollapsedIcon}>👥</Text>
        <Text style={styles.peopleCollapsedNames} numberOfLines={1}>{names}</Text>
        <Text style={styles.peopleCollapsedEdit}>Edit →</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.peopleSection}>
      <View style={styles.peopleSectionHeader}>
        <Feather name="users" size={14} color={TEXT_MUTED} />
        <Text style={styles.peopleSectionTitle}>Family members</Text>
        {members.length > 0 && !adding && (
          <>
            <TouchableOpacity
              style={styles.addPersonCtaInline}
              onPress={() => setAdding(true)}
              activeOpacity={0.75}
            >
              <Feather name="user-plus" size={12} color={TEAL} />
              <Text style={styles.addPersonCtaInlineText}>Add another</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.7}
              style={{ marginLeft: "auto" }}
            >
              <Text style={styles.peopleDoneLink}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* No-adults hint */}
      {needsAdultHint && !adding && (
        <View style={styles.noAdultsHint}>
          <Feather name="info" size={12} color={GOLD} />
          <Text style={styles.noAdultsHintText}>
            Add an adult or driver too, so Sortii can work out the running around.
          </Text>
        </View>
      )}

      {members.length === 0 && !adding && (
        <Text style={styles.peopleSectionEmpty}>
          Add family members to assign them to events.
        </Text>
      )}

      {members.length > 0 && (
        <View style={styles.peopleList}>
          {members.map((m) => (
            <View key={m.id} style={styles.peopleRow}>
              <View style={[styles.peopleColorDot, { backgroundColor: m.color }]} />
              <Text style={styles.peopleName}>{m.name}</Text>
              <View style={[styles.roleTag, m.role === "adult" ? styles.roleTagAdult : styles.roleTagChild]}>
                <Text style={[styles.roleTagText, { color: m.role === "adult" ? TEAL : GOLD }]}>
                  {m.role === "adult" ? "Adult" : "Child"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onRemove(m.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color="#ccc" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <View style={styles.addPersonForm}>
          <TextInput
            style={styles.addPersonInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#bbb"
            returnKeyType="done"
            onSubmitEditing={confirm}
            autoFocus
          />
          <View style={styles.addPersonRoleRow}>
            {(["adult", "child"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.addPersonRole, role === r && styles.addPersonRoleSelected]}
                onPress={() => setRole(r)}
                activeOpacity={0.75}
              >
                <Text style={[styles.addPersonRoleText, role === r && { color: TEAL }]}>
                  {r === "adult" ? "Adult / driver" : "Child"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addPersonBtns}>
            <TouchableOpacity style={styles.addPersonConfirm} onPress={confirm} activeOpacity={0.8}>
              <Feather name="check" size={14} color="#fff" />
              <Text style={styles.addPersonConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)} activeOpacity={0.7}>
              <Feather name="x" size={16} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      ) : members.length === 0 ? (
        /* Large CTA when empty */
        <TouchableOpacity
          style={styles.addPersonCtaFull}
          onPress={() => setAdding(true)}
          activeOpacity={0.8}
        >
          <Feather name="user-plus" size={15} color="#fff" />
          <Text style={styles.addPersonCtaFullText}>Add family member</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── SetupReadyStrip ────────────────────────────────────────────────────────────
function SetupReadyStrip({
  eventCount, adultCount, lastSolvedAt, onViewLastPlan,
}: {
  eventCount: number;
  adultCount: number;
  lastSolvedAt: number | null;
  onViewLastPlan: () => void;
}) {
  const parts = [
    `${eventCount} ${eventCount === 1 ? "thing" : "things"} this week`,
    adultCount > 0 ? `${adultCount} ${adultCount === 1 ? "adult" : "adults"} can help` : null,
    "Ready when you are.",
  ].filter(Boolean);

  return (
    <View style={styles.setupStrip}>
      <Text style={styles.setupStripText}>{parts.join("  ·  ")}</Text>
      {lastSolvedAt ? (
        <TouchableOpacity onPress={onViewLastPlan} activeOpacity={0.8} style={styles.setupViewPlanBtn}>
          <Feather name="check-circle" size={12} color={TEAL} />
          <Text style={styles.setupViewPlanBtnText}>
            Last sorted {new Date(lastSolvedAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} — view
          </Text>
          <Feather name="chevron-right" size={12} color={TEAL} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── SortContextCard ────────────────────────────────────────────────────────────
function SortContextCard({
  events,
  juggleResult,
  isSorted,
  sortError,
  onSort,
  onViewPlan,
  onReSort,
}: {
  events: FamilyEvent[];
  juggleResult: JuggleResult | null;
  isSorted: boolean;
  sortError: string | null;
  onSort: () => void;
  onViewPlan: () => void;
  onReSort: () => void;
}) {
  const hasSortedResult = !!juggleResult;
  const sortedDate = juggleResult?.solvedAt
    ? new Date(juggleResult.solvedAt).toLocaleDateString("en-AU", {
        weekday: "short", day: "numeric", month: "short",
      })
    : null;

  const subline =
    events.length >= 5 ? "Bit of a juggle here."
    : events.length >= 2 ? "This week's got a few moving parts."
    : "Even one thing is worth planning around.";

  if (hasSortedResult && isSorted) {
    return (
      <View style={styles.sortCardSorted}>
        <View style={styles.sortCardSortedTop}>
          <View style={styles.sortCardSortedTick}>
            <Feather name="check" size={11} color="#fff" />
          </View>
          <Text style={styles.sortCardSortedTitle}>Sorted. Nothing to stress about.</Text>
        </View>
        {sortedDate && (
          <Text style={styles.sortCardSortedDate}>Sorted {sortedDate}</Text>
        )}
      </View>
    );
  }

  if (hasSortedResult && !isSorted && events.length >= 2) {
    return (
      <View style={styles.staleSortCard}>
        <View style={styles.staleSortTop}>
          <View style={styles.staleSortDot} />
          <Text style={styles.staleSortTitle}>Week's shifted a bit.</Text>
        </View>
        <Text style={styles.staleSortSub}>Want me to re-sort this?</Text>
        {sortError ? (
          <View style={styles.sortCardError}>
            <Feather name="alert-circle" size={13} color="#C04040" />
            <Text style={styles.sortCardErrorText}>{sortError}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.staleSortBtn} onPress={onSort} activeOpacity={0.85}>
          <Feather name="refresh-cw" size={14} color="#fff" />
          <Text style={styles.staleSortBtnText}>Re-sort the week</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewPlan} activeOpacity={0.7} style={styles.staleSortViewLink}>
          <Text style={styles.staleSortViewLinkText}>View last plan instead →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.sortPromptStrip}>
      <View style={styles.sortPromptInner}>
        <Feather name="zap" size={13} color={GOLD} />
        <Text style={styles.sortPromptText}>
          {events.length >= 5
            ? "Bit of a juggle here. Ready to untangle?"
            : events.length >= 2
            ? "Couple of moving parts. Ready to untangle this week?"
            : "Even one thing is worth planning around. Want us to sort it?"}
        </Text>
      </View>
      {sortError ? (
        <View style={styles.sortCardError}>
          <Feather name="alert-circle" size={13} color="#C04040" />
          <Text style={styles.sortCardErrorText}>{sortError}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── NeedHelpPrompt ─────────────────────────────────────────────────────────────
function NeedHelpPrompt({
  helpers,
  onFindHelp,
}: {
  helpers: FamilyHelper[];
  onFindHelp: () => void;
}) {
  return (
    <View style={styles.needHelpCard}>
      <View style={styles.needHelpTop}>
        <Feather name="users" size={13} color={ORANGE} />
        <Text style={styles.needHelpTitle}>Worth having a backup.</Text>
      </View>
      <Text style={styles.needHelpSub}>
        {helpers.length > 0
          ? `You have ${helpers.length} helper${helpers.length > 1 ? "s" : ""} on the list.`
          : "Add someone who could step in if needed."}
      </Text>
      <TouchableOpacity style={styles.needHelpBtn} onPress={onFindHelp} activeOpacity={0.8}>
        <Feather name="user-plus" size={13} color={TEAL} />
        <Text style={styles.needHelpBtnText}>
          {helpers.length > 0 ? "View helpers" : "Add a helper"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── HelperSection ──────────────────────────────────────────────────────────────
function HelperSection({
  helpers,
  onAdd,
  onRemove,
}: {
  helpers: FamilyHelper[];
  onAdd: (name: string, contact?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName]       = useState("");
  const [contact, setContact] = useState("");
  const [adding, setAdding]   = useState(false);

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, contact.trim() || undefined);
    setName(""); setContact(""); setAdding(false);
  }

  return (
    <View style={styles.helperSection}>
      <View style={styles.helperSectionHeader}>
        <Feather name="users" size={13} color={TEAL} />
        <Text style={styles.helperSectionTitle}>Helpers</Text>
      </View>
      <Text style={styles.helperSectionSub}>
        People who can step in when you need a hand.
      </Text>
      {helpers.map((h) => (
        <View key={h.id} style={styles.helperRow}>
          <View style={styles.helperDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.helperName}>{h.name}</Text>
            {h.contact ? <Text style={styles.helperContact}>{h.contact}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => onRemove(h.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={13} color="#ccc" />
          </TouchableOpacity>
        </View>
      ))}
      {adding ? (
        <View style={styles.helperAddForm}>
          <TextInput
            style={styles.helperInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#bbb"
            returnKeyType="next"
            autoFocus
          />
          <TextInput
            style={styles.helperInput}
            value={contact}
            onChangeText={setContact}
            placeholder="Phone (optional)"
            placeholderTextColor="#bbb"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={styles.helperConfirmBtn} onPress={handleAdd} activeOpacity={0.8}>
              <Text style={styles.helperConfirmBtnText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)} activeOpacity={0.7}>
              <Feather name="x" size={16} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.helperAddBtn}
          onPress={() => setAdding(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={13} color={TEAL} />
          <Text style={styles.helperAddBtnText}>Add helper</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
// ── Places Autocomplete ────────────────────────────────────────────────────────
const GEO_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_GEO_API_KEY ?? "";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

function LocationAutocomplete({
  value,
  onSelect,
  inputStyle,
}: {
  value: string;
  onSelect: (name: string) => void;
  inputStyle: object;
}) {
  const [query, setQuery]           = useState(value);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [open, setOpen]             = useState(false);
  const debounce                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  function fetchSuggestions(text: string) {
    if (debounce.current) clearTimeout(debounce.current);
    if (!GEO_API_KEY || text.trim().length < 2) {
      setSuggestions([]); setOpen(false); return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
          `?input=${encodeURIComponent(text)}&components=country:au&types=geocode&key=${GEO_API_KEY}`;
        const res  = await fetch(url);
        const data = (await res.json()) as { status: string; predictions: PlacePrediction[] };
        const preds = data.predictions ?? [];
        setSuggestions(preds);
        setOpen(preds.length > 0);
      } catch {
        setSuggestions([]); setOpen(false);
      }
    }, 300);
  }

  function handleSelect(pred: PlacePrediction) {
    const name = pred.structured_formatting.main_text;
    setQuery(name);
    onSelect(name);
    setSuggestions([]);
    setOpen(false);
    Keyboard.dismiss();
  }

  return (
    <View style={{ zIndex: 20 }}>
      <TextInput
        style={inputStyle}
        value={query}
        onChangeText={(t) => { setQuery(t); onSelect(t); fetchSuggestions(t); }}
        placeholder="e.g. Rathmines, Morisset, Wangi Wangi"
        placeholderTextColor="#bbb"
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (
        <View style={{
          position: "absolute", top: 48, left: 0, right: 0,
          backgroundColor: "#fff", borderRadius: 12,
          borderWidth: 1, borderColor: "#E2DDD6",
          zIndex: 100, elevation: 8,
          ...Platform.select({ web: { boxShadow: "0px 4px 16px rgba(0,0,0,0.12)" } }),
        }}>
          {suggestions.slice(0, 5).map((pred, idx) => (
            <TouchableOpacity
              key={pred.place_id}
              onPress={() => handleSelect(pred)}
              style={{
                paddingHorizontal: 14, paddingVertical: 11,
                borderBottomWidth: idx < Math.min(suggestions.length, 5) - 1 ? 1 : 0,
                borderBottomColor: "#F0ECE6",
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT }}>
                {pred.structured_formatting.main_text}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED }}>
                {pred.structured_formatting.secondary_text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const insets        = useSafeAreaInsets();
  const paddingTop    = insets.top + 8;
  const paddingBottom = 120;
  const scrollRef     = useRef<ScrollView>(null);
  const bannerTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState]   = useState<FamilyState>({ members: [], events: [] });
  const [result, setResult] = useState<FamilyWeekResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedBanner, setSavedBanner] = useState<{
    type: BannerType; title: string;
  } | null>(null);

  const [showForm, setShowForm]               = useState(false);
  const [editingEvent, setEditingEvent]       = useState<FamilyEvent | null>(null);
  const [showPlanSummary, setShowPlanSummary] = useState(false);
  // familyStep drives the 3-page flow: input → sorting → results
  const [familyStep, setFamilyStep]           = useState<"input" | "sorting" | "results">("input");
  const [juggleResult, setJuggleResult]       = useState<JuggleResult | null>(null);
  const [sortError, setSortError]             = useState<string | null>(null);
  const [isSorted, setIsSorted]               = useState(false);
  const [helpers, setHelpers]                 = useState<FamilyHelper[]>([]);
  const [showHelpers, setShowHelpers]         = useState(false);
  const [pushedCalEvents, setPushedCalEvents] = useState<SortiiCalEvent[]>([]);
  const [apptItems,       setApptItems]       = useState<Appointment[]>([]);
  const [carpoolContacts, setCarpoolContacts] = useState<CarpoolContact[]>([]);
  const [juggleFreeText, setJuggleFreeText]   = useState("");
  // 0 = this week, 1 = next week — controls both the appt feed and the juggle sort
  const [sortWeek, setSortWeek]               = useState<0 | 1>(0);

  // Compute a map from eventId → AI-assigned adult name (including swaps)
  const juggleDriverMap = React.useMemo(() => {
    if (!juggleResult) return new Map<string, string>();
    const map = new Map<string, string>();
    const overrides = juggleResult.swapOverrides ?? {};
    (juggleResult.adult_plans ?? []).forEach((plan) => {
      plan.schedule.forEach((s) => {
        const adult = overrides[s.event_id] ?? plan.adult;
        if (s.event_id) map.set(s.event_id, adult);
      });
    });
    return map;
  }, [juggleResult]);

  const carpoolKey = () => SK.carpoolContacts(getCurrentUserId());

  const load = useCallback(async () => {
    const uid = getCurrentUserId();
    const [s, savedJuggle, savedHelpers, appts, savedCarpool, savedFreeText] = await Promise.all([
      loadFamilyState(),
      AsyncStorage.getItem(juggleKey()),
      AsyncStorage.getItem(HELPERS_KEY),
      loadAppointments(),
      AsyncStorage.getItem(SK.carpoolContacts(uid)),
      AsyncStorage.getItem(SK.juggleFreeText(uid)),
    ]);
    setState(s);
    setResult(computeFamilyWeek(s));
    setApptItems(appts);
    if (savedJuggle) {
      try { setJuggleResult(JSON.parse(savedJuggle)); setIsSorted(true); } catch {}
    }
    if (savedHelpers) {
      try { setHelpers(JSON.parse(savedHelpers)); } catch {}
    }
    if (savedCarpool) {
      try { setCarpoolContacts(JSON.parse(savedCarpool)); } catch {}
    }
    if (savedFreeText) {
      setJuggleFreeText(savedFreeText);
    }
    try {
      const pushed = await loadFamilyPushedEvents();
      setPushedCalEvents(pushed);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  // When the user switches weeks, load (or clear) the stored result for that week.
  useEffect(() => {
    AsyncStorage.getItem(juggleKey(sortWeek)).then((raw) => {
      if (raw) {
        try { setJuggleResult(JSON.parse(raw)); setIsSorted(true); } catch {}
      } else {
        setJuggleResult(null); setIsSorted(false);
      }
    });
  }, [sortWeek]);

  async function persistState(next: FamilyState) {
    setState(next);
    setResult(computeFamilyWeek(next));
    await saveFamilyState(next);
  }

  function openAddEvent()                   { setEditingEvent(null); setShowForm(true); }
  function openEditEvent(ev: FamilyEvent)   { setEditingEvent(ev);   setShowForm(true); }

  function openPlanSummary() {
    dismissBanner();
    if (juggleResult) {
      setFamilyStep("results");
    }
  }

  function showBanner(type: BannerType, title: string) {
    setSavedBanner({ type, title });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setSavedBanner(null), 3000);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);
  }

  function dismissBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setSavedBanner(null);
  }

  async function handleSaveEvent(draft: Omit<FamilyEvent, "id">) {
    const wasEditing  = !!editingEvent;
    const prevCount   = state.events.length;
    const savedId     = editingEvent?.id ?? Date.now().toString();
    const next: FamilyState = editingEvent
      ? {
          ...state,
          events: state.events.map((e) =>
            e.id === editingEvent.id ? { ...draft, id: editingEvent.id } : e
          ),
        }
      : { ...state, events: [...state.events, { ...draft, id: savedId }] };
    setShowForm(false);
    setEditingEvent(null);
    await persistState(next);
    setIsSorted(false);

    // ── Bidirectional sync: Family appointment → Appointments store ────────────
    // If event is marked as appointment, mirror it into the Appointments tab so
    // the user doesn't have to enter it twice.  Use deterministic id "fam_<id>"
    // so edits/deletes stay linked.
    if (draft.isAppointment) {
      const apptId = `fam_${savedId}`;
      // Pin the appointment to the correct calendar week (this or next) based on sortWeek
      const date   = dateForDayInWeek(draft.day as DayOfWeek, sortWeek);
      const person = draft.assignedAdult ||
        draft.personIds.map((pid) => state.members.find((m) => m.id === pid)?.name).filter(Boolean).join(", ") || "";
      const newAppt: Appointment = {
        id: apptId,
        title: draft.title,
        category: "Medical",
        date,
        startTime: draft.time || "09:00",
        endTime: draft.endTime || undefined,
        person,
        locationName: draft.location || "",
        suburb: "",
        notes: draft.notes || "",
        checklist: [],
        reminderEnabled: false,
        recurringEnabled: draft.isRecurring ?? (draft.repeat !== "none"),
        isDone: false,
        isCancelled: false,
        appointmentCost: null,
        availabilityBlock: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const existing = await loadAppointments();
      const filtered = existing.filter((a) => a.id !== apptId);
      await saveAppointments([...filtered, newAppt]);
      setApptItems([...filtered, newAppt]); // refresh in-memory
    }
    // ── End bidirectional sync ─────────────────────────────────────────────────

    const bannerType: BannerType =
      wasEditing ? "edited" : prevCount === 0 ? "first" : "subsequent";
    showBanner(bannerType, draft.title);
  }

  async function handleDeleteEvent(id: string) {
    Alert.alert("Remove event?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await persistState({ ...state, events: state.events.filter((e) => e.id !== id) });
          setIsSorted(false);
        },
      },
    ]);
  }

  async function handleAddMember(name: string, role: "adult" | "child") {
    const nameExists = state.members.some(
      (m) => m.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (nameExists) return;
    const usedColors = state.members.map((m) => m.color);
    const color = MEMBER_COLORS.find((c) => !usedColors.includes(c)) ?? MEMBER_COLORS[0]!;
    const member: FamilyMember = { id: Date.now().toString(), name, role, color };
    await persistState({ ...state, members: [...state.members, member] });
  }

  async function handleRemoveMember(id: string) {
    await persistState({
      members: state.members.filter((m) => m.id !== id),
      events: state.events.map((e) => ({
        ...e,
        personIds: e.personIds.filter((pid) => pid !== id),
        driverId: e.driverId === id ? undefined : e.driverId,
      })),
    });
  }

  async function handleSharePlan() {
    if (!result) return;
    try { await Share.share({ message: result.sharePlanText }); } catch {}
  }

  async function handleSwapApplied(event_id: string, adult: string) {
    if (!juggleResult) return;
    const updated: JuggleResult = {
      ...juggleResult,
      swapOverrides: { ...(juggleResult.swapOverrides ?? {}), [event_id]: adult },
    };
    setJuggleResult(updated);
    await AsyncStorage.setItem(juggleKey(sortWeek), JSON.stringify(updated));
  }

  async function handleSortJuggle() {
    const uniqueMembers = state.members.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) => m.name.toLowerCase().trim() === member.name.toLowerCase().trim()
        )
    );
    const adults = uniqueMembers.filter((m) => m.role === "adult");

    // Compute the target week's date range using local dates (not UTC / toISOString).
    // sortWeek=0 → this Mon-Sun; sortWeek=1 → next Mon-Sun.
    const _now    = new Date();
    const _jsDay  = _now.getDay();
    const _diff   = _jsDay === 0 ? -6 : 1 - _jsDay;
    const _wStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + _diff + sortWeek * 7);
    const _wEnd   = new Date(_wStart.getFullYear(), _wStart.getMonth(), _wStart.getDate() + 6);
    const _ws     = localDateStr(_wStart);
    const _we     = localDateStr(_wEnd);

    // Convert this week's Appointments into FamilyEvent format for Claude.
    // Exclude any that were synced FROM this Family tab (id starts with "fam_")
    // to avoid double-counting.
    const existingIds = new Set(state.events.map((e) => e.id));
    const apptAsEvents: FamilyEvent[] = apptItems
      .filter((a) => !a.isDone && !a.isCancelled && a.date >= _ws && a.date <= _we && !a.id.startsWith("fam_"))
      .map((a): FamilyEvent => {
        const apptDate = new Date(`${a.date}T00:00:00`);
        const dayName  = DAYS_JS_TO_SORTII[apptDate.getDay()] ?? "Monday";
        const personMember = uniqueMembers.find((m) => m.name === a.person);
        return {
          id: a.id,
          title: a.title,
          day: dayName,
          time: a.startTime || "09:00",
          endTime: a.endTime || "",
          personIds: personMember ? [personMember.id] : [],
          isAppointment: true,
          assignedAdult: a.person || undefined,
          priority: "must",
          location: [a.locationName, a.suburb].filter(Boolean).join(", ") || undefined,
          notes: a.notes || undefined,
          driverId: undefined,
          repeat: "none",
        };
      })
      .filter((e) => !existingIds.has(e.id)); // deduplicate

    const allEvents = [...state.events, ...apptAsEvents];

    if (adults.length === 0 || (allEvents.length === 0 && pushedCalEvents.length === 0)) return;

    console.log("[Sortii] Sort triggered — adults:", adults.length, "events:", allEvents.length, "appts:", apptAsEvents.length, "cal:", pushedCalEvents.length);
    setSortError(null);
    setFamilyStep("sorting");

    try {
      const memberLookup = new Map<string, FamilyMember>(uniqueMembers.map((m) => [m.id, m]));

      // ── Diagnostic: log exact solver input ──────────────────────────────────
      console.log("=== SOLVER INPUT ===");
      console.log("MEMBERS:", uniqueMembers.map((m) => `${m.name} (${m.role})`).join(", "));
      console.log("EVENTS:");
      allEvents.forEach((ev) => {
        const persons = ev.personIds.map((id) => memberLookup.get(id)?.name ?? id).join(", ");
        console.log(
          ` • ${ev.title} | day:${ev.day} | ${ev.time}–${ev.endTime || "?"}`
          + ` | assignedAdult:${ev.assignedAdult ?? "(none)"}`
          + ` | location:${ev.location ?? "(none)"}`
          + ` | persons:[${persons}]`
          + ` | isAppt:${ev.isAppointment ?? false}`
        );
      });
      console.log("=== END SOLVER INPUT ===");
      // ────────────────────────────────────────────────────────────────────────

      // ── Build location pairs for real drive-time lookup ──────────────────────
      const locationPairs: Array<{ from: string; to: string }> = [];
      const sortedByTime = [...allEvents]
        .filter((ev) => ev.location?.trim())
        .sort((a, b) => {
          const [ah = 0, am = 0] = (a.time || "00:00").split(":").map(Number);
          const [bh = 0, bm = 0] = (b.time || "00:00").split(":").map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
        });
      for (let i = 0; i < sortedByTime.length - 1; i++) {
        const from = sortedByTime[i]!.location?.trim();
        const to   = sortedByTime[i + 1]!.location?.trim();
        if (from && to && from.toLowerCase() !== to.toLowerCase()) {
          const already = locationPairs.some(
            (p) => p.from.toLowerCase() === from.toLowerCase() &&
                   p.to.toLowerCase() === to.toLowerCase()
          );
          if (!already) locationPairs.push({ from, to });
        }
      }
      const driveTimes   = await getDriveTimes(locationPairs);
      const travelContext = buildTravelContext(driveTimes);

      // ── Build user message for Claude ────────────────────────────────────────
      const adultLines = adults
        .filter((a) => a.name.trim())
        .map((a) => `- ${a.name} (can drive)`)
        .join("\n");

      const eventLines = allEvents.map((ev, i) => {
        const personNames = ev.personIds
          .map((id) => memberLookup.get(id)?.name ?? id)
          .filter(Boolean)
          .join(", ");
        return [
          `Event ${i + 1} (ID: ${ev.id}):`,
          `  Person: ${personNames || ev.assignedAdult || "unspecified"}`,
          `  Activity: ${ev.title}`,
          `  Location: ${ev.location || "unspecified"}`,
          `  Day: ${ev.day}`,
          `  Start: ${ev.time || "unspecified"}`,
          `  End: ${ev.endTime || "unspecified"}`,
          `  Assigned adult: ${ev.assignedAdult || "unassigned"}`,
          `  Priority: ${ev.priority || "must"}`,
          `  Type: ${ev.isAppointment ? "appointment" : "activity"}`,
          `  Recurring: ${ev.repeat && ev.repeat !== "none" ? "yes — weekly" : "no — one-off"}`,
          `  Notes: ${ev.notes || "none"}`,
        ].join("\n");
      }).join("\n\n");

      const calLines = pushedCalEvents.length > 0
        ? `\n\nCalendar events:\n${pushedCalEvents.map((c, i) =>
            `Cal ${i + 1}: ${c.title} | ${c.startTime}–${c.endTime ?? "open"} | ${c.location || "no location"}`
          ).join("\n")}`
        : "";

      const freeTextSection = juggleFreeText.trim()
        ? `\n\nAdditional context from parent:\n${juggleFreeText.trim()}`
        : "";

      // ── Carpool contacts ─────────────────────────────────────────────────────
      // Global contacts (CarpoolContact: id/name/phone) + per-event contacts
      // (CarpoolContactEntry: richer type). Built as string lines separately
      // to avoid type-union assignment issues.
      const globalContactLines = carpoolContacts.map((c) =>
        `- ${c.name} (contact)${c.phone ? ` · ${c.phone}` : ""}`
      );
      const perEventEntries: CarpoolContactEntry[] = allEvents.flatMap((ev) => {
        if (!ev.carpoolContacts?.length) return [];
        const childName = ev.personIds
          .map((id) => memberLookup.get(id)?.name)
          .filter(Boolean)
          .join(", ");
        return ev.carpoolContacts.map((c) => ({
          ...c,
          canHelpWith: c.canHelpWith?.length ? c.canHelpWith : childName ? [childName] : [],
        }));
      });
      const perEventContactLines = perEventEntries
        .filter((pc) => !carpoolContacts.some(
          (gc) => gc.name.toLowerCase() === pc.name.toLowerCase()
        ))
        .map((c) =>
          `- ${c.name} (${c.relationship || "contact"}) — can help with: ${
            (c.canHelpWith ?? []).join(", ") || "any child"
          }${c.phone ? ` · ${c.phone}` : ""}${c.mobile ? ` · ${c.mobile}` : ""}`
        );
      const allContactLines = [...globalContactLines, ...perEventContactLines];
      const contactLines = allContactLines.length > 0
        ? `\n\nCarpool contacts:\n${allContactLines.join("\n")}`
        : "\n\nCarpool contacts: none saved yet.";
      // ────────────────────────────────────────────────────────────────────────

      const userMessage =
        `Available adults:\n${adultLines}\n\nWeekend events:\n${eventLines}${calLines}` +
        `${travelContext}\n\nRegion: Lake Macquarie / Hunter, NSW Australia.` +
        `${contactLines}${freeTextSection}\n\nPlease solve this schedule.`;

      console.log("=== SENDING TO CLAUDE ===");
      console.log(userMessage);
      console.log("=== END CLAUDE MESSAGE ===");

      const rawResult = await solveJuggle(userMessage);
      const full: JuggleResult = { ...(rawResult as unknown as JuggleResult), solvedAt: Date.now() };

      await AsyncStorage.setItem(juggleKey(sortWeek), JSON.stringify(full));
      setJuggleResult(full);
      setIsSorted(true);
      setFamilyStep("results");
    } catch (err) {
      console.error("[Sortii] Sort error:", err);
      setFamilyStep("input");
      setSortError("Something went sideways. Try re-sorting.");
    }
  }

  async function handleShareJuggle(text: string) {
    try { await Share.share({ message: text }); } catch {}
  }

  async function handleAddCarpoolContact(c: CarpoolContact) {
    const next = [...carpoolContacts, c];
    setCarpoolContacts(next);
    await AsyncStorage.setItem(carpoolKey(), JSON.stringify(next));
  }

  async function handleFreeTextChange(text: string) {
    setJuggleFreeText(text);
    await AsyncStorage.setItem(SK.juggleFreeText(getCurrentUserId()), text);
  }

  async function handleAddHelper(name: string, contact?: string) {
    const next: FamilyHelper[] = [...helpers, { id: Date.now().toString(), name, contact }];
    setHelpers(next);
    await AsyncStorage.setItem(HELPERS_KEY, JSON.stringify(next));
    setShowHelpers(true);
  }

  async function handleRemoveHelper(id: string) {
    const next = helpers.filter((h) => h.id !== id);
    setHelpers(next);
    await AsyncStorage.setItem(HELPERS_KEY, JSON.stringify(next));
  }

  // ── This-week appointments — must be before early returns (Rules of Hooks) ──
  const thisWeekAppts = React.useMemo(() => {
    const today = new Date();
    const jsDay = today.getDay();
    const diff = jsDay === 0 ? -6 : 1 - jsDay;
    // Use sortWeek offset so the correct week's appointments are shown in the family view
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff + sortWeek * 7);
    const weekEnd   = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    // Use localDateStr — NOT toISOString() which converts to UTC and gives the wrong date for AU/NZ.
    const ws = localDateStr(weekStart);
    const we = localDateStr(weekEnd);
    return apptItems
      .filter((a) => !a.isDone && !a.isCancelled && a.date >= ws && a.date <= we)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [apptItems, sortWeek]);

  if (loading) return <View style={{ flex: 1, backgroundColor: BG }} />;

  // ── Page 2: Sorting / loading screen ───────────────────────────────────────
  if (familyStep === "sorting") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <JuggleProcessingOverlay />
      </SafeAreaView>
    );
  }

  // ── Page 3: Results screen ─────────────────────────────────────────────────
  if (familyStep === "results" && juggleResult) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Slim nav bar — content weight lives inside the hero dashboard card */}
        <View style={styles.resultsHeader}>
          <TouchableOpacity
            onPress={() => setFamilyStep("input")}
            style={styles.resultsNavBtn}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={16} color={TEAL} />
            <Text style={styles.resultsBack}>Family</Text>
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Sorted. Here's the plan</Text>
          <TouchableOpacity
            onPress={() => handleSortJuggle()}
            style={styles.resultsNavBtn}
            activeOpacity={0.75}
          >
            <Feather name="refresh-cw" size={13} color={TEXT_MUTED} />
            <Text style={styles.resultsRetry}>Re-sort</Text>
          </TouchableOpacity>
        </View>
        <JuggleResultsContent
          juggleResult={juggleResult}
          members={state.members}
          carpoolContacts={carpoolContacts}
          onClose={() => setFamilyStep("input")}
          onSortAgain={() => handleSortJuggle()}
          onShare={handleShareJuggle}
          onSwapApplied={handleSwapApplied}
        />
      </SafeAreaView>
    );
  }

  const hasEvents          = state.events.length > 0 || pushedCalEvents.length > 0 || thisWeekAppts.length > 0;

  const hasMembers         = state.members.length > 0;
  const hasAdults          = state.members.some((m) => m.role === "adult");
  const daysWithEvents     = result?.daysWithEvents ?? [];
  const canSort            = hasEvents && hasAdults;
  // needsSort: true when there's something to sort and either no prior result, or events changed since last sort
  const needsSort          = canSort && (!juggleResult || !isSorted);
  const hasTightOrConflict = (result?.insights ?? []).some(
    (i) => i.type === "conflict" || i.type === "tight" || i.type === "child_clash"
  );
  // Taller bottom padding when sort CTA is shown in sticky bar
  const navPad = TAB_BAR_HEIGHT + Math.max(insets.bottom, 0);
  const scrollPadBottom = hasEvents ? (needsSort ? 160 + navPad : 112 + navPad) : 80;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop, paddingBottom: scrollPadBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Family</Text>
            <Text style={styles.pageSub}>
              {hasEvents
                ? sortWeek === 1
                  ? "Planning next week. Add events and we'll sort them."
                  : "What's on this week? We'll untangle the rest."
                : hasMembers
                ? "Add things as they come up. We'll sort the rest."
                : "Your family's week, in one place."}
            </Text>
          </View>
        </View>

        {/* ── Family members — always at top ── */}
        <ManagePeopleSection
          members={state.members}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />

        {/* ── Week selector — This week / Next week ── */}
        {hasMembers && (
          <View style={styles.weekSelectorRow}>
            {([{ v: 0 as const, label: "This week" }, { v: 1 as const, label: "Next week" }]).map(({ v, label }) => (
              <TouchableOpacity
                key={v}
                onPress={() => setSortWeek(v)}
                style={[styles.weekSelectorChip, sortWeek === v && styles.weekSelectorChipActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.weekSelectorText, sortWeek === v && styles.weekSelectorTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Events or empty states ── */}
        {hasEvents ? (
          <>
            {/* Day-by-day events — clean list, no plan outputs pre-sort */}
            <View style={styles.weekSection}>
              <Text style={styles.sectionLabel}>{sortWeek === 0 ? "THIS WEEK" : "NEXT WEEK"}</Text>
              {(() => {
                const apptsByDay: Partial<Record<DayOfWeek, Appointment[]>> = {};
                for (const a of thisWeekAppts) {
                  const d = new Date(`${a.date}T00:00:00`);
                  const day = DAYS_JS_TO_SORTII[d.getDay()];
                  if (day) (apptsByDay[day] = apptsByDay[day] ?? []).push(a);
                }
                const allDays = ALL_DAYS.filter(
                  (d) => (result?.eventsByDay[d]?.length ?? 0) > 0 || (apptsByDay[d]?.length ?? 0) > 0
                );
                return allDays.map((day) => {
                  const famEvs = result?.eventsByDay[day] ?? [];
                  const dayAppts = apptsByDay[day] ?? [];
                  const isWeekend = day === "Saturday" || day === "Sunday";
                  return (
                    <View key={day} style={styles.daySection}>
                      <View style={[styles.dayHeader, isWeekend && styles.dayHeaderWeekend]}>
                        <Text style={[styles.dayLabel, isWeekend && { color: GOLD }]}>{day}</Text>
                        <View style={[styles.eventCountBadge, isWeekend && { backgroundColor: GOLD + "18" }]}>
                          <Text style={[styles.eventCountText, isWeekend && { color: GOLD }]}>
                            {famEvs.length + dayAppts.length}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.daySectionEvents}>
                        {famEvs.map((ev, idx) => (
                          <React.Fragment key={ev.id}>
                            <EventCard
                              event={ev}
                              members={state.members}
                              onEdit={() => openEditEvent(ev)}
                              onDelete={() => handleDeleteEvent(ev.id)}
                              aiDriver={juggleDriverMap?.get(ev.id)}
                            />
                            {(idx < famEvs.length - 1 || dayAppts.length > 0) && (
                              <View style={styles.dayEventConnector} />
                            )}
                            {juggleDriverMap && idx < famEvs.length - 1 && (() => {
                              const hint = getTravelHint(ev, famEvs[idx + 1]!, juggleDriverMap);
                              if (!hint) return null;
                              return (
                                <View style={styles.travelHintRow}>
                                  <Feather name="navigation" size={11} color={ORANGE} />
                                  <Text style={styles.travelHintText}>{hint}</Text>
                                </View>
                              );
                            })()}
                          </React.Fragment>
                        ))}
                        {dayAppts.map((a) => (
                          <View key={a.id} style={styles.apptItemRow}>
                            <View style={styles.apptTimePill}>
                              <Text style={styles.apptTimeText}>{a.startTime || "All day"}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.apptTitle} numberOfLines={1}>{a.title}</Text>
                            </View>
                            <View style={styles.apptBadge}>
                              <Text style={styles.apptBadgeText}>Appt</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                });
              })()}

              {/* Pushed calendar events */}
              {pushedCalEvents.length > 0 && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {pushedCalEvents.map((e) => {
                    const timeLabel = e.isAllDay
                      ? "All day"
                      : new Date(e.startTime).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <View key={e.id} style={styles.calPushedCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <View style={styles.calPushedTimePill}>
                            <Text style={styles.calPushedTimeText}>{timeLabel}</Text>
                          </View>
                          <Text>📅</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.calPushedTitle} numberOfLines={1}>{e.title}</Text>
                            {e.calendarName ? (
                              <Text style={styles.calPushedSource}>{e.calendarName}</Text>
                            ) : null}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={async () => {
                            await removeEventFromFamily(e.id);
                            setPushedCalEvents((prev) => prev.filter((x) => x.id !== e.id));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.calPushedRemove}>↩ Remove</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Recurring note */}
            {state.events.some((e) => e.repeat !== "none") && (
              <View style={styles.repeatNote}>
                <Feather name="repeat" size={12} color={TEXT_MUTED} />
                <Text style={styles.repeatNoteText}>
                  Regulars carry forward. Nothing to re-enter.
                </Text>
              </View>
            )}

            {/* Inline Sort / re-sort card */}
            {state.events.length >= 1 && (
              <SortContextCard
                events={state.events}
                juggleResult={juggleResult}
                isSorted={isSorted}
                sortError={sortError}
                onSort={handleSortJuggle}
                onViewPlan={() => setFamilyStep("results")}
                onReSort={() => handleSortJuggle()}
              />
            )}

            {/* Need backup prompt — when tight/conflict insights exist */}
            {hasTightOrConflict && (
              <NeedHelpPrompt
                helpers={helpers}
                onFindHelp={() => setShowHelpers(true)}
              />
            )}

            {/* Helper list — shown when user taps "Find help" */}
            {showHelpers && (
              <HelperSection
                helpers={helpers}
                onAdd={handleAddHelper}
                onRemove={handleRemoveHelper}
              />
            )}

            {/* Light setup summary strip */}
            <SetupReadyStrip
              eventCount={state.events.length}
              adultCount={state.members.filter((m) => m.role === "adult").length}
              lastSolvedAt={juggleResult?.solvedAt ?? null}
              onViewLastPlan={() => setFamilyStep("results")}
            />

            {/* Persistent "Add another event" button — always visible when events exist */}
            <TouchableOpacity
              style={styles.addAnotherBtn}
              onPress={openAddEvent}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.addAnotherBtnText}>Add another event</Text>
            </TouchableOpacity>

            {/* ANYTHING WE SHOULD KNOW? — global free-text context for Claude */}
            <View style={{ marginTop: 8 }}>
              <Text style={{
                fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#999",
                textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
              }}>
                ANYTHING WE SHOULD KNOW?
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#F7F3EB",
                  borderColor: "#E6E1D7",
                  borderWidth: 1,
                  borderRadius: 10,
                  fontSize: 14,
                  fontFamily: "Inter_400Regular",
                  padding: 12,
                  minHeight: 80,
                  color: TEXT,
                }}
                value={juggleFreeText}
                onChangeText={handleFreeTextChange}
                placeholder="e.g. Morisset to Wangi Wangi takes longer on Saturday mornings, or Tom's football usually runs 10 min late"
                placeholderTextColor="#bbb"
                multiline
                textAlignVertical="top"
              />
            </View>
          </>
        ) : hasMembers ? (
          /* Members exist, no events yet */
          <View style={styles.membersReadyState}>
            <View style={styles.membersReadyChips}>
              {state.members.map((m) => (
                <MemberChip key={m.id} member={m} />
              ))}
            </View>
            <Text style={styles.membersReadyTitle}>Everyone's here.</Text>
            <Text style={styles.membersReadySub}>
              Add events as they come up — pickups, activities, anything that needs coordinating.
              Once you do, we'll untangle the week for you.
            </Text>
            <TouchableOpacity
              style={styles.membersReadyCta}
              onPress={openAddEvent}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.membersReadyCtaText}>Add first event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Truly empty */
          <View style={styles.emptyState}>
            <Feather name="calendar" size={34} color="#D6D2C8" />
            <Text style={styles.emptyTitle}>Nothing on yet.</Text>
            <Text style={styles.emptySub}>
              Add your family, then events as they come up. Sortii will untangle the rest.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Saved toast — appears above sticky bar ── */}
      <SavedToast visible={!!savedBanner} />

      {/* ── Sticky bar — See the plan + Re-sort when events exist ── */}
      {hasEvents && (
        <View style={[styles.sortCtaBar, { paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 0) + 8 }]}>
          <View style={styles.sortCtaBarBtns}>
            <TouchableOpacity
              style={styles.stickySeePlanBtn}
              onPress={() => juggleResult ? setFamilyStep("results") : handleSortJuggle()}
              activeOpacity={0.88}
            >
              <Text style={styles.stickySeePlanBtnText}>See the plan →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stickyResortBtn}
              onPress={() => handleSortJuggle()}
              activeOpacity={0.85}
            >
              <Text style={styles.stickyResortBtnText}>Re-sort ↺</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Add / Edit form sheet ── */}
      {showForm && (
        <AddEventSheet
          visible={showForm}
          members={state.members}
          initialDraft={editingEvent}
          carpoolContacts={carpoolContacts}
          onAddCarpoolContact={handleAddCarpoolContact}
          onClose={() => { setShowForm(false); setEditingEvent(null); }}
          onSave={handleSaveEvent}
        />
      )}

      {/* Modal + overlay removed — results now use familyStep early-return above */}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14 },

  // Header
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  pageTitle: { fontSize: 28, fontFamily: "DMSans_700Bold", color: TEXT, letterSpacing: -0.5 },
  pageSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic",
    marginTop: 3, lineHeight: 18, maxWidth: 240,
  },
  sharePlanBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TEAL + "30", marginTop: 4, flexShrink: 0,
  },
  sharePlanBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2,
    textTransform: "uppercase", color: TEXT_MUTED, marginBottom: 6,
  },

  // Week summary card
  weekSummaryCard: {
    backgroundColor: TEAL_TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TEAL + "30",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  weekSummaryStats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14 },
  statItem: { alignItems: "center", gap: 1 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: TEXT },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  busynessPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  busynessDot: { width: 7, height: 7, borderRadius: 4 },
  busynessText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  unassignedNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  unassignedNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, flex: 1 },

  // Plan split card
  planSplitCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    padding: 14,
    gap: 10,
  },
  planSplitHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  planSplitTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  planSplitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  planSplitDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  planSplitName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT, minWidth: 56 },
  planSplitDays: { flexDirection: "row", flexWrap: "wrap", gap: 5, flex: 1 },
  planSplitDayChip: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  planSplitDayText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Insights
  insightsCard: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 14, gap: 10,
  },
  insightsHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  insightsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  insightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },

  // Week section
  weekSection: { gap: 0 },
  daySection: { marginBottom: 4 },
  dayHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 6,
  },
  dayHeaderWeekend: { borderBottomColor: GOLD + "44" },
  dayLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: TEXT, flex: 1 },
  eventCountBadge: { backgroundColor: TEAL + "18", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  eventCountText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEAL },
  daySectionEvents: { gap: 8, marginBottom: 12 },
  dayEventConnector: { height: 1, backgroundColor: BORDER, marginHorizontal: 4, opacity: 0.6 },

  // Event card
  eventCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, borderLeftWidth: 3 },
  eventCardMain: { flexDirection: "row", gap: 10, padding: 11, alignItems: "flex-start" },
  eventMenuBtn: { alignSelf: "flex-start", paddingLeft: 4, paddingTop: 1 },
  eventInlineMenu: {
    position: "absolute", top: 26, right: 0, zIndex: 100,
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 6, minWidth: 130, overflow: "hidden",
  },
  eventInlineMenuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  eventInlineMenuText: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT },
  eventInlineMenuDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 10 },
  eventTimePill: {
    backgroundColor: TEAL_TINT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: "flex-start", flexShrink: 0, flexDirection: "row", alignItems: "center",
    minWidth: 110,
  },
  eventTimeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: TEAL },
  eventTimeEnd: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEAL },
  eventCardBody: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  eventMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  eventMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventMetaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  eventInvolvedRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  eventActions: { borderTopWidth: 1, borderTopColor: BORDER, padding: 11, gap: 8 },
  carpoolText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
  eventNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  eventActionBtns: { flexDirection: "row", gap: 10 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6 },
  deleteBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C0392B" },

  // Member chip
  memberChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },
  memberChipSmall: { paddingHorizontal: 7, paddingVertical: 3 },
  memberChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  memberChipTextSmall: { fontSize: 11 },
  roleDot: { width: 5, height: 5, borderRadius: 3 },

  // "Members exist, no events" state
  membersReadyState: {
    backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 20, alignItems: "center", gap: 10,
  },
  membersReadyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  membersReadyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: TEXT, marginTop: 4 },
  membersReadySub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED,
    textAlign: "center", lineHeight: 19,
  },
  membersReadyCta: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4,
  },
  membersReadyCtaText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Truly empty state
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: TEXT },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, textAlign: "center", lineHeight: 19 },

  // People section
  peopleSection: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10,
  },
  peopleCollapsedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  peopleCollapsedIcon: { fontSize: 15 },
  peopleCollapsedNames: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT },
  peopleCollapsedEdit: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL },
  peopleDoneLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL },
  peopleSectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  peopleSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  peopleSectionEmpty: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
  peopleList: { gap: 8 },
  peopleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  peopleColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  peopleName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT },
  roleTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagAdult: { backgroundColor: TEAL + "18" },
  roleTagChild: { backgroundColor: GOLD + "18" },
  roleTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  addPersonForm: { gap: 10 },
  addPersonInput: {
    backgroundColor: "#F7F3EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, borderWidth: 1, borderColor: BORDER,
  },
  addPersonRoleRow: { flexDirection: "row", gap: 8 },
  addPersonRole: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  addPersonRoleSelected: { borderColor: TEAL, backgroundColor: TEAL_TINT },
  addPersonRoleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  addPersonBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  addPersonConfirm: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  addPersonConfirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  addPersonCta: { flexDirection: "row", alignItems: "center", gap: 7 },
  addPersonCtaText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Saved banner
  // Saved toast — replaces old banner
  savedToast: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center" as const,
    zIndex: 1000,
    ...Platform.select({
      web: { boxShadow: `0px 4px 20px ${TEAL}55` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    }),
  },
  savedToastText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", textAlign: "center" as const,
  },

  savedBanner: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: TEAL + "40", borderLeftWidth: 3, borderLeftColor: TEAL,
    padding: 14, gap: 10,
    ...Platform.select({
      web: { boxShadow: `0px 2px 12px ${TEAL}22` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 },
    }),
  },
  savedBannerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  savedBannerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: TEAL, marginTop: 4, flexShrink: 0 },
  savedBannerHeadline: { fontSize: 14, fontFamily: "Inter_700Bold", color: TEXT },
  savedBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 1 },
  savedBannerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  bannerReviewBtn: {
    backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  bannerReviewBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  bannerAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  bannerAddBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Light insight (quiet week)
  lightInsightCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: TEAL_TINT, borderRadius: 12, borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  lightInsightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },

  // WeekSortedCard
  weekSortedCard: {
    backgroundColor: TEAL_TINT, borderRadius: 16, borderWidth: 1, borderColor: TEAL + "30", padding: 16, gap: 10,
    ...Platform.select({
      web: { boxShadow: `0px 2px 16px ${TEAL}1A` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    }),
  },
  weekSortedCardWarn: { backgroundColor: ORANGE + "12", borderColor: ORANGE + "40" },
  weekSortedHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  weekSortedTick: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: TEAL,
    alignItems: "center", justifyContent: "center",
  },
  weekSortedTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT, flex: 1 },
  weekSortedStats: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT_MUTED, letterSpacing: 0.2 },
  weekSortedInsight: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18, fontStyle: "italic" },
  weekSortedActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 },
  weekSortedReviewBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
  },
  weekSortedReviewBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  weekSortedShareBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: TEAL + "44",
  },
  weekSortedShareBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },
  weekSortedAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  weekSortedAddBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED },

  // Plan summary sheet
  sheetSubTitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 2 },
  summaryStatsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16, paddingBottom: 4 },
  summaryStatBox: { alignItems: "center", gap: 1 },
  summaryStatNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: TEXT },
  summaryStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  summaryInsightBlock: {
    backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 12, gap: 8,
  },
  summaryBlock: {
    backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, gap: 8,
  },
  summaryBlockLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2,
    textTransform: "uppercase", color: TEXT_MUTED, marginBottom: 2,
  },
  summaryInsightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  summaryInsightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },
  summaryPlanRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryPlanName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT, minWidth: 60 },
  summaryPlanDays: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  summaryDayBlock: { gap: 6, marginBottom: 4 },
  summaryDayLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: TEXT },
  summaryEventRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  summaryEventTimePill: { backgroundColor: TEAL_TINT, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start" },
  summaryEventTime: { fontSize: 11, fontFamily: "Inter_700Bold", color: TEAL },
  summaryEventTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  summaryEventMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 1 },
  summaryUnassignedNote: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  summaryUnassignedText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 17 },
  summaryActions: { flexDirection: "row", gap: 10, paddingTop: 12, flexWrap: "wrap" },
  summaryShareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14,
  },
  summaryShareBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  summaryAddBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: TEAL_TINT, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  summaryAddBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Time preset chips
  timePresetChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  timePresetChipSelected: { backgroundColor: TEAL, borderColor: TEAL },
  timePresetText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  timePresetTextSelected: { color: "#fff" },

  // People section improvements
  addPersonCtaInline: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  addPersonCtaInlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },
  addPersonCtaFull: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 13, marginTop: 4,
  },
  addPersonCtaFullText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  noAdultsHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: GOLD + "12", borderRadius: 10, borderWidth: 1, borderColor: GOLD + "30",
    paddingHorizontal: 11, paddingVertical: 9,
  },
  noAdultsHintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 17 },

  // Juggle AI section
  juggleSection: { gap: 10, marginTop: 4 },
  jugglePriorResult: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: TEAL_TINT, borderRadius: 10, borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  jugglePriorResultText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT },
  juggleSolveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: TEAL, borderRadius: 14, height: 52,
    ...Platform.select({
      web: { boxShadow: `0px 3px 12px ${TEAL}44` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
    }),
  },
  juggleSolveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.2 },
  juggleSolveSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, textAlign: "center" },

  // Juggle processing overlay
  juggleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    zIndex: 9999,
  },
  jugglePulse: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: `0px 4px 24px ${TEAL}55` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 16, elevation: 8 },
    }),
  },
  juggleLineText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: TEXT, textAlign: "center", paddingHorizontal: 40 },
  juggleSubText: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, textAlign: "center" },

  // Juggle results — unified soft summary panel (top of results screen)
  resultSummaryPanel: {
    backgroundColor: "#EAF6F4", borderRadius: 16, padding: 18, gap: 10,
  },
  resultSummaryOutcome: {
    fontSize: 20, fontFamily: "DMSans_700Bold", color: TEXT,
    letterSpacing: -0.3, lineHeight: 26,
  },
  resultSummaryStatsRow: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
  },
  resultSummaryStatText: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED,
  },
  resultSummaryStatDot: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: BORDER,
  },

  // Juggle results — section label
  juggleSectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM,
    textTransform: "uppercase", letterSpacing: 0.1, marginBottom: 2,
  },

  // Section helper text (under section labels)
  juggleSectionHelper: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic",
  },

  // Juggle results — adult card (WHO'S GOT WHAT)
  juggleAdultCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 4,
    padding: 14, gap: 8,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
    }),
  },
  juggleAdultCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  juggleAdultDot: { width: 10, height: 10, borderRadius: 5 },
  juggleAdultName: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT },
  juggleScheduleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  juggleTimePill: {
    backgroundColor: TEAL, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  juggleTimePillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  juggleScheduleActivity: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  juggleScheduleChild: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  juggleScheduleLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  juggleFreeWindow: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#2D7A5A",
    backgroundColor: "#E0F5EC", paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, alignSelf: "flex-start" as const, marginTop: 4,
  },
  juggleAdultSendBtn: {
    borderWidth: 1, borderColor: TEAL, borderRadius: 10,
    paddingVertical: 9, alignItems: "center", marginTop: 4,
  },
  juggleAdultSendBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Juggle results — THE PLAN table
  jugglePlanCard: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: "hidden",
    padding: 14,
  },
  jugglePlanSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginBottom: 10 },
  jugglePlanRowHeader: {
    flexDirection: "row", backgroundColor: TEAL,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginBottom: 4,
  },
  jugglePlanDataRow: {
    flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "#F0EDEA", alignItems: "flex-start",
  },
  jugglePlanHeaderText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.8 },
  jugglePlanCellTime: { width: 72, justifyContent: "center" },
  jugglePlanCellWho: { flex: 1.2, paddingHorizontal: 6 },
  jugglePlanCellWhere: { flex: 1.4 },
  jugglePlanWhoText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEXT },
  jugglePlanWhereText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 17 },

  // Juggle results — swap pills
  juggleSwapPill: {
    backgroundColor: "#F3E8EE", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start",
  },
  juggleSwapPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM },
  juggleSwappedPill: {
    backgroundColor: "#E8F8F0", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start",
  },
  juggleSwappedPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2A8F88" },
  jugglePickerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 4, backgroundColor: "#FAFAF8", borderRadius: 8, marginBottom: 4 },
  jugglePickerLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  jugglePickerPill: { backgroundColor: PLUM + "18", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  jugglePickerPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: PLUM },

  // Juggle results — conflicts (HEADS UP card)
  juggleConflictCard: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E8D5D0",
    borderLeftWidth: 4, borderLeftColor: "#B86557", padding: 14, gap: 8,
    ...Platform.select({
      web: { boxShadow: "0px 2px 10px rgba(0,0,0,0.07)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
    }),
  },
  juggleConflictLabel: {
    color: "#B86557", fontSize: 11, fontFamily: "Inter_700Bold",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2,
  },
  juggleConflictDesc: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT, lineHeight: 20 },
  juggleConflictRec: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL, marginTop: 4, fontStyle: "italic" },
  juggleConflictOption: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 2 },

  carpoolClashBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3E0DC",
  },
  carpoolClashLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL, marginBottom: 3 },
  carpoolClashContact: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 18 },
  carpoolClashLink: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Juggle results — worth knowing
  juggleWorthKnowingCard: {
    backgroundColor: "#FAFAF8", borderRadius: 14, borderWidth: 1, borderColor: PLUM + "22",
    borderLeftWidth: 4, borderLeftColor: PLUM, padding: 14, gap: 6,
  },
  juggleSubhead: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: TEXT_MUTED,
    fontStyle: "italic", lineHeight: 22, marginBottom: 4,
  },
  juggleWorthKnowingLabel: {
    color: PLUM, fontSize: 11, fontFamily: "Inter_700Bold",
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  juggleWorthKnowingText: { fontSize: 15, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 22 },

  // legacy aliases kept for other sheets
  juggleSortAgain: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Repeat note
  repeatNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  repeatNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },

  // Pushed calendar event cards in THIS WEEK
  calPushedCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 12,
  },
  calPushedTimePill: {
    backgroundColor: TEAL_TINT, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  calPushedTimeText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEAL,
  },
  calPushedTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  calPushedSource: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  calPushedRemove: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT_MUTED },

  // Appointments weekly section
  apptSection: {
    marginTop: 12, backgroundColor: "#F5FBF9",
    borderRadius: 10, padding: 12, gap: 8,
  },
  apptSectionLabel: {
    fontSize: 10, fontFamily: "DMSans_700Bold", color: TEAL,
    letterSpacing: 0.8, marginBottom: 2,
  },
  apptItemRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  apptTimePill: {
    backgroundColor: TEAL + "18", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, minWidth: 52, alignItems: "center",
  },
  apptTimeText: {
    fontSize: 11, fontFamily: "DMSans_600SemiBold", color: TEAL,
  },
  apptTitle: { fontSize: 13, fontFamily: "DMSans_600SemiBold", color: TEXT, flex: 1 },
  apptDate: { fontSize: 11, fontFamily: "DMSans_400Regular", color: TEXT_MUTED },
  apptBadge: {
    backgroundColor: "#EEF2FF", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  apptBadgeText: {
    fontSize: 10, fontFamily: "DMSans_600SemiBold", color: "#6366F1",
  },

  // Carpool contact chips
  carpoolChipRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8,
  },
  carpoolChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff",
  },
  carpoolChipSelected: {
    borderColor: TEAL, backgroundColor: TEAL + "12",
  },
  carpoolChipText: {
    fontSize: 13, fontFamily: "DMSans_500Medium", color: TEXT,
  },
  carpoolChipTextSelected: { color: TEAL },
  carpoolChipAdd: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 20, borderStyle: "dashed",
    paddingHorizontal: 10, paddingVertical: 6,
  },
  carpoolChipAddText: {
    fontSize: 12, fontFamily: "DMSans_500Medium", color: TEAL,
  },
  carpoolAddForm: { marginTop: 8 },
  carpoolAddRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  carpoolAddBtn: {
    backgroundColor: TEAL, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 11, justifyContent: "center",
  },
  carpoolAddBtnText: {
    fontSize: 14, fontFamily: "DMSans_600SemiBold", color: "#fff",
  },

  // Week selector chips (This week / Next week)
  weekSelectorRow: { flexDirection: "row", gap: 8 },
  weekSelectorChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#F0EBE3", borderWidth: 1, borderColor: "#E0D9CF",
  },
  weekSelectorChipActive: {
    backgroundColor: TEAL_TINT, borderColor: TEAL + "50",
  },
  weekSelectorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  weekSelectorTextActive: { color: TEAL, fontFamily: "Inter_600SemiBold" },

  // "Add another event" persistent button
  addAnotherBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 13, marginTop: 12,
    ...Platform.select({
      web: { boxShadow: `0px 2px 10px ${TEAL}44` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
    }),
  },
  addAnotherBtnText: {
    fontSize: 14, fontFamily: "DMSans_600SemiBold", color: "#fff",
  },

  // FAB
  fab: {
    position: "absolute", right: 20,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: TEAL, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13,
    ...Platform.select({
      web: { boxShadow: `0px 4px 16px ${TEAL}55` },
      default: {
        shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
      },
    }),
  },
  fabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // "Sort this out" hero CTA bar
  sortCtaBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 16,
    gap: 8,
    ...Platform.select({
      web: { boxShadow: "0px -2px 12px rgba(0,0,0,0.07)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 8 },
    }),
  },
  sortCtaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: TEAL, borderRadius: 14, height: 54,
    ...Platform.select({
      web: { boxShadow: `0px 3px 12px ${TEAL}55` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
    }),
  },
  sortCtaBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.2 },
  // Softer variants — used when juggle not yet run, so sort hero card leads attention
  sortCtaBarSoft: { borderTopColor: BORDER, backgroundColor: "#fff" },
  sortCtaBtnSoft: {
    backgroundColor: "transparent", borderWidth: 1.5, borderColor: TEAL + "55",
    shadowOpacity: 0,
    ...Platform.select({ web: { boxShadow: "none" }, default: { elevation: 0 } }),
  },
  sortCtaAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8,
  },
  sortCtaAddBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },

  // Sticky bar — Sort the week (secondary, gold outline)
  sortCtaSortBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1.5, borderColor: GOLD + "66",
    backgroundColor: "#FFFDF9", borderRadius: 14, height: 46,
  },
  sortCtaSortBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: GOLD },

  // Sticky bar — Re-sort (low-emphasis text link row)
  sortCtaResortLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 4,
  },
  sortCtaResortLinkText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },

  // Sticky bar — new 2-button layout (See plan / Re-sort)
  sortCtaBarBtns: { flexDirection: "row", gap: 10 },
  stickySeePlanBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: GOLD, borderRadius: 14, height: 52,
    ...Platform.select({
      web: { boxShadow: `0px 3px 10px ${GOLD}55` },
      default: { shadowColor: GOLD, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    }),
  },
  stickySeePlanBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  stickyResortBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 14, height: 52,
    backgroundColor: "transparent",
  },
  stickyResortBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Travel hint row (between events in DaySection)
  travelHintRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: ORANGE + "0D", borderRadius: 8,
    marginVertical: 2,
  },
  travelHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: ORANGE, lineHeight: 16 },

  // Stale sort card (juggleResult exists but isSorted=false after event change)
  staleSortCard: {
    backgroundColor: "#FFFBF0", borderRadius: 16,
    borderWidth: 1, borderColor: GOLD + "55",
    paddingHorizontal: 18, paddingVertical: 18, gap: 10,
    ...Platform.select({
      web: { boxShadow: `0px 3px 16px ${GOLD}22` },
      default: { shadowColor: GOLD, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
    }),
  },
  staleSortTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  staleSortDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: GOLD, marginTop: 1,
  },
  staleSortTitle: { fontSize: 17, fontFamily: "DMSans_700Bold", color: TEXT, letterSpacing: -0.2 },
  staleSortSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 19 },
  staleSortBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GOLD, borderRadius: 13, height: 50,
    ...Platform.select({
      web: { boxShadow: `0px 3px 10px ${GOLD}55` },
      default: { shadowColor: GOLD, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    }),
  },
  staleSortBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  staleSortViewLink: { alignSelf: "flex-start", paddingVertical: 2 },
  staleSortViewLinkText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },

  // Need-help prompt card
  needHelpCard: {
    backgroundColor: ORANGE + "0F", borderRadius: 14,
    borderWidth: 1, borderColor: ORANGE + "33",
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  needHelpTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  needHelpTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  needHelpSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 17 },
  needHelpBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: "flex-start",
    borderWidth: 1, borderColor: TEAL + "44",
  },
  needHelpBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL },

  // Helpers section
  helperSection: {
    backgroundColor: TEAL_TINT, borderRadius: 14,
    borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  helperSectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  helperSectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: TEXT },
  helperSectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 17 },
  helperRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: TEAL + "18",
  },
  helperDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL },
  helperName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  helperContact: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  helperAddForm: { gap: 8 },
  helperInput: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT,
  },
  helperConfirmBtn: {
    backgroundColor: TEAL, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  helperConfirmBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  helperAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, alignSelf: "flex-start",
  },
  helperAddBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL },

  // Inline unsorted prompt strip (replaces big SortCard pre-sort)
  sortPromptStrip: {
    flexDirection: "column", gap: 8,
    backgroundColor: "#FFFDF9", borderRadius: 14,
    borderWidth: 1, borderColor: GOLD + "44",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  sortPromptInner: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  sortPromptText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 19 },

  // Setup ready strip
  setupStrip: {
    backgroundColor: TEAL_TINT, borderRadius: 12, borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  setupStripText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED, lineHeight: 18 },
  setupViewPlanBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: TEAL + "40",
  },
  setupViewPlanBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL },

  // Sort context card — pre-sort hero state
  sortCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 18, borderWidth: 1, borderColor: GOLD + "55",
    paddingHorizontal: 20, paddingVertical: 22,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: `0px 4px 20px rgba(0,0,0,0.10)` },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 5 },
    }),
  },
  sortCardTitle: { fontSize: 18, fontFamily: "DMSans_700Bold", color: TEXT, letterSpacing: -0.3 },
  sortCardSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 20 },
  sortCardError: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 2 },
  sortCardErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#C04040", flex: 1 },
  sortCardBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GOLD, borderRadius: 14, height: 52, marginTop: 4,
    ...Platform.select({
      web: { boxShadow: `0px 3px 12px ${GOLD}55` },
      default: { shadowColor: GOLD, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
    }),
  },
  sortCardBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.1 },

  // Sort context card — post-sort state
  sortCardSorted: {
    backgroundColor: TEAL_TINT, borderRadius: 16,
    borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 16, paddingVertical: 16, gap: 8,
    ...Platform.select({
      web: { boxShadow: `0px 2px 12px ${TEAL}1A` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    }),
  },
  sortCardSortedTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  sortCardSortedTick: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: TEAL, alignItems: "center", justifyContent: "center",
  },
  sortCardSortedTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: TEXT, flex: 1 },
  sortCardSortedDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  sortCardSortedBtns: { flexDirection: "row", gap: 8, marginTop: 2 },
  sortCardSeePlanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 11,
    ...Platform.select({
      web: { boxShadow: `0px 2px 8px ${TEAL}44` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
    }),
  },
  sortCardSeePlanBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  sortCardResortBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderColor: TEAL + "44",
  },
  sortCardResortBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL },

  // Form sheet
  formOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  formSheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: "92%",
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    flexDirection: "column",
    ...Platform.select({
      web: { boxShadow: "0px -6px 30px rgba(0,0,0,0.14)" },
      default: {
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14, shadowRadius: 20, elevation: 24,
      },
    }),
  },

  // Discard confirmation
  discardConfirm: {
    backgroundColor: "#FFF8F0", borderRadius: 10, borderWidth: 1, borderColor: GOLD + "40",
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4, gap: 8,
  },
  discardConfirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  discardConfirmBtns: { flexDirection: "row", gap: 16 },
  discardConfirmYes: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C0392B" },
  discardConfirmNo: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL },

  // Sticky save footer
  sheetFooter: {
    paddingHorizontal: 0, paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#F0EDEA",
  },
  saveButton: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 16, alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#B8D8D6", opacity: 0.7 },
  saveButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  validationHint: { textAlign: "center", color: TEXT_MUTED, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 14 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: TEXT },

  // Form fields
  formField: { gap: 7 },
  formRow: { flexDirection: "row", gap: 12 },
  formLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED,
    textTransform: "uppercase", letterSpacing: 0.7,
  },
  formInput: {
    backgroundColor: "#F7F3EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, borderWidth: 1, borderColor: BORDER,
  },
  formTextArea: { minHeight: 76 },
  formTimeField: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F7F3EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: BORDER, minHeight: 46,
  },
  formTimeFieldText: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT },
  formTimeFieldPlaceholder: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#bbb" },
  formHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 16, marginTop: 2 },

  // Time picker sheet
  tpOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  tpSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "65%", paddingBottom: 24,
  },
  tpHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  tpTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT },
  tpDoneBtn: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEAL },
  tpGrid: {
    flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 0,
  },
  tpCell: {
    width: "25%", minHeight: 44, alignItems: "center", justifyContent: "center",
    padding: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "#EDE9E3",
    backgroundColor: "#fff", margin: 2,
  },
  tpCellSel: { backgroundColor: TEAL, borderColor: TEAL },
  tpCellSugg: { backgroundColor: GOLD + "20", borderColor: GOLD + "55" },
  tpCellText: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT },
  tpCellTextSel: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  dayChipSelected: { backgroundColor: TEAL, borderColor: TEAL },
  dayChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  dayChipTextSelected: { color: "#fff" },
  driverChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  driverChipNone: { backgroundColor: "#F0F0F0", borderColor: "#E0E0E0" },
  driverChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  driverChipTextNone: { color: TEXT },
  repeatChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  repeatChipSelected: { backgroundColor: TEAL_TINT, borderColor: TEAL },
  repeatChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  repeatChipTextSelected: { color: TEAL },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FCA5A5", padding: 12, gap: 4 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#B91C1C" },
  saveBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Juggle results modal
  // Results page — hero dashboard
  resultDashboard: {
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  resultDashboardBar: {
    height: 4,
    width: "100%",
  },
  resultDashboardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    gap: 8,
  },
  resultDashboardHeadline: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    color: TEXT,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  resultDashboardSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    lineHeight: 20,
  },
  resultDashboardChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  resultChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Results page — action row
  resultActionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultShareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 14,
    ...Platform.select({
      web: { boxShadow: `0px 2px 10px ${TEAL}44` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    }),
  },
  resultShareBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  resultSortAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: TEAL + "44",
  },
  resultSortAgainBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Results — add activity button
  resultAddActivityBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: TEAL + "55",
    borderStyle: "dashed" as const,
  },
  resultAddActivityBtnText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: TEAL,
  },

  // Results nav bar
  resultsNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 70,
  },
  resultsHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0EDEA",
    backgroundColor: "#fff",
  },
  resultsBack: { color: TEAL, fontSize: 14, fontFamily: "Inter_500Medium" },
  resultsTitle: {
    color: TEXT, fontSize: 15, fontFamily: "DMSans_700Bold", letterSpacing: -0.2,
    flex: 1, textAlign: "center",
  },
  resultsRetry: { color: TEXT_MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  resultsCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 4,
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(0,0,0,0.07)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
    }),
  },
  resultsCardLabel: {
    color: PLUM, fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 4,
  },
  resultsCardSub: { color: TEXT_MUTED, fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 },
  tableRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "#F0EDEA",
  },
  timePill: {
    borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8, marginRight: 10,
    minWidth: 100, alignItems: "center",
  },
  timePillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  tableWho: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 2 },
  tableWhere: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 17 },
  conflictCard: { borderLeftWidth: 3, borderLeftColor: "#B86557" },
  conflictLabel: {
    color: "#B86557", fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 12,
  },
  conflictRow: { marginBottom: 10 },
  conflictText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  worthKnowingCard: { borderLeftWidth: 3, borderLeftColor: PLUM, backgroundColor: "#F3E8EE" },
  worthKnowingLabel: {
    color: PLUM, fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 8,
  },
  worthKnowingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 21 },
  shareButton: {
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8, marginBottom: 4,
  },
  shareButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  differentWeekend: { alignItems: "center", paddingVertical: 16, marginBottom: 32 },
  differentWeekendText: { color: TEXT_MUTED, fontSize: 14, fontFamily: "Inter_400Regular" },
});

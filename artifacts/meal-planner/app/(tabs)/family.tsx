import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
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
  DayOfWeek,
  FamilyEvent,
  FamilyMember,
  FamilyState,
  MEMBER_COLORS,
  RepeatType,
} from "@/utils/familyTypes";
import { loadFamilyState, saveFamilyState } from "@/utils/familyStore";
import { buildJugglePrompt } from "@/utils/buildJugglePrompt";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SortiiCalEvent, FAMILY_PUSHED_KEY } from "@/utils/calendarTypes";
import { loadFamilyPushedEvents, removeEventFromFamily } from "@/utils/appointmentService";

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

const JUGGLE_RESULT_KEY = "@sortii_juggle_result_v1";
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

const BUSYNESS_CONFIG: Record<BusynessLevel, { label: string; color: string }> = {
  clear:  { label: "Clear week",  color: TEXT_MUTED },
  quiet:  { label: "Quiet week",  color: TEAL },
  steady: { label: "Steady week", color: GOLD },
  busy:   { label: "Busy week",   color: ORANGE },
};

// ── Blank event draft ──────────────────────────────────────────────────────────
function blankDraft(): Omit<FamilyEvent, "id"> {
  return {
    title: "", day: "Monday", time: "", endTime: "", location: "",
    personIds: [], driverId: undefined, carpoolContact: "", repeat: "none", notes: "",
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
  onClose,
  onSortAgain,
  onShare,
  onSwapApplied,
}: {
  juggleResult: JuggleResult;
  members: FamilyMember[];
  onClose: () => void;
  onSortAgain: () => void;
  onShare: (text: string) => void;
  onSwapApplied?: (event_id: string, adult: string) => void;
}) {
  const ws            = juggleResult.weekend_summary ?? { total_events: 0, conflicts_resolved: 0, tight_windows: 0, impossible_clashes: 0 };
  const adultPlans    = juggleResult.adult_plans ?? [];
  const conflicts     = juggleResult.conflicts ?? [];
  const allAdultNames = adultPlans.map((p) => p.adult);

  const [swapAssignments, setSwapAssignments] = useState<Record<string, string>>(
    juggleResult.swapOverrides ?? {}
  );
  const [swappingEventId, setSwappingEventId] = useState<string | null>(null);
  const [swappedFlash, setSwappedFlash]       = useState<string | null>(null);

  const planRows = adultPlans.flatMap((p) =>
    p.schedule.map((s) => ({
      time:     s.time,
      adult:    swapAssignments[s.event_id] ?? p.adult,
      child:    s.child,
      activity: s.activity,
      location: s.location,
      event_id: s.event_id,
    }))
  ).sort((a, b) => a.time.localeCompare(b.time));

  function handleSwap(event_id: string) {
    if (allAdultNames.length === 2) {
      const cur   = planRows.find((r) => r.event_id === event_id)?.adult ?? allAdultNames[0];
      const other = allAdultNames.find((a) => a !== cur) ?? allAdultNames[0]!;
      setSwapAssignments((prev) => ({ ...prev, [event_id]: other }));
      onSwapApplied?.(event_id, other);
      setSwappedFlash(event_id);
      setTimeout(() => setSwappedFlash(null), 2000);
    } else {
      setSwappingEventId(swappingEventId === event_id ? null : event_id);
    }
  }

  function pickAdult(event_id: string, adult: string) {
    setSwapAssignments((prev) => ({ ...prev, [event_id]: adult }));
    onSwapApplied?.(event_id, adult);
    setSwappingEventId(null);
    setSwappedFlash(event_id);
    setTimeout(() => setSwappedFlash(null), 2000);
  }

  const impossible = ws.impossible_clashes ?? 0;
  const tight      = ws.tight_windows ?? 0;

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

  // Dashboard headline + summary line
  const dashHeadline = impossible > 0
    ? "Almost there."
    : tight > 0
    ? "Sorted. Here's what the week looks like."
    : "Sorted. Here's what the week looks like.";

  const dashSummaryLine = (() => {
    const parts: string[] = [];
    if (ws.total_events > 0) parts.push(`${ws.total_events} ${ws.total_events === 1 ? "event" : "events"}`);
    if (impossible > 0)       parts.push(`${impossible} ${impossible === 1 ? "clash" : "clashes"} to sort`);
    else if (tight > 0)       parts.push(`${tight} tight spot${tight > 1 ? "s" : ""}, manageable`);
    else                      parts.push("nothing clashing");
    if (ws.conflicts_resolved > 0 && impossible === 0) parts.push(`${ws.conflicts_resolved} sorted ✓`);
    return parts.join("  ·  ");
  })();

  // Chip colour config
  const dashBg = impossible > 0 ? "#FDF2F0" : tight > 0 ? "#FFFBF0" : "#EDFAF6";
  const dashAccent = impossible > 0 ? "#C0695A" : tight > 0 ? GOLD : TEAL;

  return (
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
              <View style={[styles.resultChip, { backgroundColor: GOLD + "18", borderColor: GOLD + "33" }]}>
                <Text style={[styles.resultChipText, { color: "#A07010" }]}>
                  {tight} tight {tight === 1 ? "spot" : "spots"}
                </Text>
              </View>
            )}
            {ws.conflicts_resolved > 0 && impossible === 0 && (
              <View style={[styles.resultChip, { backgroundColor: TEAL + "18", borderColor: TEAL + "33" }]}>
                <Text style={[styles.resultChipText, { color: TEAL }]}>
                  {ws.conflicts_resolved} sorted ✓
                </Text>
              </View>
            )}
            {impossible === 0 && tight === 0 && (
              <View style={[styles.resultChip, { backgroundColor: TEAL + "18", borderColor: TEAL + "33" }]}>
                <Text style={[styles.resultChipText, { color: TEAL }]}>all clear ✓</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16, paddingTop: 18 }}>

      {/* ── 2. THE PLAN table ── */}
      {planRows.length > 0 && (
        <View style={styles.jugglePlanCard}>
          <View style={{ gap: 2 }}>
            <Text style={styles.juggleSectionLabel}>THE PLAN</Text>
            <Text style={styles.jugglePlanSub}>What's happening</Text>
          </View>
          <View style={[styles.jugglePlanRowHeader]}>
            <Text style={[styles.jugglePlanCellTime, styles.jugglePlanHeaderText]}>TIME</Text>
            <Text style={[styles.jugglePlanCellWho, styles.jugglePlanHeaderText]}>WHO</Text>
            <Text style={[styles.jugglePlanCellWhere, styles.jugglePlanHeaderText]}>WHERE</Text>
          </View>
          {planRows.map((row, i) => (
            <View key={i}>
              <View style={[styles.jugglePlanDataRow, { backgroundColor: i % 2 === 0 ? "#fff" : "#FAFAF8" }]}>
                <View style={styles.jugglePlanCellTime}>
                  <View style={styles.juggleTimePill}>
                    <Text style={styles.juggleTimePillText}>{row.time}</Text>
                  </View>
                </View>
                <View style={[styles.jugglePlanCellWho, { gap: 4 }]}>
                  <Text style={styles.jugglePlanWhoText}>
                    {row.adult}{row.child ? ` · ${row.child}` : ""}
                  </Text>
                  {swappedFlash === row.event_id ? (
                    <View style={styles.juggleSwappedPill}>
                      <Text style={styles.juggleSwappedPillText}>Swapped ✓</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.juggleSwapPill} onPress={() => handleSwap(row.event_id)} activeOpacity={0.75}>
                      <Text style={styles.juggleSwapPillText}>⇄ Swap</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.jugglePlanCellWhere}>
                  <Text style={styles.jugglePlanWhereText} numberOfLines={2}>
                    {[row.location, row.activity].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
              {swappingEventId === row.event_id && allAdultNames.length >= 3 && (
                <View style={styles.jugglePickerRow}>
                  <Text style={styles.jugglePickerLabel}>Swap to:</Text>
                  {allAdultNames.filter((a) => a !== row.adult).map((a) => (
                    <TouchableOpacity key={a} style={styles.jugglePickerPill} onPress={() => pickAdult(row.event_id, a)} activeOpacity={0.8}>
                      <Text style={styles.jugglePickerPillText}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── 3. WHO'S DOING THE RUNNING ── */}
      {adultPlans.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={styles.juggleSectionLabel}>WHO'S GOT WHAT</Text>
          {adultPlans.map((plan) => {
            const member = members.find((m) => m.name === plan.adult);
            return (
              <View key={plan.adult} style={styles.juggleAdultCard}>
                <View style={styles.juggleAdultCardHeader}>
                  <View style={[styles.juggleAdultDot, { backgroundColor: member?.color ?? TEAL }]} />
                  <Text style={styles.juggleAdultName}>{plan.adult}</Text>
                </View>
                {plan.schedule.map((s, i) => (
                  <View key={i} style={styles.juggleScheduleRow}>
                    <View style={styles.juggleTimePill}>
                      <Text style={styles.juggleTimePillText}>{s.time}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={styles.juggleScheduleActivity}>{s.activity}</Text>
                      {s.child ? <Text style={styles.juggleScheduleChild}>with {s.child}</Text> : null}
                      {s.location ? <Text style={styles.juggleScheduleLocation}>{s.location}</Text> : null}
                    </View>
                  </View>
                ))}
                {(() => {
                  const insight = buildFreeWindowInsight(plan);
                  return insight ? (
                    <Text style={styles.juggleFreeWindow}>{insight}</Text>
                  ) : null;
                })()}
                <TouchableOpacity
                  style={styles.juggleAdultSendBtn}
                  onPress={() => {
                    const lines = [`Hi ${plan.adult} — here's your bit:`, ""];
                    plan.schedule.forEach((s) =>
                      lines.push(`${s.time}  ${s.activity}${s.child ? ` with ${s.child}` : ""}${s.location ? ` · ${s.location}` : ""}`)
                    );
                    lines.push("", "— Sent from Sortii.");
                    onShare(lines.join("\n"));
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.juggleAdultSendBtnText}>{plan.adult}'s list →</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── 4. Tight spot / conflicts ── */}
      {conflicts.length > 0 && (
        <View style={styles.juggleConflictCard}>
          <Text style={styles.juggleConflictLabel}>
            {conflicts.length === 1 ? "HEADS UP" : "HEADS UP"}
          </Text>
          {conflicts.map((c, i) => (
            <View key={i} style={i > 0 ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3E0DC" } : undefined}>
              <Text style={styles.juggleConflictDesc}>⚠ {c.description}</Text>
              {c.recommendation ? <Text style={styles.juggleConflictRec}>{c.recommendation}</Text> : null}
              {c.options.map((o, j) => (
                <Text key={j} style={styles.juggleConflictOption}>· {o}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ── 5. Worth knowing ── */}
      {juggleResult.smart_note ? (
        <View style={styles.juggleWorthKnowingCard}>
          <Text style={styles.juggleWorthKnowingLabel}>✦ WORTH KNOWING</Text>
          <Text style={styles.juggleWorthKnowingText}>{juggleResult.smart_note}</Text>
        </View>
      ) : null}

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
  );
}

// ── SavedBanner ────────────────────────────────────────────────────────────────
type BannerType = "first" | "subsequent" | "edited";

function SavedBanner({
  type,
  eventTitle,
  onReview,
  onAddAnother,
  onDismiss,
}: {
  type: BannerType;
  eventTitle: string;
  onReview: () => void;
  onAddAnother: () => void;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY,  { toValue: 0, tension: 90, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const headline =
    type === "first"      ? "Saved. One thing down."
    : type === "edited"   ? "Updated."
    : "Saved. Plan updated.";

  const reviewLabel =
    type === "first" ? "Review week" : "Review full plan";

  const subline =
    type === "first"
      ? "Want us to map the week?"
      : type === "edited"
      ? "The plan reflects your change."
      : "We've sorted the week around it.";

  return (
    <Animated.View style={[styles.savedBanner, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.savedBannerLeft}>
        <View style={styles.savedBannerDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.savedBannerHeadline}>{headline}</Text>
          <Text style={styles.savedBannerSub}>{subline}</Text>
        </View>
      </View>
      <View style={styles.savedBannerActions}>
        {type !== "edited" && (
          <TouchableOpacity style={styles.bannerReviewBtn} onPress={onReview} activeOpacity={0.85}>
            <Text style={styles.bannerReviewBtnText}>{reviewLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.bannerAddBtn} onPress={onAddAnother} activeOpacity={0.85}>
          <Feather name="plus" size={13} color={TEAL} />
          <Text style={styles.bannerAddBtnText}>Add another</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={14} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>
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
  const [expanded, setExpanded] = useState(false);
  const driverDisplay = aiDriver ?? (event.driverId ? members.find((m) => m.id === event.driverId)?.name : null);
  const involved = event.personIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as FamilyMember[];
  const timeLabel = formatTime(event.time);
  const endLabel  = event.endTime ? `–${formatTime(event.endTime)}` : "";

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
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
      </View>

      {expanded && (
        <View style={styles.eventActions}>
          {event.carpoolContact ? (
            <Text style={styles.carpoolText}>Carpool: {event.carpoolContact}</Text>
          ) : null}
          {event.notes ? (
            <Text style={styles.eventNotes}>{event.notes}</Text>
          ) : null}
          <View style={styles.eventActionBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.8}>
              <Feather name="edit-2" size={13} color={TEAL} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
              <Feather name="trash-2" size={13} color="#C0392B" />
              <Text style={styles.deleteBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
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
function AddEventSheet({
  visible,
  members,
  initialDraft,
  onClose,
  onSave,
}: {
  visible: boolean;
  members: FamilyMember[];
  initialDraft?: Partial<FamilyEvent> | null;
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

  // Derived: is the form valid enough to save?
  const isFormValid = draft.title.trim().length > 0 && draft.time.trim().length > 0;

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
    setDraft((d) => ({
      ...d,
      personIds: d.personIds.includes(id)
        ? d.personIds.filter((x) => x !== id)
        : [...d.personIds, id],
    }));
  }

  function handleSave() {
    const errs: string[] = [];
    if (!draft.title.trim()) errs.push("Add a title for this event.");
    if (!draft.time.trim())  errs.push("Tap the Start time field to pick a time.");
    if (errs.length) { setErrors(errs); return; }

    const parsedTime = parseTime(draft.time) || draft.time;
    const parsedEnd  = draft.endTime?.trim() ? (parseTime(draft.endTime) || draft.endTime) : undefined;
    onSave({
      ...draft,
      title: draft.title.trim(),
      time: parsedTime,
      endTime: parsedEnd || undefined,
      location: draft.location?.trim() || undefined,
      carpoolContact: draft.carpoolContact?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      driverId: undefined,
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

            {/* Day */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Which day?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ALL_DAYS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, draft.day === d && styles.dayChipSelected]}
                      onPress={() => setField("day", d)}
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
                  onPress={() => { setTimePickerFor("start"); setTimePickerVisible(true); }}
                  activeOpacity={0.75}
                >
                  <Text style={draft.time ? styles.formTimeFieldText : styles.formTimeFieldPlaceholder}>
                    {draft.time ? labelForTime(draft.time) : "Start time"}
                  </Text>
                  <Feather name="clock" size={14} color={TEXT_MUTED} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formTimeField, { flex: 1 }]}
                  onPress={() => { setTimePickerFor("end"); setTimePickerVisible(true); }}
                  activeOpacity={0.75}
                >
                  <Text style={draft.endTime ? styles.formTimeFieldText : styles.formTimeFieldPlaceholder}>
                    {draft.endTime ? labelForTime(draft.endTime) : "End time (opt.)"}
                  </Text>
                  <Feather name="clock" size={14} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Location (optional)</Text>
              <TextInput
                style={styles.formInput}
                value={draft.location ?? ""}
                onChangeText={(v) => setField("location", v)}
                placeholder="e.g. Memorial Park, Highbury Fields"
                placeholderTextColor="#bbb"
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

            {/* Backup contact — always shown; driver assigned by AI */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Backup contact (optional)</Text>
              <TextInput
                style={styles.formInput}
                value={draft.carpoolContact ?? ""}
                onChangeText={(v) => setField("carpoolContact", v)}
                placeholder="e.g. Sarah — 0412 345 678"
                placeholderTextColor="#bbb"
              />
              <Text style={styles.formHint}>
                Someone who could help if needed. They'll appear in conflict suggestions.
              </Text>
            </View>

            {/* Repeat */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Does this repeat?</Text>
              <View style={styles.chipGroup}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.repeatChip, draft.repeat === r && styles.repeatChipSelected]}
                    onPress={() => setField("repeat", r)}
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

            {/* Notes */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={draft.notes ?? ""}
                onChangeText={(v) => setField("notes", v)}
                placeholder="Anything else worth knowing…"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
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
            <Text style={styles.validationHint}>Just need a name, day and time.</Text>
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

  const load = useCallback(async () => {
    const [s, savedJuggle, savedHelpers] = await Promise.all([
      loadFamilyState(),
      AsyncStorage.getItem(JUGGLE_RESULT_KEY),
      AsyncStorage.getItem(HELPERS_KEY),
    ]);
    setState(s);
    setResult(computeFamilyWeek(s));
    if (savedJuggle) {
      try { setJuggleResult(JSON.parse(savedJuggle)); setIsSorted(true); } catch {}
    }
    if (savedHelpers) {
      try { setHelpers(JSON.parse(savedHelpers)); } catch {}
    }
    try {
      const pushed = await loadFamilyPushedEvents();
      setPushedCalEvents(pushed);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

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
    bannerTimer.current = setTimeout(() => setSavedBanner(null), 6000);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);
  }

  function dismissBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setSavedBanner(null);
  }

  async function handleSaveEvent(draft: Omit<FamilyEvent, "id">) {
    const wasEditing  = !!editingEvent;
    const prevCount   = state.events.length;
    const next: FamilyState = editingEvent
      ? {
          ...state,
          events: state.events.map((e) =>
            e.id === editingEvent.id ? { ...draft, id: editingEvent.id } : e
          ),
        }
      : { ...state, events: [...state.events, { ...draft, id: Date.now().toString() }] };
    setShowForm(false);
    setEditingEvent(null);
    await persistState(next);
    setIsSorted(false);
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
    await AsyncStorage.setItem(JUGGLE_RESULT_KEY, JSON.stringify(updated));
  }

  async function handleSortJuggle() {
    const adults = state.members.filter((m) => m.role === "adult");
    if (adults.length === 0 || (state.events.length === 0 && pushedCalEvents.length === 0)) return;

    console.log("[Sortii] Sort triggered — adults:", adults.length, "events:", state.events.length, "cal:", pushedCalEvents.length);
    setSortError(null);
    setFamilyStep("sorting");
    dismissBanner();

    try {
      // Build prompt using actual field names from FamilyEvent
      const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const adultsStr = adults.map((a) => `${a.name}, can drive: yes`).join("\n");
      const eventsStr = state.events.map((e) => {
        const involved = e.personIds
          .map((id) => state.members.find((m) => m.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        return [
          `EventID: ${e.id}`,
          `Activity: ${e.title}`,
          `Day: ${e.day}`,
          `Start: ${formatTime(e.time) || "not specified"}`,
          `End: ${e.endTime ? formatTime(e.endTime) : "not specified"}`,
          `Location: ${e.location || "not specified"}`,
          `Who's going: ${involved || "unspecified"}`,
          `Assigned adult: unassigned`,
        ].join("\n");
      }).join("\n---\n");

      // Include pushed calendar events
      const calStr = pushedCalEvents.map((e) => {
        const day = DAY_NAMES[new Date(e.startTime).getDay()] ?? "Monday";
        const startT = e.isAllDay ? "All day" : new Date(e.startTime).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
        const endT = e.endTime && !e.isAllDay ? new Date(e.endTime).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "not specified";
        return [
          `EventID: ${e.id}`,
          `Activity: ${e.title}`,
          `Day: ${day}`,
          `Start: ${startT}`,
          `End: ${endT}`,
          `Location: ${e.location || "not specified"}`,
          `Who's going: unspecified`,
          `Assigned adult: unassigned`,
          `Source: ${e.calendarName || e.source} calendar`,
        ].join("\n");
      }).join("\n---\n");

      const fullEventsStr = [eventsStr, calStr].filter(Boolean).join("\n---\n");
      const prompt = `Available adults:\n${adultsStr}\n\nEvents this week:\n${fullEventsStr}\n\nPlease solve this schedule.`;

      console.log("[Sortii] Loading state entered — calling API");
      // Web: use root-relative URL (proxied at /api). Native: localhost directly.
      const apiBase = Platform.OS === "web" ? "" : "http://localhost:8080";
      const res = await fetch(`${apiBase}/api/juggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as { result: Omit<JuggleResult, "solvedAt"> };
      const resultData = data.result ?? (data as unknown as Omit<JuggleResult, "solvedAt">);
      const full: JuggleResult = { ...resultData, solvedAt: Date.now() };

      console.log("[Sortii] Sort completed — results payload created, events in result:", full.events?.length);
      await AsyncStorage.setItem(JUGGLE_RESULT_KEY, JSON.stringify(full));
      setJuggleResult(full);
      setIsSorted(true);
      setFamilyStep("results");
      console.log("[Sortii] Results screen activated");
    } catch (err) {
      console.error("[Sortii] Sort error:", err);
      setFamilyStep("input");
      setSortError("Couldn't sort right now. Check your connection and try again.");
    }
  }

  async function handleShareJuggle(text: string) {
    try { await Share.share({ message: text }); } catch {}
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
          onClose={() => setFamilyStep("input")}
          onSortAgain={() => handleSortJuggle()}
          onShare={handleShareJuggle}
          onSwapApplied={handleSwapApplied}
        />
      </SafeAreaView>
    );
  }

  const hasEvents          = state.events.length > 0 || pushedCalEvents.length > 0;
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
                ? "What's on this week? We'll untangle the rest."
                : hasMembers
                ? "Add events as they come up. Sortii will sort the rest."
                : "Your family's week, in one place."}
            </Text>
          </View>
        </View>

        {/* ── Post-save confirmation banner ── */}
        {savedBanner && (
          <SavedBanner
            type={savedBanner.type}
            eventTitle={savedBanner.title}
            onReview={openPlanSummary}
            onAddAnother={() => { dismissBanner(); openAddEvent(); }}
            onDismiss={dismissBanner}
          />
        )}

        {/* ── Family members — always at top ── */}
        <ManagePeopleSection
          members={state.members}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />

        {/* ── Events or empty states ── */}
        {hasEvents ? (
          <>
            {/* Day-by-day events — clean list, no plan outputs pre-sort */}
            <View style={styles.weekSection}>
              <Text style={styles.sectionLabel}>THIS WEEK</Text>
              {daysWithEvents.map((day) => (
                <DaySection
                  key={day}
                  day={day}
                  events={result?.eventsByDay[day] ?? []}
                  members={state.members}
                  onEditEvent={openEditEvent}
                  onDeleteEvent={handleDeleteEvent}
                  juggleDriverMap={juggleDriverMap}
                />
              ))}
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
  pageTitle: { fontSize: 28, fontFamily: "Manrope_700Bold", color: TEXT, letterSpacing: -0.5 },
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
  daySectionEvents: { gap: 6, marginBottom: 12 },

  // Event card
  eventCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  eventCardMain: { flexDirection: "row", gap: 10, padding: 11 },
  eventTimePill: {
    backgroundColor: TEAL_TINT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: "flex-start", flexShrink: 0, flexDirection: "row", alignItems: "center",
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
    fontSize: 20, fontFamily: "Manrope_700Bold", color: TEXT,
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

  // Juggle results — adult card (WHO'S DOING THE RUNNING)
  juggleAdultCard: {
    backgroundColor: "#F2FAF8", borderRadius: 14,
    borderWidth: 1, borderColor: TEAL + "28",
    borderLeftWidth: 3, borderLeftColor: TEAL + "66",
    padding: 14, gap: 10,
  },
  juggleAdultCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  juggleAdultDot: { width: 10, height: 10, borderRadius: 5 },
  juggleAdultName: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT },
  juggleScheduleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  juggleTimePill: {
    backgroundColor: "#2B2B2B", borderRadius: 20,
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
    paddingHorizontal: 20, paddingTop: 14,
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
  staleSortTitle: { fontSize: 17, fontFamily: "Manrope_700Bold", color: TEXT, letterSpacing: -0.2 },
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
  sortCardTitle: { fontSize: 18, fontFamily: "Manrope_700Bold", color: TEXT, letterSpacing: -0.3 },
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
    fontFamily: "Manrope_700Bold",
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
    color: TEXT, fontSize: 15, fontFamily: "Manrope_700Bold", letterSpacing: -0.2,
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

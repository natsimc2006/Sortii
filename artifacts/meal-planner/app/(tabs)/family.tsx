import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

// ── Juggle AI result types ─────────────────────────────────────────────────────
export interface JugglePlanItem {
  adult: string;
  day: string;
  duty: string;
}
export interface JuggleConflict {
  type: "overlap" | "impossible" | "tight";
  description: string;
}
export interface JuggleResult {
  status: "sorted" | "tight" | "needs_attention";
  summary: string;
  smart_note: string | null;
  plan: JugglePlanItem[];
  conflicts: JuggleConflict[];
  adult_lists: Record<string, string>;
  unassigned_events: string[];
  solvedAt: number;
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
          <Feather name="alert-circle" size={12} color={TEXT_MUTED} />
          <Text style={styles.unassignedNoteText}>
            {summary.unassignedCount} {summary.unassignedCount === 1 ? "event" : "events"} with no driver assigned yet.
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

// ── JuggleResultSheet ─────────────────────────────────────────────────────────
function JuggleResultSheet({
  visible,
  juggle,
  members,
  onClose,
  onSortAgain,
  onShare,
}: {
  visible: boolean;
  juggle: JuggleResult | null;
  members: FamilyMember[];
  onClose: () => void;
  onSortAgain: () => void;
  onShare: (text: string) => void;
}) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(900)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }),
        Animated.timing(overlayOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 900, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !juggle) return null;

  const statusColor =
    juggle.status === "sorted"          ? TEAL
    : juggle.status === "tight"         ? GOLD
    : "#C0392B";
  const statusLabel =
    juggle.status === "sorted"          ? "Weekend sorted"
    : juggle.status === "tight"         ? "Tight but workable"
    : "Some things to sort";
  const statusIcon =
    juggle.status === "sorted"          ? "check-circle"
    : juggle.status === "tight"         ? "clock"
    : "alert-triangle";

  function buildShareText(): string {
    const lines = ["📋 Family juggle — sorted.", ""];
    lines.push(juggle.summary);
    if (juggle.smart_note) { lines.push(""); lines.push(`Worth knowing: ${juggle.smart_note}`); }
    if (Object.keys(juggle.adult_lists).length > 0) {
      lines.push(""); lines.push("Who's covering what:");
      for (const [name, duties] of Object.entries(juggle.adult_lists)) {
        lines.push(`\n${name}:`); lines.push(duties);
      }
    }
    if (juggle.conflicts.length > 0) {
      lines.push(""); lines.push("Needs attention:");
      juggle.conflicts.forEach((c) => lines.push(`• ${c.description}`));
    }
    lines.push(""); lines.push("— Sent from Sortii.");
    return lines.join("\n");
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOp }]}>
        <Pressable style={styles.formOverlay} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.formSheet,
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16, maxHeight: "94%" },
        ]}
      >
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.sheetTitleRow}>
          <View>
            <Text style={styles.sheetTitle}>Weekend plan</Text>
            <Text style={styles.sheetSubTitle}>AI-sorted · just now</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <TouchableOpacity onPress={onSortAgain} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.juggleSortAgain}>Sort again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 12 }}>
          {/* Status pill */}
          <View style={[styles.juggleStatusPill, { backgroundColor: statusColor + "14", borderColor: statusColor + "40" }]}>
            <Feather name={statusIcon as any} size={14} color={statusColor} />
            <Text style={[styles.juggleStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          {/* Summary */}
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryBlockLabel}>THE SUMMARY</Text>
            <Text style={styles.juggleSummaryText}>{juggle.summary}</Text>
            {juggle.smart_note && (
              <View style={styles.juggleSmartNote}>
                <Feather name="zap" size={12} color={GOLD} />
                <Text style={styles.juggleSmartNoteText}>{juggle.smart_note}</Text>
              </View>
            )}
          </View>

          {/* Plan — who does what */}
          {juggle.plan.length > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryBlockLabel}>THE PLAN</Text>
              {juggle.plan.map((item, i) => {
                const member = members.find((m) => m.name === item.adult);
                const dotColor = member?.color ?? TEAL;
                return (
                  <View key={i} style={styles.jugglePlanRow}>
                    <View style={[styles.planSplitDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jugglePlanAdult}>{item.adult} — <Text style={{ fontFamily: "Inter_400Regular" }}>{item.day}</Text></Text>
                      <Text style={styles.jugglePlanDuty}>{item.duty}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Conflicts */}
          {juggle.conflicts.length > 0 && (
            <View style={[styles.summaryInsightBlock, { borderLeftColor: "#C0392B" }]}>
              <Text style={styles.summaryBlockLabel}>NEEDS SORTING</Text>
              {juggle.conflicts.map((c, i) => {
                const conflictIcon =
                  c.type === "impossible" ? "alert-triangle"
                  : c.type === "tight"    ? "clock"
                  : "alert-circle";
                const conflictColor =
                  c.type === "impossible" ? "#C0392B"
                  : c.type === "tight"    ? GOLD
                  : ORANGE;
                return (
                  <View key={i} style={styles.summaryInsightRow}>
                    <Feather name={conflictIcon as any} size={13} color={conflictColor} />
                    <Text style={styles.summaryInsightText}>{c.description}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Worth knowing */}
          {juggle.smart_note && juggle.conflicts.length === 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryBlockLabel}>WORTH KNOWING</Text>
              <View style={styles.summaryInsightRow}>
                <Feather name="check-circle" size={13} color={TEAL} />
                <Text style={styles.summaryInsightText}>{juggle.smart_note}</Text>
              </View>
            </View>
          )}

          {/* Per-adult action lists */}
          {Object.keys(juggle.adult_lists).length > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryBlockLabel}>SEND EACH PERSON</Text>
              {Object.entries(juggle.adult_lists).map(([name, duties]) => {
                const member = members.find((m) => m.name === name);
                const dotColor = member?.color ?? TEAL;
                function shareAdult() {
                  onShare(`Hi ${name} — here's what you're covering this week:\n\n${duties}\n\n— Sent from Sortii.`);
                }
                return (
                  <TouchableOpacity key={name} style={styles.juggleAdultRow} onPress={shareAdult} activeOpacity={0.8}>
                    <View style={[styles.planSplitDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jugglePlanAdult}>{name}'s list</Text>
                      <Text style={styles.jugglePlanDuty} numberOfLines={2}>{duties}</Text>
                    </View>
                    <Feather name="send" size={14} color={TEAL} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Unassigned */}
          {juggle.unassigned_events.length > 0 && (
            <View style={styles.summaryUnassignedNote}>
              <Feather name="alert-circle" size={13} color={TEXT_MUTED} />
              <Text style={styles.summaryUnassignedText}>
                Unassigned: {juggle.unassigned_events.join(", ")} — tap the event to assign a driver.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Actions */}
        <View style={styles.summaryActions}>
          <TouchableOpacity style={styles.summaryShareBtn} onPress={() => onShare(buildShareText())} activeOpacity={0.85}>
            <Feather name="send" size={14} color="#fff" />
            <Text style={styles.summaryShareBtnText}>Share full plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryAddBtn} onPress={onSortAgain} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={14} color={TEAL} />
            <Text style={styles.summaryAddBtnText}>Sort again</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
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
  event, members, onEdit, onDelete,
}: {
  event: FamilyEvent;
  members: FamilyMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const driver   = event.driverId ? members.find((m) => m.id === event.driverId) : null;
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
            {driver ? (
              <View style={styles.eventMetaItem}>
                <Feather name="navigation" size={11} color={TEAL} />
                <Text style={[styles.eventMetaText, { color: TEAL }]}>{driver.name}</Text>
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
  day, events, members, onEditEvent, onDeleteEvent,
}: {
  day: DayOfWeek;
  events: FamilyEvent[];
  members: FamilyMember[];
  onEditEvent: (e: FamilyEvent) => void;
  onDeleteEvent: (id: string) => void;
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
        {events.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            members={members}
            onEdit={() => onEditEvent(ev)}
            onDelete={() => onDeleteEvent(ev.id)}
          />
        ))}
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

  // Derived: is the form valid enough to save?
  const isFormValid = draft.title.trim().length > 0 && draft.time.trim().length > 0;

  // Derived: does the form have any data entered?
  const formHasData = draft.title.trim().length > 0
    || draft.time.trim().length > 0
    || (draft.location ?? "").trim().length > 0
    || (draft.notes ?? "").trim().length > 0
    || draft.personIds.length > 0
    || !!draft.driverId;

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
    if (!draft.time.trim())  errs.push("Add a start time (e.g. 3:30pm).");
    const parsedTime = draft.time.trim() ? parseTime(draft.time) : "";
    if (draft.time.trim() && !parsedTime) errs.push("Time not recognised — try 3:30pm or 15:30.");
    if (errs.length) { setErrors(errs); return; }

    const parsedEnd = draft.endTime?.trim() ? parseTime(draft.endTime) : undefined;
    onSave({
      ...draft,
      title: draft.title.trim(),
      time: parsedTime,
      endTime: parsedEnd || undefined,
      location: draft.location?.trim() || undefined,
      carpoolContact: draft.carpoolContact?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    });
  }

  const adults = members.filter((m) => m.role === "adult");

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
              {/* Quick-pick time chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["7am","8am","9am","10am","11am","12pm","1pm","2pm","3pm","3:30pm","4pm","4:30pm","5pm","6pm","7pm"].map((t) => {
                    const isSelected = draft.time === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.timePresetChip, isSelected && styles.timePresetChipSelected]}
                        onPress={() => setField("time", t)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.timePresetText, isSelected && styles.timePresetTextSelected]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={styles.formInput}
                    value={draft.time}
                    onChangeText={(v) => setField("time", v)}
                    placeholder="or type: 3:30pm"
                    placeholderTextColor="#bbb"
                    autoCapitalize="none"
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={styles.formInput}
                    value={draft.endTime ?? ""}
                    onChangeText={(v) => setField("endTime", v)}
                    placeholder="ends: 5pm (optional)"
                    placeholderTextColor="#bbb"
                    autoCapitalize="none"
                  />
                </View>
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
                <Text style={styles.formLabel}>Who's involved?</Text>
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

            {/* Driver (adults only) */}
            {adults.length > 0 && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Who's driving?</Text>
                <View style={styles.chipGroup}>
                  <TouchableOpacity
                    style={[styles.driverChip, !draft.driverId && styles.driverChipNone]}
                    onPress={() => setField("driverId", undefined)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.driverChipText, !draft.driverId && styles.driverChipTextNone]}>
                      No driver
                    </Text>
                  </TouchableOpacity>
                  {adults.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.driverChip,
                        draft.driverId === m.id && {
                          backgroundColor: m.color,
                          borderColor: m.color,
                        },
                      ]}
                      onPress={() =>
                        setField("driverId", draft.driverId === m.id ? undefined : m.id)
                      }
                      activeOpacity={0.75}
                    >
                      <Feather
                        name="navigation"
                        size={12}
                        color={draft.driverId === m.id ? "#fff" : m.color}
                      />
                      <Text
                        style={[
                          styles.driverChipText,
                          draft.driverId === m.id && { color: "#fff" },
                        ]}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Carpool contact — only when driver set */}
            {draft.driverId && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Carpool contact (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={draft.carpoolContact ?? ""}
                  onChangeText={(v) => setField("carpoolContact", v)}
                  placeholder="Name or phone number"
                  placeholderTextColor="#bbb"
                />
              </View>
            )}

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
  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState("");
  const [role, setRole]     = useState<"adult" | "child">("child");

  function confirm() {
    if (!name.trim()) return;
    onAdd(name.trim(), role);
    setName(""); setRole("child"); setAdding(false);
    Keyboard.dismiss();
  }

  const hasAdults   = members.some((m) => m.role === "adult");
  const hasChildren = members.some((m) => m.role === "child");
  const needsAdultHint = hasChildren && !hasAdults;

  return (
    <View style={styles.peopleSection}>
      <View style={styles.peopleSectionHeader}>
        <Feather name="users" size={14} color={TEXT_MUTED} />
        <Text style={styles.peopleSectionTitle}>Family members</Text>
        {members.length > 0 && !adding && (
          <TouchableOpacity
            style={styles.addPersonCtaInline}
            onPress={() => setAdding(true)}
            activeOpacity={0.75}
          >
            <Feather name="user-plus" size={12} color={TEAL} />
            <Text style={styles.addPersonCtaInlineText}>Add another</Text>
          </TouchableOpacity>
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

// ── Main screen ────────────────────────────────────────────────────────────────
export default function FamilyScreen() {
  const insets        = useSafeAreaInsets();
  const paddingTop    = insets.top + 8;
  const paddingBottom = insets.bottom + 88;
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
  const [isJuggleSolving, setIsJuggleSolving] = useState(false);
  const [juggleResult, setJuggleResult]       = useState<JuggleResult | null>(null);
  const [showJuggleResult, setShowJuggleResult] = useState(false);

  const load = useCallback(async () => {
    const [s, savedJuggle] = await Promise.all([
      loadFamilyState(),
      AsyncStorage.getItem(JUGGLE_RESULT_KEY),
    ]);
    setState(s);
    setResult(computeFamilyWeek(s));
    if (savedJuggle) {
      try { setJuggleResult(JSON.parse(savedJuggle)); } catch {}
    }
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
    setShowPlanSummary(true);
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

  async function handleSortJuggle() {
    const adults = state.members.filter((m) => m.role === "adult");
    if (adults.length === 0 || state.events.length === 0) return;
    setIsJuggleSolving(true);
    setShowJuggleResult(false);
    dismissBanner();
    try {
      // Build prompt using actual field names from FamilyEvent
      const adultsStr = adults.map((a) => `${a.name}, can drive: yes`).join("\n");
      const eventsStr = state.events.map((e) => {
        const involved = e.personIds
          .map((id) => state.members.find((m) => m.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        return [
          `Activity: ${e.title}`,
          `Day: ${e.day}`,
          `Start: ${e.time || "not specified"}`,
          `End: ${e.endTime || "not specified"}`,
          `Location: ${e.location || "not specified"}`,
          `Who's going: ${involved || "unspecified"}`,
          `Assigned adult: unassigned`,
        ].join("\n");
      }).join("\n---\n");
      const prompt = `Available adults:\n${adultsStr}\n\nEvents this week:\n${eventsStr}\n\nPlease solve this schedule.`;

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
      await AsyncStorage.setItem(JUGGLE_RESULT_KEY, JSON.stringify(full));
      setJuggleResult(full);
      setIsJuggleSolving(false);
      setShowJuggleResult(true);
    } catch (err) {
      console.error("Juggle solve error:", err);
      setIsJuggleSolving(false);
      Alert.alert(
        "That one got complicated.",
        "Too many moving parts at once. Try again — it usually works second time.",
        [
          { text: "Try again", onPress: handleSortJuggle },
          { text: "Not now", style: "cancel" },
        ]
      );
    }
  }

  async function handleShareJuggle(text: string) {
    try { await Share.share({ message: text }); } catch {}
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const hasEvents      = state.events.length > 0;
  const hasMembers     = state.members.length > 0;
  const insights       = result?.insights ?? [];
  const weekSummary    = result?.weekSummary;
  const planSplit      = result?.planSplit ?? new Map();
  const daysWithEvents = result?.daysWithEvents ?? [];
  const lightInsight   = result ? getLightInsight(result) : null;
  const hasInsights    = insights.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Family</Text>
            <Text style={styles.pageSub}>
              {hasEvents
                ? (result?.dashboardLine ?? "The moving parts of your week.")
                : hasMembers
                ? "Once you add a couple of things, we'll map the week."
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

        {/* ══ PLANNER OUTPUTS — lead when events exist ══ */}
        {hasEvents ? (
          <>
            {/* 1. Week summary stats */}
            {weekSummary && <WeekSummaryCard summary={weekSummary} />}

            {/* 2. Worth knowing — always shows something */}
            {hasInsights ? (
              <InsightsSection insights={insights} />
            ) : lightInsight ? (
              <View style={styles.lightInsightCard}>
                <Feather name="zap" size={13} color={TEAL} />
                <Text style={styles.lightInsightText}>{lightInsight}</Text>
              </View>
            ) : null}

            {/* 3. Who's covering what — up here, not buried */}
            {planSplit.size > 0 && (
              <PlanSplitSection planSplit={planSplit} members={state.members} />
            )}

            {/* 4. This week — day-by-day events */}
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
                />
              ))}
            </View>

            {/* 5. "This week, sorted" payoff card */}
            {result && (
              <WeekSortedCard
                result={result}
                onReview={openPlanSummary}
                onShare={handleSharePlan}
                onAddAnother={openAddEvent}
              />
            )}

            {/* 6. Sort the family juggle — AI solve button */}
            {state.members.some((m) => m.role === "adult") && (
              <View style={styles.juggleSection}>
                {juggleResult && (
                  <TouchableOpacity
                    style={styles.jugglePriorResult}
                    onPress={() => setShowJuggleResult(true)}
                    activeOpacity={0.85}
                  >
                    <Feather name="check-circle" size={13} color={TEAL} />
                    <Text style={styles.jugglePriorResultText}>
                      Last sorted {new Date(juggleResult.solvedAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} — tap to view
                    </Text>
                    <Feather name="chevron-right" size={13} color={TEXT_MUTED} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.juggleSolveBtn}
                  onPress={handleSortJuggle}
                  activeOpacity={0.88}
                >
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={styles.juggleSolveBtnText}>Sort the family juggle →</Text>
                </TouchableOpacity>
                <Text style={styles.juggleSolveSub}>
                  AI maps who goes where and flags anything worth knowing.
                </Text>
              </View>
            )}
          </>
        ) : hasMembers ? (
          /* ── Members exist, no events ── */
          <View style={styles.membersReadyState}>
            <View style={styles.membersReadyChips}>
              {state.members.map((m) => (
                <MemberChip key={m.id} member={m} />
              ))}
            </View>
            <Text style={styles.membersReadyTitle}>Everyone's here.</Text>
            <Text style={styles.membersReadySub}>
              Add events as they come up — pickups, activities, anything that needs coordinating.
              Once you do, we'll map the week for you.
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
          /* ── Truly empty ── */
          <View style={styles.emptyState}>
            <Feather name="calendar" size={34} color="#D6D2C8" />
            <Text style={styles.emptyTitle}>Nothing on this week.</Text>
            <Text style={styles.emptySub}>
              Add family members, then events as they come up. Sortii will sort the week.
            </Text>
          </View>
        )}

        {/* ── Family members (always at bottom when events exist) ── */}
        <ManagePeopleSection
          members={state.members}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />

        {/* ── Recurring events note ── */}
        {state.events.some((e) => e.repeat !== "none") && (
          <View style={styles.repeatNote}>
            <Feather name="repeat" size={12} color={TEXT_MUTED} />
            <Text style={styles.repeatNoteText}>
              Repeating events carry forward automatically each week.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Floating add button ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: paddingBottom - 48 }]}
        onPress={openAddEvent}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Add event</Text>
      </TouchableOpacity>

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

      {/* ── Plan summary review sheet ── */}
      {showPlanSummary && (
        <PlanSummarySheet
          visible={showPlanSummary}
          result={result}
          members={state.members}
          onClose={() => setShowPlanSummary(false)}
          onShare={handleSharePlan}
          onAddAnother={() => { setShowPlanSummary(false); openAddEvent(); }}
        />
      )}

      {/* ── AI juggle processing overlay ── */}
      {isJuggleSolving && <JuggleProcessingOverlay />}

      {/* ── AI juggle results modal ── */}
      {juggleResult && (
        <Modal
          visible={showJuggleResult}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowJuggleResult(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
            {/* Header */}
            <View style={styles.resultsHeader}>
              <TouchableOpacity onPress={() => setShowJuggleResult(false)}>
                <Text style={styles.resultsBack}>← Family</Text>
              </TouchableOpacity>
              <Text style={styles.resultsTitle}>WEEKEND PLAN</Text>
              <TouchableOpacity onPress={() => { setShowJuggleResult(false); handleSortJuggle(); }}>
                <Text style={styles.resultsRetry}>Sort again</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              {/* Status pill */}
              <View style={[
                styles.juggleStatusPill,
                {
                  backgroundColor:
                    juggleResult.status === "sorted" ? TEAL + "14"
                    : juggleResult.status === "tight" ? GOLD + "14"
                    : "#C0392B14",
                  borderColor:
                    juggleResult.status === "sorted" ? TEAL + "40"
                    : juggleResult.status === "tight" ? GOLD + "40"
                    : "#C0392B40",
                },
              ]}>
                <Feather
                  name={
                    juggleResult.status === "sorted" ? "check-circle"
                    : juggleResult.status === "tight" ? "clock"
                    : "alert-triangle"
                  }
                  size={14}
                  color={juggleResult.status === "sorted" ? TEAL : juggleResult.status === "tight" ? GOLD : "#C0392B"}
                />
                <Text style={[styles.juggleStatusLabel, {
                  color: juggleResult.status === "sorted" ? TEAL : juggleResult.status === "tight" ? GOLD : "#C0392B",
                }]}>
                  {juggleResult.status === "sorted" ? "Weekend sorted"
                    : juggleResult.status === "tight" ? "Tight but workable"
                    : "Some things to sort"}
                </Text>
              </View>

              {/* Summary */}
              <View style={styles.resultsCard}>
                <Text style={styles.resultsCardLabel}>THE SUMMARY</Text>
                <Text style={styles.juggleSummaryText}>{juggleResult.summary}</Text>
              </View>

              {/* Plan */}
              {juggleResult.plan.length > 0 && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsCardLabel}>THE PLAN</Text>
                  <Text style={styles.resultsCardSub}>What's happening. Who's on it.</Text>
                  {juggleResult.plan.map((item, i) => {
                    const member = state.members.find((m) => m.name === item.adult);
                    return (
                      <View key={i} style={[
                        styles.tableRow,
                        { backgroundColor: i % 2 === 0 ? "#fff" : "#FAFAF8" },
                      ]}>
                        <View style={[styles.timePill, { backgroundColor: member?.color ?? PLUM }]}>
                          <Text style={styles.timePillText}>{item.day.slice(0, 3).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableWho}>{item.adult}</Text>
                          <Text style={styles.tableWhere}>{item.duty}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Conflicts */}
              {juggleResult.conflicts.length > 0 && (
                <View style={[styles.resultsCard, styles.conflictCard]}>
                  <Text style={styles.conflictLabel}>THIS BIT NEEDS A PLAN</Text>
                  {juggleResult.conflicts.map((c, i) => (
                    <View key={i} style={styles.conflictRow}>
                      <Text style={styles.conflictText}>⚠ {c.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Smart note */}
              {juggleResult.smart_note && (
                <View style={[styles.resultsCard, styles.worthKnowingCard]}>
                  <Text style={styles.worthKnowingLabel}>✦ WORTH KNOWING</Text>
                  <Text style={styles.worthKnowingText}>{juggleResult.smart_note}</Text>
                </View>
              )}

              {/* Per-adult shareable lists */}
              {Object.keys(juggleResult.adult_lists).length > 0 && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsCardLabel}>SEND EACH PERSON</Text>
                  {Object.entries(juggleResult.adult_lists).map(([name, duties]) => {
                    const member = state.members.find((m) => m.name === name);
                    return (
                      <TouchableOpacity
                        key={name}
                        style={styles.juggleAdultRow}
                        onPress={() => handleShareJuggle(`Hi ${name} — here's what you're covering this week:\n\n${duties}\n\n— Sent from Sortii.`)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.planSplitDot, { backgroundColor: member?.color ?? TEAL }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.jugglePlanAdult}>{name}'s list</Text>
                          <Text style={styles.jugglePlanDuty} numberOfLines={2}>{duties}</Text>
                        </View>
                        <Feather name="send" size={14} color={TEAL} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Share full plan */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => {
                  const lines = ["Family juggle — sorted.", "", juggleResult.summary];
                  if (juggleResult.smart_note) lines.push("", `Worth knowing: ${juggleResult.smart_note}`);
                  handleShareJuggle(lines.join("\n"));
                }}
              >
                <Text style={styles.shareButtonText}>Share full plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.differentWeekend}
                onPress={() => setShowJuggleResult(false)}
              >
                <Text style={styles.differentWeekendText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
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

  // Juggle result sheet
  juggleStatusPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "flex-start", borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  juggleStatusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  juggleSummaryText: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 21 },
  juggleSmartNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: GOLD + "12", borderRadius: 9, borderWidth: 1, borderColor: GOLD + "30",
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 6,
  },
  juggleSmartNoteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },
  jugglePlanRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  jugglePlanAdult: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  jugglePlanDuty: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 1, lineHeight: 17 },
  juggleAdultRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  juggleSortAgain: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Repeat note
  repeatNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  repeatNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },

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
  resultsHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0EDEA",
    backgroundColor: "#fff",
  },
  resultsBack: { color: TEAL, fontSize: 15, fontFamily: "Inter_500Medium" },
  resultsTitle: {
    color: PLUM, fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.12, textTransform: "uppercase",
  },
  resultsRetry: { color: TEXT_MUTED, fontSize: 14, fontFamily: "Inter_400Regular" },
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

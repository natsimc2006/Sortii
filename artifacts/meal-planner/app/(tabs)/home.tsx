import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";
import { useLocale } from "@/context/LocaleContext";
import allRecipesRaw from "@/data/recipes_unified_au.json";
import { computeNudge, recordAppOpen, Nudge } from "@/utils/nudgeEngine";
import { loadFamilyState } from "@/utils/familyStore";
import { FamilyState } from "@/utils/familyTypes";
import { computeFamilyWeek } from "@/utils/familyEngine";
import { loadAppointments, Appointment } from "@/utils/appointmentStore";
import { loadBills, computeBillStatus, Bill, daysUntilDue } from "@/utils/billStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APPLE_CONNECTED_KEY, GOOGLE_CONNECTED_KEY, FAMILY_PUSHED_KEY } from "@/utils/calendarTypes";
import {
  buildTimelineItems,
  deriveReminders,
  TimelineItem,
  ReminderItem,
} from "@/utils/weeklyAggregate";
import { WeeklyGlanceCard, ReminderStrip } from "./upcoming";

const JUGGLE_RESULT_KEY = "@sortii_juggle_result_v1";

interface JuggleResult {
  status: "sorted" | "tight" | "needs_attention";
  summary: string;
  smart_note: string | null;
  plan: Array<{ adult: string; day: string; duty: string }>;
  conflicts: Array<{ type: string; description: string }>;
  adult_lists: Record<string, string>;
  unassigned_events: string[];
  solvedAt: number;
}

const allRecipes = allRecipesRaw as { id: string; name: string }[];

const TEAL      = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD      = "#D29A22";
const PLUM      = "#5E3A4C";
const BG        = "#FFFFFF";
const CARD_BG   = "#FFFDF9";
const BORDER    = "#E6E1D7";
const TEXT      = "#2B2B2B";
const TEXT_MUTED= "#888888";

const DAYS     = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getTodayName() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

const SUMMARIES: Record<string, string[]> = {
  empty: [
    "The week's wide open. Nothing dramatic yet.",
    "A blank slate. Could go either way.",
    "Not much on yet. Plenty of time.",
  ],
  light: [
    "A light week, by the look of it.",
    "A quiet one. We'll take it.",
    "A couple of things taking shape. Nothing unmanageable.",
  ],
  steady: [
    "A fairly steady week. No surprises lurking.",
    "You've got a bit on, but nothing dramatic.",
    "A couple of moving parts. All quite manageable.",
  ],
  sorted: [
    "You're in good shape. Nothing's on fire.",
    "A fairly sorted week. Not much to worry about.",
    "A solid week. Organised without being smug about it.",
  ],
};

function getWeeklySummary(filled: number): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (filled === 0) return pick(SUMMARIES.empty);
  if (filled <= 2)  return pick(SUMMARIES.light);
  if (filled <= 5)  return pick(SUMMARIES.steady);
  return pick(SUMMARIES.sorted);
}

// ── Smart nudge banner ────────────────────────────────────────────
function NudgeBanner({ nudge, onDismiss }: { nudge: Nudge; onDismiss: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.nudgeBanner, { borderLeftColor: nudge.color }]}
      onPress={onDismiss}
      activeOpacity={0.8}
    >
      <View style={[styles.nudgeIcon, { backgroundColor: nudge.color + "18" }]}>
        <Feather name={nudge.icon as any} size={14} color={nudge.color} />
      </View>
      <View style={styles.nudgeText}>
        <Text style={styles.nudgeMessage}>{nudge.message}</Text>
        <Text style={styles.nudgeSub}>{nudge.sub}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={14} color={TEXT_MUTED} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── "Help me sort this" overlay — auto relief sequence ───────────────────────
const RELIEF_LINES = [
  { text: "Dinner's handled.", check: true },
  { text: "Tomorrow's behaving.", check: true },
  { text: "Nothing's falling apart.", check: false },
];

function HelpOverlay({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const op0 = useRef(new Animated.Value(0)).current;
  const op1 = useRef(new Animated.Value(0)).current;
  const op2 = useRef(new Animated.Value(0)).current;
  const opDismiss = useRef(new Animated.Value(0)).current;
  const opacities = [op0, op1, op2];

  useEffect(() => {
    if (!visible) {
      op0.setValue(0); op1.setValue(0); op2.setValue(0); opDismiss.setValue(0);
      return;
    }
    const fade = (val: Animated.Value, delay: number) =>
      setTimeout(() => Animated.timing(val, { toValue: 1, duration: 380, useNativeDriver: true }).start(), delay);

    const t0 = fade(op0, 450);
    const t1 = fade(op1, 1600);
    const t2 = fade(op2, 2750);
    const t3 = fade(opDismiss, 3700);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Pressable style={styles.helpBackdrop} onPress={onDismiss}>
      <Pressable style={styles.helpCard} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.helpTitle}>Right. Let's keep this simple.</Text>

        <View style={styles.helpItems}>
          {RELIEF_LINES.map((line, i) => (
            <Animated.View
              key={i}
              style={[styles.helpItem, { opacity: opacities[i] }]}
            >
              {line.check && (
                <Feather name="check" size={15} color={TEAL} />
              )}
              {!line.check && (
                <View style={{ width: 15 }} />
              )}
              <Text style={styles.helpItemText}>{line.text}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View style={{ opacity: opDismiss }}>
          <TouchableOpacity
            style={styles.helpDismiss}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.helpDismissText}>That'll do.</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const [helpVisible, setHelpVisible]       = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [nudge, setNudge]               = useState<Nudge | null>(null);
  const [familyLine, setFamilyLine]     = useState<string>("Nothing on the family radar this week.");
  const [familySub, setFamilySub]       = useState<string>("A rare and peaceful sight.");
  const [familyEventCount, setFamilyEventCount] = useState(0);
  const [juggleResult, setJuggleResult] = useState<JuggleResult | null>(null);
  const [nextAppt, setNextAppt]         = useState<Appointment | null>(null);
  const [billsData, setBillsData]       = useState<{ overdue: number; dueSoon: number; total: number } | null>(null);
  const [allBills,  setAllBills]        = useState<Bill[]>([]);
  const [allItems,  setAllItems]        = useState<TimelineItem[]>([]);
  const [reminders, setReminders]       = useState<ReminderItem[]>([]);
  const [calAppleConn,  setCalAppleConn]  = useState(false);
  const [calGoogleConn, setCalGoogleConn] = useState(false);
  const [calPushedCount, setCalPushedCount] = useState(0);

  const todayName    = getTodayName();
  const todayIdx     = DAYS.indexOf(todayName);
  const plannedCount = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId).length;

  const tonightEntry  = currentPlan.find((e) => e.day === todayName && e.slot === "dinner");
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;

  const weeklyBreathingRoom = money
    ? Math.round(
        money.weeklyIncome - money.fixedWeeklyCosts - money.groceriesWeekly -
        (money.eatingOutWeekly ?? 0) - (money.otherWeeklySpend ?? 0)
      )
    : 0;

  const greeting = useMemo(() => getGreeting(), []);
  const summary  = useMemo(() => getWeeklySummary(plannedCount), [plannedCount]);

  useEffect(() => {
    (async () => {
      const [familyState, nudgeResult, , savedJuggle, appts, bills, appleConnRaw, googleConnRaw, pushedRaw] = await Promise.all([
        loadFamilyState(),
        computeNudge(currentPlan, allRecipes),
        recordAppOpen(),
        AsyncStorage.getItem(JUGGLE_RESULT_KEY),
        loadAppointments(),
        loadBills(),
        AsyncStorage.getItem(APPLE_CONNECTED_KEY),
        AsyncStorage.getItem(GOOGLE_CONNECTED_KEY),
        AsyncStorage.getItem(FAMILY_PUSHED_KEY),
      ]);
      setCalAppleConn(appleConnRaw === "true");
      setCalGoogleConn(googleConnRaw === "true");
      if (pushedRaw) { try { setCalPushedCount((JSON.parse(pushedRaw) as unknown[]).length); } catch {} }
      const fr = computeFamilyWeek(familyState);
      setFamilyEventCount(familyState.events.length);
      setFamilyLine(fr.dashboardLine);
      setFamilySub(fr.dashboardSub ?? fr.dashboardLine);
      if (nudgeResult) setNudge(nudgeResult);
      if (savedJuggle) {
        try { setJuggleResult(JSON.parse(savedJuggle)); } catch {}
      }
      // Next upcoming appointment
      const upcoming = appts
        .filter((a) => !a.isDone && !a.isCancelled)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      setNextAppt(upcoming[0] ?? null);
      // Bills summary
      const overdue  = bills.filter((b) => computeBillStatus(b) === "Overdue").length;
      const dueSoon  = bills.filter((b) => computeBillStatus(b) === "Due Soon").length;
      const total    = bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);
      setBillsData(bills.length > 0 ? { overdue, dueSoon, total } : null);
      setAllBills(bills);
      // Cross-module timeline
      const builtItems = buildTimelineItems({
        plan:         currentPlan,
        recipes:      allRecipes,
        appointments: appts,
        bills,
        familyState,
      });
      setAllItems(builtItems);
      setReminders(deriveReminders({ appointments: appts, bills, familyState }));
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* A — Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.wordmark}>
                sorti<Text style={styles.wordmarkGold}>ii</Text>.
              </Text>
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setHelpVisible(true)}
                activeOpacity={0.75}
              >
                <Feather name="zap" size={13} color={TEAL} />
                <Text style={styles.helpBtnText}>Help me sort this</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearBtn}
                onPress={() => setSettingsVisible(true)}
                activeOpacity={0.75}
              >
                <Feather name="settings" size={15} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekly summary */}
          <Text style={styles.summary}>{summary}</Text>

          {/* Reminder strip */}
          {reminders.length > 0 && (
            <ReminderStrip reminders={reminders} />
          )}

          {/* Smart nudge banner */}
          {nudge && (
            <NudgeBanner nudge={nudge} onDismiss={() => setNudge(null)} />
          )}

          {/* B — Tonight's dinner */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/meals")}
            activeOpacity={0.8}
            style={[styles.card, styles.cardNeutral, styles.cardRailTeal]}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: tonightRecipe ? TEAL : GOLD }]}>
                  TONIGHT'S DINNER
                </Text>
                <Text style={styles.cardTitle}>
                  {tonightRecipe ? tonightRecipe.name : "Nothing planned yet."}
                </Text>
                <Text style={[styles.cardSub, { color: tonightRecipe ? TEAL : TEXT_MUTED }]}>
                  {tonightRecipe ? "Sorted. ✓" : "Tap to sort tonight →"}
                </Text>
              </View>
              <View style={[styles.cardChevron, { backgroundColor: (tonightRecipe ? TEAL : GOLD) + "12" }]}>
                <Feather name="chevron-right" size={16} color={tonightRecipe ? TEAL : GOLD} />
              </View>
            </View>
          </TouchableOpacity>

          {/* C — Family */}
          {(() => {
            // Determine family card state based on events and AI solve result
            const totalThings = familyEventCount + calPushedCount;
            const hasEvents = totalThings > 0;
            const hasSolved = !!juggleResult;
            const hasConflicts = hasSolved && juggleResult!.conflicts.length > 0;
            const cardColor =
              hasConflicts ? "#E8A838"
              : hasSolved  ? TEAL
              : PLUM;
            const cardLine =
              !hasEvents  ? familyLine
              : hasSolved && hasConflicts
                ? `${juggleResult!.conflicts.length} thing${juggleResult!.conflicts.length > 1 ? "s" : ""} need${juggleResult!.conflicts.length === 1 ? "s" : ""} sorting.`
              : hasSolved
                ? `Weekend sorted. ${juggleResult!.plan.length} ${juggleResult!.plan.length === 1 ? "duty" : "duties"} mapped.`
              : `${totalThings} thing${totalThings > 1 ? "s" : ""} on this week.`;
            const calBreakdown = !hasSolved && calPushedCount > 0 && familyEventCount > 0
              ? `${calPushedCount} from your calendar, ${familyEventCount} added.`
              : null;
            const cardSub =
              !hasEvents  ? familySub
              : hasSolved && hasConflicts
                ? "Tap to see what needs a plan →"
              : hasSolved
                ? "Tap to see the plan →"
              : calBreakdown ?? "Tap to sort the juggle →";

            return (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/family")}
                activeOpacity={0.8}
                style={[styles.card, styles.cardNeutral, { borderLeftColor: cardColor, borderLeftWidth: 3 }]}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: cardColor }]}>FAMILY</Text>
                    <Text style={styles.cardTitle}>{cardLine}</Text>
                    <Text style={[styles.cardSub, { color: hasSolved || hasEvents ? cardColor : TEXT_MUTED, fontStyle: "italic" }]}>
                      {cardSub}
                    </Text>
                  </View>
                  <View style={[styles.cardChevron, { backgroundColor: cardColor + "12" }]}>
                    <Feather name="chevron-right" size={16} color={cardColor} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* D — Money */}
          {hasMoneySetup && weeklyBreathingRoom > 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/money")}
              activeOpacity={0.8}
              style={[styles.card, styles.cardNeutral, styles.cardRailGold]}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                  <Text style={styles.cardTitle}>
                    {currencySymbol}{weeklyBreathingRoom} breathing room this week.
                  </Text>
                  <Text style={[styles.cardSub, { color: TEXT_MUTED }]}>
                    After meals and fixed costs.
                  </Text>
                </View>
                <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
                  <Feather name="chevron-right" size={16} color={GOLD} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/money")}
              activeOpacity={0.8}
              style={[styles.card, styles.cardNeutral, styles.cardRailGold]}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                  <Text style={styles.cardTitle}>
                    Curious how this week looks financially?
                  </Text>
                  <Text style={[styles.cardSub, { color: TEAL }]}>Set it up →</Text>
                </View>
                <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
                  <Feather name="chevron-right" size={16} color={GOLD} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* D2 — COMING UP: bills due this week */}
          {(() => {
            const dueSoon = allBills
              .filter((b) => !b.isPaid && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            if (dueSoon.length === 0) return null;
            const shown = dueSoon.slice(0, 2);
            const extra = dueSoon.length - 2;
            return (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: GOLD }]}>COMING UP</Text>
                {shown.map((bill) => {
                  const days = daysUntilDue(bill);
                  const dueLabel = days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
                  const dueColor = days <= 1 ? "#B86557" : days <= 3 ? GOLD : TEXT_MUTED;
                  return (
                    <TouchableOpacity
                      key={bill.id}
                      onPress={() => router.push("/(tabs)/bills")}
                      activeOpacity={0.8}
                      style={styles.comingUpCard}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.comingUpName} numberOfLines={1}>{bill.title}</Text>
                        <Text style={[styles.comingUpDue, { color: dueColor }]}>{dueLabel}</Text>
                      </View>
                      <Text style={styles.comingUpAmount}>{currencySymbol}{bill.amount.toFixed(0)}</Text>
                    </TouchableOpacity>
                  );
                })}
                {extra > 0 && (
                  <TouchableOpacity onPress={() => router.push("/(tabs)/bills")} activeOpacity={0.7}>
                    <Text style={styles.comingUpMore}>{extra} more →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* E — Week at a glance */}
          <View style={styles.weekSection}>
            <Text style={styles.sectionLabel}>WEEK AT A GLANCE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekStrip}
            >
              {DAYS.map((day, i) => {
                const isToday = day === todayName;
                const hasMeal = currentPlan.some(
                  (e) => e.day === day && e.slot === "dinner" && e.recipeId
                );
                return (
                  <View
                    key={day}
                    style={[
                      styles.dayPill,
                      isToday ? styles.dayPillToday
                        : hasMeal ? styles.dayPillMeal
                        : styles.dayPillEmpty,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        isToday ? { color: "#fff" }
                          : hasMeal ? { color: TEXT }
                          : { color: "#bbb" },
                      ]}
                    >
                      {DAY_ABBR[i]}
                    </Text>
                    <View style={styles.dayDots}>
                      {hasMeal && (
                        <View style={[styles.dot, { backgroundColor: isToday ? "#fff" : TEAL }]} />
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* What's Coming Up — only when there's a cross-module insight */}
          {allItems.length > 0 && (
            <WeeklyGlanceCard
              items={allItems}
              bills={allBills}
              onViewAll={() => router.push("/(tabs)/upcoming")}
            />
          )}

          {/* F — Appointments preview */}
          {(() => {
            const apptColor = PLUM;
            const apptTitle = nextAppt ? nextAppt.title : "Nothing coming up yet.";
            const apptSub   = nextAppt
              ? (() => {
                  const [y, m, d] = nextAppt.date.split("-").map(Number);
                  const date      = new Date(y!, (m! - 1), d!);
                  const dayName   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()] ?? "";
                  const dd        = date.getDate();
                  const mo        = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()] ?? "";
                  const h         = parseInt(nextAppt.startTime.split(":")[0] ?? "0", 10);
                  const mn        = nextAppt.startTime.split(":")[1] ?? "00";
                  const period    = h >= 12 ? "pm" : "am";
                  const hr        = (h % 12 || 12);
                  const timeStr   = mn === "00" ? `${hr}${period}` : `${hr}:${mn}${period}`;
                  return `${dayName} ${dd} ${mo} · ${timeStr}${nextAppt.person ? ` · ${nextAppt.person}` : ""}`;
                })()
              : "Tap to add appointments →";
            return (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/appointments")}
                activeOpacity={0.8}
                style={[styles.card, styles.cardNeutral, { borderLeftColor: apptColor, borderLeftWidth: 3 }]}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: apptColor }]}>APPOINTMENTS</Text>
                    <Text style={styles.cardTitle}>{apptTitle}</Text>
                    <Text style={[styles.cardSub, { color: nextAppt ? apptColor : TEXT_MUTED, fontStyle: "italic" }]}>
                      {apptSub}
                    </Text>
                  </View>
                  <View style={[styles.cardChevron, { backgroundColor: apptColor + "12" }]}>
                    <Feather name="chevron-right" size={16} color={apptColor} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* G — Bills preview */}
          {(() => {
            const billColor  = "#4A7B5E";
            const billTitle  = !billsData
              ? "No bills added yet."
              : billsData.overdue > 0
                ? `${billsData.overdue} bill${billsData.overdue > 1 ? "s" : ""} overdue.`
                : billsData.dueSoon > 0
                  ? `${billsData.dueSoon} bill${billsData.dueSoon > 1 ? "s" : ""} due this week.`
                  : "Nothing urgent on the bill front.";
            const billSub    = !billsData
              ? "Tap to start tracking bills →"
              : billsData.overdue > 0
                ? "Tap to see what needs sorting →"
                : billsData.dueSoon > 0
                  ? `${currencySymbol}${billsData.total.toFixed(0)} outstanding this week →`
                  : "All quiet. Tap to view →";
            return (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/bills")}
                activeOpacity={0.8}
                style={[styles.card, styles.cardNeutral, { borderLeftColor: billColor, borderLeftWidth: 3 }]}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: billColor }]}>BILLS</Text>
                    <Text style={styles.cardTitle}>{billTitle}</Text>
                    <Text style={[styles.cardSub, { color: billsData ? billColor : TEXT_MUTED, fontStyle: "italic" }]}>
                      {billSub}
                    </Text>
                  </View>
                  <View style={[styles.cardChevron, { backgroundColor: billColor + "12" }]}>
                    <Feather name="chevron-right" size={16} color={billColor} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          <View style={{ paddingBottom: 90 }} />
        </ScrollView>

        {/* Help me sort this — rendered above scroll */}
        <HelpOverlay
          visible={helpVisible}
          onDismiss={() => setHelpVisible(false)}
        />

        {/* Settings sheet */}
        {settingsVisible && (
          <Pressable
            style={styles.settingsOverlay}
            onPress={() => setSettingsVisible(false)}
          >
            <Pressable style={styles.settingsSheet} onPress={() => {}}>
              <View style={styles.settingsHandle} />
              <Text style={styles.settingsTitle}>More from Sortii</Text>

              {/* CALENDARS */}
              <Text style={styles.settingsSectionLabel}>CALENDARS</Text>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => { setSettingsVisible(false); router.push("/(tabs)/appointments" as any); }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 14 }}>🍎</Text>
                <Text style={[styles.settingsRowText, calAppleConn && { color: TEAL }]}>
                  {"iPhone Calendar" + (calAppleConn ? " — Connected ✓" : " — Not connected")}
                </Text>
                <Feather name="chevron-right" size={15} color={TEXT_MUTED} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => { setSettingsVisible(false); router.push("/(tabs)/appointments" as any); }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 14, color: "#4285F4", fontFamily: "Inter_700Bold" }}>G</Text>
                <Text style={[styles.settingsRowText, calGoogleConn && { color: TEAL }]}>
                  {"Google Calendar" + (calGoogleConn ? " — Connected ✓" : " — Not connected")}
                </Text>
                <Feather name="chevron-right" size={15} color={TEXT_MUTED} />
              </TouchableOpacity>
              <View style={styles.settingsDivider} />

              {[
                { label: "Dietary preferences", icon: "sliders" as const, route: "/(tabs)/preferences" as const },
                { label: "Appointments", icon: "calendar" as const, route: "/(tabs)/appointments" as const },
                { label: "Bills", icon: "credit-card" as const, route: "/(tabs)/bills" as const },
                { label: "Saved meals", icon: "bookmark" as const, route: "/(tabs)/saved" as const },
                { label: "What's coming up", icon: "clock" as const, route: "/(tabs)/upcoming" as const },
              ].map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.settingsRow}
                  onPress={() => { setSettingsVisible(false); router.push(item.route as any); }}
                  activeOpacity={0.75}
                >
                  <Feather name={item.icon} size={16} color={TEAL} />
                  <Text style={styles.settingsRowText}>{item.label}</Text>
                  <Feather name="chevron-right" size={15} color={TEXT_MUTED} />
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: { flex: 1, gap: 2 },
  wordmark: { fontSize: 26, fontFamily: "PlayfairDisplay_700Bold", color: TEXT },
  wordmarkGold: { color: GOLD },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  summary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
    lineHeight: 20,
    marginTop: -2,
    marginBottom: 2,
  },

  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: TEAL_TINT,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: TEAL + "30",
    marginTop: 2,
    flexShrink: 0,
  },
  helpBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  gearBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F4F2EE",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
    flexShrink: 0,
  },

  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    zIndex: 999,
  },
  settingsSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 4,
    ...Platform.select({
      web: { boxShadow: "0px -3px 20px rgba(0,0,0,0.10)" },
      default: {
        shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.10, shadowRadius: 12, elevation: 10,
      },
    }),
  },
  settingsHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#DDD", alignSelf: "center", marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: TEXT, marginBottom: 8,
  },
  settingsRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  settingsRowText: {
    flex: 1, fontSize: 15,
    fontFamily: "Inter_400Regular", color: TEXT,
  },
  settingsSectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8, marginBottom: 2,
  },
  settingsDivider: {
    height: 1, backgroundColor: BORDER, marginVertical: 8,
  },

  // Nudge banner
  nudgeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    padding: 12,
  },
  nudgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  nudgeText: { flex: 1, gap: 2 },
  nudgeMessage: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 18,
  },
  nudgeSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 17,
  },

  // Cards — consistent off-white surface with category left rail
  card: { borderRadius: 14, borderWidth: 1, padding: 15 },
  cardNeutral: { backgroundColor: CARD_BG, borderColor: BORDER },
  cardRailTeal: { borderLeftWidth: 3.5, borderLeftColor: TEAL },
  cardRailPlum: { borderLeftWidth: 3.5, borderLeftColor: PLUM },
  cardRailGold: { borderLeftWidth: 3.5, borderLeftColor: GOLD },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 22,
  },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  cardChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Week strip
  weekSection: { gap: 8, marginTop: 4 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: TEXT_MUTED,
  },
  comingUpCard: {
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  comingUpName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    flex: 1,
  },
  comingUpDue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  comingUpAmount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: TEXT,
  },
  comingUpMore: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: GOLD,
    textAlign: "right",
    paddingRight: 2,
  },
  weekStrip: { gap: 6, paddingBottom: 2 },
  dayPill: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    minWidth: 44,
  },
  dayPillToday: { backgroundColor: TEAL, borderColor: TEAL },
  dayPillMeal:  { backgroundColor: CARD_BG, borderColor: BORDER },
  dayPillEmpty: { backgroundColor: BG, borderColor: BORDER },
  dayPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dayDots: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // Placeholders
  placeholderRow: { flexDirection: "row", gap: 10 },
  placeholderCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 5,
    alignItems: "flex-start",
  },
  placeholderLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  soonPill: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soonText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#aaa" },

  // Help overlay — deliberately minimal
  helpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 28, 24, 0.58)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 100,
  },
  helpCard: {
    backgroundColor: "#FEFCF8",
    borderRadius: 22,
    padding: 26,
    width: "100%",
    ...Platform.select({
      web: { boxShadow: "0px 12px 40px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 24,
      },
    }),
  },
  helpTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    marginBottom: 20,
    lineHeight: 26,
  },

  // Lines: auto-reveal statement rows
  helpItems: { gap: 14, marginBottom: 28 },
  helpItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  helpItemText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: TEXT,
    flex: 1,
    lineHeight: 22,
  },

  // Always-on dismiss
  helpDismiss: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  helpDismissText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});

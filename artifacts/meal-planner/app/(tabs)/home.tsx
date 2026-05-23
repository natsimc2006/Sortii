import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MealPlanEntry } from "@/constants/recipes";
import { isShopWindow as computeIsShopWindow, getNextWeekMondayISO } from "@/utils/weekUtils";
import ThisWeekCard from "@/components/ThisWeekCard";
import NextWeekCard from "@/components/NextWeekCard";
import OverwhelmModal, { PressureItem } from "@/components/OverwhelmModal";
import {
  Image,
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
import { calKeys } from "@/utils/calendarTypes";
import { SK } from "@/utils/storageKeys";
import { getCurrentUserId } from "@/utils/currentUser";
import {
  buildTimelineItems,
  deriveReminders,
  TimelineItem,
  ReminderItem,
} from "@/utils/weeklyAggregate";
import { WeeklyGlanceCard, ReminderStrip } from "./upcoming";

function juggleKey()     { return SK.juggle(getCurrentUserId()); }
function welcomeTipKey() { return SK.welcomeTip(getCurrentUserId()); }

interface JuggleResult {
  status: "sorted" | "tight" | "needs_attention";
  summary: string;
  smart_note: string | null;
  plan: Array<{ adult: string; day: string; duty: string }>;
  conflicts: Array<{ type: string; description: string }>;
  adult_lists: Record<string, string>;
  unassigned_events: string[];
  solvedAt: number;
  events?: unknown[];
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

function getTodayName(): string {
  // Use Intl to get the correct local weekday.
  // On real devices the OS timezone is used automatically.
  // In web/preview environments that run in UTC (e.g. Replit canvas),
  // we fall back to Australia/Sydney since this is an AU-first app.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effective = tz === "UTC" || tz === "Etc/UTC" ? "Australia/Sydney" : tz;
    const raw = new Date().toLocaleDateString("en-AU", { weekday: "long", timeZone: effective });
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
    return DAYS.find((d) => d === cap) ?? DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]!;
  } catch {
    const d = new Date().getDay();
    return DAYS[d === 0 ? 6 : d - 1]!;
  }
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

// ── Main screen ───────────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol, formatMoneyRound } = useLocale();

  const [showOverwhelm, setShowOverwhelm]   = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [nudge, setNudge]               = useState<Nudge | null>(null);
  const [familyLine, setFamilyLine]     = useState<string>("Nothing on the family radar this week.");
  const [familySub, setFamilySub]       = useState<string>("A rare and peaceful sight.");
  const [familyEventCount, setFamilyEventCount] = useState(0);
  const [juggleResult, setJuggleResult]       = useState<JuggleResult | null>(null);
  const [nextAppt, setNextAppt]               = useState<Appointment | null>(null);
  const [billsData, setBillsData]             = useState<{ overdue: number; dueSoon: number; total: number } | null>(null);
  const [allBills,  setAllBills]              = useState<Bill[]>([]);
  const [allAppts,  setAllAppts]              = useState<Appointment[]>([]);
  const [pressureItems, setPressureItems]     = useState<PressureItem[]>([]);
  const [apptsTodayTomorrow, setApptsTodayTomorrow] = useState<Appointment[]>([]);
  const [conflictLines, setConflictLines]     = useState<string[]>([]);
  const [welcomeTipDismissed, setWelcomeTipDismissed] = useState(true);
  const [allItems,  setAllItems]        = useState<TimelineItem[]>([]);
  const [reminders, setReminders]       = useState<ReminderItem[]>([]);
  const [calAppleConn,  setCalAppleConn]  = useState(false);
  const [calGoogleConn, setCalGoogleConn] = useState(false);
  const [calPushedCount, setCalPushedCount] = useState(0);
  const [crossSellMsg, setCrossSellMsg]   = useState<{ title: string; sub: string; route: string; color: string } | null>(null);
  const [nextWeekPlan, setNextWeekPlan]   = useState<MealPlanEntry[] | null>(null);
  const [shopWindow, setShopWindow]       = useState(false);

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

  const pressureTotal = pressureItems.reduce((s, p) => s + p.amount, 0);
  const adjustedBreathingRoom = weeklyBreathingRoom - pressureTotal;
  type MoneyTabState = "none" | "calm" | "tight" | "stretched";
  const moneyTabState: MoneyTabState = !hasMoneySetup
    ? "none"
    : adjustedBreathingRoom > 50
      ? "calm"
      : adjustedBreathingRoom >= 1
        ? "tight"
        : "stretched";

  const greeting = useMemo(() => getGreeting(), []);
  const summary  = useMemo(() => getWeeklySummary(plannedCount), [plannedCount]);

  // Helper: load next-week plan from AsyncStorage
  const loadNextWeek = useCallback(async () => {
    const uid = getCurrentUserId();
    const mondayISO = getNextWeekMondayISO();
    setShopWindow(computeIsShopWindow());
    const raw = await AsyncStorage.getItem(SK.planNextWeek(uid, mondayISO));
    if (raw) {
      try { setNextWeekPlan(JSON.parse(raw)); } catch { setNextWeekPlan(null); }
    } else {
      setNextWeekPlan(null);
    }
  }, []);

  // Reload next-week plan whenever home screen gains focus
  useFocusEffect(useCallback(() => { loadNextWeek(); }, [loadNextWeek]));

  useEffect(() => {
    (async () => {
      const uid = getCurrentUserId();
      const [familyState, nudgeResult, , savedJuggle, appts, bills, appleConnRaw, googleConnRaw, pushedRaw, tipDismissed, crossSellRaw] = await Promise.all([
        loadFamilyState(),
        computeNudge(currentPlan as any, allRecipes),
        recordAppOpen(),
        AsyncStorage.getItem(juggleKey()),
        loadAppointments(),
        loadBills(),
        AsyncStorage.getItem(calKeys.appleConn()),
        AsyncStorage.getItem(calKeys.googleConn()),
        AsyncStorage.getItem(calKeys.pushedEvents()),
        AsyncStorage.getItem(welcomeTipKey()),
        AsyncStorage.getItem(SK.crossSellNudge(uid)),
      ]);
      setWelcomeTipDismissed(tipDismissed === "true");
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
      const total    = bills.filter((b) => computeBillStatus(b) === "Due Soon").reduce((s, b) => s + b.amount, 0);
      setBillsData(bills.length > 0 ? { overdue, dueSoon, total } : null);
      setAllBills(bills);
      setAllAppts(appts);

      // ── Phase 5: Pressure items (one-off bills + appointment costs) ──
      const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
      const todayIso    = todayMidnight.toISOString().split("T")[0]!;
      const tomorrowIso = new Date(todayMidnight.getTime() + 86_400_000).toISOString().split("T")[0]!;

      const billPressure: PressureItem[] = bills
        .filter((b) => !b.isPaid && b.billType === "oneOff" && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7)
        .map((b) => ({ name: b.title, amount: b.amount, dateStr: b.dueDate }));
      const apptPressure: PressureItem[] = appts
        .filter((a) => {
          if (a.isDone || a.isCancelled || !(a.appointmentCost && a.appointmentCost > 0)) return false;
          const [ay, am, ad] = a.date.split("-").map(Number);
          const diff = Math.floor((new Date(ay!, (am!-1), ad!).getTime() - todayMidnight.getTime()) / 86_400_000);
          return diff >= 0 && diff <= 7;
        })
        .map((a) => ({ name: a.title, amount: a.appointmentCost!, dateStr: a.date }));
      setPressureItems([...billPressure, ...apptPressure]);
      setApptsTodayTomorrow(appts.filter((a) => !a.isDone && !a.isCancelled && (a.date === todayIso || a.date === tomorrowIso)));

      // ── Phase 5: Availability conflict detection ──────────────────
      const WEEK_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
      const weekStart = new Date(todayMidnight);
      const jsDay = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
      const detected: string[] = [];
      for (const appt of appts) {
        if (appt.isDone || appt.isCancelled || !appt.availabilityBlock) continue;
        const blockedIds = appt.availabilityBlock.personIds;
        if (!blockedIds.length) continue;
        const [ay, am, ad] = appt.date.split("-").map(Number);
        const apptDate = new Date(ay!, (am!-1), ad!);
        const dayOffset = Math.round((apptDate.getTime() - weekStart.getTime()) / 86_400_000);
        const dayName = WEEK_DAYS[dayOffset];
        if (!dayName) continue;
        for (const evt of familyState.events) {
          if (evt.day !== dayName) continue;
          const conflictPid = blockedIds.find((pid) => evt.personIds.includes(pid) || evt.driverId === pid);
          if (!conflictPid) continue;
          const member = familyState.members.find((m) => m.id === conflictPid);
          const personName = member ? member.name : "Someone";
          const line = `${personName} unavailable ${dayName} — ${evt.title} needs cover`;
          if (!detected.includes(line)) detected.push(line);
        }
      }
      setConflictLines(detected);

      // ── Cross-sell nudge (one-time per feature, shown until dismissed) ─────
      if (!crossSellRaw) {
        // Priority: money → family → bills, only if user has some meals set up
        if (plannedCount > 0 && !hasMoneySetup) {
          setCrossSellMsg({
            title: "Your meals are sorted. How's the money looking?",
            sub: "Add your income and outgoings to see your weekly breathing room.",
            route: "/money-setup",
            color: GOLD,
          });
        } else if (plannedCount > 0 && familyState.events.length === 0 && familyState.members.length === 0) {
          setCrossSellMsg({
            title: "Who else is in your household?",
            sub: "Add your family to sort the weekly juggle — school runs, appointments, everything.",
            route: "/(tabs)/family",
            color: PLUM,
          });
        } else if (bills.length === 0 && hasMoneySetup) {
          setCrossSellMsg({
            title: "Track your bills in one place.",
            sub: "Add bills once — they'll flow into your week.",
            route: "/(tabs)/bills",
            color: TEAL,
          });
        }
      }

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

  // Save the current plan as next week's plan
  async function handleSaveAsNextWeek() {
    if (!currentPlan.some((e) => e.slot === "dinner" && e.recipeId)) return;
    const uid = getCurrentUserId();
    const mondayISO = getNextWeekMondayISO();
    await AsyncStorage.setItem(SK.planNextWeek(uid, mondayISO), JSON.stringify(currentPlan));
    setNextWeekPlan(currentPlan);
  }

  // "Plan next week" / "Sort next week" action
  async function handleGenerate() {
    // If the user already has a current plan, offer to save it as next week
    const hasCurrentPlan = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId).length >= 3;
    if (hasCurrentPlan && !nextWeekPlan) {
      await handleSaveAsNextWeek();
    } else {
      router.push("/(tabs)/meals");
    }
  }

  // Shopping list navigation — scoped to remaining this-week meals or next week
  function handleShoppingList(scope: "thisWeek" | "nextWeek") {
    router.push("/(tabs)/shopping");
  }

  // Order the cards: shop window → NextWeek first; otherwise → ThisWeek first
  const shopWindowFirst = shopWindow;

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
              <Image
                source={require("@/assets/images/sortii-logo2-wordmark.png")}
                style={styles.wordmarkLogo}
                resizeMode="contain"
              />
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setShowOverwhelm(true)}
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

          {/* Welcome tip — shown once after first onboarding */}
          {!welcomeTipDismissed && (
            <View style={styles.welcomeTip}>
              <View style={styles.welcomeTipTop}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="check-circle" size={14} color={TEAL} />
                  <Text style={styles.welcomeTipTitle}>Welcome to Sortii.</Text>
                </View>
              </View>
              <Text style={styles.welcomeTipBody}>
                Start with meals below — takes about a minute.
              </Text>
              <View style={styles.welcomeTipActions}>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/meals")}
                  style={styles.welcomeTipCta}
                  activeOpacity={0.8}
                >
                  <Text style={styles.welcomeTipCtaText}>Sort meals →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await AsyncStorage.setItem(welcomeTipKey(), "true");
                    setWelcomeTipDismissed(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.welcomeTipDismiss}>Got it ×</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Week at a glance strip ── */}
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

          {/* B — This Week + Next Week meal cards */}
          <View style={{ gap: 12 }}>
            {shopWindowFirst ? (
              <>
                <NextWeekCard
                  nextWeekPlan={nextWeekPlan}
                  isShopWindow={shopWindow}
                  allRecipes={allRecipes}
                  onGenerate={handleGenerate}
                  onViewPlan={() => router.push("/(tabs)/meals")}
                  onShoppingList={() => handleShoppingList("nextWeek")}
                />
                <ThisWeekCard
                  plan={currentPlan}
                  allRecipes={allRecipes}
                  onViewPlan={() => router.push("/(tabs)/meals")}
                  onShoppingList={() => handleShoppingList("thisWeek")}
                />
              </>
            ) : (
              <>
                <ThisWeekCard
                  plan={currentPlan}
                  allRecipes={allRecipes}
                  onViewPlan={() => router.push("/(tabs)/meals")}
                  onShoppingList={() => handleShoppingList("thisWeek")}
                />
                <NextWeekCard
                  nextWeekPlan={nextWeekPlan}
                  isShopWindow={shopWindow}
                  allRecipes={allRecipes}
                  onGenerate={handleGenerate}
                  onViewPlan={() => router.push("/(tabs)/meals")}
                  onShoppingList={() => handleShoppingList("nextWeek")}
                />
              </>
            )}
          </View>

          {/* B2 — Fridge Rescue shortcut */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/cook-with" as any)}
            style={styles.fridgeShortcut}
            activeOpacity={0.7}
          >
            <Feather name="search" size={11} color={TEAL} />
            <Text style={styles.fridgeShortcutText}>Fridge Rescue →</Text>
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
              : hasEvents  ? TEAL
              : PLUM;
            const cardLine =
              !hasEvents  ? familyLine
              : hasSolved && hasConflicts
                ? (() => {
                    const all = juggleResult!.conflicts;
                    const n = all.length;
                    const unassigned = all.filter((c: any) => c.type === "unassigned").length;
                    const overlaps   = all.filter((c: any) => c.type === "overlap").length;
                    if (unassigned > 0 && overlaps === 0)
                      return `${unassigned} event${unassigned > 1 ? "s" : ""} need${unassigned === 1 ? "s" : ""} a driver.`;
                    if (overlaps > 0 && unassigned === 0)
                      return `${overlaps} event${overlaps > 1 ? "s" : ""} clash${overlaps > 1 ? "" : "es"} this week.`;
                    return `${n} thing${n > 1 ? "s" : ""} need${n === 1 ? "s" : ""} sorting out.`;
                  })()
              : hasSolved
                ? `Weekend sorted. ${juggleResult!.events?.length ?? 0} thing${(juggleResult!.events?.length ?? 0) === 1 ? "" : "s"} mapped.`
              : `${totalThings} event${totalThings > 1 ? "s" : ""} this week.`;
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

          {/* D — Money (Phase 5: 3-state card) */}
          {(() => {
            if (moneyTabState === "none") {
              return (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/money")}
                  activeOpacity={0.8}
                  style={[styles.card, styles.cardNeutral, styles.cardRailGold]}
                >
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                      <Text style={styles.cardTitle}>Want a quick money check?</Text>
                      <Text style={[styles.cardSub, { color: TEAL }]}>Add your numbers →</Text>
                    </View>
                    <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
                      <Feather name="chevron-right" size={16} color={GOLD} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            if (moneyTabState === "stretched") {
              const RED = "#B86557";
              return (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/money")}
                  activeOpacity={0.8}
                  style={[styles.card, styles.cardNeutral, { borderLeftColor: RED, borderLeftWidth: 3 }]}
                >
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardLabel, { color: RED }]}>MONEY</Text>
                      <Text style={styles.cardTitle}>
                        Stretched week. {pressureItems.length} cost{pressureItems.length !== 1 ? "s" : ""} landing.
                      </Text>
                      <Text style={[styles.cardSub, { color: RED, fontStyle: "italic" }]}>Tap to see what's coming →</Text>
                    </View>
                    <View style={[styles.cardChevron, { backgroundColor: RED + "12" }]}>
                      <Feather name="chevron-right" size={16} color={RED} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            if (moneyTabState === "tight") {
              const topItem = [...pressureItems].sort((a, b) => a.dateStr.localeCompare(b.dateStr))[0];
              return (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/money")}
                  activeOpacity={0.8}
                  style={[styles.card, styles.cardNeutral, { borderLeftColor: GOLD, borderLeftWidth: 3 }]}
                >
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                      <Text style={styles.cardTitle}>
                        Tighter than usual{topItem ? ` — ${topItem.name} coming up` : ""}.
                      </Text>
                      <Text style={[styles.cardSub, { color: TEAL, fontStyle: "italic" }]}>Tap to see more →</Text>
                    </View>
                    <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
                      <Feather name="chevron-right" size={16} color={GOLD} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            // State 1 — calm
            return (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/money")}
                activeOpacity={0.8}
                style={[styles.card, styles.cardNeutral, { borderLeftColor: BORDER, borderLeftWidth: 3 }]}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: TEXT_MUTED }]}>MONEY</Text>
                    <Text style={styles.cardTitle}>Money looks fine this week.</Text>
                    <Text style={[styles.cardSub, { color: TEXT_MUTED, fontStyle: "italic" }]}>After meals, bills and fixed costs.</Text>
                  </View>
                  <View style={[styles.cardChevron, { backgroundColor: BORDER }]}>
                    <Feather name="chevron-right" size={16} color={TEXT_MUTED} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* D2 — What's Coming Up (Phase 5 synthesis) */}
          {(() => {
            // ── Helpers ──────────────────────────────────────────────
            const todayD = new Date(); todayD.setHours(0,0,0,0);
            const todayS = todayD.toISOString().split("T")[0]!;
            const tomS   = new Date(todayD.getTime() + 86_400_000).toISOString().split("T")[0]!;
            function dayLabelFrom(dateStr: string): string {
              if (dateStr === todayS) return "today";
              if (dateStr === tomS) return "tomorrow";
              const [y, m, d] = dateStr.split("-").map(Number);
              return new Date(y!, (m!-1), d!).toLocaleDateString("en-AU", { weekday: "long" });
            }
            function fmtTime(hhmm: string): string {
              const [hStr, mStr] = hhmm.split(":");
              const h = parseInt(hStr ?? "0", 10);
              const m = mStr ?? "00";
              const period = h < 12 ? "am" : "pm";
              const hr = h % 12 || 12;
              return m === "00" ? `${hr}${period}` : `${hr}:${m}${period}`;
            }

            // ── Build ordered items (max 4 non-meals, then always meals) ──
            interface SynthLine { text: string; color: string; key: string; route?: string }
            const lines: SynthLine[] = [];

            // P1: one-off bills due this week or next (0–14 days)
            const upcomingOneOff = allBills
              .filter((b) => !b.isPaid && b.billType === "oneOff" && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 14)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            for (const b of upcomingOneOff) {
              if (lines.length >= 3) break;
              lines.push({ text: `· ${b.title} — ${currencySymbol}${Math.round(b.amount)} — ${dayLabelFrom(b.dueDate)}`, color: GOLD, key: `bill-${b.id}`, route: "/(tabs)/bills" });
            }

            // P2: appointments with cost flag this week (0–7 days)
            const costAppts = allAppts
              .filter((a) => {
                if (a.isDone || a.isCancelled || !(a.appointmentCost && a.appointmentCost > 0)) return false;
                const [ay, am, ad] = a.date.split("-").map(Number);
                const diff = Math.floor((new Date(ay!, (am!-1), ad!).getTime() - todayD.getTime()) / 86_400_000);
                return diff >= 0 && diff <= 7;
              })
              .sort((a, b) => a.date.localeCompare(b.date));
            for (const a of costAppts) {
              if (lines.length >= 3) break;
              const personLabel = a.person ? ` (${a.person})` : "";
              lines.push({ text: `· ${a.title} — ${dayLabelFrom(a.date)} ${fmtTime(a.startTime)}${personLabel}`, color: GOLD, key: `appt-cost-${a.id}`, route: "/(tabs)/appointments" });
            }

            // P3: appointments with availability block, within 7 days
            const blockAppts = allAppts
              .filter((a) => {
                if (a.isDone || a.isCancelled || !a.availabilityBlock) return false;
                const [ay, am, ad] = a.date.split("-").map(Number);
                const diff = Math.floor((new Date(ay!, (am!-1), ad!).getTime() - todayD.getTime()) / 86_400_000);
                return diff >= 0 && diff <= 7;
              })
              .sort((a, b) => a.date.localeCompare(b.date));
            for (const a of blockAppts) {
              if (lines.length >= 3) break;
              lines.push({ text: `· ${a.person || "Someone"} unavailable ${dayLabelFrom(a.date)} — logistics flag`, color: TEAL, key: `appt-block-${a.id}`, route: "/(tabs)/appointments" });
            }

            // P4: family juggle auto-detected conflicts
            for (const cl of conflictLines) {
              if (lines.length >= 3) break;
              lines.push({ text: `· ${cl}`, color: TEAL, key: `conflict-${cl}`, route: "/(tabs)/family" });
            }

            // Always last: meals coverage
            const mealsText = `· ✅ ${plannedCount} dinner${plannedCount !== 1 ? "s" : ""} sorted this week`;

            // ── Render ────────────────────────────────────────────────
            if (lines.length === 0) {
              return (
                <View style={[styles.comingUpCard, { padding: 14 }]}>
                  <Text style={[styles.cardLabel, { color: TEXT_MUTED, marginBottom: 6 }]}>WHAT'S COMING UP</Text>
                  <Text style={[styles.comingUpLine, { color: TEXT_MUTED }]}>
                    A quiet one. Not much to worry about.
                  </Text>
                </View>
              );
            }

            return (
              <View style={{ gap: 4 }}>
                <Text style={[styles.sectionLabel, { color: GOLD, marginBottom: 2 }]}>WHAT'S COMING UP</Text>
                <View style={[styles.comingUpCard, { padding: 14, gap: 8 }]}>
                  {lines.slice(0, 4).map((item) => (
                    <TouchableOpacity key={item.key} onPress={item.route ? () => router.push(item.route as any) : undefined} activeOpacity={0.75}>
                      <Text style={[styles.comingUpLine, { color: item.color }]}>{item.text}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.comingUpLine, { color: TEAL }]}>{mealsText}</Text>
                </View>
              </View>
            );
          })()}

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
              : "Add something coming up →";
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
            const billColor  = "#2A8F88";
            const billTitle  = !billsData
              ? "No bills added yet."
              : billsData.overdue > 0
                ? `${billsData.overdue} bill${billsData.overdue > 1 ? "s" : ""} overdue.`
                : billsData.dueSoon > 0
                  ? `${billsData.dueSoon} bill${billsData.dueSoon > 1 ? "s" : ""} due this week.`
                  : "Nothing urgent on the bill front.";
            const billSub    = !billsData
              ? "Start tracking bills →"
              : billsData.overdue > 0
                ? "Tap to see what needs sorting →"
                : billsData.dueSoon > 0
                  ? `${currencySymbol}${billsData.total.toFixed(0)} due this week →`
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

          {/* Cross-sell nudge — one-time, priority-ordered */}
          {crossSellMsg && (
            <View style={[styles.crossSellCard, { borderLeftColor: crossSellMsg.color }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.crossSellTitle, { color: crossSellMsg.color }]}>
                  {crossSellMsg.title}
                </Text>
                <Text style={styles.crossSellSub}>{crossSellMsg.sub}</Text>
                <View style={styles.crossSellActions}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(crossSellMsg.route as any);
                    }}
                    activeOpacity={0.8}
                    style={[styles.crossSellCta, { backgroundColor: crossSellMsg.color }]}
                  >
                    <Text style={styles.crossSellCtaText}>Add your numbers →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      const uid = getCurrentUserId();
                      await AsyncStorage.setItem(SK.crossSellNudge(uid), JSON.stringify({ dismissedAt: Date.now() }));
                      setCrossSellMsg(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.crossSellDismiss}>Not now ×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={{ paddingBottom: 90 }} />
        </ScrollView>

        {/* Overwhelm mode — triggered by "Help me sort this" button */}
        <OverwhelmModal
          visible={showOverwhelm}
          pressureItems={pressureItems}
          apptsTodayTomorrow={apptsTodayTomorrow}
          tonightsDinner={tonightRecipe?.name ?? null}
          formatMoney={formatMoneyRound}
          dinnersPlanned={plannedCount}
          onBack={() => setShowOverwhelm(false)}
          onSeeEverything={() => { setShowOverwhelm(false); router.push("/(tabs)" as any); }}
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
  wordmarkLogo: { width: "100%", height: 44 },
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
  welcomeTip: {
    backgroundColor: TEAL_TINT,
    borderWidth: 1,
    borderColor: "rgba(42,143,136,0.2)",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  welcomeTipTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeTipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },
  welcomeTipBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    lineHeight: 20,
  },
  welcomeTipActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  welcomeTipCta: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: TEAL,
    borderRadius: 8,
  },
  welcomeTipCtaText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  welcomeTipDismiss: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },
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
  fridgeShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TEAL + "28",
    backgroundColor: TEAL + "07",
  },
  fridgeShortcutText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: TEAL,
  },
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
    flexDirection: "column",
    gap: 4,
  },
  comingUpLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    lineHeight: 19,
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

  // Cross-sell nudge
  crossSellCard: {
    borderRadius: 16,
    borderLeftWidth: 3,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginTop: 4,
    ...Platform.select({
      web: { boxShadow: "0px 1px 6px rgba(0,0,0,0.06)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 1,
      },
    }),
  },
  crossSellTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
    marginBottom: 4,
  },
  crossSellSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#776B5A",
    lineHeight: 18,
    marginBottom: 12,
  },
  crossSellActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  crossSellCta: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  crossSellCtaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  crossSellDismiss: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#AAA49A",
    textDecorationLine: "underline",
  },
});

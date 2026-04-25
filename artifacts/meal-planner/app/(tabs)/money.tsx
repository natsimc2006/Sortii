import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Animated,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { SK } from "@/utils/storageKeys";
import { getCurrentUserId } from "@/utils/currentUser";
import { usePlanner } from "@/context/PlannerContext";
import { useLocale } from "@/context/LocaleContext";
import { useUserWeek } from "@/context/UserWeekContext";
import {
  buildMoneyPage,
  MoneySuggestion,
  MoneyPageResult,
  WeeklyState,
  LifestyleSpendData,
} from "@/utils/yourWeekEngine";
import { getSwapsForRecipe } from "@/utils/getSwapsForRecipe";
import { SWAP_RULES } from "@/constants/swapRules";
import {
  getSavingsGoalCopy,
  goalPercent,
  weeksToGoalFromGoal,
} from "@/utils/savingsGoalCopy";
import type { SavingsGoal } from "@/utils/onboardingState";
import type { Recipe } from "@/constants/recipes";
import { loadBills, daysUntilDue, getOneOffBillsDueThisWeek, Bill } from "@/utils/billStore";
import { getAppointmentsWithCostThisWeek, loadAppointments, Appointment as ApptItem } from "@/utils/appointmentStore";
import OverwhelmModal from "@/components/OverwhelmModal";

const C = Colors.light;
const TEAL = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD = "#D29A22";
const RED = "#B86557";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const PLUM_BORDER = "rgba(94,58,76,0.20)";
const HERO_BG = "#E6F3F0";
const PAGE_BG = "#FFFFFF";

// ─── Pressure item type ───────────────────────────────────────
interface PressureItem {
  name: string;
  amount: number;
  dateStr: string;
}

function pressureDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, (m! - 1), d!);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return DAYS[date.getDay()] ?? dateStr;
}

// ─── Quick win confirm messages ───────────────────────────────

const WIN_CTA: Record<string, string> = {
  skip_takeaway:      "Give this a go",
  pause_subscription: "Try this",
  skip_coffee:        "Give this a go",
  grocery_trim:       "Apply this",
  skip_entertainment: "Give this a go",
  leftover_night:     "Apply this",
  eating_out_nomeal:  "Sort some dinners",
  freezer_check:      "Try this",
};

function confirmMsg(id: string, amount: number, fmt: (n: number) => string): string {
  switch (id) {
    case "skip_takeaway":      return `Nice. That freed up ${fmt(amount)}.`;
    case "pause_subscription": return "Sorted. One less subscription this week.";
    case "skip_coffee":        return "Done. Small win, but it adds up.";
    case "grocery_trim":       return "Good call. Smarter swaps, same dinners.";
    case "skip_entertainment": return "Done. Quiet win.";
    case "leftover_night":     return "Nice. That batch meal is earning its keep.";
    case "freezer_check":      return "Sorted. Free food you forgot about.";
    default:                   return `Done. A little extra breathing room.`;
  }
}

// ─── Stacked wins bar ────────────────────────────────────────

function escalatingHeadline(count: number): string {
  if (count === 1) return "Nice. Small win.";
  if (count <= 2) return "That's already helping.";
  return "You've quietly fixed a chunk of your week.";
}

function StackedWinsBar({
  total,
  count,
  fmt,
}: {
  total: number;
  count: number;
  fmt: (n: number) => string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevTotal = useRef(0);

  useEffect(() => {
    if (total > 0 && total !== prevTotal.current) {
      prevTotal.current = total;
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, tension: 260, friction: 7 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
      ]).start();
    }
  }, [total]);

  if (total <= 0 || count === 0) return null;

  return (
    <View style={styles.winsBar}>
      <Feather name="trending-up" size={14} color={TEAL} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.winsBarHeadline}>{escalatingHeadline(count)}</Text>
        <Animated.Text style={[styles.winsBarAmount, { transform: [{ scale }] }]}>
          +{fmt(total)} freed up this week
        </Animated.Text>
      </View>
    </View>
  );
}

// ─── Wins toast ───────────────────────────────────────────────

function WinsToast({
  message,
  bottomInset,
}: {
  message: string | null;
  bottomInset: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [displayMsg, setDisplayMsg] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setDisplayMsg(message);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 9 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setDisplayMsg(null);
      });
    }
  }, [message]);

  if (!displayMsg) return null;

  return (
    <Animated.View
      style={[
        styles.winsToast,
        { bottom: bottomInset + 16 },
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.winsToastText}>{displayMsg}</Text>
    </Animated.View>
  );
}

// ─── Status pill ────────────────────────────────────────────

function StatusPill({ state }: { state: WeeklyState | null }) {
  if (!state) return null;
  const MAP: Record<WeeklyState, string> = {
    over:  "Tight week",
    tight: "Tight week",
    ok:    "Holding steady",
    good:  "On track",
    great: "On track",
  };
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{MAP[state]}</Text>
    </View>
  );
}

// ─── 1. Hero Card ────────────────────────────────────────────

function HeroCard({
  estimatedDinnerSpend,
  dinnerPlanCost,
  weeklyState,
  fmt,
}: {
  estimatedDinnerSpend: number;
  dinnerPlanCost: number;
  weeklyState: WeeklyState | null;
  fmt: (n: number) => string;
}) {
  const total = Math.round(estimatedDinnerSpend - dinnerPlanCost);
  if (total <= 0 || !isFinite(total)) return null;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <Text style={styles.heroEyebrow}>THIS WEEK</Text>
        <StatusPill state={weeklyState} />
      </View>
      <Text style={styles.heroBigNumber}>~{fmt(total)}</Text>
      <Text style={styles.heroLabel}>saved this week vs. eating out</Text>
    </View>
  );
}

// ─── 2. Weekly Snapshot (collapsible) ────────────────────────

function WeeklySnapshotSection({
  money,
  result,
  lifestyleSpend,
  dinnerPlanCost,
  hasMealsSetup,
  fmt,
  appliedSavingsTotal,
  defaultOpen,
  collapsedSummaryLine,
}: {
  money: NonNullable<ReturnType<typeof useUserWeek>["money"]>;
  result: MoneyPageResult;
  lifestyleSpend: LifestyleSpendData | null;
  dinnerPlanCost: number;
  hasMealsSetup: boolean;
  fmt: (n: number) => string;
  appliedSavingsTotal: number;
  defaultOpen?: boolean;
  collapsedSummaryLine?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const { weeklyIncome, fixedWeeklyCosts, groceriesWeekly, eatingOutWeekly, otherWeeklySpend } = money;
  const { weeklyState } = result;
  const remaining = result.remaining + appliedSavingsTotal;
  const isNeg = remaining < 0;
  const remainingColor = isNeg ? C.danger : TEAL;

  const ls = lifestyleSpend ?? { streaming: 0, coffee: 0, entertainment: 0 };
  const coffeeSpend = ls.coffee;
  const showCoffeeNote =
    coffeeSpend > 0 &&
    hasMealsSetup &&
    dinnerPlanCost > 0 &&
    Math.abs(coffeeSpend - dinnerPlanCost) <= dinnerPlanCost * 0.2;

  return (
    <View style={styles.collapseCard}>
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        style={styles.collapseHeader}
        activeOpacity={0.7}
      >
        {!open && collapsedSummaryLine ? (
          <Text style={styles.snapshotSummaryLine} numberOfLines={1}>{collapsedSummaryLine}</Text>
        ) : (
          <Text style={styles.collapseTitle}>The quick version</Text>
        )}
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={styles.collapseBody}>
          <SnapshotRow label="Income" value={fmt(weeklyIncome)} />
          <SnapshotRow label="Fixed costs" value={fmt(fixedWeeklyCosts)} />
          <SnapshotRow label="Groceries" value={fmt(groceriesWeekly)} />
          {(eatingOutWeekly ?? 0) > 0 && (
            <SnapshotRow label="Eating out" value={fmt(eatingOutWeekly ?? 0)} />
          )}
          {(otherWeeklySpend ?? 0) > 0 && (
            <SnapshotRow label="Other spend" value={fmt(otherWeeklySpend ?? 0)} muted />
          )}

          {showCoffeeNote && (
            <View style={styles.coffeeNote}>
              <Text style={styles.coffeeNoteText}>
                Your coffee spend is close to your dinner plan this week.
              </Text>
            </View>
          )}

          <View style={styles.snapshotDivider} />

          <View style={styles.snapshotRow}>
            <Text style={[styles.snapshotLabel, { color: TEAL, fontFamily: "Inter_600SemiBold" }]}>
              Remaining
            </Text>
            <Text style={[styles.snapshotValue, { color: remainingColor, fontFamily: "Inter_700Bold" }]}>
              {isNeg ? `–${fmt(Math.abs(remaining))} over` : fmt(remaining)}
            </Text>
          </View>
          {appliedSavingsTotal > 0 && (
            <Text style={styles.appliedWinsNote}>
              ↑ {fmt(appliedSavingsTotal)} freed up by your easy wins
            </Text>
          )}
          {!isNeg && hasMealsSetup && (
            <Text style={styles.mealsCreditNote}>
              Meals planning is doing most of the work here.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function SnapshotRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.snapshotRow}>
      <Text style={[styles.snapshotLabel, muted && { color: C.textMuted }]}>{label}</Text>
      <Text style={[styles.snapshotValue, muted && { color: C.textMuted }]}>{value}</Text>
    </View>
  );
}

// ─── 3. Where Groceries Are Going (minimal, no card border) ──

function GroceriesSection({
  estimatedDinnerSpend,
  dinnerPlanCost,
  dinnerInsight,
  hasMealsSetup,
  numMeals,
  hasGroceries,
  fmt,
}: {
  estimatedDinnerSpend: number;
  dinnerPlanCost: number;
  dinnerInsight: string;
  hasMealsSetup: boolean;
  numMeals: number;
  hasGroceries: boolean;
  fmt: (n: number) => string;
}) {
  if (!hasGroceries) return null;

  const delta = Math.abs(estimatedDinnerSpend - dinnerPlanCost);
  const underEst = hasMealsSetup && dinnerPlanCost > 0 && dinnerPlanCost <= estimatedDinnerSpend;
  const dinnerInsightLine = hasMealsSetup && dinnerPlanCost > 0
    ? `${numMeals} of 7 dinners covered. ${underEst ? "Under" : "Over"} estimate by ${fmt(delta)}.`
    : dinnerInsight;

  return (
    <View style={styles.groceriesSection}>
      <Text style={styles.groceriesSectionTitle}>Where groceries are going</Text>

      <View style={styles.groceriesStatsRow}>
        <View style={styles.groceriesStat}>
          <Text style={styles.groceriesStatLabel}>Estimated grocery spend</Text>
          <Text style={styles.groceriesStatValue}>{fmt(estimatedDinnerSpend)}</Text>
        </View>
        {hasMealsSetup && dinnerPlanCost > 0 && (
          <>
            <View style={styles.groceriesStatDivider} />
            <View style={styles.groceriesStat}>
              <Text style={styles.groceriesStatLabel}>Your dinner plan</Text>
              <View style={styles.groceriesStatValueRow}>
                <Text style={[styles.groceriesStatValue, { color: TEAL }]}>
                  {fmt(dinnerPlanCost)}
                </Text>
                {underEst && (
                  <Text style={styles.groceriesTick}> ✓</Text>
                )}
              </View>
            </View>
          </>
        )}
      </View>

      <Text style={styles.groceriesInsight}>{dinnerInsightLine}</Text>
    </View>
  );
}

// ─── 4. Quick Wins — WinRow ───────────────────────────────────

function WinRow({
  s,
  fmt,
  applied,
  onApply,
  onUndo,
}: {
  s: MoneySuggestion;
  fmt: (n: number) => string;
  applied: boolean;
  onApply: () => void;
  onUndo: () => void;
}) {
  const showAmount = !s.isGoalProjection && !s.isMonthlyNudge && s.impactAmount > 0;
  const cta = WIN_CTA[s.id] ?? "Try this";

  return (
    <View style={[styles.quickWinsRow, applied && styles.quickWinsRowApplied]}>
      {applied ? (
        <View style={styles.quickWinsBadge}>
          <Text style={styles.quickWinsBadgeText}>✓</Text>
        </View>
      ) : (
        <Text style={styles.quickWinsArrow}>▸</Text>
      )}
      <View style={styles.quickWinsContent}>
        <Text style={[styles.quickWinsLabel, applied && styles.quickWinsLabelApplied]}>
          {s.label}
        </Text>
        {!applied && s.reason ? (
          <Text style={styles.quickWinsReason}>{s.reason}</Text>
        ) : null}
        {applied ? (
          <View style={styles.quickWinsCtaRow}>
            <Text style={styles.quickWinsConfirm}>Done. Nicely handled.</Text>
            <TouchableOpacity
              onPress={onUndo}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.quickWinsUndo}>Undo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.quickWinsCtaRow}>
            {showAmount && (
              <View style={styles.winAmountPill}>
                <Text style={styles.winAmountPillText}>~{fmt(s.impactAmount)}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={onApply}
              activeOpacity={0.75}
              style={styles.quickWinsCtaBtn}
            >
              <Text style={styles.quickWinsCtaBtnText}>{cta}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── 4. Quick Wins (collapsible) ──────────────────────────────

function QuickWinsSection({
  suggestions,
  fmt,
  defaultOpen,
  appliedWins,
  onApply,
  onUndo,
}: {
  suggestions: MoneySuggestion[];
  fmt: (n: number) => string;
  defaultOpen?: boolean;
  appliedWins: Map<string, number>;
  onApply: (id: string, amount: number) => void;
  onUndo: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const tips = suggestions.slice(0, 3);
  if (tips.length === 0) return null;

  return (
    <View style={styles.quickWinsWrap}>
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        style={styles.quickWinsHeader}
        activeOpacity={0.7}
      >
        <Text style={styles.quickWinsTitle}>💡 A few quick wins</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={17} color={PLUM} />
      </TouchableOpacity>

      {open && (
        <View style={styles.quickWinsBody}>
          {tips.map((s) => (
            <WinRow
              key={s.id}
              s={s}
              fmt={fmt}
              applied={appliedWins.has(s.id)}
              onApply={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onApply(s.id, s.impactAmount);
              }}
              onUndo={() => onUndo(s.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── 5. Savings Goal Card ─────────────────────────────────────

function SavingsGoalCard({
  goal,
  weeklyDinnerSaving,
  fmt,
  onUpdate,
}: {
  goal: SavingsGoal;
  weeklyDinnerSaving: number;
  fmt: (n: number) => string;
  onUpdate: () => void;
}) {
  const pct = goalPercent(goal);
  const pctDisplay = Math.round(pct * 100);
  const weeksLeft = weeksToGoalFromGoal(goal, weeklyDinnerSaving);
  const copy = getSavingsGoalCopy(goal, weeklyDinnerSaving);

  return (
    <View style={styles.goalCard}>
      {/* Top row: emoji + name + percent */}
      <View style={styles.goalTopRow}>
        <Text style={styles.goalEmoji}>{goal.emoji}</Text>
        <Text style={styles.goalName}>{goal.name}</Text>
        <Text style={styles.goalPct}>{pctDisplay}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, pctDisplay)}%` as any }]} />
      </View>

      {/* Dynamic copy — italic, plum */}
      {copy ? <Text style={styles.goalCopy}>{copy}</Text> : null}

      {/* Saved row */}
      <View style={styles.goalSavedRow}>
        <Text style={styles.goalSavedLabel}>
          {fmt(Math.round(goal.currentSaved))} of {fmt(goal.targetAmount)} saved
        </Text>
      </View>

      {/* This week row */}
      <View style={styles.goalWeekRow}>
        {weeklyDinnerSaving > 0 && (
          <Text style={styles.goalWeekLeft}>
            This week added ~{fmt(Math.round(weeklyDinnerSaving))}
          </Text>
        )}
        {weeksLeft !== null && weeksLeft > 0 && (
          <Text style={styles.goalWeekRight}>{weeksLeft} weeks to go</Text>
        )}
      </View>

      {/* Update goal link */}
      <TouchableOpacity onPress={onUpdate} style={styles.updateGoalLink}>
        <Text style={styles.updateGoalLinkText}>Update goal</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Meal Plan Saving Card ───────────────────────────────────

function MealPlanSavingCard({
  mealsPlanned,
  weeklyGroceryEstimate,
  fmt,
}: {
  mealsPlanned: number;
  weeklyGroceryEstimate: number;
  fmt: (n: number) => string;
}) {
  // Never show the card when no dinners are planned
  if (mealsPlanned === 0) return null;

  const usualSpendPerMeal      = weeklyGroceryEstimate / 7;
  const typicalTakeawayPerMeal = usualSpendPerMeal * 1.8;
  const estimatedSaving        = Math.round(mealsPlanned * (typicalTakeawayPerMeal - usualSpendPerMeal));
  const fullWeekSaving         = Math.round(7 * (typicalTakeawayPerMeal - usualSpendPerMeal));

  if (estimatedSaving <= 0 || !isFinite(estimatedSaving)) return null;

  const savingCopy = mealsPlanned === 7
    ? "Cooking all 7 — full saving unlocked."
    : `Cooking ${mealsPlanned} of 7 dinners this week.`;
  const savingSubtext = mealsPlanned < 7
    ? `Add more to unlock the full ~${fmt(fullWeekSaving)} saving.`
    : null;

  return (
    <View style={styles.mealSavingCard}>
      <Text style={styles.mealSavingEyebrow}>THIS WEEK'S DINNER SAVING</Text>
      <Text style={styles.mealSavingBig}>~{fmt(estimatedSaving)}</Text>
      <Text style={styles.mealSavingDesc}>{savingCopy}</Text>
      {savingSubtext ? (
        <Text style={styles.mealSavingAppend}>{savingSubtext}</Text>
      ) : null}
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────

function MoneyEmptyState({ onSetup, onDismiss }: { onSetup: () => void; onDismiss: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyNudgeCard}>
        <Text style={styles.emptyNudgeHeadline}>Want to see what this week costs?</Text>
        <Text style={styles.emptyNudgeSub}>
          Set a rough budget and we'll keep an eye on it.
        </Text>
        <View style={styles.emptyNudgeActions}>
          <TouchableOpacity
            onPress={onSetup}
            activeOpacity={0.85}
            style={styles.emptyNudgeBtn}
          >
            <Text style={styles.emptyNudgeBtnText}>Set it up →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} style={styles.emptyNudgeLater}>
            <Text style={styles.emptyNudgeLaterText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MoneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, getRecipeById, preferences } = usePlanner();
  const { formatMoneyRound } = useLocale();
  const {
    weeklyMode, goal, hasMealsSetup, hasMoneySetup,
    money, lifestyleSpend, savingsGoal, isLoaded,
  } = useUserWeek();

  // Applied quick wins (id → impactAmount)
  const [appliedWins, setAppliedWins] = useState<Map<string, number>>(new Map());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bills due this week (legacy counts used by bills-note card — kept for now)
  const [billsTotalThisWeek, setBillsTotalThisWeek] = useState(0);
  const [billsCountThisWeek, setBillsCountThisWeek] = useState(0);

  // Phase 3 — pressure data
  const [oneOffBillsThisWeek, setOneOffBillsThisWeek] = useState<Bill[]>([]);
  const [apptCostsThisWeek, setApptCostsThisWeek] = useState<ApptItem[]>([]);

  // Phase 4 — Overwhelm mode
  const [showOverwhelm, setShowOverwhelm] = useState(false);

  // Inline "What could give this week?" expansion (stretched state)
  const [showCanWait, setShowCanWait] = useState(false);
  const [allAppts, setAllAppts] = useState<ApptItem[]>([]);

  // Money nudge dismiss state
  const [nudgeHidden, setNudgeHidden] = useState(false);

  // Snapshot default-open for first-time visitors
  const [snapshotDefaultOpen, setSnapshotDefaultOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    // First-visit snapshot expand tracking
    const uid = getCurrentUserId();
    AsyncStorage.getItem(SK.snapshotSeen(uid)).then((raw) => {
      if (!raw) {
        setSnapshotDefaultOpen(true);
        AsyncStorage.setItem(SK.snapshotSeen(uid), "1").catch(() => {});
      } else {
        setSnapshotDefaultOpen(false);
      }
    }).catch(() => {});

    // Bills due this week (all bills for legacy note card)
    loadBills().then((bills) => {
      const dueSoon = bills.filter((b) => !b.isPaid && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7);
      setBillsCountThisWeek(dueSoon.length);
      setBillsTotalThisWeek(dueSoon.reduce((s, b) => s + b.amount, 0));
    }).catch(() => {});

    // Phase 3 — one-off bills + appointment costs
    getOneOffBillsDueThisWeek().then(setOneOffBillsThisWeek).catch(() => {});
    getAppointmentsWithCostThisWeek().then(setApptCostsThisWeek).catch(() => {});

    // Phase 4 — load all appointments for overwhelm mode today/tomorrow filter
    loadAppointments().then(setAllAppts).catch(() => {});

    // Check nudge dismiss state
    AsyncStorage.getItem(SK.moneyNudge(uid)).then((raw) => {
      if (!raw) { setNudgeHidden(false); return; }
      try {
        const { dismissedAt, dismissCount } = JSON.parse(raw) as { dismissedAt: number; dismissCount: number };
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) { setNudgeHidden(true); return; }
        if (dismissCount >= 2) { setNudgeHidden(true); return; }
        setNudgeHidden(false);
      } catch { setNudgeHidden(false); }
    }).catch(() => {});
  }, []));

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };

  const applyWin = (id: string, amount: number) => {
    setAppliedWins((prev) => new Map(prev).set(id, amount));
    showToast(confirmMsg(id, amount, formatMoneyRound));
  };

  const undoWin = (id: string) => {
    setAppliedWins((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(null);
  };

  const appliedSavingsTotal = Array.from(appliedWins.values()).reduce((a, b) => a + b, 0);

  const goToMeals = () => {
    Haptics.selectionAsync();
    router.push("/(tabs)/meals");
  };

  const paddingTop = Platform.OS === "web" ? 24 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 60 : insets.bottom + 80;

  const goToMoneySetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
  };

  const handleNudgeDismiss = async () => {
    try {
      const uid = getCurrentUserId();
      const raw = await AsyncStorage.getItem(SK.moneyNudge(uid));
      const existing = raw ? JSON.parse(raw) : { dismissCount: 0 };
      await AsyncStorage.setItem(SK.moneyNudge(uid), JSON.stringify({
        dismissedAt: Date.now(),
        dismissCount: (existing.dismissCount ?? 0) + 1,
      }));
    } catch {}
    setNudgeHidden(true);
  };

  const goToGoalSetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/goal-setup");
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/your-week");
  };

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { paddingTop }]}>
        <ActivityIndicator color={TEAL} />
      </View>
    );
  }

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const dinnerPlanCost = filledMeals.reduce((sum, entry) => {
    const recipe = getRecipeById(entry.recipeId!);
    const cost = recipe?.costPerServe ?? recipe?.costPerServeAUD ?? 0;
    return sum + cost * (preferences.householdSize ?? 4);
  }, 0);

  // ── Sortii savings ──
  const swapSavings = (() => {
    const ruleCount: Record<string, number> = {};
    for (const entry of filledMeals) {
      const recipe = getRecipeById(entry.recipeId!) as Recipe | null;
      if (!recipe) continue;
      const matched = getSwapsForRecipe(recipe.ingredients.map((i) => i.name));
      for (const swap of matched) {
        ruleCount[swap.id] = (ruleCount[swap.id] ?? 0) + 1;
      }
    }
    return Object.entries(ruleCount).reduce((sum, [ruleId, count]) => {
      const rule = SWAP_RULES.find((r) => r.id === ruleId);
      return rule ? sum + rule.savingPerServeAUD * (preferences.householdSize ?? 4) * count : sum;
    }, 0);
  })();

  const pantryEfficiency = filledMeals.filter((e) => {
    const r = getRecipeById(e.recipeId!) as Recipe | null;
    return r && (r.batchCook || r.leftoversFriendly);
  }).length * 1.8 * (preferences.householdSize ?? 4);

  const weeklySortiiSaving = swapSavings + pantryEfficiency;

  const hasBatchMeal = filledMeals.some((e) => {
    const r = getRecipeById(e.recipeId!) as Recipe | null;
    return r && (r.batchCook || r.leftoversFriendly);
  });

  const result = buildMoneyPage(
    {
      weeklyMode,
      goal,
      hasMealsSetup,
      hasMoneySetup,
      meals: hasMealsSetup
        ? { dinnersPlanned: filledMeals.length, dinnerPlanCost, householdSize: preferences.householdSize }
        : null,
      money,
    },
    dinnerPlanCost,
    weeklySortiiSaving,
    lifestyleSpend,
    hasBatchMeal,
    formatMoneyRound,
  );

  // ── Phase 3 — pressure calculations ───────────────────────────────────────
  const pressureItems: PressureItem[] = [
    ...oneOffBillsThisWeek.map((b) => ({ name: b.title, amount: b.amount, dateStr: b.dueDate })),
    ...apptCostsThisWeek.map((a) => ({ name: a.title, amount: a.appointmentCost!, dateStr: a.date })),
  ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const weeklyBreathingRoom = money ? result.remaining + appliedSavingsTotal : 0;
  const pressureTotal = pressureItems.reduce((s, p) => s + p.amount, 0);
  const adjustedBreathingRoom = weeklyBreathingRoom - pressureTotal;
  type MoneyTabState = "calm" | "tight" | "stretched";
  const moneyTabState: MoneyTabState = hasMoneySetup
    ? adjustedBreathingRoom > 50 ? "calm"
      : adjustedBreathingRoom >= 1 ? "tight"
      : "stretched"
    : "calm"; // irrelevant when no setup

  // ── Phase 4 — Overwhelm mode computed data ─────────────────────
  const JS_DAY_TO_SORTII = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ] as const;
  const todayDayName = JS_DAY_TO_SORTII[new Date().getDay()];
  const tonightEntry = currentPlan.find(
    (e) => e.day === todayDayName && e.slot === "dinner",
  );
  const tonightsRecipe = tonightEntry?.recipeId
    ? getRecipeById(tonightEntry.recipeId)
    : null;
  const tonightsDinner: string | null = tonightsRecipe?.name ?? null;

  const _today = new Date(); _today.setHours(0, 0, 0, 0);
  const _tomorrow = new Date(_today); _tomorrow.setDate(_today.getDate() + 1);
  const _todayStr = _today.toISOString().split("T")[0]!;
  const _tomorrowStr = _tomorrow.toISOString().split("T")[0]!;
  const todayTomorrowAppts = allAppts.filter(
    (a) =>
      !a.isDone &&
      !a.isCancelled &&
      (a.date === _todayStr || a.date === _tomorrowStr),
  ).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime),
  );

  // Shared "full picture" section (State 2 always-visible)
  const fullPictureSection = (
    <>
      {money && (
        <WeeklySnapshotSection
          money={money}
          result={result}
          lifestyleSpend={lifestyleSpend}
          dinnerPlanCost={dinnerPlanCost}
          hasMealsSetup={hasMealsSetup}
          fmt={formatMoneyRound}
          appliedSavingsTotal={appliedSavingsTotal}
          defaultOpen={snapshotDefaultOpen}
        />
      )}
      <QuickWinsSection
        suggestions={result.suggestions}
        fmt={formatMoneyRound}
        appliedWins={appliedWins}
        onApply={applyWin}
        onUndo={undoWin}
      />
      <StackedWinsBar total={appliedSavingsTotal} count={appliedWins.size} fmt={formatMoneyRound} />
      {savingsGoal ? (
        <SavingsGoalCard
          goal={savingsGoal}
          weeklyDinnerSaving={weeklySortiiSaving}
          fmt={formatMoneyRound}
          onUpdate={goToGoalSetup}
        />
      ) : (
        <TouchableOpacity onPress={goToGoalSetup} activeOpacity={0.7} style={styles.setGoalLink}>
          <Text style={styles.setGoalLinkText}>Set a savings goal →</Text>
        </TouchableOpacity>
      )}
      <View style={styles.updateCtaWrap}>
        <Text style={styles.updateCtaLabel}>Your numbers, your call. Update anytime.</Text>
        <TouchableOpacity onPress={goToMoneySetup} activeOpacity={0.85} style={styles.updateCtaBtn}>
          <Text style={styles.updateCtaBtnText}>Update my numbers</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Money</Text>
        {hasMoneySetup ? (
          <Text style={styles.pageSubtitle}>
            {moneyTabState === "calm"      ? "This week's fine. Nothing to worry about."
            : moneyTabState === "tight"    ? "A bit tight this week. Worth knowing."
            : adjustedBreathingRoom < 0   ? "This one needs attention."
            :                               "This week needs a look."}
          </Text>
        ) : (
          <Text style={styles.pageSubtitle}>
            Here's where your money sits this week.
          </Text>
        )}
      </View>

      {/* Quick-access chips */}
      {hasMoneySetup && (
        <View style={styles.quickChipsRow}>
          <TouchableOpacity onPress={goToMoneySetup} style={styles.quickChip} activeOpacity={0.75}>
            <Text style={styles.quickChipText}>Tweak numbers</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToGoalSetup} style={styles.quickChip} activeOpacity={0.75}>
            <Text style={styles.quickChipText}>Savings goal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── No budget set ── */}
      {!hasMoneySetup && !nudgeHidden ? (
        <MoneyEmptyState onSetup={goToMoneySetup} onDismiss={handleNudgeDismiss} />

      ) : !hasMoneySetup ? null : moneyTabState === "calm" ? (
        /* ── STATE 1 — Calm ──────────────────────────────────── */
        <>
          {/* 1. Hero card — breathing room front and centre */}
          <View style={styles.calmHeroCard}>
            <View style={styles.calmHeroTopRow}>
              <Text style={styles.calmHeroEyebrow}>THIS WEEK</Text>
              <View style={styles.calmBadge}>
                <Text style={styles.calmBadgeText}>All good ✓</Text>
              </View>
            </View>
            <Text style={styles.calmHeroBig}>
              ~{formatMoneyRound(Math.max(0, adjustedBreathingRoom))}
            </Text>
            <Text style={styles.calmHeroLabel}>breathing room this week</Text>
            <Text style={styles.calmSubtext}>
              {adjustedBreathingRoom > 100
                ? "Solid week. Nothing unexpected landing."
                : "A little tight but workable."}
            </Text>
          </View>

          {/* 2. Meal plan saving card */}
          <MealPlanSavingCard
            mealsPlanned={filledMeals.length}
            weeklyGroceryEstimate={money && money.groceriesWeekly > 0 ? money.groceriesWeekly : (money?.weeklyIncome ?? 0) * 0.65}
            fmt={formatMoneyRound}
          />

          {/* 3. Snapshot — collapsed with summary line */}
          {money && (() => {
            const remaining = result.remaining + appliedSavingsTotal;
            const summaryLine = `Income ${formatMoneyRound(money.weeklyIncome)} · Fixed ${formatMoneyRound(money.fixedWeeklyCosts)} · Left ~${formatMoneyRound(Math.max(0, remaining))}`;
            return (
              <WeeklySnapshotSection
                money={money}
                result={result}
                lifestyleSpend={lifestyleSpend}
                dinnerPlanCost={dinnerPlanCost}
                hasMealsSetup={hasMealsSetup}
                fmt={formatMoneyRound}
                appliedSavingsTotal={appliedSavingsTotal}
                defaultOpen={false}
                collapsedSummaryLine={summaryLine}
              />
            );
          })()}

          {/* 4. Quick wins — expanded by default in State 1 */}
          <QuickWinsSection
            suggestions={result.suggestions}
            fmt={formatMoneyRound}
            defaultOpen={true}
            appliedWins={appliedWins}
            onApply={applyWin}
            onUndo={undoWin}
          />

          {/* 4b. Stacked wins bar — appears as wins accumulate */}
          <StackedWinsBar total={appliedSavingsTotal} count={appliedWins.size} fmt={formatMoneyRound} />

          {/* 5. Savings goal card or quiet prompt */}
          {savingsGoal ? (
            <SavingsGoalCard
              goal={savingsGoal}
              weeklyDinnerSaving={weeklySortiiSaving}
              fmt={formatMoneyRound}
              onUpdate={goToGoalSetup}
            />
          ) : (
            <View style={styles.quietGoalPrompt}>
              <Text style={styles.quietGoalPromptText}>
                Got something you're saving for?{" "}
                <Text style={styles.quietGoalPromptLink} onPress={goToGoalSetup}>Set a goal →</Text>
              </Text>
            </View>
          )}

          {/* 6. Persistent "Update my numbers" button */}
          <TouchableOpacity
            onPress={goToMoneySetup}
            activeOpacity={0.85}
            style={styles.updateMyNumbersBtn}
          >
            <Text style={styles.updateMyNumbersBtnText}>Update my numbers →</Text>
          </TouchableOpacity>
        </>

      ) : moneyTabState === "tight" ? (
        /* ── STATE 2 — Tight ─────────────────────────────────── */
        <>
          <View style={styles.tightCard}>
            <View style={styles.calmHeroTopRow}>
              <Text style={styles.calmHeroEyebrow}>THIS WEEK</Text>
              <View style={[styles.calmBadge, { backgroundColor: GOLD + "22", borderColor: GOLD + "55" }]}>
                <Text style={[styles.calmBadgeText, { color: GOLD }]}>Keep an eye on it</Text>
              </View>
            </View>
            <Text style={[styles.calmHeroBig, { fontSize: 20, marginTop: 8 }]}>
              ~{formatMoneyRound(Math.max(0, adjustedBreathingRoom))} left. Tight but possible.
            </Text>
            <Text style={[styles.calmSubtext, { color: GOLD }]}>
              One unplanned thing and it tips. Worth knowing.
            </Text>

            {pressureItems.length > 0 && (
              <View style={[styles.pressureList, { marginTop: 10 }]}>
                {pressureItems.map((p, i) => (
                  <Text key={i} style={styles.pressureItem}>
                    · {p.name} — {formatMoneyRound(p.amount)} due {pressureDayLabel(p.dateStr)}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <MealPlanSavingCard
            mealsPlanned={filledMeals.length}
            weeklyGroceryEstimate={money && money.groceriesWeekly > 0 ? money.groceriesWeekly : (money?.weeklyIncome ?? 0) * 0.65}
            fmt={formatMoneyRound}
          />

          {fullPictureSection}
        </>

      ) : (
        /* ── STATE 3 — Stretched ─────────────────────────────── */
        <>
          {/* Hero card with red left accent border */}
          <View style={[styles.stretchedCard, { borderLeftColor: RED, borderLeftWidth: 4 }]}>
            <Text style={styles.stretchedHeading}>This week is stretched.</Text>
            <Text style={[styles.stretchedSubtext, { marginTop: 4 }]}>
              You're ~{formatMoneyRound(Math.abs(adjustedBreathingRoom))} over on paper.
            </Text>
            <Text style={[styles.stretchedReassurance, { marginTop: 6 }]}>
              Here's what's hitting all at once.
            </Text>

            {pressureItems.length > 0 && (
              <View style={styles.pressureList}>
                {pressureItems.slice(0, 4).map((p, i) => (
                  <Text key={i} style={styles.pressureItem}>
                    · {p.name} — {formatMoneyRound(p.amount)} — {pressureDayLabel(p.dateStr)}
                  </Text>
                ))}
                {pressureItems.length > 4 && (
                  <Text style={styles.pressureMore}>· +{pressureItems.length - 4} more</Text>
                )}
              </View>
            )}

            {/* Inline toggle — "Want to see what can wait?" */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.overwhelmLink}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCanWait((v) => !v);
              }}
            >
              <Text style={styles.overwhelmLinkText}>
                {showCanWait ? "Hide ↑" : "Want to see what can wait? →"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline expansion — "What could give this week?" */}
          {showCanWait && (() => {
            const discretionary: { name: string; weekly: number; action: string }[] = [];
            const ls = lifestyleSpend;
            if ((ls?.entertainment ?? 0) > 0)
              discretionary.push({ name: "Entertainment", weekly: Math.round((ls!.entertainment) / 4.33), action: "Pause this →" });
            if ((money?.eatingOutWeekly ?? 0) > 0)
              discretionary.push({ name: "Takeaway", weekly: Math.round(money!.eatingOutWeekly!), action: "Cut back →" });
            if ((ls?.coffee ?? 0) > 0)
              discretionary.push({ name: "Coffee & café", weekly: Math.round(ls!.coffee), action: "Skip a few →" });
            discretionary.sort((a, b) => b.weekly - a.weekly);
            return (
              <View style={styles.canWaitPanel}>
                <Text style={styles.canWaitTitle}>What could give this week?</Text>
                {discretionary.length === 0 ? (
                  <Text style={styles.canWaitEmpty}>No lifestyle spend entered yet.</Text>
                ) : discretionary.map((item) => (
                  <View key={item.name} style={styles.canWaitRow}>
                    <Text style={styles.canWaitName}>{item.name}</Text>
                    <Text style={styles.canWaitAmount}>~{formatMoneyRound(item.weekly)}</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setToastMsg(`Good call. That's ~${formatMoneyRound(item.weekly)} back this week.`);
                        if (toastTimer.current) clearTimeout(toastTimer.current);
                        toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
                      }}
                    >
                      <Text style={styles.canWaitAction}>{item.action}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={styles.canWaitFooter}>
                  These are optional. Committed costs — mortgage, bills, groceries — stay.
                </Text>
              </View>
            );
          })()}

          <MealPlanSavingCard
            mealsPlanned={filledMeals.length}
            weeklyGroceryEstimate={money && money.groceriesWeekly > 0 ? money.groceriesWeekly : (money?.weeklyIncome ?? 0) * 0.65}
            fmt={formatMoneyRound}
          />
        </>
      )}
    </ScrollView>
    <WinsToast message={toastMsg} bottomInset={paddingBottom} />

    {/* Phase 4 — Overwhelm Mode overlay */}
    <OverwhelmModal
      visible={showOverwhelm}
      pressureItems={pressureItems}
      apptsTodayTomorrow={todayTomorrowAppts}
      tonightsDinner={tonightsDinner}
      dinnersPlanned={filledMeals.length}
      formatMoney={formatMoneyRound}
      onBack={() => {
        setShowOverwhelm(false);
        router.push("/(tabs)");
      }}
      onSeeEverything={() => {
        setShowOverwhelm(false);
        router.push("/(tabs)");
      }}
      onDinnerPress={() => {
        setShowOverwhelm(false);
        router.push("/(tabs)/meals");
      }}
    />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 14,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  // Quick-access chips
  quickChipsRow: {
    flexDirection: "row", gap: 8, marginTop: -4,
  },
  quickChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: TEAL, backgroundColor: "#fff",
  },
  quickChipText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL,
  },

  // Header
  pageHeader: { gap: 4, marginBottom: 4 },
  pageTitle: {
    fontSize: 28, fontFamily: "DMSans_700Bold",
    color: C.text, letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 20,
  },

  // Status pill
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: TEAL,
  },
  statusPillText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff",
  },

  // 1. Hero card
  heroCard: {
    borderRadius: 20,
    backgroundColor: HERO_BG,
    borderWidth: 1.5,
    borderColor: "rgba(42,143,136,0.28)",
    padding: 20,
    gap: 6,
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(42,143,136,0.12)" },
      default: {
        shadowColor: TEAL, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
      },
    }),
  },
  heroTopRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  heroEyebrow: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: TEAL, textTransform: "uppercase", letterSpacing: 0.8,
  },
  heroBigNumber: {
    fontSize: 34, fontFamily: "DMSans_700Bold",
    color: TEAL, lineHeight: 42,
  },
  heroLabel: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#3A6E6A", lineHeight: 20, marginBottom: 4,
  },
  heroDivider: {
    height: 1, backgroundColor: "rgba(42,143,136,0.20)", marginVertical: 6,
  },
  heroLineItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  heroLineLabel: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "#3A6E6A", flex: 1,
  },
  heroLineValue: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL,
  },
  heroDisclaimer: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(42,143,136,0.60)", marginTop: 6, fontStyle: "italic",
  },
  heroNoMealsHint: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(42,143,136,0.65)", fontStyle: "italic", marginTop: 4,
  },

  // 2. Weekly Snapshot (collapsible card)
  collapseCard: {
    borderRadius: 16, backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: C.border,
    overflow: "hidden",
  },
  collapseHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
  },
  collapseTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text,
  },
  collapseBody: {
    paddingHorizontal: 18, paddingBottom: 16, gap: 4,
  },
  snapshotRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 4,
  },
  snapshotLabel: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: C.textSecondary, flex: 1,
  },
  snapshotValue: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: C.text,
  },
  snapshotDivider: {
    height: 1, backgroundColor: C.border, marginVertical: 6,
  },
  coffeeNote: {
    backgroundColor: "#FEF8E7", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginVertical: 4,
    borderLeftWidth: 2, borderLeftColor: GOLD,
  },
  coffeeNoteText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "#8A6200", lineHeight: 17, fontStyle: "italic",
  },

  // 3. Groceries section (minimal, no border)
  groceriesSection: {
    gap: 10, paddingVertical: 4,
  },
  groceriesSectionTitle: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.6,
  },
  groceriesStatsRow: {
    flexDirection: "row", alignItems: "flex-start",
  },
  groceriesStat: { flex: 1, gap: 3 },
  groceriesStatDivider: {
    width: 1, backgroundColor: C.border, marginHorizontal: 16, alignSelf: "stretch",
  },
  groceriesStatLabel: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, lineHeight: 16,
  },
  groceriesStatValueRow: { flexDirection: "row", alignItems: "center" },
  groceriesStatValue: {
    fontSize: 22, fontFamily: "DMSans_700Bold", color: C.text, lineHeight: 28,
  },
  groceriesTick: {
    fontSize: 16, color: TEAL, marginLeft: 4, fontFamily: "Inter_700Bold",
  },
  groceriesInsight: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: C.textSecondary, lineHeight: 20,
  },

  // 4. Quick wins
  quickWinsWrap: {
    borderRadius: 16, backgroundColor: PLUM_TINT,
    borderWidth: 1.5, borderColor: "rgba(94,58,76,0.18)", overflow: "hidden",
  },
  quickWinsHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
  },
  quickWinsTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: PLUM,
  },
  quickWinsBody: {
    paddingHorizontal: 18, paddingBottom: 16, gap: 12,
  },
  quickWinsIntro: {
    fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic",
    color: PLUM, lineHeight: 18, marginBottom: 4, opacity: 0.75,
  },
  quickWinsRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  quickWinsArrow: {
    fontSize: 13, color: PLUM, marginTop: 2, fontFamily: "Inter_600SemiBold",
  },
  quickWinsContent: { flex: 1, gap: 2, marginRight: 8 },
  winAmountPill: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: "center",
  },
  winAmountPillText: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff",
  },
  quickWinsLabel: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: C.text, lineHeight: 20,
  },
  quickWinsReason: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textMuted, lineHeight: 17, fontStyle: "italic",
  },
  quickWinsImpact: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: PLUM,
  },
  quickWinsCtaRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4,
  },
  quickWinsCtaBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    backgroundColor: TEAL,
    ...Platform.select({
      web: { boxShadow: "0px 2px 6px rgba(42,143,136,0.28)" },
      default: {
        shadowColor: TEAL,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
        elevation: 2,
      },
    }),
  },
  quickWinsCtaBtnText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  quickWinsRowApplied: {
    opacity: 0.85,
  },
  quickWinsLabelApplied: {
    color: C.textMuted,
  },
  quickWinsConfirm: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL,
    fontStyle: "italic", lineHeight: 18, marginTop: 2,
  },
  quickWinsUndo: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textMuted, textDecorationLine: "underline", marginTop: 3,
  },
  quickWinsBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: TEAL, alignItems: "center", justifyContent: "center",
  },
  quickWinsBadgeText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff",
  },
  appliedWinsNote: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL,
    fontStyle: "italic", marginTop: 2,
  },
  quickWinsMealLink: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL,
    textDecorationLine: "underline", marginTop: 2,
  },

  // Stacked wins bar
  winsBar: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#E6F3F0", borderRadius: 14,
    borderWidth: 1.5, borderColor: "rgba(42,143,136,0.22)",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  winsBarHeadline: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "#1C6860", lineHeight: 18,
  },
  winsBarAmount: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: TEAL,
  },

  // Bills note card
  billsNoteCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFCF5",
    gap: 4,
  },
  billsNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  billsNoteLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#555",
  },
  billsNoteAmount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  billsNoteSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },

  // Wins toast
  winsToast: {
    position: "absolute",
    left: 24, right: 24,
    backgroundColor: "#1A5C57",
    borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 12,
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 6px 20px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  winsToastText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff",
    textAlign: "center",
  },

  // 5. Savings goal card
  goalCard: {
    borderRadius: 18, backgroundColor: PLUM_TINT,
    borderWidth: 1.5, borderColor: PLUM_BORDER, padding: 20, gap: 10,
  },
  goalTopRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  goalEmoji: { fontSize: 22 },
  goalName: {
    flex: 1, fontSize: 16, fontFamily: "DMSans_700Bold", color: PLUM,
  },
  goalPct: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: PLUM,
  },
  progressBarTrack: {
    height: 8, borderRadius: 6, backgroundColor: "rgba(94,58,76,0.15)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8, borderRadius: 6, backgroundColor: GOLD,
  },
  goalCopy: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: PLUM, fontStyle: "italic", lineHeight: 19,
  },
  goalSavedRow: { marginTop: 2 },
  goalSavedLabel: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary,
  },
  goalWeekRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  goalWeekLeft: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary,
  },
  goalWeekRight: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: PLUM,
  },
  updateGoalLink: { alignSelf: "flex-start", marginTop: 4 },
  updateGoalLinkText: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL,
    textDecorationLine: "underline",
  },

  // Set goal text link (when no goal set)
  setGoalLink: {
    alignItems: "center", paddingVertical: 6,
  },
  setGoalLinkText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: TEAL,
    textDecorationLine: "underline",
  },
  mealsCreditNote: {
    fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic",
    color: C.textMuted, marginTop: 6, lineHeight: 17,
  },

  // 6. Update CTA
  updateCtaWrap: {
    gap: 10, marginTop: 4,
  },
  updateCtaLabel: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textMuted, textAlign: "center",
  },
  updateCtaBtn: {
    backgroundColor: TEAL, borderRadius: 16,
    paddingVertical: 18, alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 16px rgba(42,143,136,0.28)" },
      default: {
        shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 14, elevation: 5,
      },
    }),
  },
  updateCtaBtnText: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff",
  },

  // Empty state
  emptyState: {
    alignItems: "center", gap: 12,
    paddingVertical: 32, paddingHorizontal: 16,
  },
  emptyNudgeCard: {
    backgroundColor: "#FFFCF5",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(210,154,34,0.3)",
    padding: 20,
    gap: 10,
    width: "100%",
  },
  emptyNudgeHeadline: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: C.text,
    lineHeight: 26,
  },
  emptyNudgeSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 20,
  },
  emptyNudgeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  emptyNudgeBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyNudgeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyNudgeLater: {
    paddingVertical: 4,
  },
  emptyNudgeLaterText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },

  // ── Phase 3 — STATE 1: Calm ──────────────────────────────────
  calmHeroCard: {
    borderRadius: 20,
    backgroundColor: HERO_BG,
    borderWidth: 1.5,
    borderColor: "rgba(42,143,136,0.22)",
    padding: 20,
    gap: 6,
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(42,143,136,0.10)" },
      default: {
        shadowColor: TEAL,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 10,
        elevation: 2,
      },
    }),
  },
  calmHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  calmHeroEyebrow: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: TEAL, textTransform: "uppercase", letterSpacing: 0.8,
  },
  calmBadge: {
    backgroundColor: "rgba(42,143,136,0.12)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  calmBadgeText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL,
  },
  calmHeroBig: {
    fontSize: 38, fontFamily: "DMSans_700Bold",
    color: TEAL, lineHeight: 46, letterSpacing: -0.5,
  },
  calmHeroLabel: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#3A6E6A", lineHeight: 20,
  },
  calmHeading: {
    fontSize: 22, fontFamily: "DMSans_700Bold",
    color: "#2B2B2B",
  },
  calmSubtext: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#5A8E8A", lineHeight: 19, marginTop: 2,
  },
  calmBreathing: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    color: TEAL, marginTop: 2,
  },
  calmMonthly: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "#AAA", fontStyle: "italic",
  },
  updateMyNumbersBtn: {
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 12,
    paddingVertical: 13, alignItems: "center", justifyContent: "center",
  },
  updateMyNumbersBtnText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEAL,
  },

  // Meal plan saving card
  mealSavingCard: {
    backgroundColor: TEAL_TINT,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  mealSavingEyebrow: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: TEAL, textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 2,
  },
  mealSavingBig: {
    fontSize: 28, fontFamily: "DMSans_700Bold",
    color: TEAL, lineHeight: 34,
  },
  mealSavingDesc: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#3A6E6A", lineHeight: 18,
  },
  mealSavingCount: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: TEAL, lineHeight: 18, marginTop: 2,
  },
  mealSavingAppend: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#888", fontStyle: "italic", lineHeight: 18, marginTop: 4,
  },

  // Snapshot collapsed summary line
  snapshotSummaryLine: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "#555", flex: 1,
  },

  // Quiet goal prompt (State 1, no savings goal set)
  quietGoalPrompt: {
    paddingVertical: 6,
  },
  quietGoalPromptText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#888", lineHeight: 18,
  },
  quietGoalPromptLink: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: TEAL,
  },

  // ── Phase 3 — STATE 2: Tight ─────────────────────────────────
  tightCard: {
    borderRadius: 16,
    backgroundColor: "#FFFDF5",
    borderWidth: 1.5,
    borderColor: "rgba(210,154,34,0.30)",
    padding: 20,
    gap: 10,
  },
  tightIconRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  tightIcon: {
    fontSize: 18, color: GOLD,
  },
  tightHeading: {
    fontSize: 20, fontFamily: "DMSans_700Bold", color: "#2B2B2B", flex: 1,
  },
  tightDivider: {
    height: 1, backgroundColor: "#E6E1D7", marginVertical: 4,
  },
  tightMealLine: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: TEAL, lineHeight: 20,
  },
  tightBreathing: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#888", lineHeight: 20,
  },

  // ── Phase 3 — STATE 3: Stretched ─────────────────────────────
  stretchedCard: {
    borderRadius: 16,
    backgroundColor: "#FFF8F7",
    borderWidth: 1.5,
    borderColor: "rgba(184,101,87,0.25)",
    borderLeftWidth: 3,
    borderLeftColor: "#B86557",
    padding: 20,
    gap: 10,
  },
  stretchedHeading: {
    fontSize: 22, fontFamily: "DMSans_700Bold", color: "#2B2B2B",
  },
  stretchedSubtext: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#888", fontStyle: "italic", lineHeight: 20,
  },
  stretchedReassurance: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: TEAL, lineHeight: 20,
  },
  stretchedBreathing: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#888", lineHeight: 20,
  },

  // ── Shared pressure list ──────────────────────────────────────
  pressureList: { gap: 6, marginTop: 2 },
  pressureItem: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#2B2B2B", lineHeight: 22,
  },
  pressureMore: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#AAA", lineHeight: 22,
  },

  // ── Overwhelm mode entry link ─────────────────────────────────
  overwhelmLink: {
    alignSelf: "flex-start", paddingVertical: 4, marginTop: 8,
  },
  overwhelmLinkText: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEAL,
  },

  // ── "What could give?" inline panel ───────────────────────────
  canWaitPanel: {
    backgroundColor: "#FFF8F7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(184,101,87,0.20)",
    padding: 16,
    gap: 12,
  },
  canWaitTitle: {
    fontSize: 15, fontFamily: "DMSans_700Bold", color: "#2B2B2B",
  },
  canWaitRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  canWaitName: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#2B2B2B",
  },
  canWaitAmount: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#2B2B2B", minWidth: 44, textAlign: "right",
  },
  canWaitAction: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: TEAL, minWidth: 90, textAlign: "right",
  },
  canWaitEmpty: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "#AAA",
  },
  canWaitFooter: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: "#AAA",
    lineHeight: 17, marginTop: 4,
  },
});

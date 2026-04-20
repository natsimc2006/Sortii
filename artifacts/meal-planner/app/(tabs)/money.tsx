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
import { loadBills, daysUntilDue } from "@/utils/billStore";

const C = Colors.light;
const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const PLUM_BORDER = "rgba(94,58,76,0.20)";
const HERO_BG = "#E6F3F0";
const PAGE_BG = "#FFFFFF";

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
  swapSavings,
  pantryEfficiency,
  weeklyState,
  fmt,
}: {
  swapSavings: number;
  pantryEfficiency: number;
  weeklyState: WeeklyState | null;
  fmt: (n: number) => string;
}) {
  const total = Math.round(swapSavings + pantryEfficiency);
  const roundedSwap = Math.round(swapSavings);
  const roundedPantry = Math.round(pantryEfficiency);

  if (total <= 0) return null;

  return (
    <View style={styles.heroCard}>
      {/* Status pill top-right */}
      <View style={styles.heroTopRow}>
        <Text style={styles.heroEyebrow}>This week</Text>
        <StatusPill state={weeklyState} />
      </View>

      {/* Big number */}
      <Text style={styles.heroBigNumber}>~{fmt(total)}</Text>
      <Text style={styles.heroLabel}>sorted by Sortii this week</Text>

      <View style={styles.heroDivider} />
      {roundedSwap > 0 && (
        <View style={styles.heroLineItem}>
          <Text style={styles.heroLineLabel}>Smarter ingredient choices</Text>
          <Text style={styles.heroLineValue}>{fmt(roundedSwap)}</Text>
        </View>
      )}
      {roundedPantry > 0 && (
        <View style={styles.heroLineItem}>
          <Text style={styles.heroLineLabel}>Pantry-friendly meal selection</Text>
          <Text style={styles.heroLineValue}>{fmt(roundedPantry)}</Text>
        </View>
      )}
      <Text style={styles.heroDisclaimer}>
        Nothing dramatic. Just less waste. Estimated, not exact.
      </Text>
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
}: {
  money: NonNullable<ReturnType<typeof useUserWeek>["money"]>;
  result: MoneyPageResult;
  lifestyleSpend: LifestyleSpendData | null;
  dinnerPlanCost: number;
  hasMealsSetup: boolean;
  fmt: (n: number) => string;
  appliedSavingsTotal: number;
  defaultOpen?: boolean;
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
        <Text style={styles.collapseTitle}>The quick version</Text>
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
  isApplied,
  onApply,
  onUndo,
  hasMealsSetup,
  onViewMeals,
}: {
  s: MoneySuggestion;
  fmt: (n: number) => string;
  isApplied: boolean;
  onApply: () => void;
  onUndo: () => void;
  hasMealsSetup: boolean;
  onViewMeals: () => void;
}) {
  const isActionable = !s.isGoalProjection && !s.isMonthlyNudge && s.impactAmount > 0;
  const ctaLabel = WIN_CTA[s.id] ?? "Try this";
  const message = confirmMsg(s.id, s.impactAmount, fmt);

  return (
    <View style={[styles.quickWinsRow, isApplied && styles.quickWinsRowApplied]}>
      <Text style={[styles.quickWinsArrow, isApplied && { color: TEAL }]}>
        {isApplied ? "✓" : "▸"}
      </Text>
      <View style={styles.quickWinsContent}>
        <Text style={[styles.quickWinsLabel, isApplied && styles.quickWinsLabelApplied]}>
          {s.label}
        </Text>

        {isApplied ? (
          <>
            <Text style={styles.quickWinsConfirm}>{message}</Text>
            {s.id === "skip_takeaway" && hasMealsSetup && (
              <TouchableOpacity
                onPress={onViewMeals}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.quickWinsMealLink}>Your dinners are already sorted →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onUndo();
              }}
              hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            >
              <Text style={styles.quickWinsUndo}>Undo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {s.reason ? <Text style={styles.quickWinsReason}>{s.reason}</Text> : null}
            {isActionable && (
              <View style={styles.quickWinsCtaRow}>
                <Text style={styles.quickWinsImpact}>~{fmt(s.impactAmount)}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onApply();
                  }}
                  style={styles.quickWinsCtaBtn}
                  activeOpacity={0.78}
                >
                  <Text style={styles.quickWinsCtaBtnText}>{ctaLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── 4. Quick Wins (collapsible) ──────────────────────────────

function QuickWinsSection({
  suggestions,
  fmt,
  appliedWins,
  onApply,
  onUndo,
  hasMealsSetup,
  onViewMeals,
}: {
  suggestions: MoneySuggestion[];
  fmt: (n: number) => string;
  appliedWins: Map<string, number>;
  onApply: (id: string, amount: number) => void;
  onUndo: (id: string) => void;
  hasMealsSetup: boolean;
  onViewMeals: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tips = suggestions.slice(0, 3);
  if (tips.length === 0) return null;

  const appliedCount = tips.filter((s) => appliedWins.has(s.id)).length;

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.quickWinsTitle}>💡 A few quick wins</Text>
          {appliedCount > 0 && (
            <View style={styles.quickWinsBadge}>
              <Text style={styles.quickWinsBadgeText}>{appliedCount}</Text>
            </View>
          )}
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={17} color={PLUM} />
      </TouchableOpacity>

      {open && (
        <View style={styles.quickWinsBody}>
          <Text style={styles.quickWinsIntro}>If you want to tighten things slightly this week:</Text>
          {tips.map((s) => (
            <WinRow
              key={s.id}
              s={s}
              fmt={fmt}
              isApplied={appliedWins.has(s.id)}
              onApply={() => onApply(s.id, s.impactAmount)}
              onUndo={() => onUndo(s.id)}
              hasMealsSetup={hasMealsSetup}
              onViewMeals={onViewMeals}
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

  // Bills due this week
  const [billsTotalThisWeek, setBillsTotalThisWeek] = useState(0);
  const [billsCountThisWeek, setBillsCountThisWeek] = useState(0);

  // Money nudge dismiss state
  const [nudgeHidden, setNudgeHidden] = useState(false);

  // Snapshot default-open for first-time visitors
  const [snapshotDefaultOpen, setSnapshotDefaultOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    // First-visit snapshot expand tracking
    AsyncStorage.getItem("sortii_snapshot_seen").then((raw) => {
      if (!raw) {
        setSnapshotDefaultOpen(true);
        AsyncStorage.setItem("sortii_snapshot_seen", "1").catch(() => {});
      } else {
        setSnapshotDefaultOpen(false);
      }
    }).catch(() => {});

    // Bills due this week
    loadBills().then((bills) => {
      const dueSoon = bills.filter((b) => !b.isPaid && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7);
      setBillsCountThisWeek(dueSoon.length);
      setBillsTotalThisWeek(dueSoon.reduce((s, b) => s + b.amount, 0));
    }).catch(() => {});

    // Check nudge dismiss state
    AsyncStorage.getItem("sortii_money_nudge_v1").then((raw) => {
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
      const raw = await AsyncStorage.getItem("sortii_money_nudge_v1");
      const existing = raw ? JSON.parse(raw) : { dismissCount: 0 };
      await AsyncStorage.setItem("sortii_money_nudge_v1", JSON.stringify({
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
        <Text style={styles.pageSubtitle}>
          Here's where your money sits this week.
        </Text>
      </View>

      {!hasMoneySetup && !nudgeHidden ? (
        <MoneyEmptyState onSetup={goToMoneySetup} onDismiss={handleNudgeDismiss} />
      ) : (
        <>
          {/* 1. Hero card */}
          <HeroCard
            swapSavings={swapSavings}
            pantryEfficiency={pantryEfficiency}
            weeklyState={result.weeklyState}
            fmt={formatMoneyRound}
          />

          {/* Stacked wins bar */}
          <StackedWinsBar
            total={appliedSavingsTotal}
            count={appliedWins.size}
            fmt={formatMoneyRound}
          />

          {/* 2. Weekly Snapshot */}
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

          {/* 2b. Bills impact on breathing room */}
          {money && billsTotalThisWeek > 0 && (() => {
            const breathing = result.remaining + appliedSavingsTotal;
            const adjusted = breathing - billsTotalThisWeek;
            const isNeg = adjusted < 0;
            return (
              <View style={[styles.billsNoteCard, { borderColor: isNeg ? "#B86557" : GOLD }]}>
                <View style={styles.billsNoteRow}>
                  <Text style={styles.billsNoteLabel}>
                    After {billsCountThisWeek} bill{billsCountThisWeek > 1 ? "s" : ""} this week
                  </Text>
                  <Text style={[styles.billsNoteAmount, { color: isNeg ? "#B86557" : GOLD }]}>
                    {isNeg ? `–${formatMoneyRound(Math.abs(adjusted))}` : formatMoneyRound(adjusted)}
                  </Text>
                </View>
                <Text style={[styles.billsNoteSub, { color: isNeg ? "#B86557" : "#888" }]}>
                  {isNeg
                    ? "Tight week — bills exceed breathing room."
                    : `Includes ${formatMoneyRound(billsTotalThisWeek)} in upcoming bills.`}
                </Text>
              </View>
            );
          })()}

          {/* 3. Where groceries are going */}
          {money && (
            <GroceriesSection
              estimatedDinnerSpend={result.estimatedDinnerSpend}
              dinnerPlanCost={dinnerPlanCost}
              dinnerInsight={result.dinnerInsight}
              hasMealsSetup={hasMealsSetup}
              numMeals={filledMeals.length}
              hasGroceries={result.hasGroceries}
              fmt={formatMoneyRound}
            />
          )}

          {/* 4. Quick wins */}
          <QuickWinsSection
            suggestions={result.suggestions}
            fmt={formatMoneyRound}
            appliedWins={appliedWins}
            onApply={applyWin}
            onUndo={undoWin}
            hasMealsSetup={hasMealsSetup}
            onViewMeals={goToMeals}
          />

          {/* 5. Savings goal card */}
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

          {/* 6. Update CTA */}
          <View style={styles.updateCtaWrap}>
            <Text style={styles.updateCtaLabel}>
              Your numbers, your call. Update anytime.
            </Text>
            <TouchableOpacity
              onPress={goToMoneySetup}
              activeOpacity={0.85}
              style={styles.updateCtaBtn}
            >
              <Text style={styles.updateCtaBtnText}>Update my numbers</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
    <WinsToast message={toastMsg} bottomInset={paddingBottom} />
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

  // Header
  pageHeader: { gap: 4, marginBottom: 4 },
  pageTitle: {
    fontSize: 28, fontFamily: "Manrope_700Bold",
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
    fontSize: 34, fontFamily: "Manrope_700Bold",
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
    fontSize: 22, fontFamily: "Manrope_700Bold", color: C.text, lineHeight: 28,
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
  quickWinsContent: { flex: 1, gap: 2 },
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
    flex: 1, fontSize: 16, fontFamily: "Manrope_700Bold", color: PLUM,
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
    fontFamily: "Manrope_700Bold",
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
});

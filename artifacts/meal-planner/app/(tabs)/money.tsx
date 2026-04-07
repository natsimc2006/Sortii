import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

const C = Colors.light;
const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const PLUM_BORDER = "rgba(94,58,76,0.20)";
const HERO_BG = "#E6F3F0";
const PAGE_BG = "#F7F3EB";
const sortiiLogo = require("@/assets/images/sortii-logo-money.png");

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

  return (
    <View style={styles.heroCard}>
      {/* Status pill top-right */}
      <View style={styles.heroTopRow}>
        <Text style={styles.heroEyebrow}>This week</Text>
        <StatusPill state={weeklyState} />
      </View>

      {/* Big number */}
      <Text style={styles.heroBigNumber}>~{fmt(total > 0 ? total : 0)}</Text>
      <Text style={styles.heroLabel}>sorted by Sortii this week</Text>

      {total > 0 && (
        <>
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
            Compared with a less-planned week — estimated, not exact.
          </Text>
        </>
      )}

      {total <= 0 && (
        <Text style={styles.heroNoMealsHint}>
          Add meals to your planner to see your weekly savings.
        </Text>
      )}
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
}: {
  money: NonNullable<ReturnType<typeof useUserWeek>["money"]>;
  result: MoneyPageResult;
  lifestyleSpend: LifestyleSpendData | null;
  dinnerPlanCost: number;
  hasMealsSetup: boolean;
  fmt: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const { weeklyIncome, fixedWeeklyCosts, groceriesWeekly, eatingOutWeekly, otherWeeklySpend } = money;
  const { remaining, weeklyState } = result;
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
        <Text style={styles.collapseTitle}>Weekly snapshot</Text>
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
              <Feather name="coffee" size={12} color={GOLD} />
              <Text style={styles.coffeeNoteText}>
                Your coffee spend ({fmt(Math.round(coffeeSpend))}) is close to your dinner plan ({fmt(Math.round(dinnerPlanCost))}). Interesting.
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

  const underEstimate = hasMealsSetup && dinnerPlanCost > 0 && dinnerPlanCost <= estimatedDinnerSpend;

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
                {underEstimate && (
                  <Text style={styles.groceriesTick}> ✓</Text>
                )}
              </View>
            </View>
          </>
        )}
      </View>

      <Text style={styles.groceriesInsight}>{dinnerInsight}</Text>
    </View>
  );
}

// ─── 4. Quick Wins (collapsible plum section) ─────────────────

function QuickWinsSection({ suggestions, fmt }: { suggestions: MoneySuggestion[]; fmt: (n: number) => string }) {
  const [open, setOpen] = useState(false);
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
        <Text style={styles.quickWinsTitle}>💡 Tap for some quick wins this week</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={17} color="#8A6200" />
      </TouchableOpacity>

      {open && (
        <View style={styles.quickWinsBody}>
          {tips.map((s) => (
            <View key={s.id} style={styles.quickWinsRow}>
              <Text style={styles.quickWinsArrow}>▸</Text>
              <View style={styles.quickWinsContent}>
                <Text style={styles.quickWinsLabel}>{s.label}</Text>
                {s.reason ? (
                  <Text style={styles.quickWinsReason}>{s.reason}</Text>
                ) : null}
                {!s.isGoalProjection && !s.isMonthlyNudge && s.impactAmount > 0 ? (
                  <Text style={styles.quickWinsImpact}>Save ~{fmt(s.impactAmount)}</Text>
                ) : null}
              </View>
            </View>
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
        <Text style={styles.goalWeekLeft}>
          This week added ~{fmt(Math.round(weeklyDinnerSaving))}
        </Text>
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

function MoneyEmptyState({ onSetup, onBack }: { onSetup: () => void; onBack: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="dollar-sign" size={40} color={C.border} />
      <Text style={styles.emptyHeadline}>No money setup yet</Text>
      <Text style={styles.emptySub}>
        Add your weekly numbers to see how your week is tracking.
      </Text>
      <TouchableOpacity
        onPress={onSetup}
        activeOpacity={0.85}
        style={styles.emptyBtn}
      >
        <Text style={styles.emptyBtnText}>Add my numbers</Text>
        <Feather name="arrow-right" size={16} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.emptyBack}>
        <Text style={styles.emptyBackText}>Maybe later</Text>
      </TouchableOpacity>
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

  const paddingTop = Platform.OS === "web" ? 24 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 60 : insets.bottom + 80;

  const goToMoneySetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
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
    <ScrollView
      style={{ backgroundColor: PAGE_BG }}
      contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View style={styles.moneyHeaderRow}>
          <Image source={sortiiLogo} style={styles.moneyPageLogo} resizeMode="contain" />
          <TouchableOpacity
            onPress={() => router.push("/home")}
            style={styles.homeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="home" size={15} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.pageSubtitle}>
          A quick look at your week, with a few easy wins if you want them.
        </Text>
      </View>

      {!hasMoneySetup ? (
        <MoneyEmptyState onSetup={goToMoneySetup} onBack={goBack} />
      ) : (
        <>
          {/* 1. Hero card */}
          <HeroCard
            swapSavings={swapSavings}
            pantryEfficiency={pantryEfficiency}
            weeklyState={result.weeklyState}
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
            />
          )}

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
          <QuickWinsSection suggestions={result.suggestions} fmt={formatMoneyRound} />

          {/* 5. Savings goal card */}
          {savingsGoal ? (
            <SavingsGoalCard
              goal={savingsGoal}
              weeklyDinnerSaving={weeklySortiiSaving}
              fmt={formatMoneyRound}
              onUpdate={goToGoalSetup}
            />
          ) : (
            <TouchableOpacity onPress={goToGoalSetup} style={styles.addGoalNudge} activeOpacity={0.8}>
              <Text style={styles.addGoalNudgeText}>+ Set a savings goal</Text>
              <Text style={styles.addGoalNudgeSub}>We'll track your progress week by week.</Text>
            </TouchableOpacity>
          )}

          {/* 6. Update CTA */}
          <View style={styles.updateCtaWrap}>
            <Text style={styles.updateCtaLabel}>
              Groceries, income, or fixed costs — easy.
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
  moneyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  moneyPageLogo: { width: 221, height: 101 },
  homeBtn: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.chipBg, borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
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
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#FEF8E7", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginVertical: 4,
  },
  coffeeNoteText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: GOLD, lineHeight: 17, fontStyle: "italic",
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
    borderRadius: 16, backgroundColor: "#FEF3D8",
    borderWidth: 1.5, borderColor: "rgba(210,154,34,0.30)", overflow: "hidden",
  },
  quickWinsHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
  },
  quickWinsTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#8A6200",
  },
  quickWinsBody: {
    paddingHorizontal: 18, paddingBottom: 16, gap: 12,
  },
  quickWinsRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  quickWinsArrow: {
    fontSize: 13, color: "#8A6200", marginTop: 2, fontFamily: "Inter_600SemiBold",
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
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#8A6200",
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

  // Add goal nudge (when no goal set)
  addGoalNudge: {
    borderRadius: 14, borderWidth: 1.5, borderColor: PLUM_BORDER,
    borderStyle: "dashed", paddingVertical: 18, paddingHorizontal: 20,
    alignItems: "center", gap: 4,
  },
  addGoalNudgeText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: PLUM,
  },
  addGoalNudgeSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted,
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
  emptyHeadline: {
    fontSize: 20, fontFamily: "Manrope_700Bold",
    color: C.text, textAlign: "center",
  },
  emptySub: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: C.textSecondary, textAlign: "center", lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
    backgroundColor: GOLD, marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  emptyBack: { alignItems: "center", paddingVertical: 4 },
  emptyBackText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: C.textMuted, textDecorationLine: "underline",
  },
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
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
  WeekGoal,
  WeeklyState,
} from "@/utils/yourWeekEngine";
import { getSwapsForRecipe } from "@/utils/getSwapsForRecipe";
import { SWAP_RULES } from "@/constants/swapRules";
import type { Recipe } from "@/constants/recipes";

const C = Colors.light;
const sortiiLogo = require("@/assets/images/sortii-logo-money.png");

// ─── Shared card wrapper ────────────────────────────────────

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ─── WeeklySnapshotCard ─────────────────────────────────────

function SnapshotRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.snapshotRow}>
      <Text
        style={[
          styles.snapshotLabel,
          { color: muted ? C.textMuted : C.textSecondary },
          bold && { color: C.text, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.snapshotValue,
          { color: muted ? C.textMuted : C.text },
          bold && { fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function StatePill({ state }: { state: WeeklyState | null }) {
  if (!state) return null;

  const config: Record<WeeklyState, { label: string; bg: string; text: string }> = {
    over:  { label: "Over budget",    bg: C.dangerBg,   text: C.danger },
    tight: { label: "A little tight", bg: C.goldTint,   text: C.goldDark },
    ok:    { label: "Holding steady", bg: C.tealTint,   text: C.primary },
    good:  { label: "Looking good",   bg: C.tealTint,   text: C.primary },
    great: { label: "Great shape",    bg: C.tealTint,   text: C.primary },
  };

  const { label, bg, text } = config[state];
  return (
    <View style={[styles.statePill, { backgroundColor: bg }]}>
      <Text style={[styles.statePillText, { color: text }]}>{label}</Text>
    </View>
  );
}

function WeeklySnapshotCard({
  money,
  result,
  fmt,
}: {
  money: NonNullable<ReturnType<typeof useUserWeek>["money"]>;
  result: MoneyPageResult;
  fmt: (n: number) => string;
}) {
  const { weeklyIncome, fixedWeeklyCosts, groceriesWeekly, eatingOutWeekly, otherWeeklySpend } = money;
  const { remaining, weeklyState, snapshotHeadline } = result;
  const isNeg = remaining < 0;

  const remainingColor = isNeg ? C.danger : C.accent;
  const remainingLabel = isNeg
    ? `${fmt(Math.abs(remaining))} over this week`
    : `${fmt(remaining)} left this week`;

  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: C.text }]}>Weekly snapshot</Text>
        <StatePill state={weeklyState} />
      </View>

      <Text style={[styles.snapshotHeadline, { color: C.text }]}>{snapshotHeadline}</Text>

      <View style={styles.divider} />

      <SnapshotRow label="Income" value={fmt(weeklyIncome)} />
      <SnapshotRow label="Fixed costs" value={fmt(fixedWeeklyCosts)} />
      <SnapshotRow label="Groceries" value={fmt(groceriesWeekly)} />
      {(eatingOutWeekly ?? 0) > 0 && (
        <SnapshotRow label="Eating out" value={fmt(eatingOutWeekly ?? 0)} />
      )}
      {(otherWeeklySpend ?? 0) > 0 && (
        <SnapshotRow label="Other spend" value={fmt(otherWeeklySpend ?? 0)} muted />
      )}

      <View style={styles.divider} />

      <View style={styles.snapshotRow}>
        <Text style={[styles.snapshotLabel, { color: C.text, fontFamily: "Inter_600SemiBold" }]}>
          Remaining
        </Text>
        <Text style={[styles.remainingAmount, { color: remainingColor }]}>
          {isNeg ? "–" : ""}{remainingLabel}
        </Text>
      </View>
    </Card>
  );
}

// ─── FoodFocusCard ──────────────────────────────────────────

function FoodFocusCard({
  estimatedDinnerSpend,
  fullWeekDinnerEstimate,
  dinnerPlanCost,
  dinnerInsight,
  hasMealsSetup,
  numMeals,
  householdSize,
  hasGroceries,
  hasEatingOutData,
  fmt,
}: {
  estimatedDinnerSpend: number;
  fullWeekDinnerEstimate: number;
  dinnerPlanCost: number;
  dinnerInsight: string;
  hasMealsSetup: boolean;
  numMeals: number;
  householdSize: number;
  hasGroceries: boolean;
  hasEatingOutData: boolean;
  fmt: (n: number) => string;
}) {
  // Takeaway savings: benchmark $13/person/meal; only show when meals are planned
  const TAKEAWAY_PER_PERSON_PER_MEAL = 13;
  const benchmarkTotal = numMeals * householdSize * TAKEAWAY_PER_PERSON_PER_MEAL;

  // If user entered eating-out data, use that (scaled to numMeals); otherwise use benchmark
  const takeawayComparison = benchmarkTotal;
  const takeawaySaving = takeawayComparison - dinnerPlanCost;

  // Only show if meals planned, costs known, meaningful saving, AND groceries entered
  const showSaving = hasMealsSetup && hasGroceries && dinnerPlanCost > 0 && numMeals > 0 && takeawaySaving > 2;

  // Display label for estimated figure (proportional or full-week)
  const estimateLabel = hasMealsSetup && numMeals > 0 && numMeals < 7
    ? `~${numMeals} dinners covered`
    : "Estimated dinners";

  return (
    <Card style={{ borderColor: C.primary }}>
      <View style={[styles.cardHeader]}>
        <Text style={[styles.cardTitle, { color: C.text }]}>Where groceries are going</Text>
      </View>

      {!hasGroceries ? (
        <View style={[styles.partialNudge, { backgroundColor: C.tealTint, borderColor: C.primary }]}>
          <Feather name="info" size={14} color={C.primary} />
          <Text style={[styles.partialNudgeText, { color: C.primaryDark }]}>
            Add your weekly grocery spend to unlock dinner insights and savings comparisons.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.foodRow}>
            <View style={styles.foodCell}>
              <Text style={[styles.foodCellLabel, { color: C.textMuted }]}>{estimateLabel}</Text>
              <Text style={[styles.foodCellValue, { color: C.text }]}>{fmt(estimatedDinnerSpend)}</Text>
            </View>
            {hasMealsSetup && dinnerPlanCost > 0 && (
              <>
                <View style={[styles.foodDivider, { backgroundColor: C.border }]} />
                <View style={styles.foodCell}>
                  <Text style={[styles.foodCellLabel, { color: C.textMuted }]}>Your dinner plan</Text>
                  <Text style={[styles.foodCellValue, { color: C.primary }]}>{fmt(dinnerPlanCost)}</Text>
                </View>
              </>
            )}
          </View>

          <Text style={[styles.foodInsight, { color: C.textSecondary }]}>{dinnerInsight}</Text>

          {showSaving && (
            <View style={[styles.takeawaySavingRow, { backgroundColor: C.plumTint ?? "#F5EEF8", borderColor: C.plum }]}>
              <Feather name="award" size={14} color={C.plum} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.takeawaySavingText, { color: C.plum }]}>
                  {hasEatingOutData
                    ? `Your meal plan saves you ~${fmt(Math.round(takeawaySaving))} vs eating out this week`
                    : `Based on typical takeaway costs, this plan could save about ${fmt(Math.round(takeawaySaving))}`}
                </Text>
                <Text style={[styles.takeawaySavingMontly, { color: C.plum }]}>
                  That's ~{fmt(Math.round(takeawaySaving * 4))}/month if you keep it up
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.foodHelper, { color: C.textMuted }]}>
            Estimated from your grocery spend — close enough, not spreadsheet-level.
          </Text>
        </>
      )}
    </Card>
  );
}

// ─── SortiiSavingsCard ──────────────────────────────────────

function SortiiSavingsCard({
  swapSavings,
  pantryEfficiency,
  fmt,
}: {
  swapSavings: number;
  pantryEfficiency: number;
  fmt: (n: number) => string;
}) {
  const total = Math.round(swapSavings + pantryEfficiency);
  if (total < 2) return null;

  const roundedSwap = Math.round(swapSavings);
  const roundedPantry = Math.round(pantryEfficiency);

  return (
    <Card style={{ borderColor: C.primary, backgroundColor: C.tealTint }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[styles.savingsIconBadge, { backgroundColor: C.primary }]}>
          <Feather name="trending-down" size={14} color="#fff" />
        </View>
        <Text style={[styles.cardTitle, { color: C.primary, flex: 1 }]}>What Sortii saved you</Text>
      </View>

      <View style={styles.savingsAmountRow}>
        <Text style={[styles.savingsAmountBig, { color: C.primary }]}>
          ~{fmt(total)}
        </Text>
        <Text style={[styles.savingsAmountLabel, { color: C.textSecondary }]}>
          estimated this week
        </Text>
      </View>

      <View style={styles.savingsBreakdown}>
        {roundedSwap > 0 && (
          <View style={styles.savingsBreakdownRow}>
            <Text style={[styles.savingsBreakdownLabel, { color: C.textSecondary }]}>Smarter ingredient choices</Text>
            <Text style={[styles.savingsBreakdownValue, { color: C.primary }]}>{fmt(roundedSwap)}</Text>
          </View>
        )}
        {roundedPantry > 0 && (
          <View style={styles.savingsBreakdownRow}>
            <Text style={[styles.savingsBreakdownLabel, { color: C.textSecondary }]}>Pantry-friendly meal selection</Text>
            <Text style={[styles.savingsBreakdownValue, { color: C.primary }]}>{fmt(roundedPantry)}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.savingsDisclaimer, { color: C.textMuted }]}>
        Compared with a less-planned weekly mix. Estimated, not exact.
      </Text>
    </Card>
  );
}

// ─── SavingsSuggestionsSection ──────────────────────────────

function SuggestionCard({
  suggestion,
  fmt,
}: {
  suggestion: MoneySuggestion;
  fmt: (n: number) => string;
}) {
  return (
    <View style={[styles.suggCard, { backgroundColor: "#F7EEF5", borderColor: C.plum }]}>
      <View style={styles.suggTop}>
        <View style={[styles.suggDot, { backgroundColor: C.plum }]} />
        <Text style={[styles.suggLabel, { color: C.text }]}>{suggestion.label}</Text>
      </View>
      {suggestion.reason && (
        <Text style={[styles.suggReason, { color: C.textMuted }]}>{suggestion.reason}</Text>
      )}
      <Text style={[styles.suggImpact, { color: C.plum }]}>
        Save ~{fmt(suggestion.impactAmount)}
      </Text>
    </View>
  );
}

function SavingsSuggestionsSection({
  suggestions,
  fmt,
}: {
  suggestions: MoneySuggestion[];
  fmt: (n: number) => string;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.suggestionsSection}>
      <View style={styles.sectionHeadingRow}>
        <Feather name="zap" size={14} color={C.plum} />
        <Text style={[styles.sectionHeading, { color: C.plum }]}>Easy wins this week</Text>
      </View>
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} fmt={fmt} />
      ))}
    </View>
  );
}

// ─── GoalProgressCard ───────────────────────────────────────

const GOAL_CONFIG: Record<
  WeekGoal,
  { emoji: string; label: string; nudge: string } | null
> = {
  holiday: {
    emoji: "✈️",
    label: "Trip fund",
    nudge: "Every dinner at home brings the trip a little closer.",
  },
  house: {
    emoji: "🏠",
    label: "Deposit goal",
    nudge: "Each week you cook at home is a step toward your deposit.",
  },
  wedding: {
    emoji: "💍",
    label: "Wedding fund",
    nudge: "Small savings now add up faster than you think.",
  },
  general: {
    emoji: "🐷",
    label: "Saving goal",
    nudge: "You're building a great habit, week by week.",
  },
  none: null,
};

function GoalProgressCard({ goal }: { goal: WeekGoal }) {
  const config = GOAL_CONFIG[goal];
  if (!config) return null;

  return (
    <Card style={{ backgroundColor: C.tealTint, borderColor: C.primary }}>
      <View style={styles.goalRow}>
        <Text style={styles.goalEmoji}>{config.emoji}</Text>
        <View style={styles.goalText}>
          <Text style={[styles.goalLabel, { color: C.primary }]}>{config.label}</Text>
          <Text style={[styles.goalNudge, { color: C.textSecondary }]}>{config.nudge}</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── QuickEditCard ──────────────────────────────────────────

function QuickEditCard({ onPress }: { onPress: () => void }) {
  return (
    <Card style={{ borderColor: C.border }}>
      <Text style={[styles.cardTitle, { color: C.text }]}>Need to tweak a number?</Text>
      <Text style={[styles.editHelper, { color: C.textSecondary }]}>
        Groceries, eating out, or fixed costs — easy.
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.82}
        style={[styles.editBtn, { backgroundColor: C.primary }]}
      >
        <Feather name="edit-2" size={15} color="#fff" />
        <Text style={styles.editBtnText}>Update my numbers</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Empty state ────────────────────────────────────────────

function MoneyEmptyState({ onSetup, onBack }: { onSetup: () => void; onBack: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="dollar-sign" size={40} color={C.border} />
      <Text style={[styles.emptyHeadline, { color: C.text }]}>No money setup yet</Text>
      <Text style={[styles.emptySub, { color: C.textSecondary }]}>
        Add your weekly numbers to see how your week is tracking.
      </Text>
      <TouchableOpacity
        onPress={onSetup}
        activeOpacity={0.85}
        style={[styles.emptyBtn, { backgroundColor: C.gold }]}
      >
        <Text style={styles.emptyBtnText}>Add my numbers</Text>
        <Feather name="arrow-right" size={16} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.emptyBack}>
        <Text style={[styles.emptyBackText, { color: C.textMuted }]}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────

export default function MoneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, getRecipeById, preferences } = usePlanner();
  const { formatMoneyRound } = useLocale();
  const { weeklyMode, goal, hasMealsSetup, hasMoneySetup, money, isLoaded } = useUserWeek();

  const paddingTop = Platform.OS === "web" ? 24 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 60 : insets.bottom + 80;

  const goToMoneySetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/your-week");
  };

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { paddingTop }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const dinnerPlanCost = filledMeals.reduce((sum, entry) => {
    const recipe = getRecipeById(entry.recipeId!);
    const cost = recipe?.costPerServe ?? recipe?.costPerServeAUD ?? 0;
    return sum + cost * (preferences.householdSize ?? 4);
  }, 0);

  // ─── Sortii savings calculation ────────────────────────────
  // Swap savings: count matched swap rules across all planned meals
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

  // Pantry efficiency: batch/leftover-friendly recipes save ~$1.80/serve vs convenience alternatives
  const pantryEfficiency = filledMeals.filter((e) => {
    const r = getRecipeById(e.recipeId!) as Recipe | null;
    return r && (r.batchCook || r.leftoversFriendly);
  }).length * 1.8 * (preferences.householdSize ?? 4);

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
  );

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View style={styles.moneyHeaderRow}>
          <Image
            source={sortiiLogo}
            style={styles.moneyPageLogo}
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={() => router.push("/home")}
            style={[styles.filterIconBtn, { backgroundColor: C.chipBg, borderWidth: 1.5, borderColor: C.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="home" size={15} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.pageSubtitle, { color: C.textSecondary }]}>
          A quick look at your week, with a few easy wins if you want them.
        </Text>
      </View>

      {!hasMoneySetup ? (
        <MoneyEmptyState onSetup={goToMoneySetup} onBack={goBack} />
      ) : (
        <>
          <WeeklySnapshotCard
            money={money!}
            result={result}
            fmt={formatMoneyRound}
          />

          {/* Partial setup nudge — income entered but no groceries yet */}
          {result.isPartialSetup && (
            <Card style={{ borderColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="info" size={16} color={C.textSecondary} />
                <Text style={[styles.cardTitle, { color: C.text, flex: 1 }]}>Nice start</Text>
              </View>
              <Text style={[styles.editHelper, { color: C.textSecondary }]}>
                Add groceries or eating out to unlock savings insights and see the full picture.
              </Text>
              <TouchableOpacity
                onPress={goToMoneySetup}
                activeOpacity={0.82}
                style={[styles.editBtn, { backgroundColor: C.primary }]}
              >
                <Feather name="plus" size={15} color="#fff" />
                <Text style={styles.editBtnText}>Add more numbers</Text>
              </TouchableOpacity>
            </Card>
          )}

          {money && (
            <FoodFocusCard
              estimatedDinnerSpend={result.estimatedDinnerSpend}
              fullWeekDinnerEstimate={result.fullWeekDinnerEstimate}
              dinnerPlanCost={dinnerPlanCost}
              dinnerInsight={result.dinnerInsight}
              hasMealsSetup={hasMealsSetup}
              numMeals={filledMeals.length}
              householdSize={preferences.householdSize ?? 4}
              hasGroceries={result.hasGroceries}
              hasEatingOutData={result.hasEatingOutData}
              fmt={formatMoneyRound}
            />
          )}

          {hasMealsSetup && filledMeals.length > 0 && (
            <SortiiSavingsCard
              swapSavings={swapSavings}
              pantryEfficiency={pantryEfficiency}
              fmt={formatMoneyRound}
            />
          )}

          <SavingsSuggestionsSection
            suggestions={result.suggestions}
            fmt={formatMoneyRound}
          />

          <GoalProgressCard goal={goal} />

          <QuickEditCard onPress={goToMoneySetup} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  pageHeader: {
    gap: 6,
    marginBottom: 4,
  },
  moneyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  moneyPageLogo: {
    width: 221,
    height: 101,
  },
  filterIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: "#FFFFFF",
    padding: 20,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(0,0,0,0.06)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statePillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  snapshotHeadline: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 2,
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  snapshotLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  snapshotValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  remainingAmount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  foodRow: {
    flexDirection: "row",
    gap: 0,
    marginTop: 4,
  },
  foodCell: {
    flex: 1,
    gap: 4,
  },
  foodDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  foodCellLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  foodCellValue: {
    fontSize: 20,
    fontFamily: "Manrope_700Bold",
    lineHeight: 26,
  },
  foodInsight: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  foodHelper: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    fontStyle: "italic",
  },
  partialNudge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partialNudgeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    flex: 1,
  },
  suggestionsSection: {
    gap: 10,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: "Manrope_700Bold",
    lineHeight: 24,
  },
  takeawaySavingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  takeawaySavingText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  takeawaySavingMontly: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    opacity: 0.8,
    marginTop: 2,
  },
  suggCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 6,
    ...Platform.select({
      web: { boxShadow: "0px 1px 6px rgba(0,0,0,0.05)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  suggTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  suggDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
  },
  suggLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  suggReason: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginLeft: 17,
    fontStyle: "italic",
  },
  suggImpact: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginLeft: 17,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  goalEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  goalText: {
    flex: 1,
    gap: 4,
  },
  goalLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  goalNudge: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  editHelper: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  editBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyHeadline: {
    fontSize: 20,
    fontFamily: "Manrope_700Bold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyBack: {
    alignItems: "center",
    paddingVertical: 4,
  },
  emptyBackText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  savingsIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  savingsAmountBig: {
    fontSize: 28,
    fontFamily: "Manrope_700Bold",
    lineHeight: 34,
  },
  savingsAmountLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  savingsBreakdown: {
    gap: 6,
    paddingTop: 4,
  },
  savingsBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savingsBreakdownLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  savingsBreakdownValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  savingsDisclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    fontStyle: "italic",
  },
});

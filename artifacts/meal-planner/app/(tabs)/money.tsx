import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
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
  WeekGoal,
  WeeklyState,
} from "@/utils/yourWeekEngine";

const C = Colors.light;

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
  dinnerPlanCost,
  dinnerInsight,
  hasMealsSetup,
  fmt,
}: {
  estimatedDinnerSpend: number;
  dinnerPlanCost: number;
  dinnerInsight: string;
  hasMealsSetup: boolean;
  fmt: (n: number) => string;
}) {
  return (
    <Card>
      <Text style={[styles.cardTitle, { color: C.text }]}>Where groceries are going</Text>

      <View style={styles.foodRow}>
        <View style={styles.foodCell}>
          <Text style={[styles.foodCellLabel, { color: C.textMuted }]}>Estimated dinners</Text>
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

      <Text style={[styles.foodHelper, { color: C.textMuted }]}>
        We estimate dinners from your weekly grocery spend — close enough, not spreadsheet-level.
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
    <View style={[styles.suggCard, { borderColor: C.border }]}>
      <View style={styles.suggTop}>
        <View style={[styles.suggDot, { backgroundColor: C.goldDark }]} />
        <Text style={[styles.suggLabel, { color: C.text }]}>{suggestion.label}</Text>
      </View>
      {suggestion.reason && (
        <Text style={[styles.suggReason, { color: C.textMuted }]}>{suggestion.reason}</Text>
      )}
      <Text style={[styles.suggImpact, { color: C.goldDark }]}>
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
      <Text style={[styles.sectionHeading, { color: C.text }]}>Easy wins this week</Text>
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

function MoneyEmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="dollar-sign" size={40} color={C.border} />
      <Text style={[styles.emptyHeadline, { color: C.text }]}>No money setup yet</Text>
      <Text style={[styles.emptySub, { color: C.textSecondary }]}>
        Add your weekly income and costs to see your money snapshot.
      </Text>
      <TouchableOpacity
        onPress={onSetup}
        activeOpacity={0.85}
        style={[styles.emptyBtn, { backgroundColor: C.gold }]}
      >
        <Text style={styles.emptyBtnText}>Set up my money</Text>
        <Feather name="arrow-right" size={16} color="#fff" />
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
        <Text style={[styles.pageTitle, { color: C.text }]}>Money — sorted</Text>
        <Text style={[styles.pageSubtitle, { color: C.textSecondary }]}>
          A quick look at your week, with a few easy wins if you want them.
        </Text>
      </View>

      {!hasMoneySetup ? (
        <MoneyEmptyState onSetup={goToMoneySetup} />
      ) : (
        <>
          <WeeklySnapshotCard
            money={money!}
            result={result}
            fmt={formatMoneyRound}
          />

          {money && (
            <FoodFocusCard
              estimatedDinnerSpend={result.estimatedDinnerSpend}
              dinnerPlanCost={dinnerPlanCost}
              dinnerInsight={result.dinnerInsight}
              hasMealsSetup={hasMealsSetup}
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
  pageTitle: {
    fontSize: 26,
    fontFamily: "Manrope_700Bold",
    lineHeight: 32,
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
  suggestionsSection: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: "Manrope_700Bold",
    lineHeight: 24,
    marginBottom: 2,
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
});

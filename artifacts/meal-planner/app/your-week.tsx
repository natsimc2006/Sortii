import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { usePlanner } from "@/context/PlannerContext";
import { Recipe, getRecipePrepStyles } from "@/constants/recipes";

const C = Colors.light;

const BUDGET_LABELS: Record<string, string> = {
  "super-budget": "Super Budget",
  "budget": "Budget",
  "standard": "Standard",
  "premium": "Premium",
};

type Suggestion = {
  id: string;
  icon: string;
  message: string;
  cta: string;
  onPress: () => void;
};

type OptionConfig = {
  icon: string;
  accentColor: string;
  bgColor: string;
  title: string;
  sub: string;
  btnLabel: string;
  onPress: () => void;
};

function OptionCard({ icon, accentColor, bgColor, title, sub, btnLabel, onPress }: OptionConfig) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, { borderColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.optionIconBox, { backgroundColor: bgColor }]}>
        <Feather name={icon as any} size={20} color={accentColor} />
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionTitle, { color: C.text }]}>{title}</Text>
        <Text style={[styles.optionSub, { color: C.textSecondary }]}>{sub}</Text>
      </View>
      <View style={[styles.optionBtn, { backgroundColor: accentColor }]}>
        <Text style={styles.optionBtnText}>{btnLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <TouchableOpacity
      style={styles.suggestionCard}
      onPress={suggestion.onPress}
      activeOpacity={0.88}
    >
      <View style={styles.suggestionIcon}>
        <Feather name={suggestion.icon as any} size={14} color={C.primary} />
      </View>
      <View style={styles.suggestionBody}>
        <Text style={[styles.suggestionMessage, { color: C.text }]}>{suggestion.message}</Text>
      </View>
      <View style={styles.suggestionCta}>
        <Text style={[styles.suggestionCtaText, { color: C.primary }]}>{suggestion.cta}</Text>
        <Feather name="chevron-right" size={12} color={C.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function AdjustHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, preferences, getRecipeById, estimatedCostBand } = usePlanner();

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const hasPlan = filledMeals.length > 0;

  const filledRecipes = useMemo(
    () => filledMeals.map((e) => getRecipeById(e.recipeId!)).filter(Boolean) as Recipe[],
    [filledMeals, getRecipeById]
  );

  const budgetLabel = BUDGET_LABELS[preferences.budgetLevel] ?? "Standard";

  const planSummary = hasPlan
    ? `${preferences.householdSize} ${preferences.householdSize === 1 ? "person" : "people"} · ${budgetLabel} · ${estimatedCostBand}/wk`
    : `${preferences.householdSize} ${preferences.householdSize === 1 ? "person" : "people"} · ${budgetLabel}`;

  const suggestions = useMemo<Suggestion[]>(() => {
    if (filledRecipes.length < 2) return [];
    const result: Suggestion[] = [];

    const budgetLevel = preferences.budgetLevel;
    const hasHighCostMeals = filledRecipes.some((r) => r.estimatedCostBand === "high");
    const isLowBudgetPlan = budgetLevel === "super-budget" || budgetLevel === "budget";

    if (hasHighCostMeals && isLowBudgetPlan) {
      result.push({
        id: "budget",
        icon: "trending-down",
        message: "You're spending more than you need to.",
        cta: "Find cheaper swaps",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.replace("/(tabs)/preferences");
        },
      });
    }

    if (result.length < 2) {
      const avgCookTime =
        filledRecipes.reduce((sum, r) => sum + (r.cookTimeMinutes ?? 30), 0) / filledRecipes.length;
      if (avgCookTime > 30) {
        result.push({
          id: "time",
          icon: "clock",
          message: "Busy week? Want quicker dinners?",
          cta: "Switch to faster meals",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(tabs)/preferences");
          },
        });
      }
    }

    if (result.length < 2 && filledRecipes.length >= 3) {
      const hasBatch = filledRecipes.some((r) => getRecipePrepStyles(r).batchCook);
      if (!hasBatch) {
        result.push({
          id: "effort",
          icon: "zap",
          message: "Want to make this week easier?",
          cta: "Add a batch meal",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(tabs)/preferences");
          },
        });
      }
    }

    return result.slice(0, 2);
  }, [filledRecipes, preferences.budgetLevel, router]);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/planner");
    }
  };

  const handleMeals = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/preferences");
  };

  const handleMoney = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
  };

  const handleStartFresh = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/(tabs)/preferences?flow=fresh");
  };

  const sheetPaddingBottom = Platform.OS === "web" ? 32 : insets.bottom + 20;

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={[styles.sheet, { paddingBottom: sheetPaddingBottom }]}>
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderText}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>
              {hasPlan ? "What do you want to tweak?" : "Let's set up your week"}
            </Text>
            <Text style={[styles.sheetSub, { color: C.textSecondary }]}>
              Pick one — we'll handle the rest.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Feather name="x" size={21} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.helperText, { color: "#777" }]}>
          Tweak your week — without starting over.
        </Text>

        <Text style={[styles.planSummaryLabel, { color: C.textMuted }]}>Your current plan</Text>
        <View style={styles.planSummaryRow}>
          <Feather name="bar-chart-2" size={12} color={C.primary} />
          <Text style={[styles.planSummaryText, { color: C.textSecondary }]}>{planSummary}</Text>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsBlock}>
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </View>
        )}

        <View style={styles.options}>
          <OptionCard
            icon="calendar"
            accentColor={C.primary}
            bgColor={C.tealTint}
            title="Meals"
            sub="Change meals, preferences or budget level"
            btnLabel="Update meals"
            onPress={handleMeals}
          />
          <OptionCard
            icon="dollar-sign"
            accentColor={C.gold}
            bgColor="#FEF3C7"
            title="Money"
            sub="Update your weekly numbers"
            btnLabel="Update budget"
            onPress={handleMoney}
          />

          <View style={styles.freshDivider}>
            <View style={[styles.freshDividerLine, { backgroundColor: C.border }]} />
          </View>

          <OptionCard
            icon="refresh-cw"
            accentColor={C.plum}
            bgColor="#F3ECF5"
            title="Start fresh"
            sub="Rebuild your full week from scratch"
            btnLabel="Redo my week"
            onPress={handleStartFresh}
          />
        </View>

        <TouchableOpacity onPress={handleClose} style={styles.cancelRow} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: C.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDE0DE",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sheetHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontSize: 19,
    fontFamily: "Manrope_700Bold",
    lineHeight: 26,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  closeBtn: {
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  planSummaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  planSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F4FAF9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 14,
  },
  planSummaryText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  suggestionsBlock: {
    gap: 8,
    marginBottom: 14,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FAF9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(37,133,127,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E1F4F3",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggestionBody: {
    flex: 1,
  },
  suggestionMessage: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  suggestionCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  suggestionCtaText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  options: {
    gap: 10,
    marginBottom: 16,
  },
  freshDivider: {
    paddingVertical: 2,
  },
  freshDividerLine: {
    height: 1,
    borderRadius: 1,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFAFA",
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  optionBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  cancelRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

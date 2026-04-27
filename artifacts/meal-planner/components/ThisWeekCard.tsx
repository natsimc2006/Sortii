import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MealPlanEntry } from "@/constants/recipes";
import { DAYS_ORDER, getTodayDayIndex } from "@/utils/weekUtils";

const TEAL       = "#2A8F88";
const TEAL_TINT  = "#E6F3F0";
const TEXT       = "#2B2B2B";
const TEXT_MUTED = "#888888";
const BORDER     = "#E6E1D7";
const CARD_BG    = "#FFFDF9";

interface Props {
  plan: MealPlanEntry[];
  allRecipes: { id: string; name: string }[];
  onViewPlan: () => void;
  onShoppingList: () => void;
}

export default function ThisWeekCard({ plan, allRecipes, onViewPlan, onShoppingList }: Props) {
  const todayIdx = getTodayDayIndex();

  const dinners = plan.filter((e) => e.slot === "dinner");
  const filled  = dinners.filter((e) => !!e.recipeId);
  const done    = dinners.filter((e) => !!e.recipeId && DAYS_ORDER.indexOf(e.day as any) < todayIdx);
  const remaining = dinners.filter((e) => !!e.recipeId && DAYS_ORDER.indexOf(e.day as any) >= todayIdx);
  const totalMeals  = filled.length;
  const doneCount   = done.length;
  const remaining0  = remaining.length;

  const headline =
    totalMeals === 0
      ? "Dinners not sorted yet."
      : remaining0 === 0
        ? "All done."
        : `${remaining0} dinner${remaining0 !== 1 ? "s" : ""} left.`;

  return (
    <View style={styles.card}>
      <View style={styles.rail} />
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>THIS WEEK</Text>
          {doneCount > 0 && (
            <View style={styles.donePill}>
              <Text style={styles.donePillText}>{doneCount} done</Text>
            </View>
          )}
        </View>

        <Text style={styles.headline}>{headline}</Text>

        {totalMeals > 0 && (
          <View style={styles.mealList}>
            {DAYS_ORDER.map((day, i) => {
              const entry = dinners.find((e) => e.day === day);
              if (!entry?.recipeId) return null;
              const recipe = allRecipes.find((r) => r.id === entry.recipeId);
              const isPast = i < todayIdx;
              return (
                <View key={day} style={styles.mealRow}>
                  <Text style={[styles.mealDay, isPast && styles.muted]}>{day.slice(0, 3)}</Text>
                  <Text
                    style={[styles.mealName, isPast && styles.strikethrough, isPast && styles.muted]}
                    numberOfLines={1}
                  >
                    {recipe?.name ?? "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {totalMeals === 0 && (
          <Text style={styles.sub}>Nothing planned yet. Takes about a minute.</Text>
        )}

        {totalMeals > 0 && remaining0 > 0 && (
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onViewPlan} activeOpacity={0.75}>
              <Text style={styles.btnSecondaryText}>View plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={onShoppingList} activeOpacity={0.75}>
              <Text style={styles.btnSecondaryText}>Shopping list</Text>
            </TouchableOpacity>
          </View>
        )}

        {totalMeals === 0 && (
          <TouchableOpacity style={styles.btnSecondary} onPress={onViewPlan} activeOpacity={0.75}>
            <Text style={styles.btnSecondaryText}>Sort meals →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  rail: {
    width: 4,
    backgroundColor: TEAL,
  },
  body: {
    flex: 1,
    padding: 15,
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  donePill: {
    backgroundColor: TEAL_TINT,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  donePillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: TEAL,
  },
  headline: {
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
    color: TEXT,
    marginTop: 2,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    marginTop: 2,
  },
  mealList: {
    gap: 3,
    marginTop: 4,
  },
  mealRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  mealDay: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: TEXT_MUTED,
    width: 28,
  },
  mealName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  muted: {
    color: TEXT_MUTED,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: TEAL,
  },
});

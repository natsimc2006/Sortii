// TODO: extract to shared TwoWindowCard primitive when Family Juggle and Money builds
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MealPlanEntry } from "@/constants/recipes";
import { DAYS_ORDER } from "@/utils/weekUtils";

const TEAL       = "#2A8F88";
const GOLD       = "#D29A22";
const GOLD_TINT  = "#F6E6BA";
const PLUM       = "#5E3A4C";
const PLUM_TINT  = "#F3E8EE";
const TEXT       = "#2B2B2B";
const TEXT_MUTED = "#888888";
const BORDER     = "#E6E1D7";
const CARD_BG    = "#FFFDF9";

interface Props {
  nextWeekPlan: MealPlanEntry[] | null;
  isShopWindow: boolean;
  allRecipes: { id: string; name: string }[];
  onGenerate: () => void;
  onViewPlan: () => void;
  onShoppingList: () => void;
}

export default function NextWeekCard({
  nextWeekPlan, isShopWindow, allRecipes, onGenerate, onViewPlan, onShoppingList,
}: Props) {
  const hasPlan = !!nextWeekPlan && nextWeekPlan.some((e) => e.slot === "dinner" && e.recipeId);

  // ── STATE C — plan exists ───────────────────────────────────────────────────
  if (hasPlan) {
    const dinners = nextWeekPlan!.filter((e) => e.slot === "dinner" && e.recipeId);

    return (
      <View style={[styles.card, { backgroundColor: PLUM_TINT, borderColor: PLUM + "40" }]}>
        <View style={[styles.rail, { backgroundColor: PLUM }]} />
        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: PLUM }]}>NEXT WEEK</Text>
            <View style={[styles.pill, { backgroundColor: PLUM + "22" }]}>
              <Text style={[styles.pillText, { color: PLUM }]}>Ready</Text>
            </View>
          </View>

          <Text style={styles.headline}>Sorted. ✓</Text>

          <View style={styles.mealList}>
            {DAYS_ORDER.slice(0, 5).map((day) => {
              const entry = dinners.find((e) => e.day === day);
              if (!entry?.recipeId) return null;
              const recipe = allRecipes.find((r) => r.id === entry.recipeId);
              return (
                <View key={day} style={styles.mealRow}>
                  <Text style={[styles.mealDay, { color: PLUM }]}>{day.slice(0, 3)}</Text>
                  <Text style={styles.mealName} numberOfLines={1}>{recipe?.name ?? "—"}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sub}>
            {isShopWindow
              ? "Your list is ready. Add to cart whenever you're ready."
              : "One less thing to think about."}
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btnSecondary, { borderColor: PLUM }]} onPress={onViewPlan} activeOpacity={0.75}>
              <Text style={[styles.btnSecondaryText, { color: PLUM }]}>View plan</Text>
            </TouchableOpacity>
            {isShopWindow && (
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: GOLD }]} onPress={onShoppingList} activeOpacity={0.75}>
                <Text style={styles.btnPrimaryText}>Shopping list →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── STATE B — shop window, no plan ─────────────────────────────────────────
  if (isShopWindow) {
    return (
      <View style={[styles.card, { backgroundColor: GOLD_TINT, borderColor: GOLD + "60" }]}>
        <View style={[styles.rail, { backgroundColor: GOLD }]} />
        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: GOLD }]}>NEXT WEEK</Text>
            <View style={[styles.pill, { backgroundColor: GOLD + "30" }]}>
              <Text style={[styles.pillText, { color: GOLD }]}>Shop soon</Text>
            </View>
          </View>

          <Text style={styles.headline}>Not sorted yet.</Text>

          <Text style={styles.sub}>
            Weekend's coming. Sort next week now and your list is ready to go.
          </Text>

          <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: GOLD }]} onPress={onGenerate} activeOpacity={0.75}>
            <Text style={styles.btnPrimaryText}>Sort next week →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── STATE A — not shop window, no plan ─────────────────────────────────────
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: BORDER }]}>
      <View style={[styles.rail, { backgroundColor: BORDER }]} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: TEXT_MUTED }]}>NEXT WEEK</Text>
        <Text style={styles.headline}>Nothing planned.</Text>
        <Text style={styles.sub}>Sort next week whenever you're ready.</Text>
        <TouchableOpacity style={[styles.btnSecondary, { borderColor: TEAL }]} onPress={onGenerate} activeOpacity={0.75}>
          <Text style={[styles.btnSecondaryText, { color: TEAL }]}>Plan next week</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  rail: {
    width: 4,
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
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
    width: 28,
  },
  mealName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    flex: 1,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  btnSecondary: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  btnPrimary: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  btnPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});

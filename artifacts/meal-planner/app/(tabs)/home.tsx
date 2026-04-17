import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
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

const allRecipes = allRecipesRaw as { id: string; name: string }[];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const VOICE_LINES = [
  "A steady week ahead.",
  "Thursday's doing the most, but we'll allow it.",
  "Nothing dramatic today. We love that for you.",
  "Future you is already grateful.",
  "One less thing to think about.",
];

function getTodayName(): string {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const voiceLine = useMemo(
    () => VOICE_LINES[Math.floor(Math.random() * VOICE_LINES.length)],
    []
  );

  const todayName = getTodayName();

  const tonightEntry = currentPlan.find(
    (e) => e.day === todayName && e.slot === "dinner"
  );
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;

  const weeklyBreathingRoom = money
    ? Math.round(
        money.weeklyIncome -
          money.fixedWeeklyCosts -
          money.groceriesWeekly -
          (money.eatingOutWeekly ?? 0) -
          (money.otherWeeklySpend ?? 0)
      )
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* A — HEADER */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            sorti<Text style={styles.wordmarkGold}>ii</Text>.
          </Text>
          <Text style={styles.voiceLine}>{voiceLine}</Text>
        </View>

        {/* B — TONIGHT'S DINNER */}
        {tonightRecipe ? (
          <View style={[styles.card, styles.cardTeal]}>
            <Text style={styles.cardLabelTeal}>TONIGHT'S DINNER</Text>
            <Text style={styles.mealName}>{tonightRecipe.name}</Text>
            <Text style={styles.sortedLine}>Sorted.</Text>
          </View>
        ) : (
          <View style={[styles.card, styles.cardGold]}>
            <Text style={styles.cardLabelGold}>TONIGHT</Text>
            <Text style={styles.mealName}>Nothing planned yet.</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/planner")}
              activeOpacity={0.75}
            >
              <Text style={styles.sortTonightLink}>Sort tonight →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* C — WEEK AT A GLANCE */}
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
                    isToday
                      ? styles.dayPillToday
                      : hasMeal
                      ? styles.dayPillMeal
                      : styles.dayPillEmpty,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isToday
                        ? { color: "#fff" }
                        : hasMeal
                        ? { color: "#2B2B2B" }
                        : { color: "#aaa" },
                    ]}
                  >
                    {DAY_ABBR[i]}
                  </Text>
                  <Text style={styles.dayPillEmoji}>
                    {hasMeal ? "🍽" : "·"}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* D — MONEY SNAPSHOT */}
        {hasMoneySetup && weeklyBreathingRoom > 0 ? (
          <View style={[styles.card, styles.cardMoney]}>
            <Text style={styles.cardLabelGold}>THIS WEEK'S BREATHING ROOM</Text>
            <Text style={styles.breathingAmount}>
              {currencySymbol}{weeklyBreathingRoom}
            </Text>
            <Text style={styles.breathingSub}>after meals and fixed costs.</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/money")}
            activeOpacity={0.75}
            style={[styles.card, styles.cardPlum]}
          >
            <Text style={styles.cardLabelPlum}>MONEY</Text>
            <Text style={styles.mealName}>
              See how your week looks financially.
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ paddingBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F3EB" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  header: { gap: 4, marginBottom: 4 },
  wordmark: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    color: "#2B2B2B",
  },
  wordmarkGold: { color: "#D29A22" },
  voiceLine: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "#2A8F88",
    marginTop: 4,
  },

  card: { borderRadius: 12, padding: 16, gap: 6 },
  cardTeal: {
    backgroundColor: "#E6F3F0",
    borderWidth: 1,
    borderColor: "#2A8F88",
    borderLeftWidth: 3,
    borderLeftColor: "#2A8F88",
  },
  cardGold: {
    backgroundColor: "#F6E6BA",
    borderWidth: 1,
    borderColor: "#D29A22",
    borderLeftWidth: 3,
    borderLeftColor: "#D29A22",
  },
  cardMoney: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E1D7",
    borderLeftWidth: 3,
    borderLeftColor: "#D29A22",
  },
  cardPlum: {
    backgroundColor: "#F3E8EE",
    borderWidth: 1,
    borderColor: "#5E3A4C",
    borderLeftWidth: 3,
    borderLeftColor: "#5E3A4C",
  },

  cardLabelTeal: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.12,
    textTransform: "uppercase",
    color: "#2A8F88",
  },
  cardLabelGold: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.12,
    textTransform: "uppercase",
    color: "#D29A22",
  },
  cardLabelPlum: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.12,
    textTransform: "uppercase",
    color: "#5E3A4C",
  },

  mealName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#2B2B2B",
  },
  sortedLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "#2A8F88",
  },
  sortTonightLink: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#2A8F88",
    marginTop: 2,
  },

  weekSection: { gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#2A8F88",
  },
  weekStrip: { gap: 8, paddingBottom: 2 },
  dayPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
  },
  dayPillToday: { backgroundColor: "#2A8F88", borderColor: "#2A8F88" },
  dayPillMeal: { backgroundColor: "#FFFFFF", borderColor: "#E6E1D7" },
  dayPillEmpty: { backgroundColor: "#F7F3EB", borderColor: "#E6E1D7" },
  dayPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dayPillEmoji: { fontSize: 12 },

  breathingAmount: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#2A8F88",
  },
  breathingSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#888888",
  },
});

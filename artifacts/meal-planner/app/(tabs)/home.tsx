import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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

const TEAL = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD = "#D29A22";
const GOLD_TINT = "#F6E6BA";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const BG = "#F7F3EB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6E1D7";
const TEXT = "#2B2B2B";
const TEXT_MUTED = "#888888";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTodayName() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function getWeeklySummary(filled: number): string {
  if (filled === 0) return "The week's wide open. Could go either way.";
  if (filled <= 2) return `${filled} dinners sorted. A gentle start.`;
  if (filled === 3) return "You're sorted for dinner till mid-week. We love a small win.";
  if (filled <= 5) return "A fairly steady week. Dinner's at least behaving itself.";
  if (filled === 6) return "Almost fully sorted. One more and you're done.";
  return "Week sorted for dinner. That's the spirit.";
}

function getResetLines(): string[] {
  return [
    "Just one thing: what's for dinner tonight?",
    "Let's keep this light.",
    "A couple of small things. That's enough.",
    "One step at a time is perfectly fine.",
  ];
}

export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const [resetMode, setResetMode] = useState(false);

  const todayName = getTodayName();

  const filledDinners = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId);
  const plannedCount = filledDinners.length;

  const tonightEntry = currentPlan.find((e) => e.day === todayName && e.slot === "dinner");
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

  const greeting = useMemo(() => getGreeting(), []);
  const summary = useMemo(() => getWeeklySummary(plannedCount), [plannedCount]);
  const resetLine = useMemo(
    () => getResetLines()[Math.floor(Math.random() * getResetLines().length)],
    []
  );

  // ── Reset mode: show only 1-3 high-priority actions ──────────
  if (resetMode) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.wordmark}>
              sorti<Text style={styles.wordmarkGold}>ii</Text>.
            </Text>
            <Text style={styles.voiceLine}>{resetLine}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: TEAL_TINT, borderColor: TEAL, borderLeftWidth: 3, borderLeftColor: TEAL }]}>
            <Text style={styles.cardLabelTeal}>RESET MODE</Text>
            <Text style={[styles.mealName, { fontSize: 15, lineHeight: 22 }]}>
              We've simplified everything. Just a few gentle things to focus on.
            </Text>
          </View>

          {!tonightRecipe && (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/meals")}
              activeOpacity={0.78}
              style={[styles.card, styles.cardGold]}
            >
              <Text style={styles.cardLabelGold}>ONE THING</Text>
              <Text style={styles.mealName}>Sort dinner for tonight.</Text>
              <Text style={styles.sortTonightLink}>Go to Meals →</Text>
            </TouchableOpacity>
          )}

          {tonightRecipe && (
            <View style={[styles.card, styles.cardTeal]}>
              <Text style={styles.cardLabelTeal}>TONIGHT</Text>
              <Text style={styles.mealName}>{tonightRecipe.name}</Text>
              <Text style={styles.sortedLine}>Dinner sorted. ✓</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setResetMode(false)}
            style={styles.resetExitBtn}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={14} color={TEXT_MUTED} />
            <Text style={styles.resetExitText}>Back to full view</Text>
          </TouchableOpacity>

          <View style={{ paddingBottom: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Normal mode ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* A — Header */}
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>
              sorti<Text style={styles.wordmarkGold}>ii</Text>.
            </Text>
            <Text style={styles.voiceLine}>{greeting} {summary}</Text>
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setResetMode(true)}
            activeOpacity={0.75}
          >
            <Feather name="wind" size={14} color={TEAL} />
            <Text style={styles.resetBtnText}>Breathe</Text>
          </TouchableOpacity>
        </View>

        {/* B — Tonight's dinner */}
        {tonightRecipe ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/meals")}
            activeOpacity={0.8}
            style={[styles.card, styles.cardTeal]}
          >
            <Text style={styles.cardLabelTeal}>TONIGHT'S DINNER</Text>
            <Text style={styles.mealName}>{tonightRecipe.name}</Text>
            <Text style={styles.sortedLine}>Sorted. ✓</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/meals")}
            activeOpacity={0.8}
            style={[styles.card, styles.cardGold]}
          >
            <Text style={styles.cardLabelGold}>TONIGHT</Text>
            <Text style={styles.mealName}>Nothing planned yet.</Text>
            <Text style={styles.sortTonightLink}>Sort tonight →</Text>
          </TouchableOpacity>
        )}

        {/* C — Week at a glance */}
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

        {/* D — Money snapshot */}
        {hasMoneySetup && weeklyBreathingRoom > 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/money")}
            activeOpacity={0.8}
            style={[styles.card, styles.cardMoney]}
          >
            <Text style={styles.cardLabelGold}>BREATHING ROOM THIS WEEK</Text>
            <Text style={styles.breathingAmount}>
              {currencySymbol}{weeklyBreathingRoom}
            </Text>
            <Text style={styles.breathingSub}>after meals and fixed costs.</Text>
          </TouchableOpacity>
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
            <Text style={styles.sortTonightLink} onPress={() => router.push("/(tabs)/more")}>
              Set it up →
            </Text>
          </TouchableOpacity>
        )}

        {/* E — Family placeholder */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/family")}
          activeOpacity={0.8}
          style={[styles.card, styles.cardNeutral]}
        >
          <View style={styles.cardRow}>
            <Ionicons name="people-outline" size={18} color={PLUM} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabelPlum}>FAMILY</Text>
              <Text style={[styles.mealName, { fontSize: 15 }]}>
                Nothing on here yet.{" "}
                <Text style={{ fontStyle: "italic", fontFamily: "Inter_400Regular" }}>
                  A rare and peaceful sight.
                </Text>
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#ccc" />
          </View>
        </TouchableOpacity>

        {/* F — Appointments + Bills: Coming soon row */}
        <View style={styles.placeholderRow}>
          <View style={[styles.placeholderCard, { borderColor: TEAL + "40" }]}>
            <Feather name="calendar" size={16} color={TEAL} />
            <Text style={[styles.placeholderLabel, { color: TEAL }]}>Appointments</Text>
            <Text style={styles.placeholderSoon}>Soon</Text>
          </View>
          <View style={[styles.placeholderCard, { borderColor: "#4A7B5E40" }]}>
            <Feather name="file-text" size={16} color="#4A7B5E" />
            <Text style={[styles.placeholderLabel, { color: "#4A7B5E" }]}>Bills</Text>
            <Text style={styles.placeholderSoon}>Soon</Text>
          </View>
        </View>

        <View style={{ paddingBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  header: { flex: 1, gap: 4 },
  wordmark: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    color: TEXT,
  },
  wordmarkGold: { color: GOLD },
  voiceLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
    marginTop: 4,
    lineHeight: 19,
  },

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: TEAL_TINT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: TEAL + "30",
    marginTop: 4,
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },

  resetExitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    padding: 4,
    marginTop: 4,
  },
  resetExitText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },

  card: { borderRadius: 14, padding: 16, gap: 6 },
  cardTeal: {
    backgroundColor: TEAL_TINT,
    borderWidth: 1,
    borderColor: TEAL + "60",
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  cardGold: {
    backgroundColor: GOLD_TINT,
    borderWidth: 1,
    borderColor: GOLD + "60",
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  cardMoney: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  cardPlum: {
    backgroundColor: PLUM_TINT,
    borderWidth: 1,
    borderColor: PLUM + "40",
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
  },
  cardNeutral: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: PLUM + "80",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cardLabelTeal: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: TEAL,
  },
  cardLabelGold: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: GOLD,
  },
  cardLabelPlum: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: PLUM,
  },

  mealName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 24,
  },
  sortedLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
  },
  sortTonightLink: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
    marginTop: 2,
  },

  breathingAmount: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: TEAL,
  },
  breathingSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },

  weekSection: { gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: TEAL,
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
  dayPillToday: { backgroundColor: TEAL, borderColor: TEAL },
  dayPillMeal: { backgroundColor: CARD_BG, borderColor: BORDER },
  dayPillEmpty: { backgroundColor: BG, borderColor: BORDER },
  dayPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dayPillEmoji: { fontSize: 12 },

  placeholderRow: {
    flexDirection: "row",
    gap: 12,
  },
  placeholderCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 6,
  },
  placeholderLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  placeholderSoon: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#aaa",
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});

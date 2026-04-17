import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
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
const GREEN = "#4A7B5E";
const GREEN_TINT = "#E8F2EC";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getTodayName() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

interface ModuleCard {
  icon: string;
  color: string;
  tint: string;
  title: string;
  sub: string;
  route: string;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    icon: "calendar",
    color: TEAL,
    tint: TEAL_TINT,
    title: "Plan the week",
    sub: "Fill your dinners and lunches",
    route: "/(tabs)/planner",
  },
  {
    icon: "shopping-cart",
    color: GREEN,
    tint: GREEN_TINT,
    title: "Shopping list",
    sub: "Everything you need, grouped",
    route: "/(tabs)/shopping",
  },
  {
    icon: "dollar-sign",
    color: GOLD,
    tint: GOLD_TINT,
    title: "Meal budget",
    sub: "Breathing room and savings",
    route: "/(tabs)/money",
  },
  {
    icon: "book-open",
    color: PLUM,
    tint: PLUM_TINT,
    title: "Browse recipes",
    sub: "300+ meals to choose from",
    route: "/(tabs)/recipes",
  },
];

export default function MealsScreen() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { currencySymbol } = useLocale();

  const todayName = getTodayName();
  const filledDinners = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId);
  const tonightEntry = currentPlan.find((e) => e.day === todayName && e.slot === "dinner");
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;

  const plannedCount = filledDinners.length;

  function getMealStatusLine() {
    if (plannedCount === 0) return "Nothing planned yet. The week's wide open.";
    if (plannedCount <= 2) return `${plannedCount} dinner${plannedCount > 1 ? "s" : ""} sorted. A start.`;
    if (plannedCount <= 5) return `${plannedCount} dinners sorted. A decent week taking shape.`;
    return `${plannedCount} dinners sorted. Dinner's behaving itself.`;
  }

  const handleNav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Meals</Text>
          <Text style={styles.pageSubtitle}>{getMealStatusLine()}</Text>
        </View>

        {/* Tonight's dinner quick-view */}
        <TouchableOpacity
          onPress={() => handleNav("/(tabs)/planner")}
          activeOpacity={0.8}
          style={[
            styles.tonightCard,
            tonightRecipe ? styles.tonightCardFilled : styles.tonightCardEmpty,
          ]}
        >
          <View style={styles.tonightInner}>
            <Text
              style={[
                styles.tonightLabel,
                { color: tonightRecipe ? TEAL : GOLD },
              ]}
            >
              TONIGHT'S DINNER
            </Text>
            <Text style={styles.tonightMeal}>
              {tonightRecipe ? tonightRecipe.name : "Nothing planned yet"}
            </Text>
            {tonightRecipe ? (
              <Text style={styles.tonightSorted}>Sorted. ✓</Text>
            ) : (
              <Text style={[styles.tonightSorted, { color: GOLD }]}>
                Tap to plan tonight →
              </Text>
            )}
          </View>
          <View
            style={[
              styles.tonightChevron,
              { backgroundColor: tonightRecipe ? TEAL + "18" : GOLD + "18" },
            ]}
          >
            <Feather
              name="chevron-right"
              size={18}
              color={tonightRecipe ? TEAL : GOLD}
            />
          </View>
        </TouchableOpacity>

        {/* Module cards — 2-column grid */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>WHAT WOULD YOU LIKE TO DO?</Text>
        </View>
        <View style={styles.grid}>
          {MODULE_CARDS.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={styles.gridCard}
              onPress={() => handleNav(card.route)}
              activeOpacity={0.78}
            >
              <View style={[styles.gridIconWrap, { backgroundColor: card.tint }]}>
                <Feather name={card.icon as any} size={22} color={card.color} />
              </View>
              <Text style={styles.gridTitle}>{card.title}</Text>
              <Text style={styles.gridSub}>{card.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>THIS WEEK</Text>
            <Text style={styles.progressCount}>
              {plannedCount} / 7 dinners
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((plannedCount / 7) * 100)}%` },
              ]}
            />
          </View>
          {plannedCount < 7 && (
            <Text style={styles.progressHint}>
              {7 - plannedCount} dinner{7 - plannedCount !== 1 ? "s" : ""} still to fill.{" "}
              <Text
                style={styles.progressLink}
                onPress={() => handleNav("/(tabs)/planner")}
              >
                Sort them now →
              </Text>
            </Text>
          )}
        </View>

        <View style={{ paddingBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  header: { gap: 4, marginBottom: 4 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Manrope_700Bold",
    color: TEXT,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    marginTop: 2,
    fontStyle: "italic",
  },

  tonightCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tonightCardFilled: {
    backgroundColor: TEAL_TINT,
    borderColor: TEAL,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  tonightCardEmpty: {
    backgroundColor: GOLD_TINT,
    borderColor: GOLD,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  tonightInner: { flex: 1, gap: 3 },
  tonightLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tonightMeal: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 22,
  },
  tonightSorted: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
    marginTop: 1,
  },
  tonightChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  sectionLabel: { marginBottom: -4 },
  sectionLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    color: TEXT_MUTED,
    textTransform: "uppercase",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    width: "47%",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 8,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  gridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  gridTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 18,
  },
  gridSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    lineHeight: 15,
  },

  progressCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    color: TEXT_MUTED,
    textTransform: "uppercase",
  },
  progressCount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#F0EDE8",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },
  progressLink: {
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },
});

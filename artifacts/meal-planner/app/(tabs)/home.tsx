import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
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

const SUMMARIES_EMPTY = [
  "The week's wide open. Nothing dramatic yet.",
  "Not much happening yet. Could go either way.",
  "A blank slate. Plenty of time.",
];
const SUMMARIES_LIGHT = [
  "A light week, by the look of it.",
  "A couple of things taking shape. Nothing unmanageable.",
  "A quiet one. We'll take it.",
];
const SUMMARIES_STEADY = [
  "A fairly steady week. Dinner's cooperating.",
  "A couple of moving parts, but all quite manageable.",
  "You've got a bit on, but nothing dramatic.",
];
const SUMMARIES_SORTED = [
  "A fairly sorted week. Not much to worry about.",
  "You're in reasonable shape. Dinner's cooperating and nothing's on fire.",
  "A solid week. Organised without being smug about it.",
];

function getWeeklySummary(filled: number): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (filled === 0) return pick(SUMMARIES_EMPTY);
  if (filled <= 2) return pick(SUMMARIES_LIGHT);
  if (filled <= 5) return pick(SUMMARIES_STEADY);
  return pick(SUMMARIES_SORTED);
}

// ── Sort this out overlay ──────────────────────────────────────
function SortItOutOverlay({
  visible,
  tonightRecipe,
  onDismiss,
  onCheckDinner,
  onAddActivity,
  onViewPlan,
}: {
  visible: boolean;
  tonightRecipe: { name: string } | null;
  onDismiss: () => void;
  onCheckDinner: () => void;
  onAddActivity: () => void;
  onViewPlan: () => void;
}) {
  if (!visible) return null;

  const actions = [
    {
      icon: "moon",
      label: tonightRecipe ? `Tonight: ${tonightRecipe.name}` : "Check tonight's dinner",
      color: tonightRecipe ? TEAL : GOLD,
      done: !!tonightRecipe,
      onPress: onCheckDinner,
    },
    {
      icon: "star",
      label: "Add one family activity",
      color: GOLD,
      done: false,
      onPress: onAddActivity,
    },
    {
      icon: "calendar",
      label: "Look at this week's plan",
      color: TEAL,
      done: false,
      onPress: onViewPlan,
    },
  ];

  return (
    <Pressable style={styles.sortOverlay} onPress={onDismiss}>
      <Pressable style={styles.sortCard} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.sortTitle}>Alright. Let's keep this simple.</Text>

        <View style={styles.sortActions}>
          {actions.map(({ icon, label, color, done, onPress }) => (
            <TouchableOpacity
              key={label}
              style={styles.sortAction}
              onPress={onPress}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.sortActionIcon,
                  { backgroundColor: color + "18" },
                ]}
              >
                <Feather name={icon as any} size={15} color={done ? TEAL : color} />
              </View>
              <Text
                style={[
                  styles.sortActionLabel,
                  done && { color: TEAL, textDecorationLine: "line-through", opacity: 0.6 },
                ]}
              >
                {label}
              </Text>
              {!done && (
                <Feather name="chevron-right" size={14} color="#ccc" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.sortDone} onPress={onDismiss} activeOpacity={0.75}>
          <Text style={styles.sortDoneText}>That'll do.</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const [sortItOutVisible, setSortItOutVisible] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* A — Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.wordmark}>
                sorti<Text style={styles.wordmarkGold}>ii</Text>.
              </Text>
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <TouchableOpacity
              style={styles.sortItOutBtn}
              onPress={() => setSortItOutVisible(true)}
              activeOpacity={0.75}
            >
              <Feather name="zap" size={13} color={TEAL} />
              <Text style={styles.sortItOutText}>Sort this out</Text>
            </TouchableOpacity>
          </View>

          {/* Weekly summary */}
          <Text style={styles.summary}>{summary}</Text>

          {/* B — Tonight's dinner (equal weight card) */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/meals")}
            activeOpacity={0.8}
            style={[styles.card, tonightRecipe ? styles.cardTeal : styles.cardGold]}
          >
            <View style={styles.cardRow}>
              <View>
                <Text
                  style={[
                    styles.cardLabel,
                    { color: tonightRecipe ? TEAL : GOLD },
                  ]}
                >
                  TONIGHT'S DINNER
                </Text>
                <Text style={styles.cardTitle}>
                  {tonightRecipe ? tonightRecipe.name : "Nothing planned yet."}
                </Text>
                <Text
                  style={[
                    styles.cardSub,
                    { color: tonightRecipe ? TEAL : GOLD },
                  ]}
                >
                  {tonightRecipe ? "Sorted. ✓" : "Tap to sort tonight →"}
                </Text>
              </View>
              <View
                style={[
                  styles.cardChevronWrap,
                  {
                    backgroundColor: tonightRecipe
                      ? TEAL + "18"
                      : GOLD + "18",
                  },
                ]}
              >
                <Feather
                  name="chevron-right"
                  size={16}
                  color={tonightRecipe ? TEAL : GOLD}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* C — Family (equal weight) */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/family")}
            activeOpacity={0.8}
            style={[styles.card, styles.cardNeutral]}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: PLUM }]}>FAMILY</Text>
                <Text style={styles.cardTitle}>Nothing on here yet.</Text>
                <Text style={[styles.cardSub, { fontStyle: "italic", color: TEXT_MUTED }]}>
                  A rare and peaceful sight.
                </Text>
              </View>
              <View style={[styles.cardChevronWrap, { backgroundColor: PLUM + "12" }]}>
                <Feather name="chevron-right" size={16} color={PLUM} />
              </View>
            </View>
          </TouchableOpacity>

          {/* D — Money (equal weight) */}
          {hasMoneySetup && weeklyBreathingRoom > 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/money")}
              activeOpacity={0.8}
              style={[styles.card, styles.cardNeutral]}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                  <Text style={styles.cardTitle}>
                    You've got {currencySymbol}{weeklyBreathingRoom} breathing room this week.
                  </Text>
                  <Text style={[styles.cardSub, { color: TEXT_MUTED }]}>
                    After meals and fixed costs.
                  </Text>
                </View>
                <View style={[styles.cardChevronWrap, { backgroundColor: GOLD + "12" }]}>
                  <Feather name="chevron-right" size={16} color={GOLD} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/more")}
              activeOpacity={0.8}
              style={[styles.card, styles.cardNeutral]}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: GOLD }]}>MONEY</Text>
                  <Text style={styles.cardTitle}>
                    See how your week looks financially.
                  </Text>
                  <Text style={[styles.cardSub, { color: TEAL }]}>
                    Set it up →
                  </Text>
                </View>
                <View style={[styles.cardChevronWrap, { backgroundColor: GOLD + "12" }]}>
                  <Feather name="chevron-right" size={16} color={GOLD} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* E — Week at a glance (mixed-signal ready) */}
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
                          ? { color: TEXT }
                          : { color: "#bbb" },
                      ]}
                    >
                      {DAY_ABBR[i]}
                    </Text>
                    <View style={styles.dayDots}>
                      {hasMeal && (
                        <View style={[styles.dot, { backgroundColor: isToday ? "#fff" : TEAL }]} />
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* F — Placeholder row */}
          <View style={styles.placeholderRow}>
            <View style={[styles.placeholderCard, { borderColor: TEAL + "30" }]}>
              <Feather name="calendar" size={15} color={TEAL} />
              <Text style={[styles.placeholderLabel, { color: TEAL }]}>Appointments</Text>
              <View style={styles.soonPill}><Text style={styles.soonText}>Soon</Text></View>
            </View>
            <View style={[styles.placeholderCard, { borderColor: "#4A7B5E30" }]}>
              <Feather name="file-text" size={15} color="#4A7B5E" />
              <Text style={[styles.placeholderLabel, { color: "#4A7B5E" }]}>Bills</Text>
              <View style={styles.soonPill}><Text style={styles.soonText}>Soon</Text></View>
            </View>
          </View>

          <View style={{ paddingBottom: 32 }} />
        </ScrollView>

        {/* Sort it out overlay — above scroll, within safe area */}
        <SortItOutOverlay
          visible={sortItOutVisible}
          tonightRecipe={tonightRecipe}
          onDismiss={() => setSortItOutVisible(false)}
          onCheckDinner={() => {
            setSortItOutVisible(false);
            router.push("/(tabs)/meals");
          }}
          onAddActivity={() => {
            setSortItOutVisible(false);
            router.push("/(tabs)/family");
          }}
          onViewPlan={() => {
            setSortItOutVisible(false);
            router.push("/(tabs)/planner");
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: { flex: 1, gap: 2 },
  wordmark: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_700Bold",
    color: TEXT,
  },
  wordmarkGold: { color: GOLD },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },
  summary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
    lineHeight: 20,
    marginTop: -2,
    marginBottom: 4,
  },

  sortItOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: TEAL_TINT,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: TEAL + "30",
    marginTop: 2,
    flexShrink: 0,
  },
  sortItOutText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  cardTeal: {
    backgroundColor: TEAL_TINT,
    borderColor: TEAL + "50",
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  cardGold: {
    backgroundColor: GOLD_TINT,
    borderColor: GOLD + "50",
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  cardNeutral: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 22,
    flex: 1,
    flexWrap: "wrap",
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  cardChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  weekSection: { gap: 8, marginTop: 4 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: TEXT_MUTED,
  },
  weekStrip: { gap: 6, paddingBottom: 2 },
  dayPill: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    minWidth: 44,
  },
  dayPillToday: { backgroundColor: TEAL, borderColor: TEAL },
  dayPillMeal: { backgroundColor: CARD_BG, borderColor: BORDER },
  dayPillEmpty: { backgroundColor: BG, borderColor: BORDER },
  dayPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dayDots: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },

  placeholderRow: { flexDirection: "row", gap: 10 },
  placeholderCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 5,
    alignItems: "flex-start",
  },
  placeholderLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  soonPill: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#aaa",
  },

  // Sort it out overlay
  sortOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 100,
  },
  sortCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    gap: 0,
    ...Platform.select({
      web: { boxShadow: "0px 8px 32px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 20,
      },
    }),
  },
  sortTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    marginBottom: 16,
    lineHeight: 24,
  },
  sortActions: { gap: 2, marginBottom: 20 },
  sortAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  sortActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sortActionLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: TEXT,
  },
  sortDone: {
    backgroundColor: "#F7F3EB",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  sortDoneText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: TEXT_MUTED,
  },
});

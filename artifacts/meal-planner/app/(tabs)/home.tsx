import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
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
const BG = "#F7F3EB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6E1D7";
const TEXT = "#2B2B2B";
const TEXT_MUTED = "#888888";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

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
  "You're in reasonable shape. Nothing's on fire.",
  "A solid week. Organised without being smug about it.",
];

function getWeeklySummary(filled: number): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (filled === 0) return pick(SUMMARIES_EMPTY);
  if (filled <= 2) return pick(SUMMARIES_LIGHT);
  if (filled <= 5) return pick(SUMMARIES_STEADY);
  return pick(SUMMARIES_SORTED);
}

// ── "Help me sort this" overlay ────────────────────────────────
interface SimpleAction {
  id: string;
  icon: string;
  text: string;
  sub: string;
  color: string;
  startDone: boolean;
}

function buildActions(
  tonightRecipe: { name: string } | null,
  plannedCount: number,
  tomorrowName: string,
  tomorrowRecipe: { name: string } | null
): SimpleAction[] {
  const actions: SimpleAction[] = [];

  // 1 — Tonight
  if (tonightRecipe) {
    actions.push({
      id: "tonight",
      icon: "moon",
      text: `Tonight: ${tonightRecipe.name}`,
      sub: "Already sorted. Nothing to do here.",
      color: TEAL,
      startDone: true,
    });
  } else {
    actions.push({
      id: "tonight",
      icon: "moon",
      text: "Glance at tonight's dinner",
      sub: "Just acknowledge it. That's all.",
      color: GOLD,
      startDone: false,
    });
  }

  // 2 — Week or tomorrow
  if (plannedCount >= 3) {
    actions.push({
      id: "week",
      icon: "calendar",
      text: `${plannedCount} dinners already planned`,
      sub: "Further along than it feels.",
      color: TEAL,
      startDone: true,
    });
  } else if (tomorrowRecipe) {
    actions.push({
      id: "tomorrow",
      icon: "calendar",
      text: `Tomorrow: ${tomorrowRecipe.name}`,
      sub: "One less thing to think about.",
      color: TEAL,
      startDone: true,
    });
  } else {
    actions.push({
      id: "week",
      icon: "calendar",
      text: "Add one meal for later this week",
      sub: "Just one. That's enough for now.",
      color: GOLD,
      startDone: false,
    });
  }

  // 3 — Affirmation (always last)
  actions.push({
    id: "affirm",
    icon: "heart",
    text: "One thing at a time is enough.",
    sub: "That's not an opinion. It's just true.",
    color: PLUM,
    startDone: false,
  });

  return actions;
}

function HelpOverlay({
  visible,
  tonightRecipe,
  plannedCount,
  tomorrowName,
  tomorrowRecipe,
  onDismiss,
}: {
  visible: boolean;
  tonightRecipe: { name: string } | null;
  plannedCount: number;
  tomorrowName: string;
  tomorrowRecipe: { name: string } | null;
  onDismiss: () => void;
}) {
  const actions = useMemo(
    () => buildActions(tonightRecipe, plannedCount, tomorrowName, tomorrowRecipe),
    [visible]
  );

  const [done, setDone] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    actions.forEach((a) => { if (a.startDone) initial[a.id] = true; });
    return initial;
  });

  const tapCount = Object.values(done).filter(Boolean).length - actions.filter((a) => a.startDone).length;
  const readyToDismiss = tapCount >= 1 || actions.every((a) => done[a.id]);

  function handleAction(id: string) {
    setDone((prev) => ({ ...prev, [id]: true }));
  }

  if (!visible) return null;

  return (
    <Pressable style={styles.helpBackdrop} onPress={onDismiss}>
      <Pressable style={styles.helpCard} onPress={(e) => e.stopPropagation()}>
        {/* Header */}
        <Text style={styles.helpTitle}>Alright. Let's keep this simple.</Text>

        {/* Actions */}
        <View style={styles.helpActions}>
          {actions.map((action) => {
            const isDone = !!done[action.id];
            return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.helpAction,
                  isDone && styles.helpActionDone,
                ]}
                onPress={() => handleAction(action.id)}
                activeOpacity={isDone ? 1 : 0.72}
              >
                <View
                  style={[
                    styles.helpActionIcon,
                    {
                      backgroundColor: isDone
                        ? TEAL + "18"
                        : action.color + "15",
                    },
                  ]}
                >
                  <Feather
                    name={isDone ? "check" : (action.icon as any)}
                    size={15}
                    color={isDone ? TEAL : action.color}
                  />
                </View>
                <View style={styles.helpActionText}>
                  <Text
                    style={[
                      styles.helpActionLabel,
                      isDone && styles.helpActionLabelDone,
                    ]}
                  >
                    {action.text}
                  </Text>
                  <Text style={styles.helpActionSub}>{action.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* That'll do */}
        <TouchableOpacity
          style={[
            styles.helpDismiss,
            readyToDismiss
              ? styles.helpDismissReady
              : styles.helpDismissWaiting,
          ]}
          onPress={readyToDismiss ? onDismiss : undefined}
          activeOpacity={readyToDismiss ? 0.78 : 1}
        >
          <Text
            style={[
              styles.helpDismissText,
              readyToDismiss
                ? styles.helpDismissTextReady
                : styles.helpDismissTextWaiting,
            ]}
          >
            {readyToDismiss ? "That'll do." : "Tap one to acknowledge it."}
          </Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const [helpVisible, setHelpVisible] = useState(false);

  const todayName = getTodayName();
  const todayIdx = DAYS.indexOf(todayName);
  const tomorrowName = DAYS[(todayIdx + 1) % 7] ?? DAYS[0];

  const filledDinners = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId);
  const plannedCount = filledDinners.length;

  const tonightEntry = currentPlan.find((e) => e.day === todayName && e.slot === "dinner");
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;

  const tomorrowEntry = currentPlan.find((e) => e.day === tomorrowName && e.slot === "dinner");
  const tomorrowRecipe = tomorrowEntry?.recipeId
    ? allRecipes.find((r) => r.id === tomorrowEntry.recipeId) ?? null
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
              style={styles.helpBtn}
              onPress={() => setHelpVisible(true)}
              activeOpacity={0.75}
            >
              <Feather name="zap" size={13} color={TEAL} />
              <Text style={styles.helpBtnText}>Help me sort this</Text>
            </TouchableOpacity>
          </View>

          {/* Weekly summary */}
          <Text style={styles.summary}>{summary}</Text>

          {/* B — Tonight's dinner */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/meals")}
            activeOpacity={0.8}
            style={[styles.card, tonightRecipe ? styles.cardTeal : styles.cardGold]}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: tonightRecipe ? TEAL : GOLD }]}>
                  TONIGHT'S DINNER
                </Text>
                <Text style={styles.cardTitle}>
                  {tonightRecipe ? tonightRecipe.name : "Nothing planned yet."}
                </Text>
                <Text style={[styles.cardSub, { color: tonightRecipe ? TEAL : GOLD }]}>
                  {tonightRecipe ? "Sorted. ✓" : "Tap to sort tonight →"}
                </Text>
              </View>
              <View style={[styles.cardChevron, { backgroundColor: (tonightRecipe ? TEAL : GOLD) + "18" }]}>
                <Feather name="chevron-right" size={16} color={tonightRecipe ? TEAL : GOLD} />
              </View>
            </View>
          </TouchableOpacity>

          {/* C — Family */}
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
              <View style={[styles.cardChevron, { backgroundColor: PLUM + "12" }]}>
                <Feather name="chevron-right" size={16} color={PLUM} />
              </View>
            </View>
          </TouchableOpacity>

          {/* D — Money */}
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
                <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
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
                  <Text style={styles.cardTitle}>See how your week looks financially.</Text>
                  <Text style={[styles.cardSub, { color: TEAL }]}>Set it up →</Text>
                </View>
                <View style={[styles.cardChevron, { backgroundColor: GOLD + "12" }]}>
                  <Feather name="chevron-right" size={16} color={GOLD} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* E — Week at a glance */}
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
                        isToday ? { color: "#fff" } : hasMeal ? { color: TEXT } : { color: "#bbb" },
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

          {/* F — Coming soon row */}
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

        {/* Help me sort this overlay */}
        <HelpOverlay
          visible={helpVisible}
          tonightRecipe={tonightRecipe}
          plannedCount={plannedCount}
          tomorrowName={tomorrowName}
          tomorrowRecipe={tomorrowRecipe}
          onDismiss={() => setHelpVisible(false)}
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
  wordmark: { fontSize: 26, fontFamily: "PlayfairDisplay_700Bold", color: TEXT },
  wordmarkGold: { color: GOLD },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  summary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEAL,
    lineHeight: 20,
    marginTop: -2,
    marginBottom: 4,
  },

  helpBtn: {
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
  helpBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  card: { borderRadius: 14, borderWidth: 1, padding: 15 },
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
  cardNeutral: { backgroundColor: CARD_BG, borderColor: BORDER },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  cardChevron: {
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
  placeholderLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  soonPill: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soonText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#aaa" },

  // ── Help me sort this overlay ──
  helpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 28, 24, 0.62)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 100,
  },
  helpCard: {
    backgroundColor: "#FEFCF8",
    borderRadius: 22,
    padding: 24,
    width: "100%",
    ...Platform.select({
      web: { boxShadow: "0px 12px 40px rgba(0,0,0,0.22)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 28,
        elevation: 24,
      },
    }),
  },
  helpTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    marginBottom: 18,
    lineHeight: 26,
  },
  helpActions: { gap: 6, marginBottom: 20 },
  helpAction: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F7F3EB",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "transparent",
  },
  helpActionDone: {
    backgroundColor: TEAL_TINT,
    borderColor: TEAL + "30",
  },
  helpActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  helpActionText: { flex: 1, gap: 2 },
  helpActionLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: TEXT,
    lineHeight: 20,
  },
  helpActionLabelDone: {
    color: TEAL,
    textDecorationLine: "line-through",
    opacity: 0.65,
  },
  helpActionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    lineHeight: 17,
    fontStyle: "italic",
  },

  helpDismiss: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  helpDismissReady: { backgroundColor: TEAL },
  helpDismissWaiting: { backgroundColor: "#EDEBE7" },
  helpDismissText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  helpDismissTextReady: { color: "#fff" },
  helpDismissTextWaiting: { color: "#bbb" },
});

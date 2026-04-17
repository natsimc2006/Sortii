import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { buildHelpActions, HelpAction } from "@/utils/decisionEngine";
import { computeNudge, recordAppOpen, Nudge } from "@/utils/nudgeEngine";

const allRecipes = allRecipesRaw as { id: string; name: string }[];

const TEAL      = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD      = "#D29A22";
const GOLD_TINT = "#F6E6BA";
const PLUM      = "#5E3A4C";
const BG        = "#F7F3EB";
const CARD_BG   = "#FFFFFF";
const BORDER    = "#E6E1D7";
const TEXT      = "#2B2B2B";
const TEXT_MUTED= "#888888";

const KIDS_KEY = "@sortii_kids_activities";

const DAYS     = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
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

const SUMMARIES: Record<string, string[]> = {
  empty: [
    "The week's wide open. Nothing dramatic yet.",
    "Not much happening yet. Could go either way.",
    "A blank slate. Plenty of time.",
  ],
  light: [
    "A light week, by the look of it.",
    "A couple of things taking shape. Nothing unmanageable.",
    "A quiet one. We'll take it.",
  ],
  steady: [
    "A fairly steady week. Dinner's cooperating.",
    "A couple of moving parts, but all quite manageable.",
    "You've got a bit on, but nothing dramatic.",
  ],
  sorted: [
    "A fairly sorted week. Not much to worry about.",
    "You're in reasonable shape. Nothing's on fire.",
    "A solid week. Organised without being smug about it.",
  ],
};

function getWeeklySummary(filled: number): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (filled === 0) return pick(SUMMARIES.empty);
  if (filled <= 2)  return pick(SUMMARIES.light);
  if (filled <= 5)  return pick(SUMMARIES.steady);
  return pick(SUMMARIES.sorted);
}

// ── Smart nudge banner ────────────────────────────────────────────
function NudgeBanner({
  nudge,
  onDismiss,
}: {
  nudge: Nudge;
  onDismiss: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.nudgeBanner, { borderLeftColor: nudge.color }]}
      onPress={onDismiss}
      activeOpacity={0.8}
    >
      <View style={[styles.nudgeIcon, { backgroundColor: nudge.color + "18" }]}>
        <Feather name={nudge.icon as any} size={14} color={nudge.color} />
      </View>
      <View style={styles.nudgeText}>
        <Text style={styles.nudgeMessage}>{nudge.message}</Text>
        <Text style={styles.nudgeSub}>{nudge.sub}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={14} color={TEXT_MUTED} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── "Help me sort this" overlay ───────────────────────────────────
function HelpOverlay({
  visible,
  actions,
  onDismiss,
}: {
  visible: boolean;
  actions: HelpAction[];
  onDismiss: () => void;
}) {
  // Reset done-state each time the overlay opens (component re-mounts on visible toggle)
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    actions.forEach((a) => { if (a.startDone) initial[a.id] = true; });
    return initial;
  });

  const preDoneCount = actions.filter((a) => a.startDone).length;
  const tappedCount  = Object.values(done).filter(Boolean).length - preDoneCount;
  const allDone      = actions.every((a) => done[a.id]);
  const readyToDismiss = tappedCount >= 1 || allDone;

  function handleTap(id: string) {
    setDone((prev) => ({ ...prev, [id]: true }));
  }

  if (!visible) return null;

  return (
    <Pressable style={styles.helpBackdrop} onPress={onDismiss}>
      <Pressable style={styles.helpCard} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.helpTitle}>Alright. Let's keep this simple.</Text>

        <View style={styles.helpActions}>
          {actions.map((action) => {
            const isDone = !!done[action.id];
            return (
              <TouchableOpacity
                key={action.id}
                style={[styles.helpAction, isDone && styles.helpActionDone]}
                onPress={() => handleTap(action.id)}
                activeOpacity={isDone ? 1 : 0.72}
              >
                <View
                  style={[
                    styles.helpActionIcon,
                    { backgroundColor: isDone ? TEAL + "18" : action.color + "15" },
                  ]}
                >
                  <Feather
                    name={(isDone ? "check" : action.icon) as any}
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

        <TouchableOpacity
          style={[
            styles.helpDismiss,
            readyToDismiss ? styles.helpDismissReady : styles.helpDismissWaiting,
          ]}
          onPress={readyToDismiss ? onDismiss : undefined}
          activeOpacity={readyToDismiss ? 0.78 : 1}
        >
          <Text
            style={[
              styles.helpDismissText,
              readyToDismiss ? styles.helpDismissTextReady : styles.helpDismissTextWaiting,
            ]}
          >
            {readyToDismiss ? "That'll do." : "Tap one to acknowledge it."}
          </Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const { currentPlan } = usePlanner();
  const { money, hasMoneySetup } = useUserWeek();
  const { currencySymbol } = useLocale();

  const [helpVisible, setHelpVisible]   = useState(false);
  const [nudge, setNudge]               = useState<Nudge | null>(null);
  const [kidsActivities, setKidsActivities] = useState<{ id: string; name: string }[]>([]);

  // Build help actions from decision engine (fresh on each open)
  const todayName = getTodayName();
  const todayIdx  = DAYS.indexOf(todayName);
  const tomorrowName = DAYS[(todayIdx + 1) % 7];

  const filledDinners = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId);
  const plannedCount  = filledDinners.length;

  const tonightEntry  = currentPlan.find((e) => e.day === todayName  && e.slot === "dinner");
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;

  const weeklyBreathingRoom = money
    ? Math.round(
        money.weeklyIncome - money.fixedWeeklyCosts - money.groceriesWeekly -
        (money.eatingOutWeekly ?? 0) - (money.otherWeeklySpend ?? 0)
      )
    : 0;

  const greeting = useMemo(() => getGreeting(), []);
  const summary  = useMemo(() => getWeeklySummary(plannedCount), [plannedCount]);

  // Decision engine actions (recomputed when data or overlay opens)
  const helpActions = useMemo(
    () => buildHelpActions(currentPlan, allRecipes, kidsActivities),
    [currentPlan, kidsActivities, helpVisible]
  );

  // On mount: load kids activities, compute nudge, record visit
  useEffect(() => {
    (async () => {
      // Load family activities
      const raw = await AsyncStorage.getItem(KIDS_KEY);
      if (raw) setKidsActivities(JSON.parse(raw));

      // Compute nudge (reads last_opened before we update it)
      const computed = await computeNudge(currentPlan, allRecipes);
      if (computed) setNudge(computed);

      // Record this visit
      await recordAppOpen();
    })();
  }, []);

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

          {/* Smart nudge banner */}
          {nudge && (
            <NudgeBanner nudge={nudge} onDismiss={() => setNudge(null)} />
          )}

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
                {kidsActivities.length > 0 ? (
                  <>
                    <Text style={styles.cardTitle}>
                      {kidsActivities[0].name}
                      {kidsActivities.length > 1 ? ` + ${kidsActivities.length - 1} more` : ""}
                    </Text>
                    <Text style={[styles.cardSub, { color: TEXT_MUTED }]}>
                      On the list. ✓
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Nothing on here yet.</Text>
                    <Text style={[styles.cardSub, { fontStyle: "italic", color: TEXT_MUTED }]}>
                      A rare and peaceful sight.
                    </Text>
                  </>
                )}
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
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: isToday ? "#fff" : TEAL },
                          ]}
                        />
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

        {/* Help me sort this — rendered above scroll, fills screen */}
        <HelpOverlay
          visible={helpVisible}
          actions={helpActions}
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
    marginBottom: 2,
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

  // Nudge banner
  nudgeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    padding: 12,
  },
  nudgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  nudgeText: { flex: 1, gap: 2 },
  nudgeMessage: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    lineHeight: 18,
  },
  nudgeSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 17,
  },

  // Cards
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

  // Week strip
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
  dayPillMeal:  { backgroundColor: CARD_BG, borderColor: BORDER },
  dayPillEmpty: { backgroundColor: BG, borderColor: BORDER },
  dayPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dayDots: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // Placeholders
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

  // Help overlay
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
  helpActions: { gap: 8, marginBottom: 20 },
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
  helpActionText: { flex: 1, gap: 3 },
  helpActionLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: TEXT,
    lineHeight: 20,
  },
  helpActionLabelDone: {
    color: TEAL,
    textDecorationLine: "line-through",
    opacity: 0.6,
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
  helpDismissReady:   { backgroundColor: TEAL },
  helpDismissWaiting: { backgroundColor: "#EDEBE7" },
  helpDismissText:    { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  helpDismissTextReady:   { color: "#fff" },
  helpDismissTextWaiting: { color: "#bbb" },
});

import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEFAULT_PREFERENCES, DEFAULT_WEEKEND_OVERRIDES, PlanPreferences } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";
import { updateOnboardingState } from "@/utils/onboardingState";
import { DietaryNeed, saveHouseholdProfile } from "@/utils/householdProfile";

const TEAL       = "#2A8F88";
const TEAL_TINT  = "#E6F3F0";
const CREAM      = "#F8F4EE";
const INK        = "#1A1410";
const MUTED      = "#8A7968";
const GOLD       = "#D29A22";
const PLUM       = "#5E3A4C";
const PLUM_TINT  = "#F3E8EE";
const BORDER     = "#EDE9E3";

const ROTATING_MESSAGES = [
  "Sorting your first week…",
  "Finding meals that work for you.",
  "Building your shopping list.",
  "Almost there.",
];

const HOUSEHOLD_HINTS: Record<number, string> = {
  1: "Just you. Easy week.",
  2: "Two people. Sorted.",
  3: "Small crew.",
  4: "Family of four — good size.",
  5: "Five mouths to feed.",
  6: "Feeding a crowd.",
  7: "Big household. We've got you.",
  8: "Big household. We've got you.",
};

const DIETARY_OPTIONS: { id: DietaryNeed; label: string; bg: string; color: string }[] = [
  { id: "vegan",       label: "🌱  Vegan",       bg: PLUM_TINT,  color: PLUM },
  { id: "vegetarian",  label: "🥚  Vegetarian",  bg: PLUM_TINT,  color: PLUM },
  { id: "gluten-free", label: "🌾  Gluten-free", bg: TEAL_TINT,  color: TEAL },
  { id: "dairy-free",  label: "🥛  Dairy-free",  bg: TEAL_TINT,  color: TEAL },
];

type Step = 0 | 1 | 2; // 0 = welcome, 1 = household, 2 = generating

export default function OnboardingScreen() {
  const router = useRouter();
  const {
    setPreferences, setIsOnboarded, isOnboarded, isContextLoaded,
    autoGeneratePlan, reloadHouseholdProfile,
  } = usePlanner();
  const {
    setWeeklyMode: setContextWeeklyMode,
    setHasMealsSetup: setContextHasMealsSetup,
    updateWeekKey,
    isLoaded: isWeekLoaded,
    lastUpdatedAt,
  } = useUserWeek();
  const insets = useSafeAreaInsets();

  const [step,          setStep]          = useState<Step>(0);
  const [householdSize, setHouseholdSize] = useState(4);
  const [dietaryNeeds,  setDietaryNeeds]  = useState<DietaryNeed[]>([]);
  const [generatingMsg, setGeneratingMsg] = useState(ROTATING_MESSAGES[0]);
  const [generatingDone, setGeneratingDone] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const msgIndex  = useRef(0);
  const isInGeneratingFlow = useRef(false);

  // Welcome screen stagger
  const line1 = useRef(new Animated.Value(0)).current;
  const line2 = useRef(new Animated.Value(0)).current;
  const line3 = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 16;
  const paddingTop    = Platform.OS === "web" ? 60 : insets.top + 8;

  // ── Returning user gate ──────────────────────────────────────────
  useEffect(() => {
    if (!isContextLoaded || !isWeekLoaded) return;
    if (isInGeneratingFlow.current) return;
    if (isOnboarded) {
      if (lastUpdatedAt) {
        const daysSince = (Date.now() - new Date(lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          router.replace("/(tabs)/home");
          return;
        }
      }
      router.replace("/returning");
    }
  }, [isContextLoaded, isWeekLoaded, isOnboarded]);

  // ── Welcome stagger ──────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0) return;
    line1.setValue(0); line2.setValue(0); line3.setValue(0); ctaAnim.setValue(0);
    const seq = [
      { anim: line1,   delay: 300 },
      { anim: line2,   delay: 500 },
      { anim: line3,   delay: 700 },
      { anim: ctaAnim, delay: 1100 },
    ];
    const timers = seq.map(({ anim, delay }) =>
      setTimeout(() =>
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }).start(),
        delay
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  // ── Generating animation ─────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    const tick = () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        msgIndex.current = (msgIndex.current + 1) % ROTATING_MESSAGES.length;
        setGeneratingMsg(ROTATING_MESSAGES[msgIndex.current]);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    };
    const interval = setInterval(tick, 2000);
    const doneTimer = setTimeout(() => {
      clearInterval(interval);
      pulse.stop();
      setGeneratingDone(true);
      setTimeout(() => router.replace("/(tabs)/home"), 900);
    }, 5500);
    return () => {
      clearInterval(interval);
      clearTimeout(doneTimer);
      pulse.stop();
    };
  }, [step]);

  // ── Start generating ─────────────────────────────────────────────
  const startGenerating = async () => {
    const newPrefs: PlanPreferences = {
      ...DEFAULT_PREFERENCES,
      planningMode:     "auto",
      householdSize,
      budgetLevel:      "standard",
      mealVariety:      7,
      dietType:         "no-preference",
      exclusions:       [],
      cookingPersona:   "quick",
      weekendOverrides: { ...DEFAULT_WEEKEND_OVERRIDES },
    };

    isInGeneratingFlow.current = true;

    if (dietaryNeeds.length > 0) {
      await saveHouseholdProfile({
        dietary_needs: dietaryNeeds,
        kids_situation: "same",
        setup_complete: true,
        setup_date: new Date().toISOString(),
      });
      await reloadHouseholdProfile();
    }

    await setPreferences(newPrefs);
    await setIsOnboarded(true);
    await updateOnboardingState({ hasMealsSetup: true, scope: "meals", weeklyMode: "balanced" });
    setContextWeeklyMode("balanced");
    setContextHasMealsSetup(true);
    updateWeekKey();
    autoGeneratePlan(newPrefs);
    setStep(2);
  };

  const toggleDietary = (id: DietaryNeed) => {
    Haptics.selectionAsync();
    setDietaryNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const adjustSize = (delta: number) => {
    Haptics.selectionAsync();
    setHouseholdSize((v) => Math.max(1, Math.min(8, v + delta)));
  };

  // ════════════════════════════════════════════════════════════════
  // SCREEN 2 — GENERATING
  // ════════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <View style={[styles.genRoot, { paddingTop }]}>
        <Animated.View style={[styles.genRing, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.genEmoji}>🥘</Text>
        <Animated.Text style={[styles.genMsg, { opacity: fadeAnim }]}>
          {generatingMsg}
        </Animated.Text>
        {generatingDone && <Text style={styles.genDone}>All done ✓</Text>}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SCREEN 1 — HOUSEHOLD SETUP
  // ════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <View style={[styles.root, { paddingTop }]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity
            onPress={() => setStep(0)}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.stepHeading}>Who's in your house?</Text>
          <Text style={styles.stepSub}>
            This shapes your portions and meal suggestions.
          </Text>

          {/* Household size stepper */}
          <View style={styles.sizeCard}>
            <View style={styles.sizeRow}>
              <TouchableOpacity
                onPress={() => adjustSize(-1)}
                style={[styles.sizeBtn, householdSize <= 1 && styles.sizeBtnDisabled]}
                activeOpacity={0.7}
                disabled={householdSize <= 1}
              >
                <Text style={styles.sizeBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.sizeCenter}>
                <Text style={styles.sizeNumber}>{householdSize}</Text>
                <Text style={styles.sizePeople}>people</Text>
              </View>
              <TouchableOpacity
                onPress={() => adjustSize(1)}
                style={[styles.sizeBtn, householdSize >= 8 && styles.sizeBtnDisabled]}
                activeOpacity={0.7}
                disabled={householdSize >= 8}
              >
                <Text style={styles.sizeBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sizeHint}>{HOUSEHOLD_HINTS[householdSize]}</Text>
          </View>

          {/* Dietary needs */}
          <Text style={styles.sectionLabel}>Dietary needs</Text>
          <Text style={styles.sectionSub}>Select anything that applies.</Text>

          <View style={styles.pillGrid}>
            {DIETARY_OPTIONS.map(({ id, label, bg, color }) => {
              const on = dietaryNeeds.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => toggleDietary(id)}
                  activeOpacity={0.75}
                  style={[
                    styles.pill,
                    on ? { backgroundColor: bg, borderColor: color } : styles.pillOff,
                  ]}
                >
                  <Text style={[styles.pillText, on ? { color } : styles.pillTextOff]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              startGenerating();
            }}
            activeOpacity={0.85}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Get my plan →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SCREEN 0 — WELCOME
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={[styles.root, { paddingTop }]}>
      {/* ── Wordmark ── */}
      <View style={styles.welcomeWordmarkRow}>
        <Text style={styles.welcomeS}>S</Text>
        <Text style={styles.welcomeOrtii}>ortii</Text>
      </View>

      {/* ── Tagline ── */}
      <Animated.Text style={[styles.welcomeTagline, { opacity: line1 }]}>
        We take the thinking out of the week.
      </Animated.Text>

      {/* ── Value props ── */}
      <View style={styles.valueProps}>
        {[
          { anim: line1, icon: "🥘", text: "Dinners planned — no thinking required" },
          { anim: line2, icon: "📅", text: "Your week in one clear view" },
          { anim: line3, icon: "💰", text: "Know where your money actually goes" },
        ].map(({ anim, icon, text }) => (
          <Animated.View key={text} style={[styles.valueProp, { opacity: anim }]}>
            <Text style={styles.valuePropIcon}>{icon}</Text>
            <Text style={styles.valuePropText}>{text}</Text>
          </Animated.View>
        ))}
      </View>

      {/* ── CTA ── */}
      <Animated.View style={[styles.ctaWrap, { opacity: ctaAnim, paddingBottom }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStep(1);
          }}
          activeOpacity={0.85}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Set up my week →</Text>
        </TouchableOpacity>
        <Text style={styles.welcomeNote}>Takes about 30 seconds. No account required.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
    paddingHorizontal: 24,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Welcome ─────────────────────────────────────────────────────
  welcomeWordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 32,
    marginBottom: 8,
  },
  welcomeS: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 44,
    color: TEAL,
    letterSpacing: -1,
  },
  welcomeOrtii: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 38,
    color: TEAL,
    letterSpacing: -1,
  },
  welcomeTagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: MUTED,
    marginBottom: 36,
    lineHeight: 24,
  },
  valueProps: {
    flex: 1,
    gap: 20,
    marginBottom: 24,
  },
  valueProp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  valuePropIcon: {
    fontSize: 28,
    width: 40,
    textAlign: "center",
  },
  valuePropText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 17,
    color: INK,
    lineHeight: 24,
    flex: 1,
  },
  ctaWrap: {
    gap: 12,
  },
  welcomeNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
  },

  // ── Step 1 ───────────────────────────────────────────────────────
  backBtn: {
    paddingVertical: 4,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: TEAL,
  },
  stepHeading: {
    fontFamily: "Manrope_700Bold",
    fontSize: 26,
    color: INK,
    marginBottom: 8,
  },
  stepSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: MUTED,
    marginBottom: 28,
    lineHeight: 22,
  },

  sizeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sizeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: TEAL_TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnDisabled: {
    opacity: 0.35,
  },
  sizeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    color: TEAL,
    lineHeight: 26,
  },
  sizeCenter: {
    alignItems: "center",
  },
  sizeNumber: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 52,
    color: INK,
    lineHeight: 58,
  },
  sizePeople: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
  },
  sizeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
  },

  sectionLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: INK,
    marginBottom: 4,
  },
  sectionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    marginBottom: 14,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 32,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillOff: {
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  pillTextOff: {
    color: MUTED,
  },

  // ── Generating ───────────────────────────────────────────────────
  genRoot: {
    flex: 1,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  genRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: TEAL_TINT,
    position: "absolute",
  },
  genEmoji: {
    fontSize: 40,
    marginBottom: 28,
  },
  genMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: MUTED,
    textAlign: "center",
    lineHeight: 24,
  },
  genDone: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: TEAL,
    marginTop: 16,
  },

  // ── Shared ───────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { DEFAULT_PREFERENCES, DEFAULT_WEEKEND_OVERRIDES, PlanPreferences } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";
import { updateOnboardingState } from "@/utils/onboardingState";
import { DietaryNeed, saveHouseholdProfile } from "@/utils/householdProfile";

const C = Colors.light;
const TEAL  = "#2A8F88";
const PLUM  = "#5E3A4C";
const TEXT  = "#2B2B2B";
const MUTED = "#888888";
const BORDER= "#EDE9E3";

const sortiiLogo = require("@/assets/images/sortii-logo-v2-landing.png");

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

const EXCLUSION_CHIPS = [
  "Shellfish", "Mushrooms", "Lamb", "Spicy food", "Tofu", "Anchovies",
];

const DIETARY_OPTIONS: { id: DietaryNeed; label: string }[] = [
  { id: "vegan",       label: "🌱  Vegan" },
  { id: "vegetarian",  label: "🥚  Vegetarian" },
  { id: "gluten-free", label: "🌾  Gluten-free" },
  { id: "dairy-free",  label: "🥛  Dairy-free" },
];

type Step = 0 | 1 | 2 | 3 | 4;

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <View style={styles.progressDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i < filled ? TEAL : "#E6E1D7" }]}
        />
      ))}
    </View>
  );
}

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

  const [step, setStep] = useState<Step>(0);

  // ── Collected data ────────────────────────────────────────────────
  const [householdSize,  setHouseholdSize]  = useState(4);
  const [exclusionText,  setExclusionText]  = useState("");
  const [dietaryNeeds,   setDietaryNeeds]   = useState<DietaryNeed[]>([]);
  const [noneSelected,   setNoneSelected]   = useState(false);

  // ── Generating state ──────────────────────────────────────────────
  const [generatingMsg,  setGeneratingMsg]  = useState(ROTATING_MESSAGES[0]);
  const [generatingDone, setGeneratingDone] = useState(false);
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const msgIndex   = useRef(0);
  const isInGeneratingFlow = useRef(false);

  // ── Screen 1 stagger anims ────────────────────────────────────────
  const line1 = useRef(new Animated.Value(0)).current;
  const line2 = useRef(new Animated.Value(0)).current;
  const line3 = useRef(new Animated.Value(0)).current;

  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 16;
  const paddingTop    = Platform.OS === "web" ? 60 : insets.top;

  // ── Returning user gate (UNCHANGED logic) ─────────────────────────
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

  // ── Screen 1: stagger copy lines ─────────────────────────────────
  useEffect(() => {
    if (step !== 0) return;
    line1.setValue(0); line2.setValue(0); line3.setValue(0);
    const t1 = setTimeout(() =>
      Animated.timing(line1, { toValue: 1, duration: 400, useNativeDriver: true }).start(), 300);
    const t2 = setTimeout(() =>
      Animated.timing(line2, { toValue: 1, duration: 400, useNativeDriver: true }).start(), 500);
    const t3 = setTimeout(() =>
      Animated.timing(line3, { toValue: 1, duration: 400, useNativeDriver: true }).start(), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [step]);

  // ── Screen 5: generating animation ───────────────────────────────
  useEffect(() => {
    if (step !== 4) return;

    // Pulse ring
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Rotate text
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

  // ── startGenerating — saves all data then transitions ─────────────
  const startGenerating = async () => {
    const exclusions = exclusionText
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newPrefs: PlanPreferences = {
      ...DEFAULT_PREFERENCES,
      planningMode: "auto",
      householdSize,
      budgetLevel: "standard",
      mealVariety: 7,
      dietType: "no-preference",
      exclusions,
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
    setStep(4);
  };

  const toggleDietaryNeed = (id: DietaryNeed) => {
    Haptics.selectionAsync();
    setNoneSelected(false);
    setDietaryNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const selectNone = () => {
    Haptics.selectionAsync();
    setDietaryNeeds([]);
    setNoneSelected(true);
  };

  const appendChip = (chip: string) => {
    Haptics.selectionAsync();
    setExclusionText((prev) => {
      const t = prev.trim();
      if (!t) return chip;
      if (t.endsWith(",")) return `${t} ${chip}`;
      return `${t}, ${chip}`;
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // SCREEN 1 — THE PROMISE
  // ═══════════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Vertically centred content */}
        <View style={[styles.promiseCenter, { paddingTop }]}>
          <Image
            source={sortiiLogo}
            style={styles.promiseLogo}
            resizeMode="contain"
          />
          <Text style={styles.promiseTagline}>Less to think about.</Text>
          <View style={styles.promiseLines}>
            {[
              { text: "Dinners sorted.",     anim: line1 },
              { text: "Weekends planned.",   anim: line2 },
              { text: "Money understood.",   anim: line3 },
            ].map(({ text, anim }) => (
              <Animated.Text key={text} style={[styles.promiseLine, { opacity: anim }]}>
                {text}
              </Animated.Text>
            ))}
          </View>
        </View>

        {/* Fixed bottom CTA */}
        <View style={[styles.promiseCta, { paddingBottom: paddingBottom + 8 }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep(1);
            }}
            activeOpacity={0.85}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Let's sort it →</Text>
          </TouchableOpacity>
          <Text style={styles.promiseSmall}>Takes about 60 seconds.</Text>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCREEN 5 — GENERATING
  // ═══════════════════════════════════════════════════════════════════
  if (step === 4) {
    return (
      <View style={[styles.screen, { backgroundColor: "#FFFFFF", paddingTop, paddingBottom }]}>
        <View style={styles.generatingCenter}>
          {/* Small logo mark */}
          <Image
            source={sortiiLogo}
            style={{ width: 120, height: 55, marginBottom: 28 }}
            resizeMode="contain"
          />

          {/* Teal pulse circle */}
          {!generatingDone ? (
            <>
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={styles.pulseCore} />
              <Animated.Text style={[styles.genMsg, { opacity: fadeAnim, marginTop: 32 }]}>
                {generatingMsg}
              </Animated.Text>
              <Text style={styles.genSub}>We'll have a plan ready in a moment.</Text>
            </>
          ) : (
            <>
              <View style={[styles.pulseCore, { backgroundColor: TEAL }]} />
              <Text style={[styles.genMsg, { marginTop: 32 }]}>Done. Your week's sorted.</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCREENS 2–4 — shared shell with header + scroll + footer
  // ═══════════════════════════════════════════════════════════════════
  const isScreen2 = step === 1;
  const isScreen3 = step === 2;
  const isScreen4 = step === 3;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View style={[styles.stepHeader, { paddingTop: paddingTop + 8 }]}>
        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep((s) => (s - 1) as Step)}
            style={styles.backLink}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        )}
        <ProgressDots filled={step} total={3} />
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── SCREEN 2: HOUSEHOLD SIZE ── */}
        {isScreen2 && (
          <>
            <Text style={styles.stepLabel}>STEP 1</Text>
            <Text style={styles.stepHeadline}>How many are you feeding?</Text>
            <Text style={styles.stepSub}>Most nights — roughly.</Text>

            <View style={styles.stepperRow}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setHouseholdSize((n) => Math.max(1, n - 1)); }}
                style={styles.stepperBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>

              <Text style={styles.stepperNum}>{householdSize}</Text>

              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setHouseholdSize((n) => Math.min(8, n + 1)); }}
                style={styles.stepperBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.stepperHint}>
              {HOUSEHOLD_HINTS[householdSize] ?? "Big household. We've got you."}
            </Text>
          </>
        )}

        {/* ── SCREEN 3: HARD NO'S ── */}
        {isScreen3 && (
          <>
            <Text style={styles.stepLabel}>STEP 2</Text>
            <Text style={styles.stepHeadline}>Anything we should never suggest?</Text>
            <Text style={styles.stepSub}>
              Allergies, dislikes, things the kids will absolutely riot over.
            </Text>

            <TextInput
              style={styles.exclusionInput}
              value={exclusionText}
              onChangeText={setExclusionText}
              placeholder="e.g. shellfish, mushrooms, anything spicy..."
              placeholderTextColor="#BBBBBB"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.chipRow}>
              {EXCLUSION_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => appendChip(chip)}
                  style={styles.exclusionChip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exclusionChipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── SCREEN 4: DIETARY NEEDS ── */}
        {isScreen4 && (
          <>
            <Text style={styles.stepLabel}>STEP 3</Text>
            <Text style={styles.stepHeadline}>Any dietary needs in the household?</Text>
            <Text style={styles.stepSub}>Set once. We'll handle it quietly every week.</Text>

            <View style={styles.dietaryGrid}>
              {DIETARY_OPTIONS.map(({ id, label }) => {
                const active = dietaryNeeds.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => toggleDietaryNeed(id)}
                    style={[styles.dietaryPill, active && styles.dietaryPillActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dietaryPillText, active && styles.dietaryPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* None of these */}
              <TouchableOpacity
                onPress={selectNone}
                style={[styles.dietaryPill, noneSelected && styles.dietaryPillActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.dietaryPillText, noneSelected && styles.dietaryPillTextActive]}>
                  None of these
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.dietaryNote}>
              You can update this anytime in your preferences.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.stepFooter, { paddingBottom: paddingBottom + 4 }]}>
        {isScreen2 && (
          <>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(2); }}
              activeOpacity={0.85}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>That's us →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(0)} style={styles.backLinkFooter}>
              <Text style={styles.backLinkText}>← Back</Text>
            </TouchableOpacity>
          </>
        )}

        {isScreen3 && (
          <>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(3); }}
              activeOpacity={0.85}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Got it →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setExclusionText(""); setStep(3); }}
              style={styles.skipLink}
              activeOpacity={0.7}
            >
              <Text style={styles.skipLinkText}>Skip — nothing to avoid →</Text>
            </TouchableOpacity>
          </>
        )}

        {isScreen4 && (
          <>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                startGenerating();
              }}
              activeOpacity={0.85}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Nearly there →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setDietaryNeeds([]); setNoneSelected(false); startGenerating(); }}
              style={styles.skipLink}
              activeOpacity={0.7}
            >
              <Text style={styles.skipLinkText}>Skip for now →</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // ── Screen 1: Promise ──────────────────────────────────────────────
  promiseCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  promiseLogo: {
    width: 220,
    height: 100,
  },
  promiseTagline: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
    color: TEXT,
    marginTop: 24,
  },
  promiseLines: {
    marginTop: 20,
    alignItems: "center",
  },
  promiseLine: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
    lineHeight: 32,
  },
  promiseCta: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 0,
  },
  promiseSmall: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
    marginTop: 10,
  },

  // ── Steps 2–4: shared shell ───────────────────────────────────────
  stepHeader: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    alignItems: "center",
    gap: 12,
  },
  backLink: {
    alignSelf: "flex-start",
  },
  backLinkText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: MUTED,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: PLUM,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  stepHeadline: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_700Bold",
    color: TEXT,
    lineHeight: 34,
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    lineHeight: 22,
    marginBottom: 28,
  },
  stepFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  backLinkFooter: {
    alignSelf: "center",
  },
  skipLink: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  skipLinkText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
  },

  // ── Primary button ────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: TEAL,
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

  // ── Screen 2: Stepper ─────────────────────────────────────────────
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginVertical: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 24,
    fontFamily: "Inter_400Regular",
    color: TEAL,
    lineHeight: 28,
  },
  stepperNum: {
    fontSize: 72,
    fontFamily: "PlayfairDisplay_700Bold",
    color: TEAL,
    lineHeight: 80,
    minWidth: 80,
    textAlign: "center",
  },
  stepperHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: MUTED,
    textAlign: "center",
    marginTop: 12,
  },

  // ── Screen 3: Hard no's ───────────────────────────────────────────
  exclusionInput: {
    height: 120,
    backgroundColor: "#F8F6F3",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  exclusionChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  exclusionChipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT,
  },

  // ── Screen 4: Dietary needs ───────────────────────────────────────
  dietaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  dietaryPill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  dietaryPillActive: {
    backgroundColor: PLUM,
    borderColor: PLUM,
  },
  dietaryPillText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: TEXT,
  },
  dietaryPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  dietaryNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },

  // ── Screen 5: Generating ──────────────────────────────────────────
  generatingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  pulseRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: TEAL,
    position: "absolute",
    opacity: 0.35,
  },
  pulseCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${TEAL}22`,
    borderWidth: 2,
    borderColor: TEAL,
  },
  genMsg: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    textAlign: "center",
    lineHeight: 26,
  },
  genSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
    marginTop: 10,
  },
});

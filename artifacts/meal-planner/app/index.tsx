import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEFAULT_PREFERENCES, DEFAULT_WEEKEND_OVERRIDES, PlanPreferences } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";
import { saveHouseholdProfile } from "@/utils/householdProfile";
import { loadFamilyState, saveFamilyState } from "@/utils/familyStore";
import { MEMBER_COLORS } from "@/utils/familyTypes";

const TEAL       = "#2A8F88";
const TEAL_TINT  = "#E6F3F0";
const CREAM      = "#F8F4EE";
const INK        = "#1A1410";
const MUTED      = "#8A7968";
const BORDER     = "#EDE9E3";

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

type Step = 0 | 1;

export default function OnboardingScreen() {
  const router = useRouter();
  const {
    setPreferences, setIsOnboarded, isOnboarded, isContextLoaded,
    reloadHouseholdProfile,
  } = usePlanner();
  const {
    isLoaded: isWeekLoaded,
  } = useUserWeek();
  const insets = useSafeAreaInsets();

  const [step,          setStep]          = useState<Step>(0);
  const [householdSize, setHouseholdSize] = useState(4);
  const [familyNames,   setFamilyNames]   = useState<string[]>([]);
  const [nameInput,     setNameInput]     = useState("");

  // Welcome screen stagger anims
  const line1   = useRef(new Animated.Value(0)).current;
  const line2   = useRef(new Animated.Value(0)).current;
  const line3   = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 16;
  const paddingTop    = Platform.OS === "web" ? 60 : insets.top + 8;

  // ── Returning user gate — always skip to home if onboarded ──────
  useEffect(() => {
    if (!isContextLoaded || !isWeekLoaded) return;
    if (isOnboarded) {
      router.replace("/(tabs)/home");
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

  // ── Complete onboarding — no meal generation ─────────────────────
  const finishOnboarding = async () => {
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

    await saveHouseholdProfile({
      dietary_needs:  [],
      kids_situation: "same",
      setup_complete: true,
      setup_date:     new Date().toISOString(),
    });
    await reloadHouseholdProfile();
    await setPreferences(newPrefs);

    // Persist any entered family members to the family store
    if (familyNames.length > 0) {
      const existing = await loadFamilyState();
      const usedColors = existing.members.map((m) => m.color);
      const newMembers = familyNames.map((name, i) => {
        const availableColor = MEMBER_COLORS.find((c) => !usedColors.includes(c)) ?? MEMBER_COLORS[i % MEMBER_COLORS.length]!;
        usedColors.push(availableColor);
        return { id: `${Date.now()}_${i}`, name: name.trim(), role: "adult" as const, color: availableColor };
      });
      await saveFamilyState({
        ...existing,
        members: [...existing.members, ...newMembers],
      });
    }

    await setIsOnboarded(true);
    router.replace("/(tabs)/home");
  };

  const adjustSize = (delta: number) => {
    Haptics.selectionAsync();
    setHouseholdSize((v) => Math.max(1, Math.min(8, v + delta)));
  };

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

          {/* Family members card */}
          <View style={styles.membersCard}>
            <Text style={styles.membersTitle}>Name your household members</Text>
            <Text style={styles.membersSub}>Optional — helps personalise your week. They'll appear on your Family board.</Text>

            {/* Chips for added names */}
            {familyNames.length > 0 && (
              <View style={styles.chipsRow}>
                {familyNames.map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFamilyNames((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    activeOpacity={0.75}
                    style={[styles.memberChip, { backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] + "22", borderColor: MEMBER_COLORS[i % MEMBER_COLORS.length] + "66" }]}
                  >
                    <Text style={[styles.memberChipText, { color: MEMBER_COLORS[i % MEMBER_COLORS.length] }]}>{name}</Text>
                    <Text style={[styles.memberChipX, { color: MEMBER_COLORS[i % MEMBER_COLORS.length] }]}>×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Name input row */}
            <View style={styles.nameInputRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Add a name…"
                placeholderTextColor={MUTED}
                value={nameInput}
                onChangeText={setNameInput}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const trimmed = nameInput.trim();
                  if (trimmed && !familyNames.includes(trimmed)) {
                    Haptics.selectionAsync();
                    setFamilyNames((prev) => [...prev, trimmed]);
                    setNameInput("");
                  }
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  const trimmed = nameInput.trim();
                  if (trimmed && !familyNames.includes(trimmed)) {
                    Haptics.selectionAsync();
                    setFamilyNames((prev) => [...prev, trimmed]);
                    setNameInput("");
                  }
                }}
                activeOpacity={0.8}
                style={[styles.nameAddBtn, !nameInput.trim() && styles.nameAddBtnDisabled]}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.nameAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              finishOnboarding();
            }}
            activeOpacity={0.85}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Done →</Text>
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
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_700Bold",
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
    marginBottom: 32,
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
    fontFamily: "DMSans_700Bold",
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

  // ── Family members card ─────────────────────────────────────────
  membersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  membersTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: INK,
  },
  membersSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
    marginTop: -4,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberChipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
  },
  memberChipX: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 17,
    marginLeft: 2,
  },
  nameInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: INK,
    backgroundColor: CREAM,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nameAddBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nameAddBtnDisabled: {
    opacity: 0.38,
  },
  nameAddBtnText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },

  // ── Shared ───────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

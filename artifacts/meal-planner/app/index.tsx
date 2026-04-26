import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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

const sortiiLogo1 = require("@/assets/images/sortii-logo.png");

const TEAL       = "#2A8F88";
const TEAL_TINT  = "#E6F3F0";
const CREAM      = "#F8F4EE";
const INK        = "#1A1410";
const MUTED      = "#8A7968";
const BORDER     = "#EDE9E3";
const PLUM       = "#5E3A4C";
const GOLD       = "#D29A22";

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
  const [familyMembers, setFamilyMembers] = useState<Array<{ name: string; role: "adult" | "child" }>>([]);
  const [nameInput,     setNameInput]     = useState("");
  const [pendingRole,   setPendingRole]   = useState<"adult" | "child">("adult");

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
    if (familyMembers.length > 0) {
      const existing = await loadFamilyState();
      const usedColors = existing.members.map((m) => m.color);
      const newMembers = familyMembers.map((fm, i) => {
        const availableColor = MEMBER_COLORS.find((c) => !usedColors.includes(c)) ?? MEMBER_COLORS[i % MEMBER_COLORS.length]!;
        usedColors.push(availableColor);
        return { id: `${Date.now()}_${i}`, name: fm.name.trim(), role: fm.role, color: availableColor };
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

            {/* Chips for added members */}
            {familyMembers.length > 0 && (
              <View style={styles.chipsRow}>
                {familyMembers.map((fm, i) => {
                  const chipColor = MEMBER_COLORS[i % MEMBER_COLORS.length]!;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFamilyMembers((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      activeOpacity={0.75}
                      style={[styles.memberChip, { backgroundColor: chipColor + "22", borderColor: chipColor + "66" }]}
                    >
                      <Text style={[styles.memberChipText, { color: chipColor }]}>{fm.name}</Text>
                      <Text style={[styles.memberRoleTag, { color: chipColor + "CC" }]}>
                        {fm.role === "adult" ? "Adult" : "Child"}
                      </Text>
                      <Text style={[styles.memberChipX, { color: chipColor }]}>×</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Role toggle */}
            <View style={styles.roleToggleRow}>
              {(["adult", "child"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setPendingRole(r)}
                  activeOpacity={0.75}
                  style={[styles.roleToggleBtn, pendingRole === r && styles.roleToggleBtnActive]}
                >
                  <Text style={[styles.roleToggleBtnText, pendingRole === r && styles.roleToggleBtnTextActive]}>
                    {r === "adult" ? "Adult / driver" : "Child"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
                  if (trimmed && !familyMembers.some((m) => m.name === trimmed)) {
                    Haptics.selectionAsync();
                    setFamilyMembers((prev) => [...prev, { name: trimmed, role: pendingRole }]);
                    setNameInput("");
                  }
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  const trimmed = nameInput.trim();
                  if (trimmed && !familyMembers.some((m) => m.name === trimmed)) {
                    Haptics.selectionAsync();
                    setFamilyMembers((prev) => [...prev, { name: trimmed, role: pendingRole }]);
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
      {/* ── Logo ── */}
      <Image source={sortiiLogo1} style={styles.welcomeLogo} resizeMode="contain" />

      {/* ── Feature cards ── */}
      <View style={styles.valueProps}>
        {([
          { anim: line1, accent: "#2F948C", cardBg: "#F3FAF8", tileBg: "#E6EFE5", icon: "coffee",       text: "Dinners done. No thinking needed." },
          { anim: line2, accent: "#6E3F58", cardBg: "#F8F0F4", tileBg: "#F2E8EC", icon: "calendar",     text: "Your whole week, at a glance." },
          { anim: line3, accent: "#D6A23A", cardBg: "#FFF8E6", tileBg: "#FFF4D8", icon: "dollar-sign",  text: "Money tracked. No spreadsheet." },
        ] as const).map(({ anim, accent, cardBg, tileBg, icon, text }) => (
          <Animated.View key={text} style={[styles.featureCardShadow, { backgroundColor: cardBg, opacity: anim }]}>
            <View style={[styles.featureCardInner, { backgroundColor: cardBg, borderColor: accent }]}>
              <View style={[styles.featureCardRail, { backgroundColor: accent }]} />
              <View style={styles.featureCardContent}>
                <View style={[styles.featureCardTile, { backgroundColor: tileBg }]}>
                  <Feather name={icon} size={24} color={accent} />
                </View>
                <Text style={styles.featureCardText}>{text}</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* ── CTA — absolutely pinned to bottom ── */}
      <Animated.View style={[styles.ctaWrap, { opacity: ctaAnim, paddingBottom }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStep(1);
          }}
          activeOpacity={0.85}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Get my week sorted →</Text>
        </TouchableOpacity>
        <Text style={styles.welcomeNote}>Takes about 30 seconds. No sign-up needed.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Welcome ─────────────────────────────────────────────────────
  welcomeLogo: {
    width: "100%",
    height: 190,
    marginTop: 28,
    marginBottom: 4,
    alignSelf: "center",
  },
  valueProps: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  featureCardShadow: {
    borderRadius: 16,
    backgroundColor: "#FFFDF9",
    shadowColor: "#2F342F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14,
  },
  featureCardInner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E2D8",
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#FFFDF9",
  },
  featureCardRail: {
    width: 5,
  },
  featureCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 16,
  },
  featureCardTile: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  featureCardText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: "#2F342F",
    flexShrink: 1,
    lineHeight: 23,
  },
  ctaWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  welcomeNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#888",
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
  memberRoleTag: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    opacity: 0.8,
  },
  roleToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  roleToggleBtn: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleToggleBtnActive: {
    borderColor: TEAL,
    backgroundColor: TEAL + "12",
  },
  roleToggleBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: MUTED,
  },
  roleToggleBtnTextActive: {
    color: TEAL,
    fontFamily: "Inter_600SemiBold",
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

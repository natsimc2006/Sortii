import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useLocale } from "@/context/LocaleContext";
import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";
import type { SavingsGoal } from "@/utils/onboardingState";

const C = Colors.light;

const TEAL = "#2A8F88";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const BG = "#FFFFFF";

const EMOJI_OPTIONS = ["✈️", "🏠", "🎓", "🚗", "🐷"];

export default function GoalSetupScreen() {
  const router = useRouter();
  const { returnTo, autoGeneratePlan: autoGen } = useLocalSearchParams<{ returnTo?: string; autoGeneratePlan?: string }>();
  const insets = useSafeAreaInsets();
  const { currencySymbol } = useLocale();
  const { savingsGoal: existing, setSavingsGoal } = useUserWeek();
  const { autoGeneratePlan } = usePlanner();

  const [goalName, setGoalName] = useState(existing?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(
    existing?.targetAmount ? String(existing.targetAmount) : ""
  );
  const [alreadySaved, setAlreadySaved] = useState(
    existing?.currentSaved ? String(existing.currentSaved) : ""
  );
  const [selectedEmoji, setSelectedEmoji] = useState(existing?.emoji ?? "✈️");
  const [saving, setSaving] = useState(false);

  const paddingTop = Platform.OS === "web" ? 56 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 20;

  const target = parseFloat(targetAmount) || 0;
  const saved = parseFloat(alreadySaved) || 0;
  const canSave = goalName.trim().length > 0 && target > 0;

  const navigate = () => {
    if (returnTo === "fresh") {
      autoGeneratePlan();
      router.replace("/(tabs)/planner");
    } else if (returnTo === "planner") {
      router.replace("/(tabs)/planner");
    } else {
      router.replace("/(tabs)/money");
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    const newGoal: SavingsGoal = {
      name: goalName.trim(),
      targetAmount: target,
      currentSaved: Math.min(saved, target),
      weeklyContributions: existing?.weeklyContributions ?? [],
      emoji: selectedEmoji,
    };

    setSavingsGoal(newGoal);

    setTimeout(() => {
      if (returnTo) {
        navigate();
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate("/(tabs)/home");
      }
    }, 300);
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    if (returnTo) {
      navigate();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate("/(tabs)/home");
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavingsGoal(null);
    if (returnTo) {
      navigate();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate("/(tabs)/home");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.navigate("/(tabs)/home")}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={TEAL} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Saving for something?</Text>
          <Text style={styles.headerSub}>We'll factor it in.</Text>
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: paddingBottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Emoji picker */}
        <View style={styles.emojiRow}>
          {EMOJI_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedEmoji(emoji);
              }}
              style={[
                styles.emojiBtn,
                selectedEmoji === emoji && styles.emojiBtnSelected,
              ]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>What are you saving for?</Text>
          <TextInput
            value={goalName}
            onChangeText={(v) => setGoalName(v.slice(0, 20))}
            placeholder="e.g. Trip, New car, Buffer"
            placeholderTextColor={C.textMuted}
            style={styles.textInput}
            maxLength={20}
            returnKeyType="next"
          />
          <Text style={styles.charCount}>{goalName.length}/20</Text>
        </View>

        {/* Target amount */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Target amount</Text>
          <View style={styles.moneyRow}>
            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.textMuted}
              style={styles.moneyInput}
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Already saved */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Already saved?</Text>
            <Text style={styles.optionalBadge}>optional</Text>
          </View>
          <Text style={styles.fieldHelper}>Starts at 0 if you leave this blank.</Text>
          <View style={styles.moneyRow}>
            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
            <TextInput
              value={alreadySaved}
              onChangeText={setAlreadySaved}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.textMuted}
              style={styles.moneyInput}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Feather name="info" size={13} color={TEAL} />
          <Text style={styles.infoNoteText}>
            Each week you confirm a plan, Sortii adds your dinner saving to this fund automatically.
          </Text>
        </View>

        {/* Remove goal option */}
        {existing && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Remove savings goal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom }]}>
        <TouchableOpacity
          onPress={canSave ? handleSave : undefined}
          disabled={!canSave || saving}
          style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
            {saving ? "Saving…" : "Set my goal"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={styles.skipRow}>
          <Text style={styles.skipRowText}>Skip — no goal for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,143,136,0.15)",
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(42,143,136,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    lineHeight: 26,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    marginTop: 6,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 20,
  },
  emojiRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 8,
  },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  emojiBtnSelected: {
    borderColor: PLUM,
    backgroundColor: PLUM_TINT,
  },
  emojiText: {
    fontSize: 24,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: TEAL,
  },
  optionalBadge: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    backgroundColor: C.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  fieldHelper: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    lineHeight: 17,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#1A1A1A",
    backgroundColor: "#fff",
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "right",
  },
  moneyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: "#fff",
    gap: 6,
  },
  currencyPrefix: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  moneyInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "#1A1A1A",
    height: 52,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(42,143,136,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 19,
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.danger,
    textDecorationLine: "underline",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    backgroundColor: BG,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    backgroundColor: "#D4D4D4",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  primaryBtnTextDisabled: {
    color: "#888",
  },
  skipRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipRowText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
});

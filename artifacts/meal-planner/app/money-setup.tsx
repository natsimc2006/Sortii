import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useUserWeek } from "@/context/UserWeekContext";
import { WeekGoal } from "@/utils/yourWeekEngine";
import {
  getOnboardingState,
} from "@/utils/onboardingState";

const C = Colors.light;

function MoneyField({
  label,
  helper,
  value,
  onChange,
  optional,
  currencySymbol,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  currencySymbol: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: C.text }]}>{label}</Text>
        {optional && (
          <Text style={[styles.fieldOptional, { color: C.textMuted }]}>optional</Text>
        )}
      </View>
      {helper && (
        <Text style={[styles.fieldHelper, { color: C.textMuted }]}>{helper}</Text>
      )}
      <View style={[styles.inputRow, { borderColor: C.inputBorder, backgroundColor: C.card }]}>
        <Text style={[styles.inputPrefix, { color: C.textSecondary }]}>{currencySymbol}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.textMuted}
          style={[styles.inputField, { color: C.text }]}
          returnKeyType="done"
        />
        <Text style={[styles.inputSuffix, { color: C.textMuted }]}>/ week</Text>
      </View>
    </View>
  );
}

const GOAL_OPTIONS: { value: WeekGoal; label: string; emoji: string }[] = [
  { value: 'holiday', label: 'Holiday', emoji: '✈️' },
  { value: 'house',   label: 'House deposit', emoji: '🏠' },
  { value: 'wedding', label: 'Wedding', emoji: '💍' },
  { value: 'general', label: 'Just saving', emoji: '🐷' },
];

export default function MoneySetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currencySymbol, locale } = useLocale();
  const { setMoney, setGoal: setContextGoal } = useUserWeek();

  const [weeklyIncome, setWeeklyIncome] = useState("");
  const [fixedCosts, setFixedCosts] = useState("");
  const [groceries, setGroceries] = useState("");
  const [eatingOut, setEatingOut] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<WeekGoal>('none');
  const [saving, setSaving] = useState(false);
  const [hasMealsSetup, setHasMealsSetup] = useState(false);

  useEffect(() => {
    getOnboardingState().then((state) => {
      setHasMealsSetup(state.hasMealsSetup);
    });
  }, []);

  const income = parseFloat(weeklyIncome) || 0;
  const fixed = parseFloat(fixedCosts) || 0;
  const grocery = parseFloat(groceries) || 0;
  const eating = parseFloat(eatingOut) || 0;
  const discretionary = income > 0 ? Math.max(0, income - fixed - grocery - eating) : null;

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    setMoney({
      weeklyIncome: income,
      fixedWeeklyCosts: fixed,
      groceriesWeekly: grocery,
      eatingOutWeekly: eating,
    });
    setContextGoal(selectedGoal);
    setTimeout(() => {
      router.replace("/your-week");
    }, 400);
  };

  const canSave = weeklyIncome !== "" || groceries !== "";

  const paddingTop = Platform.OS === "web" ? 60 : insets.top;
  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 24;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop,
            borderBottomColor: C.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: C.chipBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={C.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: C.text }]}>Let's map your week</Text>
          <Text style={[styles.pageHelper, { color: C.textSecondary }]}>
            Ballpark is fine. We're aiming for helpful, not perfect.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: paddingBottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.setupCard, { borderColor: C.border }]}>
          <MoneyField
            label="Weekly income"
            value={weeklyIncome}
            onChange={setWeeklyIncome}
            currencySymbol={currencySymbol}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <MoneyField
            label="Fixed weekly costs"
            helper="Rent, mortgage, bills, loans — the usual."
            value={fixedCosts}
            onChange={setFixedCosts}
            currencySymbol={currencySymbol}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <MoneyField
            label="Groceries (rough weekly spend)"
            helper="Includes the weekly shop — we'll estimate the dinner share from there."
            value={groceries}
            onChange={setGroceries}
            currencySymbol={currencySymbol}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <MoneyField
            label="Eating out / takeaway"
            helper="Optional, but helpful."
            value={eatingOut}
            onChange={setEatingOut}
            optional
            currencySymbol={currencySymbol}
          />
        </View>

        {discretionary !== null && (
          <View style={[styles.summaryCard, { backgroundColor: C.tealTint, borderColor: C.primary }]}>
            <Text style={[styles.summaryLabel, { color: C.primary }]}>Weekly breathing room</Text>
            <Text style={[styles.summaryAmount, { color: C.primary }]}>
              {currencySymbol}{Math.round(discretionary)}
            </Text>
            <Text style={[styles.summaryNote, { color: C.textSecondary }]}>
              After your fixed costs and food spend — this is yours to work with.
            </Text>
          </View>
        )}

        <View style={[styles.goalCard, { borderColor: C.border }]}>
          <Text style={[styles.goalHeading, { color: C.text }]}>
            Got something you're saving for?
          </Text>
          <View style={styles.goalGrid}>
            {GOAL_OPTIONS.map((opt) => {
              const selected = selectedGoal === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedGoal(selected ? 'none' : opt.value);
                  }}
                  activeOpacity={0.75}
                  style={[
                    styles.goalChip,
                    {
                      borderColor: selected ? C.primary : C.border,
                      backgroundColor: selected ? C.tealTint : C.card,
                    },
                  ]}
                >
                  <Text style={styles.goalEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.goalLabel,
                      { color: selected ? C.primary : C.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedGoal !== 'none' && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedGoal('none');
              }}
            >
              <Text style={[styles.goalSkip, { color: C.textMuted }]}>
                Skip — no goal for now
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.footNote, { color: C.textMuted }]}>
          No spreadsheets required. All numbers stay on your device.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: paddingBottom,
            backgroundColor: C.background,
            borderTopColor: C.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
          style={[
            styles.primaryCta,
            { backgroundColor: canSave ? C.gold : C.border },
          ]}
        >
          <Text style={styles.primaryCtaText}>
            {saving ? "Saving…" : "See my week"}
          </Text>
          <Feather name={saving ? "loader" : "arrow-right"} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            if (hasMealsSetup) {
              router.replace("/(tabs)/planner");
            } else {
              router.replace("/your-week");
            }
          }}
          style={styles.skipBtn}
        >
          <Text style={[styles.skipText, { color: C.textMuted }]}>
            Skip for now — I'll add this later
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  pageHelper: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 3,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  setupCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(0,0,0,0.07)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  divider: {
    height: 1,
    marginHorizontal: 0,
  },
  fieldBlock: {
    padding: 18,
    gap: 6,
    backgroundColor: "#fff",
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  fieldOptional: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  fieldHelper: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputPrefix: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginRight: 4,
  },
  inputField: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    height: 48,
  },
  inputSuffix: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    lineHeight: 40,
  },
  summaryNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 4,
  },
  footNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryCtaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  goalCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    gap: 14,
    backgroundColor: "#fff",
  },
  goalHeading: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  goalChip: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  goalEmoji: {
    fontSize: 20,
  },
  goalLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  goalSkip: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});

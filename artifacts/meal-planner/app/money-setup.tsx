import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { WeekGoal } from "@/utils/yourWeekEngine";
import { getOnboardingState } from "@/utils/onboardingState";

const C = Colors.light;

const TEAL      = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD      = "#D29A22";
const GOLD_TINT = "#F6E6BA";
const RED       = "#B86557";

function MoneyField({
  label,
  helper,
  value,
  onChange,
  optional,
  currencySymbol,
  suffix = "/ week",
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  currencySymbol: string;
  suffix?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: C.primary }]}>{label}</Text>
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
        <Text style={[styles.inputSuffix, { color: C.textMuted }]}>{suffix}</Text>
      </View>
    </View>
  );
}

const GOAL_OPTIONS: { value: WeekGoal; label: string; emoji: string }[] = [
  { value: "holiday", label: "Holiday",       emoji: "✈️" },
  { value: "house",   label: "House deposit", emoji: "🏠" },
  { value: "wedding", label: "Wedding",       emoji: "💍" },
  { value: "general", label: "Just saving",   emoji: "🐷" },
];

export default function MoneySetupScreen() {
  const router        = useRouter();
  const { flow }      = useLocalSearchParams<{ flow?: string }>();
  const isFreshFlow   = flow === "fresh";
  const { autoGeneratePlan } = usePlanner();
  const insets        = useSafeAreaInsets();
  const { currencySymbol } = useLocale();
  const { money: savedMoney, lifestyleSpend: savedLifestyle, saveMoneySetup, isLoaded } =
    useUserWeek();

  // ── Committed inputs ──────────────────────────────────────────────────────
  const [weeklyIncome, setWeeklyIncome] = useState("");
  const [fixedCosts,   setFixedCosts]   = useState("");
  const [groceries,    setGroceries]    = useState("");
  const [streaming,    setStreaming]    = useState("");   // monthly

  // ── Lifestyle inputs ──────────────────────────────────────────────────────
  const [coffeeSpend,    setCoffeeSpend]    = useState("");
  const [takeaway,       setTakeaway]       = useState("");
  const [entertainment,  setEntertainment]  = useState("");  // monthly

  const [selectedGoal, setSelectedGoal] = useState<WeekGoal>("none");
  const [saving,       setSaving]        = useState(false);
  const [hasMealsSetup, setHasMealsSetup] = useState(false);

  useEffect(() => {
    getOnboardingState().then((state) => setHasMealsSetup(state.hasMealsSetup));
  }, []);

  useEffect(() => {
    if (savedMoney) {
      if (savedMoney.weeklyIncome > 0)     setWeeklyIncome(String(savedMoney.weeklyIncome));
      if (savedMoney.fixedWeeklyCosts > 0) setFixedCosts(String(savedMoney.fixedWeeklyCosts));
      if (savedMoney.groceriesWeekly > 0)  setGroceries(String(savedMoney.groceriesWeekly));
    }
    if (savedLifestyle) {
      if (savedLifestyle.streaming > 0)    setStreaming(String(savedLifestyle.streaming));
      if (savedLifestyle.coffee > 0)       setCoffeeSpend(String(savedLifestyle.coffee));
      if (savedLifestyle.entertainment > 0) setEntertainment(String(savedLifestyle.entertainment));
      if ((savedLifestyle.takeaway ?? 0) > 0) setTakeaway(String(savedLifestyle.takeaway));
    }
  }, []);

  // ── Parsed numbers (empty → 0) ────────────────────────────────────────────
  const income         = parseFloat(weeklyIncome)  || 0;
  const fixed          = parseFloat(fixedCosts)    || 0;
  const grocery        = parseFloat(groceries)     || 0;
  const streamingVal   = parseFloat(streaming)     || 0;   // monthly input
  const coffeeVal      = parseFloat(coffeeSpend)   || 0;
  const takeawayVal    = parseFloat(takeaway)      || 0;
  const entertainVal   = parseFloat(entertainment) || 0;   // monthly input

  // ── Two-tier calculation ──────────────────────────────────────────────────
  const committedBreathingRoom =
    income - fixed - grocery - (streamingVal / 4.3);

  const hasLifestyleInput = coffeeVal > 0 || takeawayVal > 0 || entertainVal > 0;

  const finalBreathingRoom =
    committedBreathingRoom - coffeeVal - takeawayVal - (entertainVal / 4.3);

  const showCard1 = weeklyIncome !== "" || fixedCosts !== "" || groceries !== "" || streaming !== "";
  const showCard2 = showCard1 && hasLifestyleInput;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    saveMoneySetup(
      {
        weeklyIncome:    income,
        fixedWeeklyCosts: fixed,
        groceriesWeekly: grocery,
        eatingOutWeekly: takeawayVal,
        otherWeeklySpend: hasLifestyleInput
          ? coffeeVal + takeawayVal + entertainVal / 4.3
          : undefined,
      },
      {
        streaming:    streamingVal,
        coffee:       coffeeVal,
        entertainment: entertainVal,
        takeaway:     takeawayVal,
      },
      selectedGoal,
    );
    setTimeout(() => {
      if (selectedGoal === "none") {
        if (isFreshFlow) {
          autoGeneratePlan();
          router.replace("/(tabs)/planner");
        } else {
          router.replace("/(tabs)/money");
        }
      } else {
        const returnTo = isFreshFlow ? "fresh" : "money";
        router.replace(`/goal-setup?returnTo=${returnTo}`);
      }
    }, 400);
  };

  const canSave = weeklyIncome !== "" || groceries !== "";

  const paddingTop    = Platform.OS === "web" ? 60 : insets.top;
  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 24;

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center", paddingTop }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop, borderBottomColor: "rgba(37,133,127,0.18)" }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.navigate("/(tabs)/home")}
          style={[styles.backBtn, { backgroundColor: C.chipBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={C.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.pageTitle, { color: C.text }]}>Make it yours.</Text>
          <Text style={[styles.pageHelper, { color: C.textSecondary }]}>
            Give us rough numbers. We'll do the thinking.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.navigate("/(tabs)/home")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeBtn}
        >
          <Feather name="x" size={22} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: paddingBottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section 1: Committed spend ── */}
        <Text style={styles.sectionLabel}>COMMITTED SPEND</Text>
        <View style={[styles.setupCard, { borderColor: "rgba(37,133,127,0.28)" }]}>
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
            label="Streaming & subscriptions"
            helper="We'll work out your weekly share."
            value={streaming}
            onChange={setStreaming}
            optional
            currencySymbol={currencySymbol}
            suffix="/ month"
          />
        </View>

        {/* ── Section 2: Lifestyle spend ── */}
        <Text style={[styles.sectionLabel, { marginTop: 4 }]}>LIFESTYLE SPEND</Text>
        <View style={[styles.lifestyleCard, { borderColor: "rgba(37,133,127,0.22)" }]}>
          <View style={styles.lifestyleHeader}>
            <Feather name="coffee" size={14} color={C.primary} />
            <Text style={[styles.lifestyleTitle, { color: C.text }]}>Day-to-day extras</Text>
            <Text style={[styles.lifestyleOptionalBadge, { color: C.textMuted, backgroundColor: C.chipBg }]}>
              optional
            </Text>
          </View>
          <Text style={[styles.lifestyleSubtitle, { color: C.textMuted }]}>
            Adding these gives you a more realistic picture of your week.
          </Text>
          <MoneyField
            label="Coffee & café"
            helper="Coffee runs, snacks, extra café spend"
            value={coffeeSpend}
            onChange={setCoffeeSpend}
            optional
            currencySymbol={currencySymbol}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <MoneyField
            label="Takeaway"
            helper="Delivery, drive-through, kebab runs"
            value={takeaway}
            onChange={setTakeaway}
            optional
            currencySymbol={currencySymbol}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <MoneyField
            label="Entertainment"
            helper="We'll work out your weekly share."
            value={entertainment}
            onChange={setEntertainment}
            optional
            currencySymbol={currencySymbol}
            suffix="/ month"
          />
        </View>

        {/* ── Card 1: Committed breathing room ── */}
        {showCard1 && (
          <View style={[styles.breathingCard, { backgroundColor: TEAL_TINT, borderColor: TEAL }]}>
            <Text style={styles.breathingCardLabel}>AFTER COMMITTED SPEND</Text>
            {committedBreathingRoom >= 0 ? (
              <Text style={[styles.breathingCardAmount, { color: TEAL }]}>
                {currencySymbol}{Math.round(committedBreathingRoom)} left before lifestyle spend
              </Text>
            ) : (
              <Text style={[styles.breathingCardAmount, { color: RED }]}>
                −{currencySymbol}{Math.round(Math.abs(committedBreathingRoom))} over before lifestyle spend
              </Text>
            )}
            <Text style={styles.breathingCardNote}>
              Income minus fixed costs, groceries and subscriptions.
            </Text>
          </View>
        )}

        {/* ── Card 2: After lifestyle spend ── */}
        {showCard2 && (
          <View style={[styles.breathingCard, { backgroundColor: GOLD_TINT, borderColor: GOLD }]}>
            <Text style={[styles.breathingCardLabel, { color: GOLD }]}>AFTER LIFESTYLE SPEND</Text>
            {finalBreathingRoom >= 0 ? (
              <Text style={[styles.breathingCardAmount, { color: TEAL }]}>
                {currencySymbol}{Math.round(finalBreathingRoom)} breathing room
              </Text>
            ) : (
              <Text style={[styles.breathingCardAmount, { color: RED }]}>
                −{currencySymbol}{Math.round(Math.abs(finalBreathingRoom))} over
              </Text>
            )}
            <Text style={styles.breathingCardNote}>
              This is what's left after everything — including coffee and takeaways.
            </Text>
          </View>
        )}

        {/* ── Savings goal ── */}
        <View style={[styles.goalCard, { borderColor: "rgba(37,133,127,0.20)" }]}>
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
                    setSelectedGoal(selected ? "none" : opt.value);
                  }}
                  activeOpacity={0.75}
                  style={[
                    styles.goalChip,
                    {
                      borderColor:     selected ? C.primary : C.border,
                      backgroundColor: selected ? C.tealTint : C.card,
                    },
                  ]}
                >
                  <Text style={styles.goalEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.goalLabel, { color: selected ? C.primary : C.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedGoal !== "none" && (
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setSelectedGoal("none"); }}>
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
          { paddingBottom, backgroundColor: C.background, borderTopColor: C.cardBorder },
        ]}
      >
        {!canSave && (
          <Text style={[styles.disabledHint, { color: C.textMuted }]}>
            Add at least one number to continue
          </Text>
        )}
        <TouchableOpacity
          onPress={canSave ? handleSave : undefined}
          activeOpacity={canSave ? 0.85 : 1}
          disabled={saving || !canSave}
          style={[
            styles.primaryCta,
            canSave
              ? { backgroundColor: C.gold }
              : { backgroundColor: "#D4D4D4", opacity: 0.7 },
          ]}
        >
          <Text style={[styles.primaryCtaText, !canSave && { color: "#888" }]}>
            {saving ? "Saving…" : "See my week"}
          </Text>
          {canSave && <Feather name={saving ? "loader" : "arrow-right"} size={18} color="#fff" />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            if (isFreshFlow) {
              autoGeneratePlan();
              router.replace("/(tabs)/planner");
            } else if (hasMealsSetup) {
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
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  pageTitle: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  pageHelper: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 3 },

  container: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.1,
    color: "#999",
    marginBottom: -4,
    paddingLeft: 2,
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

  divider: { height: 1, marginHorizontal: 0 },

  fieldBlock: { padding: 18, gap: 6, backgroundColor: "#fff" },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel:    { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fieldOptional: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fieldHelper:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 2 },

  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48,
  },
  inputPrefix: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginRight: 4 },
  inputField:  { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", height: 48 },
  inputSuffix: { fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: 4 },

  lifestyleCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "#fff",
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.05)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
      },
    }),
  },
  lifestyleHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6,
  },
  lifestyleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  lifestyleOptionalBadge: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden",
  },
  lifestyleSubtitle: {
    fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17,
    paddingHorizontal: 18, paddingBottom: 8,
  },

  // Two-tier breathing room cards
  breathingCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 18, gap: 6,
  },
  breathingCardLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1, textTransform: "uppercase", color: TEAL,
    marginBottom: 2,
  },
  breathingCardAmount: {
    fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 30,
  },
  breathingCardNote: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: "#888", lineHeight: 17, marginTop: 2,
  },

  goalCard: {
    borderRadius: 18, borderWidth: 1.5, padding: 20, gap: 14, backgroundColor: "#fff",
  },
  goalHeading: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  goalGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  goalChip: {
    flexBasis: "47%", flexGrow: 1,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1.5,
  },
  goalEmoji: { fontSize: 20 },
  goalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  goalSkip: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    textAlign: "center", textDecorationLine: "underline",
  },

  footNote: {
    fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18,
  },

  footer: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, gap: 8 },
  disabledHint: {
    fontSize: 12.5, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8,
  },
  primaryCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18, borderRadius: 18,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32, shadowRadius: 16, elevation: 6,
  },
  primaryCtaText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  skipBtn:  { alignItems: "center", paddingVertical: 10 },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

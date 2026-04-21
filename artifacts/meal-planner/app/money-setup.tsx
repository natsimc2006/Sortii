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

// ── Brand tokens ──────────────────────────────────────────────────────────────
const TEAL      = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const GOLD_TEXT = "#8A6010";
const GOLD_TINT = "#F6E6BA";
const GOLD      = "#D29A22";
const RED       = "#B86557";

// ── Part 1: FrequencyPill ─────────────────────────────────────────────────────
function FrequencyPill({ variant }: { variant: "weekly" | "monthly" }) {
  const isWeekly = variant === "weekly";
  return (
    <View
      style={[
        pillStyles.pill,
        { backgroundColor: isWeekly ? TEAL_TINT : GOLD_TINT },
      ]}
    >
      <Text
        style={[
          pillStyles.pillText,
          { color: isWeekly ? TEAL : GOLD_TEXT },
        ]}
      >
        {isWeekly ? "/ week" : "/ month"}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

// ── Part 2: Income frequency selector ────────────────────────────────────────
type IncomeFreq = "weekly" | "fortnightly" | "monthly";

function FreqSelector({
  value,
  onChange,
}: {
  value: IncomeFreq;
  onChange: (f: IncomeFreq) => void;
}) {
  const options: { key: IncomeFreq; label: string }[] = [
    { key: "weekly",      label: "Weekly"      },
    { key: "fortnightly", label: "Fortnightly" },
    { key: "monthly",     label: "Monthly"     },
  ];
  return (
    <View style={freqStyles.row}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.75}
            style={[
              freqStyles.pill,
              active
                ? { backgroundColor: TEAL, borderColor: TEAL }
                : { backgroundColor: "#fff", borderColor: "#E6E1D7" },
            ]}
          >
            <Text
              style={[
                freqStyles.pillText,
                { color: active ? "#fff" : "#999" },
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const freqStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginTop: 8 },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

// ── MoneyField ────────────────────────────────────────────────────────────────
function MoneyField({
  label,
  sublabel,
  value,
  onChange,
  optional,
  currencySymbol,
  frequencyVariant,
  freqSelector,
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  currencySymbol: string;
  frequencyVariant?: "weekly" | "monthly";
  freqSelector?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: C.primary }]}>{label}</Text>
        {optional && (
          <Text style={[styles.fieldOptional, { color: C.textMuted }]}>optional</Text>
        )}
      </View>
      {sublabel && (
        <Text style={[styles.fieldHelper, { color: C.textMuted }]}>{sublabel}</Text>
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
        {frequencyVariant && <FrequencyPill variant={frequencyVariant} />}
      </View>
      {freqSelector}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundToFive(n: number): number {
  return Math.round(n / 5) * 5;
}

function safeNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const GOAL_OPTIONS: { value: WeekGoal; label: string; emoji: string }[] = [
  { value: "holiday", label: "Holiday",       emoji: "✈️" },
  { value: "house",   label: "House deposit", emoji: "🏠" },
  { value: "wedding", label: "Wedding",       emoji: "💍" },
  { value: "general", label: "Just saving",   emoji: "🐷" },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MoneySetupScreen() {
  const router      = useRouter();
  const { flow }    = useLocalSearchParams<{ flow?: string }>();
  const isFreshFlow = flow === "fresh";
  const { autoGeneratePlan } = usePlanner();
  const insets      = useSafeAreaInsets();
  const { currencySymbol } = useLocale();
  const { money: savedMoney, lifestyleSpend: savedLifestyle, saveMoneySetup, isLoaded } =
    useUserWeek();

  // ── Committed inputs (all monthly except groceries which is weekly) ─────────
  const [incomeRaw,      setIncomeRaw]      = useState("");
  const [incomeFreq,     setIncomeFreq]     = useState<IncomeFreq>("fortnightly");
  const [mortgageRent,   setMortgageRent]   = useState("");   // monthly
  const [billsLoans,     setBillsLoans]     = useState("");   // monthly
  const [subscriptions,  setSubscriptions]  = useState("");   // monthly
  const [groceries,      setGroceries]      = useState("");   // weekly

  // ── Lifestyle inputs ─────────────────────────────────────────────────────────
  const [coffeeSpend,   setCoffeeSpend]   = useState("");   // weekly
  const [takeaway,      setTakeaway]      = useState("");   // weekly
  const [entertainment, setEntertainment] = useState("");   // monthly

  const [selectedGoal,  setSelectedGoal]  = useState<WeekGoal>("none");
  const [saving,        setSaving]        = useState(false);
  const [hasMealsSetup, setHasMealsSetup] = useState(false);

  useEffect(() => {
    getOnboardingState().then((s) => setHasMealsSetup(s.hasMealsSetup));
  }, []);

  // Restore saved values
  useEffect(() => {
    if (savedMoney) {
      if (savedMoney.weeklyIncome > 0)    setIncomeRaw(String(savedMoney.weeklyIncome));
      if (savedMoney.groceriesWeekly > 0) setGroceries(String(savedMoney.groceriesWeekly));
    }
    if (savedLifestyle) {
      if (savedLifestyle.streaming > 0)    setSubscriptions(String(savedLifestyle.streaming));
      if (savedLifestyle.coffee > 0)       setCoffeeSpend(String(savedLifestyle.coffee));
      if (savedLifestyle.entertainment > 0) setEntertainment(String(savedLifestyle.entertainment));
      if ((savedLifestyle.takeaway ?? 0) > 0) setTakeaway(String(savedLifestyle.takeaway));
    }
  }, []);

  // ── Derived weekly figures ────────────────────────────────────────────────────
  const incomeVal   = safeNum(incomeRaw);
  const monthlyIncome: number =
    incomeFreq === "weekly"      ? incomeVal * 4.3
    : incomeFreq === "fortnightly" ? incomeVal * 2.15
    : incomeVal;
  const weeklyIncome = monthlyIncome / 4.3;

  const w_mortgage  = safeNum(mortgageRent)  / 4.3;
  const w_bills     = safeNum(billsLoans)    / 4.3;
  const w_subs      = safeNum(subscriptions) / 4.3;
  const w_groceries = safeNum(groceries);
  const w_coffee    = safeNum(coffeeSpend);
  const w_takeaway  = safeNum(takeaway);
  const w_entertain = safeNum(entertainment) / 4.3;

  // ── Two-tier breathing room ───────────────────────────────────────────────────
  const committedBreathingRoom =
    weeklyIncome - w_mortgage - w_bills - w_subs - w_groceries;

  const finalBreathingRoom =
    committedBreathingRoom - w_coffee - w_takeaway - w_entertain;

  const hasAnyCommitted =
    incomeRaw !== "" || mortgageRent !== "" || billsLoans !== "" ||
    subscriptions !== "" || groceries !== "";

  const hasAnyLifestyle =
    coffeeSpend !== "" || takeaway !== "" || entertainment !== "";

  const showCard1 = hasAnyCommitted;
  const showCard2 = showCard1 && hasAnyLifestyle;

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    saveMoneySetup(
      {
        weeklyIncome,
        fixedWeeklyCosts: w_mortgage + w_bills,
        groceriesWeekly:  w_groceries,
        eatingOutWeekly:  w_takeaway,
        otherWeeklySpend: hasAnyLifestyle
          ? w_coffee + w_takeaway + w_entertain
          : undefined,
      },
      {
        streaming:    safeNum(subscriptions),
        coffee:       w_coffee,
        entertainment: safeNum(entertainment),
        takeaway:     w_takeaway,
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

  const canSave = incomeRaw !== "" || groceries !== "";

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
      {/* Header */}
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

          {/* Income — frequency selector replaces pill */}
          <View style={styles.fieldBlock}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: C.primary }]}>Monthly income</Text>
            </View>
            <View style={[styles.inputRow, { borderColor: C.inputBorder, backgroundColor: C.card }]}>
              <Text style={[styles.inputPrefix, { color: C.textSecondary }]}>{currencySymbol}</Text>
              <TextInput
                value={incomeRaw}
                onChangeText={setIncomeRaw}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.textMuted}
                style={[styles.inputField, { color: C.text }]}
                returnKeyType="done"
              />
            </View>
            <FreqSelector value={incomeFreq} onChange={setIncomeFreq} />
          </View>

          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Mortgage or rent"
            sublabel="Your biggest fixed cost."
            value={mortgageRent}
            onChange={setMortgageRent}
            currencySymbol={currencySymbol}
            frequencyVariant="monthly"
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Bills, loans & regular payments"
            sublabel="Electricity, rates, loan repayments, insurance — monthly total."
            value={billsLoans}
            onChange={setBillsLoans}
            currencySymbol={currencySymbol}
            frequencyVariant="monthly"
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Streaming & subscriptions"
            sublabel="Netflix, Spotify, apps, memberships."
            value={subscriptions}
            onChange={setSubscriptions}
            currencySymbol={currencySymbol}
            frequencyVariant="monthly"
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Groceries"
            sublabel="The weekly shop — we'll estimate the dinner share from there."
            value={groceries}
            onChange={setGroceries}
            currencySymbol={currencySymbol}
            frequencyVariant="weekly"
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
            sublabel="Coffee runs, snacks, extra café spend."
            value={coffeeSpend}
            onChange={setCoffeeSpend}
            optional
            currencySymbol={currencySymbol}
            frequencyVariant="weekly"
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Takeaway"
            sublabel="Delivery, drive-through, kebab runs."
            value={takeaway}
            onChange={setTakeaway}
            optional
            currencySymbol={currencySymbol}
            frequencyVariant="weekly"
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <MoneyField
            label="Entertainment"
            sublabel="Movies, drinks, weekend plans."
            value={entertainment}
            onChange={setEntertainment}
            optional
            currencySymbol={currencySymbol}
            frequencyVariant="monthly"
          />
        </View>

        {/* ── Card 1: Committed breathing room ── */}
        {showCard1 && <BreathingCard
          variant="committed"
          weeklyAmount={committedBreathingRoom}
          currencySymbol={currencySymbol}
        />}

        {/* ── Card 2: After lifestyle spend ── */}
        {showCard2 && <BreathingCard
          variant="lifestyle"
          weeklyAmount={finalBreathingRoom}
          currencySymbol={currencySymbol}
        />}

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

      {/* Footer CTA */}
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

// ── BreathingCard ─────────────────────────────────────────────────────────────
function BreathingCard({
  variant,
  weeklyAmount,
  currencySymbol,
}: {
  variant: "committed" | "lifestyle";
  weeklyAmount: number;
  currencySymbol: string;
}) {
  const isCommitted = variant === "committed";
  const isNegative  = weeklyAmount < 0;
  const absWeekly   = Math.abs(Math.round(weeklyAmount));
  const monthlyEq   = roundToFive(Math.abs(weeklyAmount) * 4.3);

  const label = isCommitted ? "AFTER COMMITTED SPEND" : "AFTER LIFESTYLE SPEND";

  let amountText: string;
  if (isNegative) {
    amountText = `−${currencySymbol}${absWeekly} over${isCommitted ? " before lifestyle spend" : ""}`;
  } else {
    amountText = isCommitted
      ? `${currencySymbol}${absWeekly} left before lifestyle spend`
      : `${currencySymbol}${absWeekly} breathing room`;
  }

  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: isCommitted ? TEAL_TINT : GOLD_TINT,
          borderColor:      isCommitted ? TEAL      : GOLD,
        },
      ]}
    >
      <Text style={[cardStyles.label, { color: isCommitted ? TEAL : GOLD_TEXT }]}>
        {label}
      </Text>
      <Text style={[cardStyles.amount, { color: isNegative ? RED : TEAL }]}>
        {amountText}
      </Text>
      {!isNegative && (
        <Text style={cardStyles.monthly}>
          ~{currencySymbol}{monthlyEq}/month
        </Text>
      )}
      <Text style={cardStyles.note}>
        {isCommitted
          ? "Income minus mortgage, bills, subscriptions and groceries."
          : "This is what's left after everything — including coffee and takeaways."}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card:    { borderRadius: 16, borderWidth: 1.5, padding: 18, gap: 4 },
  label:   { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  amount:  { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 30 },
  monthly: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#999", fontStyle: "italic", marginTop: 2 },
  note:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "#888", lineHeight: 17, marginTop: 4 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  pageTitle:  { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  pageHelper: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 3 },

  container: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.1, color: "#999", marginBottom: -4, paddingLeft: 2,
  },

  setupCard: {
    borderRadius: 18, borderWidth: 1.5, overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(0,0,0,0.07)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
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

  lifestyleCard: {
    borderRadius: 18, borderWidth: 1.5, overflow: "hidden", backgroundColor: "#fff",
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.05)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
    }),
  },
  lifestyleHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6,
  },
  lifestyleTitle:         { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  lifestyleOptionalBadge: { fontSize: 11, fontFamily: "Inter_400Regular", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  lifestyleSubtitle:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, paddingHorizontal: 18, paddingBottom: 8 },

  goalCard:    { borderRadius: 18, borderWidth: 1.5, padding: 20, gap: 14, backgroundColor: "#fff" },
  goalHeading: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  goalGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  goalChip: {
    flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5,
  },
  goalEmoji: { fontSize: 20 },
  goalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  goalSkip:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", textDecorationLine: "underline" },

  footNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },

  footer:       { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, gap: 8 },
  disabledHint: { fontSize: 12.5, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },
  primaryCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18, borderRadius: 18,
    shadowColor: "#F0AC2E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 16, elevation: 6,
  },
  primaryCtaText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  skipBtn:        { alignItems: "center", paddingVertical: 10 },
  skipText:       { fontSize: 13, fontFamily: "Inter_400Regular" },
});

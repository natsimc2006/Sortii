import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import {
  DEFAULT_PREFERENCES,
  DEFAULT_WEEKEND_OVERRIDES,
  EXCLUSION_OPTIONS,
  PlanPreferences,
  WeekendOverrides,
} from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useLocale } from "@/context/LocaleContext";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 60 : 49;

function OptionRow({
  options,
  value,
  onSelect,
}: {
  options: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const C = Colors.light;
  return (
    <View style={styles.optionRow}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => { Haptics.selectionAsync(); onSelect(o.value); }}
            activeOpacity={0.75}
            style={[
              styles.optionChip,
              active
                ? { backgroundColor: C.primary, borderColor: C.primary }
                : { backgroundColor: "#FFFFFF", borderColor: "#E0E0E0" },
            ]}
          >
            <Text style={[styles.optionChipText, { color: active ? "#FFFFFF" : C.text }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PillButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const C = Colors.light;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        active
          ? { backgroundColor: C.primary, borderColor: C.primary }
          : { backgroundColor: "#FFFFFF", borderColor: "#E0E0E0" },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? "#FFFFFF" : C.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Toggle({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  const C = Colors.light;
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggle, { backgroundColor: value ? C.primary : C.border }]}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

function Hint({ text }: { text: string }) {
  return <Text style={styles.hint}>{text}</Text>;
}

function RowLabel({ title, sub }: { title: string; sub?: string }) {
  const C = Colors.light;
  return (
    <View style={styles.rowLabelInner}>
      <Text style={[styles.rowLabelTitle, { color: C.text }]}>{title}</Text>
      {sub && <Text style={[styles.rowLabelSub, { color: C.textMuted }]}>{sub}</Text>}
    </View>
  );
}

function ToggleRow({
  title,
  sub,
  value,
  onToggle,
}: {
  title: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <RowLabel title={title} sub={sub} />
      <Toggle value={value} onToggle={onToggle} />
    </View>
  );
}

function TierSection({
  title,
  helper,
  expanded,
  onToggle,
  badge,
  children,
  accentColor,
  cardBg,
  shadowStyle,
}: {
  title: string;
  helper: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
  accentColor?: string;
  cardBg?: string;
  shadowStyle?: object;
}) {
  const C = Colors.light;
  return (
    <View style={[styles.tierSection, { borderColor: C.border, backgroundColor: cardBg ?? C.card }, shadowStyle]}>
      {accentColor && (
        <View style={[styles.tierAccent, { backgroundColor: accentColor }]} />
      )}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={styles.tierHeader}
      >
        <View style={styles.tierHeaderLeft}>
          <Text style={[styles.tierTitle, { color: C.text }]}>{title}</Text>
          {!expanded && (
            <Text style={[styles.tierHelper, { color: C.textMuted }]}>{helper}</Text>
          )}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={C.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.tierContent}>
          <Text style={[styles.tierHelperExpanded, { color: C.textMuted }]}>{helper}</Text>
          {children}
        </View>
      )}
    </View>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const C = Colors.light;
  return (
    <View style={styles.sectionBlock}>
      {title ? <Text style={[styles.sectionBlockTitle, { color: C.primary }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export default function PreferencesScreen() {
  const { preferences, setPreferences, setIsOnboarded, autoGeneratePlan, setPreferencesDirty } = usePlanner();
  const { currencySymbol } = useLocale();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [prefs, setPrefs] = useState<PlanPreferences>({
    ...DEFAULT_PREFERENCES,
    ...preferences,
    weekendOverrides: preferences.weekendOverrides ?? { ...DEFAULT_WEEKEND_OVERRIDES },
  });
  const [householdInput, setHouseholdInput] = useState(String(preferences.householdSize));
  const [savedToast, setSavedToast] = useState(false);

  const [tier1Open, setTier1Open] = useState(true);
  const [tier2Open, setTier2Open] = useState(false);
  const [tier3Open, setTier3Open] = useState(false);
  const [tier4Open, setTier4Open] = useState(false);

  const update = (key: keyof PlanPreferences, value: any) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const updateWeekend = (key: keyof WeekendOverrides, value: any) => {
    setPrefs((p) => ({
      ...p,
      weekendOverrides: { ...p.weekendOverrides, [key]: value },
    }));
  };

  const toggleExclusion = (ex: string) => {
    Haptics.selectionAsync();
    const current = prefs.exclusions;
    if (current.includes(ex)) {
      update("exclusions", current.filter((e) => e !== ex));
    } else {
      update("exclusions", [...current, ex]);
    }
  };

  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const isFreshFlow = flow === "fresh";

  const PLAN_AFFECTING_KEYS: (keyof PlanPreferences)[] = [
    "planningMode", "healthStyle", "cookingEffort", "mealVariety",
    "cookingStyle", "cuisinePreference", "mealCoverage", "exclusions",
    "seasonalMode", "minimiseWaste", "leftoversMode", "weekendOverrides",
    "budgetLevel", "householdSize", "dietType", "kidFriendly", "prepStyle",
  ];

  const isPlanAffecting = (a: PlanPreferences, b: PlanPreferences) =>
    PLAN_AFFECTING_KEYS.some((key) =>
      JSON.stringify(a[key]) !== JSON.stringify(b[key])
    );

  const handleClose = () => {
    if (isFreshFlow && router.canGoBack()) {
      router.back();
    } else {
      router.navigate("/(tabs)/planner");
    }
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const size = parseInt(householdInput, 10);
    const finalPrefs = {
      ...prefs,
      householdSize: isNaN(size) || size < 1 ? 2 : Math.min(size, 20),
    };
    await setPreferences(finalPrefs);
    await setIsOnboarded(true);
    autoGeneratePlan(finalPrefs);
    setPreferencesDirty(false);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      if (isFreshFlow) {
        router.push("/money-setup?flow=fresh");
      } else {
        router.replace("/(tabs)/planner");
      }
    }, 1200);
  };

  const handleReset = () => {
    Haptics.selectionAsync();
    setPrefs({ ...DEFAULT_PREFERENCES });
    setHouseholdInput(String(DEFAULT_PREFERENCES.householdSize));
  };

  const planningModeHint =
    prefs.planningMode === "manual"
      ? "All yours."
      : prefs.planningMode === "mixed"
        ? "You pick a few, we'll fill the gaps."
        : "We've got this.";

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {savedToast && (
        <View style={[styles.savedToast, { backgroundColor: C.primary, top: insets.top + 12 }]}>
          <Feather name="check" size={15} color="#fff" />
          <Text style={styles.savedToastText}>Saved. Easy.</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 6,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.prefHero}>
          <View style={styles.prefHeroTopRow}>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={18} color={C.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.prefHeroHeading, { color: C.text }]}>Make it yours.</Text>
              <Text style={[styles.prefHeroSub, { color: C.textSecondary }]}>
                Set your preferences — we'll handle the rest.
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <Feather name="x" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TierSection
          title="Quick Setup"
          helper="Set the basics for your weekly plan."
          expanded={tier1Open}
          onToggle={() => setTier1Open((v) => !v)}
          shadowStyle={{
            borderColor: "rgba(42,143,136,0.40)",
            borderWidth: 1.5,
            ...Platform.select({
              web: { boxShadow: "0px 3px 16px rgba(42,143,136,0.10)" } as object,
              default: {
                shadowColor: "#2A8F88",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.10,
                shadowRadius: 16,
                elevation: 3,
              },
            }),
          }}
        >
          <SectionBlock title="Planning Mode">
            <OptionRow
              options={[
                { label: "Auto", value: "auto" },
                { label: "Mixed", value: "mixed" },
                { label: "Manual", value: "manual" },
              ]}
              value={prefs.planningMode}
              onSelect={(v) => update("planningMode", v)}
            />
            <Hint text={planningModeHint} />
          </SectionBlock>

          <SectionBlock title="Household Size">
            <View style={[styles.numberInput, { borderColor: C.inputBorder, backgroundColor: C.card }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  const v = Math.max(1, parseInt(householdInput, 10) - 1);
                  setHouseholdInput(String(v));
                }}
                style={[styles.stepper, { backgroundColor: "#E6F3F0" }]}
              >
                <Feather name="minus" size={18} color={C.primary} />
              </TouchableOpacity>
              <TextInput
                value={householdInput}
                onChangeText={setHouseholdInput}
                keyboardType="number-pad"
                style={[styles.numberField, { color: C.text, fontFamily: "Inter_700Bold" }]}
                textAlign="center"
                maxLength={2}
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  const v = Math.min(20, parseInt(householdInput, 10) + 1);
                  setHouseholdInput(String(v));
                }}
                style={[styles.stepper, { backgroundColor: "#E6F3F0" }]}
              >
                <Feather name="plus" size={18} color={C.primary} />
              </TouchableOpacity>
            </View>
            <Hint text="We'll size everything for you." />
          </SectionBlock>

          <SectionBlock title="Budget Level">
            <OptionRow
              options={[
                { label: "Super Budget", value: "super-budget" },
                { label: "Budget", value: "budget" },
                { label: "Standard", value: "standard" },
                { label: "Premium", value: "premium" },
              ]}
              value={prefs.budgetLevel}
              onSelect={(v) => update("budgetLevel", v)}
            />
            {prefs.budgetLevel === "super-budget" && (
              <Hint text={`~${currencySymbol}5 per serve. The leanest meals in the collection.`} />
            )}
            <Hint text="No judgement. Just dinner." />
          </SectionBlock>

          <SectionBlock title="Meals per Week">
            <OptionRow
              options={[
                { label: "3 nights", value: "3" },
                { label: "5 nights", value: "5" },
                { label: "7 nights", value: "7" },
              ]}
              value={String(prefs.mealVariety)}
              onSelect={(v) => update("mealVariety", parseInt(v) as 3 | 5 | 7)}
            />
            <Hint text="Even three nights is a win." />
          </SectionBlock>

          <SectionBlock title="Dietary Preferences">
            <OptionRow
              options={[
                { label: "No preference", value: "no-preference" },
                { label: "Vegetarian", value: "vegetarian" },
                { label: "Vegan", value: "vegan" },
                { label: "Pescatarian", value: "pescatarian" },
              ]}
              value={prefs.dietType ?? "no-preference"}
              onSelect={(v) => update("dietType", v)}
            />
            {prefs.dietType === "vegan" && (
              <Hint text="Filters out all meat, seafood, dairy, and eggs." />
            )}
            {prefs.dietType === "vegetarian" && (
              <Hint text="Filters out meat and seafood. Dairy and eggs allowed." />
            )}
            {prefs.dietType === "pescatarian" && (
              <Hint text="Filters out meat. Fish and seafood are included." />
            )}
            <Hint text="Hard no's only. We'll handle variety." />
          </SectionBlock>

          <SectionBlock title="Ingredient Exclusions">
            <View style={styles.pillGrid}>
              {EXCLUSION_OPTIONS.map((ex) => (
                <PillButton
                  key={ex}
                  label={ex}
                  active={prefs.exclusions.includes(ex)}
                  onPress={() => toggleExclusion(ex)}
                />
              ))}
            </View>
            <Hint text="Tap anything to skip it." />
          </SectionBlock>
        </TierSection>

        <TierSection
          title="Make it yours"
          helper="Optional — tweak it if you like."
          expanded={tier2Open}
          onToggle={() => setTier2Open((v) => !v)}
          accentColor="#F0AC2E"
          cardBg="#FFFDF7"
        >
          <SectionBlock title="Meals to Plan">
            <OptionRow
              options={[
                { label: "Dinners only", value: "dinner-only" },
                { label: "Lunch + Dinner", value: "lunch-dinner" },
              ]}
              value={prefs.mealCoverage}
              onSelect={(v) => update("mealCoverage", v)}
            />
          </SectionBlock>

          <SectionBlock title="Health Style">
            <OptionRow
              options={[
                { label: "Standard", value: "standard" },
                { label: "Healthy", value: "healthy" },
                { label: "High Protein", value: "high-protein" },
                { label: "Low Carb", value: "low-carb" },
              ]}
              value={prefs.healthStyle}
              onSelect={(v) => update("healthStyle", v)}
            />
            {prefs.healthStyle === "low-carb" && (
              <Hint text="Filters out pasta, rice, and noodle-based dishes." />
            )}
          </SectionBlock>

          <SectionBlock title="Cuisine Preference">
            <OptionRow
              options={[
                { label: "Mixed", value: "mixed" },
                { label: "Italian", value: "italian" },
                { label: "Asian", value: "asian" },
                { label: "Mexican", value: "mexican" },
                { label: "Aussie Classics", value: "aussie" },
              ]}
              value={prefs.cuisinePreference ?? "mixed"}
              onSelect={(v) => update("cuisinePreference", v)}
            />
          </SectionBlock>

          <SectionBlock title="Recipe Complexity">
            <OptionRow
              options={[
                { label: "Don't Mind", value: "any" },
                { label: "Quick & Simple", value: "quick" },
                { label: "Balanced", value: "balanced" },
              ]}
              value={prefs.cookingEffort ?? "any"}
              onSelect={(v) => update("cookingEffort", v)}
            />
            {prefs.cookingEffort === "quick" && (
              <Hint text="Easy meals ready in 20 minutes or less." />
            )}
            {prefs.cookingEffort === "balanced" && (
              <Hint text="Under 35 minutes — some prep, great results." />
            )}
          </SectionBlock>

          <SectionBlock title="Cooking Style">
            <OptionRow
              options={[
                { label: "Mixed", value: "mixed" },
                { label: "One-Pan", value: "one-pan" },
                { label: "Air Fryer", value: "air-fryer" },
                { label: "Oven-Based", value: "oven-based" },
              ]}
              value={prefs.cookingStyle}
              onSelect={(v) => update("cookingStyle", v)}
            />
          </SectionBlock>
        </TierSection>

        <TierSection
          title="Make it smarter ✨"
          helper="Let us do a bit of thinking for you."
          expanded={tier3Open}
          onToggle={() => setTier3Open((v) => !v)}
          accentColor="#5E3A4C"
          cardBg="#F3E8EE"
        >
          <SectionBlock title="">
            <ToggleRow
              title="Cook once, eat twice"
              sub="Prefer meals that make multiple portions — cook once and eat across 2–3 days."
              value={prefs.leftoversMode === "cook-once"}
              onToggle={() => {
                Haptics.selectionAsync();
                update("leftoversMode", prefs.leftoversMode === "cook-once" ? "none" : "cook-once");
              }}
            />
          </SectionBlock>

          <SectionBlock title="">
            <ToggleRow
              title="Shared Ingredients"
              sub="Reuse ingredients across the week to save money and reduce waste."
              value={prefs.minimiseWaste ?? false}
              onToggle={() => {
                Haptics.selectionAsync();
                update("minimiseWaste", !(prefs.minimiseWaste ?? false));
              }}
            />
          </SectionBlock>

          <SectionBlock title="">
            <ToggleRow
              title="Seasonal Mode"
              sub="Cheaper, fresher, better."
              value={prefs.seasonalMode ?? false}
              onToggle={() => {
                Haptics.selectionAsync();
                update("seasonalMode", !(prefs.seasonalMode ?? false));
              }}
            />
            {prefs.seasonalMode && (
              <Hint text="Seasonal recipes will be prioritised in your plan." />
            )}
          </SectionBlock>

          <SectionBlock title="">
            <ToggleRow
              title="Kid-friendly meals"
              sub="No spice. No surprises."
              value={prefs.kidFriendly ?? false}
              onToggle={() => {
                Haptics.selectionAsync();
                update("kidFriendly", !(prefs.kidFriendly ?? false));
              }}
            />
            {prefs.kidFriendly && (
              <Hint text="Only confirmed kid-friendly meals will be shown." />
            )}
          </SectionBlock>

          <SectionBlock title="Prep Style">
            <OptionRow
              options={[
                { label: "Mixed", value: "mixed" },
                { label: "Batch Cook", value: "batch-cook" },
                { label: "Quick Assembly", value: "quick-assembly" },
                { label: "Family Style", value: "family-style" },
              ]}
              value={prefs.prepStyle ?? "mixed"}
              onSelect={(v) => update("prepStyle", v)}
            />
            {prefs.prepStyle === "batch-cook" && (
              <Hint text="Prefers recipes that make multiple portions." />
            )}
            {prefs.prepStyle === "quick-assembly" && (
              <Hint text="Wraps, salads, bowls, and simple assemblies." />
            )}
          </SectionBlock>
        </TierSection>

        <TierSection
          title="Advanced"
          helper="Extra controls if you want them."
          expanded={tier4Open}
          onToggle={() => setTier4Open((v) => !v)}
          accentColor="#E6E1D7"
          cardBg="#FFFFFF"
        >
          <SectionBlock title="">
            <ToggleRow
              title="Weekend Overrides"
              sub="Different settings for Saturday & Sunday — longer cook times or bigger budget."
              value={prefs.weekendOverrides?.enabled ?? false}
              onToggle={() => {
                Haptics.selectionAsync();
                updateWeekend("enabled", !(prefs.weekendOverrides?.enabled ?? false));
              }}
            />
          </SectionBlock>

          {prefs.weekendOverrides?.enabled && (
            <>
              <SectionBlock title="Weekend Recipe Complexity">
                <OptionRow
                  options={[
                    { label: "Don't Mind", value: "any" },
                    { label: "Quick & Simple", value: "quick" },
                    { label: "Balanced", value: "balanced" },
                  ]}
                  value={prefs.weekendOverrides?.cookingEffort ?? "any"}
                  onSelect={(v) => updateWeekend("cookingEffort", v as "quick" | "balanced" | "any")}
                />
              </SectionBlock>
              <SectionBlock title="Weekend Budget">
                <OptionRow
                  options={[
                    { label: "Super Budget", value: "super-budget" },
                    { label: "Budget", value: "budget" },
                    { label: "Standard", value: "standard" },
                    { label: "Premium", value: "premium" },
                  ]}
                  value={prefs.weekendOverrides?.budgetLevel ?? "standard"}
                  onSelect={(v) => updateWeekend("budgetLevel", v)}
                />
              </SectionBlock>
            </>
          )}
        </TierSection>

        <TouchableOpacity onPress={handleReset} style={styles.resetRow}>
          <Feather name="rotate-ccw" size={13} color={C.textMuted} />
          <Text style={[styles.resetText, { color: C.textMuted }]}>Reset to defaults</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, { backgroundColor: C.gold }]}
        >
          <Feather name="check" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Save settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  pageHeader: {
    gap: 4,
    marginBottom: 4,
  },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    padding: 4,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E8F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  pageHelper: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tierSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tierAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 1,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tierHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  tierTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  tierHelper: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tierHelperExpanded: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  tierContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: "#E6E1D7",
  },
  sectionBlock: {
    gap: 10,
  },
  sectionBlockTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  optionChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 17,
    color: "#5E3A4C",
  },
  numberInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(42,143,136,0.30)",
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "flex-start",
    backgroundColor: "#E6F3F0",
  },
  stepper: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  numberField: {
    width: 60,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowLabelInner: {
    flex: 1,
    gap: 3,
  },
  rowLabelTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  rowLabelSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  toggleKnobOn: {
    alignSelf: "flex-end",
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 4,
  },
  resetText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 5,
  },
  saveBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  savedToast: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  savedToastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  prefHero: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  prefHeroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  prefHeroHeading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  prefHeroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 3,
  },
});

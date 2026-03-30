import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { PillButton } from "@/components/PillButton";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const C = Colors.light;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function OptionRow({ options, value, onSelect }: {
  options: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <PillButton
          key={opt.value}
          label={opt.label}
          active={value === opt.value}
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(opt.value);
          }}
        />
      ))}
    </View>
  );
}

export default function PreferencesScreen() {
  const { preferences, setPreferences, setIsOnboarded } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [prefs, setPrefs] = useState<PlanPreferences>({
    ...DEFAULT_PREFERENCES,
    ...preferences,
    weekendOverrides: preferences.weekendOverrides ?? { ...DEFAULT_WEEKEND_OVERRIDES },
  });
  const [householdInput, setHouseholdInput] = useState(String(preferences.householdSize));

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

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const size = parseInt(householdInput, 10);
    const finalPrefs = {
      ...prefs,
      householdSize: isNaN(size) || size < 1 ? 2 : Math.min(size, 20),
    };
    await setPreferences(finalPrefs);
    await setIsOnboarded(true);
    router.canGoBack() ? router.back() : router.replace("/(tabs)/planner");
  };

  const handleReset = () => {
    Haptics.selectionAsync();
    setPrefs({ ...DEFAULT_PREFERENCES });
    setHouseholdInput(String(DEFAULT_PREFERENCES.householdSize));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 80 : insets.top + 20,
            paddingBottom: 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/planner")}
            style={[styles.backBtn, { backgroundColor: C.chipBg }]}
          >
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: C.text }]}>Preferences</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>
              Customise your weekly meal planning
            </Text>
          </View>
        </View>

        <Section title="Planning Mode">
          <OptionRow
            options={[
              { label: "Manual", value: "manual" },
              { label: "Mixed", value: "mixed" },
              { label: "Auto", value: "auto" },
            ]}
            value={prefs.planningMode}
            onSelect={(v) => update("planningMode", v)}
          />
          <Text style={[styles.hint, { color: C.textMuted }]}>
            {prefs.planningMode === "manual"
              ? "You choose every meal yourself."
              : prefs.planningMode === "mixed"
                ? "You choose some, the app fills the rest."
                : "The app picks the whole week for you."}
          </Text>
        </Section>

        <Section title="Household Size">
          <View style={[styles.numberInput, { borderColor: C.inputBorder, backgroundColor: C.card }]}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                const v = Math.max(1, parseInt(householdInput, 10) - 1);
                setHouseholdInput(String(v));
              }}
              style={[styles.stepper, { backgroundColor: C.chipBg }]}
            >
              <Feather name="minus" size={18} color={C.primary} />
            </TouchableOpacity>
            <TextInput
              value={householdInput}
              onChangeText={setHouseholdInput}
              keyboardType="number-pad"
              style={[styles.numberField, { color: C.text }]}
              textAlign="center"
              maxLength={2}
            />
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                const v = Math.min(20, parseInt(householdInput, 10) + 1);
                setHouseholdInput(String(v));
              }}
              style={[styles.stepper, { backgroundColor: C.chipBg }]}
            >
              <Feather name="plus" size={18} color={C.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: C.textMuted }]}>
            Ingredient quantities will be scaled to this number of people.
          </Text>
        </Section>

        <Section title="Meal Coverage">
          <OptionRow
            options={[
              { label: "Dinners only", value: "dinner-only" },
              { label: "Lunch + Dinner", value: "lunch-dinner" },
            ]}
            value={prefs.mealCoverage}
            onSelect={(v) => update("mealCoverage", v)}
          />
        </Section>

        <Section title="Budget Level">
          <OptionRow
            options={[
              { label: "Budget", value: "budget" },
              { label: "Standard", value: "standard" },
              { label: "Premium", value: "premium" },
            ]}
            value={prefs.budgetLevel}
            onSelect={(v) => update("budgetLevel", v)}
          />
        </Section>

        <Section title="Health Style">
          <OptionRow
            options={[
              { label: "Standard", value: "standard" },
              { label: "Healthy", value: "healthy" },
              { label: "High Protein", value: "high-protein" },
            ]}
            value={prefs.healthStyle}
            onSelect={(v) => update("healthStyle", v)}
          />
        </Section>

        <Section title="Max Cook Time">
          <OptionRow
            options={[
              { label: "15 min", value: "15" },
              { label: "30 min", value: "30" },
              { label: "45 min", value: "45" },
              { label: "Any", value: "mixed" },
            ]}
            value={String(prefs.cookTime)}
            onSelect={(v) => update("cookTime", v === "mixed" ? "mixed" : parseInt(v))}
          />
        </Section>

        <Section title="Cooking Style">
          <OptionRow
            options={[
              { label: "Mixed", value: "mixed" },
              { label: "One-Pan", value: "one-pan" },
              { label: "Air Fryer", value: "air-fryer" },
            ]}
            value={prefs.cookingStyle}
            onSelect={(v) => update("cookingStyle", v)}
          />
        </Section>

        <Section title="Meal Variety">
          <OptionRow
            options={[
              { label: "3 meals", value: "3" },
              { label: "5 meals", value: "5" },
              { label: "7 meals", value: "7" },
            ]}
            value={String(prefs.mealVariety)}
            onSelect={(v) => update("mealVariety", parseInt(v))}
          />
          <Text style={[styles.hint, { color: C.textMuted }]}>
            {prefs.mealVariety === 3
              ? "Some meals repeat — great for batch cooking."
              : prefs.mealVariety === 5
                ? "Moderate variety with some repeats."
                : "High variety with minimal repetition."}
          </Text>
        </Section>

        <Section title="Leftovers Mode">
          <OptionRow
            options={[
              { label: "Off", value: "none" },
              { label: "Cook once, eat twice", value: "cook-once" },
            ]}
            value={prefs.leftoversMode}
            onSelect={(v) => update("leftoversMode", v)}
          />
        </Section>

        <Section title="Difficulty">
          <OptionRow
            options={[
              { label: "Easy only", value: "easy" },
              { label: "Moderate", value: "moderate" },
              { label: "Any", value: "mixed" },
            ]}
            value={prefs.difficulty}
            onSelect={(v) => update("difficulty", v)}
          />
        </Section>

        <Section title="Weekend Overrides">
          <View style={styles.weekendToggle}>
            <View style={styles.weekendToggleLeft}>
              <Text style={[styles.weekendToggleTitle, { color: C.text }]}>
                Different settings for weekends
              </Text>
              <Text style={[styles.weekendToggleSub, { color: C.textMuted }]}>
                Saturday &amp; Sunday can have longer cook times or a bigger budget
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                updateWeekend("enabled", !prefs.weekendOverrides.enabled);
              }}
              style={[
                styles.toggle,
                {
                  backgroundColor: prefs.weekendOverrides.enabled
                    ? C.primary
                    : C.inputBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  prefs.weekendOverrides.enabled && styles.toggleKnobOn,
                ]}
              />
            </TouchableOpacity>
          </View>

          {prefs.weekendOverrides.enabled && (
            <>
              <Text style={[styles.weekendSubLabel, { color: C.textSecondary }]}>
                Weekend cook time
              </Text>
              <OptionRow
                options={[
                  { label: "15 min", value: "15" },
                  { label: "30 min", value: "30" },
                  { label: "45 min", value: "45" },
                  { label: "Any", value: "mixed" },
                ]}
                value={String(prefs.weekendOverrides.cookTime)}
                onSelect={(v) =>
                  updateWeekend("cookTime", v === "mixed" ? "mixed" : parseInt(v) as 15 | 30 | 45)
                }
              />
              <Text style={[styles.weekendSubLabel, { color: C.textSecondary }]}>
                Weekend budget
              </Text>
              <OptionRow
                options={[
                  { label: "Budget", value: "budget" },
                  { label: "Standard", value: "standard" },
                  { label: "Premium", value: "premium" },
                ]}
                value={prefs.weekendOverrides.budgetLevel}
                onSelect={(v) => updateWeekend("budgetLevel", v)}
              />
            </>
          )}
        </Section>

        <Section title="Ingredient Exclusions">
          <View style={styles.exclusionGrid}>
            {EXCLUSION_OPTIONS.map((ex) => (
              <PillButton
                key={ex}
                label={ex}
                active={prefs.exclusions.includes(ex)}
                onPress={() => toggleExclusion(ex)}
                small
              />
            ))}
          </View>
        </Section>

        <TouchableOpacity onPress={handleReset} style={styles.resetRow}>
          <Feather name="rotate-ccw" size={14} color={C.textMuted} />
          <Text style={[styles.resetText, { color: C.textMuted }]}>Reset to defaults</Text>
        </TouchableOpacity>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16,
            backgroundColor: C.background,
            borderTopColor: C.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, { backgroundColor: C.primary }]}
        >
          <Feather name="check" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 28,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  numberInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "flex-start",
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
  exclusionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  resetText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  weekendToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weekendToggleLeft: {
    flex: 1,
    gap: 3,
  },
  weekendToggleTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  weekendToggleSub: {
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
  weekendSubLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import {
  DietaryNeed,
  KidSituation,
  HouseholdProfile,
  getHouseholdProfile,
  saveHouseholdProfile,
  DEFAULT_HOUSEHOLD_PROFILE,
} from "@/utils/householdProfile";
import { usePlanner } from "@/context/PlannerContext";

const C = Colors.light;

const DIETARY_OPTIONS: { need: DietaryNeed; label: string; sub: string; emoji: string }[] = [
  { need: "vegan",       label: "Vegan",       sub: "No animal products at all.",          emoji: "🌱" },
  { need: "vegetarian",  label: "Vegetarian",  sub: "No meat or seafood.",                  emoji: "🥚" },
  { need: "gluten-free", label: "Gluten-free", sub: "We'll flag GF-safe meals + swaps.",    emoji: "🌾" },
  { need: "dairy-free",  label: "Dairy-free",  sub: "We'll suggest dairy-free alternatives.", emoji: "🥛" },
];

const KID_OPTIONS: { value: KidSituation; label: string; sub: string }[] = [
  { value: "same",     label: "Same as everyone", sub: "No special meals needed." },
  { value: "simpler",  label: "Lean kid-friendly", sub: "Favour simpler meals the kids will actually eat." },
  { value: "separate", label: "Separate kids' meals", sub: "You handle theirs — we'll plan yours." },
];

export default function HouseholdProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reloadHouseholdProfile } = usePlanner();

  const [profile, setProfile] = useState<HouseholdProfile>({ ...DEFAULT_HOUSEHOLD_PROFILE });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    getHouseholdProfile().then(setProfile);
  }, []);

  const toggleNeed = (need: DietaryNeed) => {
    Haptics.selectionAsync();
    setProfile((prev) => ({
      ...prev,
      dietary_needs: prev.dietary_needs.includes(need)
        ? prev.dietary_needs.filter((n) => n !== need)
        : [...prev.dietary_needs, need],
    }));
  };

  const setKidSituation = (value: KidSituation) => {
    Haptics.selectionAsync();
    setProfile((prev) => ({ ...prev, kids_situation: value }));
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    await saveHouseholdProfile({
      ...profile,
      setup_complete: true,
      setup_date: profile.setup_date ?? new Date().toISOString(),
    });
    await reloadHouseholdProfile();
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleClear = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cleared: HouseholdProfile = { ...DEFAULT_HOUSEHOLD_PROFILE, setup_complete: false };
    setProfile(cleared);
    await saveHouseholdProfile(cleared);
    await reloadHouseholdProfile();
  };

  const paddingTop = Platform.OS === "web" ? 56 : insets.top + 6;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {savedFlash && (
        <View style={[styles.savedToast, { backgroundColor: C.primary, top: insets.top + 12 }]}>
          <Feather name="check" size={15} color="#fff" />
          <Text style={styles.savedToastText}>Saved.</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={18} color={C.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.heroHeading, { color: C.text }]}>Household profile</Text>
              <Text style={[styles.heroSub, { color: C.textSecondary }]}>
                We'll quietly filter and flag — nothing loud.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.primary }]}>Dietary needs</Text>
          <Text style={[styles.sectionHelper, { color: C.textMuted }]}>
            Select all that apply. We'll filter meals and suggest easy ingredient swaps for the rest.
          </Text>
          <View style={styles.optionList}>
            {DIETARY_OPTIONS.map(({ need, label, sub, emoji }) => {
              const active = profile.dietary_needs.includes(need);
              return (
                <TouchableOpacity
                  key={need}
                  onPress={() => toggleNeed(need)}
                  activeOpacity={0.75}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: active ? C.tealTint : C.card,
                      borderColor: active ? C.primary : C.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.optionCardInner}>
                    <Text style={styles.optionEmoji}>{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: C.text }]}>{label}</Text>
                      <Text style={[styles.optionSub, { color: C.textMuted }]}>{sub}</Text>
                    </View>
                    {active && <Feather name="check" size={18} color={C.primary} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={[styles.sectionLabel, { color: C.primary }]}>Kids at the table?</Text>
          <Text style={[styles.sectionHelper, { color: C.textMuted }]}>
            Shapes how we score and suggest meals.
          </Text>
          <View style={styles.optionList}>
            {KID_OPTIONS.map(({ value, label, sub }) => {
              const active = profile.kids_situation === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setKidSituation(value)}
                  activeOpacity={0.75}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: active ? C.tealTint : C.card,
                      borderColor: active ? C.primary : C.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.optionCardInner}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: C.text }]}>{label}</Text>
                      <Text style={[styles.optionSub, { color: C.textMuted }]}>{sub}</Text>
                    </View>
                    {active && <Feather name="check" size={18} color={C.primary} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.saveCta, { backgroundColor: C.primary, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={styles.saveCtaText}>Save profile</Text>
            <Feather name="check" size={18} color="#fff" />
          </TouchableOpacity>

          {profile.setup_complete && (
            <TouchableOpacity
              onPress={handleClear}
              activeOpacity={0.75}
              style={styles.clearBtn}
            >
              <Text style={[styles.clearBtnText, { color: C.textMuted }]}>Clear profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 0,
  },
  hero: {
    paddingBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.chipBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  heroHeading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 3,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionHelper: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    ...Platform.select({
      web: { boxShadow: "0px 1px 4px rgba(0,0,0,0.06)" },
      default: {
        shadowColor: "#1A1A1A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  optionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  optionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 1,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  saveCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveCtaText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
});

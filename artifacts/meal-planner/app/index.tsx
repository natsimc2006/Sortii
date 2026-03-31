import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
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
import { usePlanner } from "@/context/PlannerContext";

const STEPS = [
  {
    icon: "sliders",
    title: "Set your preferences",
    desc: "Choose your household size, budget, and dietary needs.",
  },
  {
    icon: "calendar",
    title: "Plan your week",
    desc: "Pick meals manually, fill gaps, or auto-generate the whole week.",
  },
  {
    icon: "shopping-cart",
    title: "Get your shopping list",
    desc: "One tap generates a combined, grouped grocery list for the week.",
  },
];

export default function LandingScreen() {
  const router = useRouter();
  const { setIsOnboarded, isOnboarded, showSplash, setShowSplash } = usePlanner();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  React.useEffect(() => {
    if (isOnboarded && !showSplash) {
      router.replace("/(tabs)/planner");
    }
  }, [isOnboarded, showSplash]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSplash(false);
    setIsOnboarded(true);
    router.replace("/(tabs)/planner");
  };

  const handleSetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/preferences");
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 80 : insets.top + 20,
          paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroSection}>
        <View style={[styles.logoBox, { backgroundColor: C.chipBg }]}>
          <Feather name="calendar" size={36} color={C.primary} />
        </View>
        <Text style={[styles.headline, { color: C.text }]}>
          Your weekly meals,{"\n"}sorted.
        </Text>
        <Text style={[styles.subheadline, { color: C.textSecondary }]}>
          Plan meals for the whole family, discover new recipes, and generate
          your grocery list in seconds.
        </Text>
      </View>

      <View style={styles.stepsSection}>
        <Text style={[styles.sectionLabel, { color: C.textMuted }]}>
          HOW IT WORKS
        </Text>
        {STEPS.map((step, i) => (
          <View
            key={i}
            style={[styles.stepCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
          >
            <View style={[styles.stepNum, { backgroundColor: C.primary }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={[styles.stepIconBox, { backgroundColor: C.chipBg }]}>
              <Feather name={step.icon as any} size={22} color={C.primary} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: C.text }]}>
                {step.title}
              </Text>
              <Text style={[styles.stepDesc, { color: C.textSecondary }]}>
                {step.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.features}>
        {[
          ["40+ Australian-friendly recipes", "book-open"],
          ["Budget, standard & premium options", "dollar-sign"],
          ["Serves 1–10 people", "users"],
          ["Leftovers-friendly planning", "refresh-cw"],
        ].map(([label, icon]) => (
          <View key={label} style={styles.featureRow}>
            <View style={[styles.featureDot, { backgroundColor: C.chipBg }]}>
              <Feather name={icon as any} size={14} color={C.primary} />
            </View>
            <Text style={[styles.featureLabel, { color: C.textSecondary }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: C.primary }]}
        >
          <Text style={styles.primaryBtnText}>Plan my week</Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSetup}
          activeOpacity={0.75}
          style={[styles.secondaryBtn, { borderColor: C.inputBorder }]}
        >
          <Text style={[styles.secondaryBtnText, { color: C.text }]}>
            Set up preferences first
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.note, { color: C.textMuted }]}>
        No account required · All data stays on your device
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 32,
  },
  heroSection: {
    alignItems: "center",
    gap: 16,
    paddingTop: 20,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 44,
  },
  subheadline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  stepsSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    position: "relative",
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 12,
    left: 12,
  },
  stepNumText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 20,
  },
  stepText: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  stepDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  features: {
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  note: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});

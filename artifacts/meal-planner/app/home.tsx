import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";

const sortiiLogo = require("@/assets/images/sortii-logo.png");

const STEPS = [
  {
    icon: "sliders",
    title: "Tell us about your household",
    desc: "Household size, budget, dietary needs — sorted in 60 seconds.",
  },
  {
    icon: "calendar",
    title: "Plan your week",
    desc: "Pick meals manually, fill gaps, or let us sort the whole lot.",
  },
  {
    icon: "shopping-cart",
    title: "Your list, ready to shop",
    desc: "One tap. Everything you need. Nothing you don't.",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/planner");
    }
  };

  const handlePreferences = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/preferences");
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 6 : insets.top,
          paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        onPress={handleBack}
        style={[styles.backBtn, { backgroundColor: C.chipBg }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="arrow-left" size={16} color={C.primary} />
      </TouchableOpacity>

      <View style={styles.heroSection}>
        <Image
          source={sortiiLogo}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={[styles.subheadline, { color: "#8A8D86" }]}>
          250 dinners. Smart planning. One less thing to think about.
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
          ["250 Australian-friendly recipes", "book-open"],
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
          onPress={handleBack}
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: C.gold }]}
        >
          <Text style={styles.primaryBtnText}>Get started</Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePreferences}
          activeOpacity={0.75}
          style={[styles.secondaryBtn, { borderColor: C.inputBorder }]}
        >
          <Text style={[styles.secondaryBtnText, { color: C.text }]}>
            Edit preferences
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
    gap: 12,
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  heroSection: {
    alignItems: "center",
    gap: 12,
    paddingTop: 0,
  },
  logoImage: {
    width: 416,
    maxWidth: "88%",
    height: 192,
  },
  subheadline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
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

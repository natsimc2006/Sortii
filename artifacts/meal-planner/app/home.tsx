import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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

import { PressableScale } from "@/components/PressableScale";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";

const sortiiLogo = require("@/assets/images/sortii-logo-orange.png");

const STEPS = [
  {
    icon: "sliders",
    title: "Tell us about your household",
    desc: "Tell us who you're feeding and what you've got to spend. Takes 60 seconds.",
  },
  {
    icon: "calendar",
    title: "Plan your week",
    desc: "Let Sortii fill the week, or pick a few yourself. Either way, dinner is handled.",
  },
  {
    icon: "shopping-cart",
    title: "Your list, ready to shop",
    desc: "Your list builds itself. Categorised, consolidated, and ready to share.",
  },
];

const FEATURES: [string, string][] = [
  ["240+ recipes. Always something new.", "book-open"],
  ["Every budget. Real prices.", "dollar-sign"],
  ["Feeds 1 to 10. Scales automatically.", "users"],
  ["Cook once. Eat twice. Less waste.", "refresh-cw"],
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
    router.push("/(tabs)/preferences");
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 6 : Math.floor(insets.top / 2),
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

      {/* Change 7: Three dots decoration */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, { width: 6, height: 6, backgroundColor: C.gold }]} />
        <View style={[styles.dot, { width: 8, height: 8, backgroundColor: C.primary }]} />
        <View style={[styles.dot, { width: 6, height: 6, backgroundColor: "#5E3A4C" }]} />
      </View>

      {/* Change 1: Hero with glow + Change 8: Updated copy */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0)"]}
          style={styles.heroGlow}
        />
        <Image
          source={sortiiLogo}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.mainHeadline}>
          {"No more\n\u201Cwhat\u2019s for dinner\u201D"}
        </Text>
        <Text style={styles.subheadline}>
          Sortii plans your week in 60 seconds — meals, budget, shopping list. Sorted.
        </Text>
        <Text style={styles.supportingLine}>
          Less stress. Fewer takeaways. More evenings back.
        </Text>
        {/* Change 2: Teal accent bar */}
        <View style={[styles.accentBar, { backgroundColor: C.primary }]} />
      </View>

      {/* Change 4 + 3: Section label upgrade + card redesign */}
      <View style={styles.stepsSection}>
        <View style={styles.sectionLabelRow}>
          <View style={[styles.sectionDot, { backgroundColor: C.primary }]} />
          <Text style={[styles.sectionLabel, { color: C.primary }]}>
            HOW IT WORKS
          </Text>
        </View>
        {STEPS.map((step, i) => (
          <View
            key={i}
            style={[styles.stepCard, { backgroundColor: "#FFFFFF", borderColor: C.cardBorder }]}
          >
            <View style={[styles.stepCardAccent, { backgroundColor: C.primary }]} />
            <View style={[styles.stepNum, { backgroundColor: C.primary }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={[styles.stepIconBox, { backgroundColor: C.gold }]}>
              <Feather name={step.icon as any} size={22} color="#FFFFFF" />
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

      {/* Change 5: Feature bullets in card */}
      <View style={[styles.featuresCard, { backgroundColor: "#FFFFFF", borderColor: C.cardBorder }]}>
        <Text style={[styles.featuresCardHeading, { color: C.primary }]}>
          WHAT'S INCLUDED
        </Text>
        {FEATURES.map(([label, icon], idx) => (
          <View key={label}>
            <View style={styles.featureRow}>
              <Feather name={icon as any} size={16} color={C.primary} />
              <Text style={[styles.featureLabel, { color: C.text }]}>
                {label}
              </Text>
            </View>
            {idx < FEATURES.length - 1 && (
              <View style={[styles.featureDivider, { backgroundColor: C.cardBorder }]} />
            )}
          </View>
        ))}
      </View>

      {/* Change 9: Plum accent line + Change 6: Upgraded button */}
      <View style={styles.actions}>
        <Text style={styles.plumAccent}>
          The convenience of a meal kit. At supermarket prices.
        </Text>
        <PressableScale
          onPress={handlePreferences}
          style={[styles.primaryBtn, { backgroundColor: C.gold }]}
        >
          <Text style={styles.primaryBtnText}>Get started</Text>
          <Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </PressableScale>

        <PressableScale
          onPress={handleBack}
          scaleTo={0.98}
          style={[styles.secondaryBtn, { borderColor: C.inputBorder }]}
        >
          <Text style={[styles.secondaryBtnText, { color: C.text }]}>
            Go to my plan →
          </Text>
        </PressableScale>
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
    gap: 20,
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: -8,
  },
  dot: {
    borderRadius: 999,
  },
  heroSection: {
    alignItems: "center",
    gap: 8,
    paddingTop: 0,
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    width: 340,
    height: 260,
    borderRadius: 170,
    top: -20,
    alignSelf: "center",
    zIndex: 0,
  },
  logoImage: {
    width: 500,
    maxWidth: "92%",
    height: 230,
    marginTop: -38,
    marginBottom: 38,
    zIndex: 1,
  },
  mainHeadline: {
    fontSize: 35,
    fontFamily: "Manrope_600SemiBold",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 52,
    letterSpacing: -0.3,
    color: "#3A3A36",
    marginBottom: 14,
    zIndex: 1,
  },
  subheadline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 28,
    letterSpacing: 0,
    color: "#5F5F59",
    maxWidth: 310,
    zIndex: 1,
  },
  supportingLine: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: 0,
    color: "#6B4A5E",
    zIndex: 1,
  },
  accentBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    zIndex: 1,
  },
  stepsSection: {
    gap: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 20,
    paddingLeft: 24,
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0px 2px 14px rgba(0,0,0,0.09)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  stepCardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 10,
    left: 8,
  },
  stepNumText: {
    fontSize: 13,
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
  featuresCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    gap: 0,
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
  featuresCardHeading: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  featureDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  featureLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    gap: 12,
  },
  plumAccent: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#5E3A4C",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 18,
    ...Platform.select({
      web: { boxShadow: "0px 4px 16px rgba(210,154,34,0.35)" },
      default: {
        shadowColor: "#F0AC2E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
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
    marginTop: -8,
  },
});

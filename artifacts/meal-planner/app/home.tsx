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

const sortiiLogo = require("@/assets/images/sortii-logo-yourweek.png");

const STEPS = [
  {
    icon: "sliders",
    title: "Tell us about your week",
    desc: "Who you're feeding and what you want to spend. Takes 60 seconds.",
    stepColor: "#F0AC2E",   // amber
  },
  {
    icon: "calendar",
    title: "Plan your week",
    desc: "Let Sortii fill the week, or pick a few yourself. Either way, dinner is handled.",
    stepColor: "#25857F",   // teal
  },
  {
    icon: "shopping-cart",
    title: "Your list, ready to shop",
    desc: "Your list builds itself. Categorised, consolidated, and ready to share.",
    stepColor: "#5E3A4C",   // mauve
  },
];

const FEATURES: [string, string][] = [
  ["240+ recipes. Always something new.", "book-open"],
  ["Every budget. Real prices.", "dollar-sign"],
  ["Feeds 1 to 10. Scales automatically.", "users"],
  ["Cook once. Eat twice. Less waste.", "refresh-cw"],
];

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "calendar",      label: "Planner",  route: "/(tabs)/planner" },
  { icon: "shopping-cart", label: "Shopping", route: "/(tabs)/shopping" },
  { icon: "dollar-sign",   label: "Money",    route: "/(tabs)/money" },
  { icon: "sliders",       label: "Settings", route: "/(tabs)/preferences" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const PANEL_HEIGHT = Platform.OS === "web" ? 76 : 70 + insets.bottom;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/planner");
    }
  };

  const handleNav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const PAGE_BG = "#F7F3EB";

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <ScrollView
        style={{ backgroundColor: PAGE_BG }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 6 : Math.floor(insets.top / 2),
            paddingBottom: PANEL_HEIGHT + 20,
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

        {/* Three dots decoration */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { width: 6, height: 6, backgroundColor: C.gold }]} />
          <View style={[styles.dot, { width: 8, height: 8, backgroundColor: C.primary }]} />
          <View style={[styles.dot, { width: 6, height: 6, backgroundColor: "#5E3A4C" }]} />
        </View>

        {/* Hero */}
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
          <View style={[styles.accentBar, { backgroundColor: C.primary }]} />
        </View>

        {/* How it works */}
        <View style={styles.stepsSection}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: C.primary }]} />
            <Text style={[styles.sectionLabel, { color: C.primary }]}>HOW IT WORKS</Text>
          </View>
          {STEPS.map((step, i) => (
            <View
              key={i}
              style={[styles.stepCard, { backgroundColor: "#FFFFFF", borderColor: "#E8E8E8" }]}
            >
              <View style={[styles.stepCardAccent, { backgroundColor: step.stepColor }]} />
              <View style={[styles.stepNum, { backgroundColor: C.primary }]}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <View style={[styles.stepIconBox, { backgroundColor: step.stepColor }]}>
                <Feather name={step.icon as any} size={22} color="#FFFFFF" />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, { color: C.text }]}>{step.title}</Text>
                <Text style={[styles.stepDesc, { color: C.textSecondary }]}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* What's included */}
        <View style={[styles.featuresCard, { backgroundColor: "#FFFFFF", borderColor: C.primary }]}>
          <Text style={[styles.featuresCardHeading, { color: C.primary }]}>WHAT'S INCLUDED</Text>
          {FEATURES.map(([label, icon], idx) => (
            <View key={label}>
              <View style={styles.featureRow}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: C.tealTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Feather name={icon as any} size={16} color={C.primary} />
                </View>
                <Text style={[styles.featureLabel, { color: C.text }]}>{label}</Text>
              </View>
              {idx < FEATURES.length - 1 && (
                <View style={[styles.featureDivider, { backgroundColor: "#F0F0F0" }]} />
              )}
            </View>
          ))}
        </View>

        {/* Actions — wrapped in soft card */}
        <View style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 16,
          gap: 10,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 2,
        }}>
          <PressableScale
            onPress={() => handleNav("/(tabs)/planner")}
            style={[styles.primaryBtn, { backgroundColor: C.gold }]}
          >
            <Text style={styles.primaryBtnText}>Go to my plan</Text>
            <Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </PressableScale>
          <Text style={[styles.note, { color: C.textMuted }]}>
            No account required · All data stays on your device
          </Text>
        </View>
      </ScrollView>

      {/* ── Floating nav panel ─────────────────────────────── */}
      <View
        style={[
          styles.floatingPanel,
          {
            backgroundColor: "#fff",
            borderTopColor: C.border,
            paddingBottom: Platform.OS === "web" ? 12 : insets.bottom + 6,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => handleNav(item.route)}
            activeOpacity={0.72}
            style={styles.navItem}
          >
            <View style={[styles.navIconWrap, { backgroundColor: C.tealTint }]}>
              <Feather name={item.icon as any} size={18} color={C.primary} />
            </View>
            <Text style={[styles.navLabel, { color: C.textSecondary }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  dot: { borderRadius: 999 },
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
    width: 320,
    maxWidth: "92%",
    height: 148,
    marginTop: 0,
    marginBottom: 16,
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
    color: "#25857F",
    zIndex: 1,
  },
  accentBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    zIndex: 1,
  },
  stepsSection: { gap: 12 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
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
  stepText: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  stepDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
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
  featureDivider: { height: 1 },
  featureLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  actions: { gap: 12 },
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
  note: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },

  // ── Floating nav panel ─────────────────────────────────────
  floatingPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingTop: 10,
    borderTopWidth: 1,
    ...Platform.select({
      web: { boxShadow: "0px -4px 20px rgba(0,0,0,0.08)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
  },
  navIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});

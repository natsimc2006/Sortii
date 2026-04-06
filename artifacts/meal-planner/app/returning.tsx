import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { usePlanner } from "@/context/PlannerContext";
import { useUserWeek } from "@/context/UserWeekContext";

const C = Colors.light;
const sortiiLogo = require("@/assets/images/sortii-logo-yourweek.png");

const GREETINGS = [
  "Ready to sort this week's dinners?",
  "Back for another sorted week?",
  "Good to see you back.",
];

export default function ReturningScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, autoGeneratePlan, preferences, isContextLoaded } = usePlanner();
  const { isLoaded, lastUpdatedAt, updateWeekKey } = useUserWeek();

  const [generating, setGenerating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const greeting = GREETINGS[0];

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const mealCount = filledMeals.length;

  const lastPlanLabel = (() => {
    if (!lastUpdatedAt) return null;
    const d = new Date(lastUpdatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "You sorted this today";
    if (diffDays === 1) return "You sorted this yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "About a week ago";
    return null;
  })();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const handleSameAsLastWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/planner");
  };

  const handleNewPlan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 120));
    updateWeekKey();
    autoGeneratePlan(preferences);
    router.replace("/(tabs)/planner");
  };

  const paddingTop = Platform.OS === "web" ? 52 : insets.top + 20;
  const paddingBottom = Platform.OS === "web" ? 52 : insets.bottom + 24;

  if (!isContextLoaded || !isLoaded) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: C.background, paddingTop, paddingBottom },
      ]}
    >
      <Animated.View
        style={[
          styles.inner,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Logo */}
        <Image
          source={sortiiLogo}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Headline */}
        <View style={styles.headlineBlock}>
          <Text style={[styles.headline, { color: C.text }]}>{greeting}</Text>
          {mealCount > 0 && (
            <Text style={[styles.sub, { color: C.textSecondary }]}>
              You've got{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: C.primary }}>
                {mealCount} dinner{mealCount !== 1 ? "s" : ""}
              </Text>{" "}
              saved from last week
              {lastPlanLabel ? ` — ${lastPlanLabel}.` : "."}
            </Text>
          )}
        </View>

        {/* Choices */}
        <View style={styles.choiceStack}>
          {/* Same as last week */}
          <TouchableOpacity
            onPress={handleSameAsLastWeek}
            activeOpacity={0.82}
            style={[
              styles.choiceCard,
              styles.choiceCardPrimary,
              { backgroundColor: C.primary, borderColor: C.primary },
            ]}
          >
            <View style={[styles.iconBadge, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
              <Feather name="copy" size={18} color="#fff" />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceLabelPrimary}>Same as last week</Text>
              <Text style={styles.choiceSubPrimary}>
                Keep your{mealCount > 0 ? ` ${mealCount}-dinner` : ""} plan and shopping list
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>

          {/* New plan */}
          <TouchableOpacity
            onPress={handleNewPlan}
            activeOpacity={0.82}
            disabled={generating}
            style={[
              styles.choiceCard,
              styles.choiceCardSecondary,
              { borderColor: C.border, backgroundColor: "#fff" },
            ]}
          >
            {generating ? (
              <ActivityIndicator color={C.primary} size="small" />
            ) : (
              <View style={[styles.iconBadge, { backgroundColor: C.tealTint }]}>
                <Feather name="refresh-cw" size={18} color={C.primary} />
              </View>
            )}
            <View style={styles.choiceText}>
              <Text style={[styles.choiceLabelSecondary, { color: C.text }]}>
                {generating ? "Sorting your week…" : "New plan"}
              </Text>
              <Text style={[styles.choiceSubSecondary, { color: C.textMuted }]}>
                Fresh picks based on your preferences
              </Text>
            </View>
            {!generating && <Feather name="arrow-right" size={18} color={C.textSecondary} />}
          </TouchableOpacity>
        </View>

        {/* Footer hint */}
        <Text style={[styles.footerHint, { color: C.textMuted }]}>
          Either way — dinner's sorted.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 32,
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 92,
    alignSelf: "flex-start",
  },
  headlineBlock: {
    gap: 10,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Manrope_700Bold",
    lineHeight: 36,
  },
  sub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  choiceStack: {
    gap: 14,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
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
  choiceCardPrimary: {},
  choiceCardSecondary: {},
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  choiceText: {
    flex: 1,
    gap: 3,
  },
  choiceLabelPrimary: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  choiceSubPrimary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 18,
  },
  choiceLabelSecondary: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  choiceSubSecondary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  footerHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    fontStyle: "italic",
  },
});

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
const sortiiLogo = require("@/assets/images/sortii-logo.png");

export default function ReturningScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, autoGeneratePlan, preferences, isContextLoaded } = usePlanner();
  const { isLoaded, updateWeekKey } = useUserWeek();

  const [generating, setGenerating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const mealCount = filledMeals.length;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleFreshPlan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 120));
    updateWeekKey();
    autoGeneratePlan(preferences);
    router.replace("/(tabs)/planner");
  };

  const handleSameAsLastWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateWeekKey();
    router.replace("/(tabs)/planner");
  };

  const paddingTop = Platform.OS === "web" ? 64 : insets.top + 28;
  const paddingBottom = Platform.OS === "web" ? 52 : insets.bottom + 28;

  if (!isContextLoaded || !isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: C.background, paddingTop, paddingBottom }]}>
      <Animated.View
        style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Logo */}
        <Image source={sortiiLogo} style={styles.logo} resizeMode="contain" />

        {/* Choices */}
        <View style={styles.choiceStack}>

          {/* Primary — Fresh plan */}
          <TouchableOpacity
            onPress={handleFreshPlan}
            activeOpacity={0.82}
            disabled={generating}
            style={[styles.card, styles.cardPrimary, { backgroundColor: C.primary, borderColor: C.primary }]}
          >
            <View style={[styles.iconBadge, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
              {generating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Feather name="refresh-cw" size={20} color="#fff" />
              }
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabelPrimary}>
                {generating ? "Sorting your week…" : "Fresh plan, same settings"}
              </Text>
              <Text style={styles.cardSubPrimary}>
                New meals based on your preferences
              </Text>
            </View>
            {!generating && <Feather name="arrow-right" size={18} color="#fff" />}
          </TouchableOpacity>

          {/* Secondary — Same as last week */}
          <TouchableOpacity
            onPress={handleSameAsLastWeek}
            activeOpacity={0.82}
            disabled={generating}
            style={[styles.card, styles.cardSecondary, { backgroundColor: "#fff", borderColor: C.border }]}
          >
            <View style={[styles.iconBadge, { backgroundColor: C.tealTint }]}>
              <Feather name="copy" size={20} color={C.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardLabelSecondary, { color: C.text }]}>
                Same meals as last week
              </Text>
              <Text style={[styles.cardSubSecondary, { color: C.textMuted }]}>
                Keep everything exactly as it was
                {mealCount > 0 ? ` — ${mealCount} dinner${mealCount !== 1 ? "s" : ""} ready` : ""}
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={C.textSecondary} />
          </TouchableOpacity>

        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
    justifyContent: "center",
  },
  logo: {
    width: 240,
    height: 100,
    alignSelf: "center",
    marginBottom: 8,
  },
  headlineBlock: { gap: 10 },
  headline: {
    fontSize: 30,
    fontFamily: "DMSans_700Bold",
    lineHeight: 38,
  },
  sub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  choiceStack: { gap: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    ...Platform.select({
      web: { boxShadow: "0px 2px 14px rgba(0,0,0,0.07)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardPrimary: {},
  cardSecondary: {},
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardText: { flex: 1, gap: 3 },
  cardLabelPrimary: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  cardSubPrimary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 18,
  },
  cardLabelSecondary: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  cardSubSecondary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  footer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    fontStyle: "italic",
  },
});

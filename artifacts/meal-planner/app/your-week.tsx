import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { usePlanner } from "@/context/PlannerContext";
import { useLocale } from "@/context/LocaleContext";
import {
  OnboardingState,
  getOnboardingState,
} from "@/utils/onboardingState";

const C = Colors.light;
const sortiiLogo = require("@/assets/images/sortii-logo-orange.png");

function WeekCard({
  title,
  children,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <View
      style={[
        styles.weekCard,
        { borderColor: C.border },
      ]}
    >
      {accentColor && (
        <View
          style={[styles.weekCardAccent, { backgroundColor: accentColor }]}
        />
      )}
      <Text style={[styles.weekCardTitle, { color: C.textSecondary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function PromptCard({
  icon,
  headline,
  sub,
  ctaLabel,
  onPress,
}: {
  icon: string;
  headline: string;
  sub: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.promptCard, { backgroundColor: C.tealTint, borderColor: C.primary }]}
    >
      <View style={styles.promptCardRow}>
        <Feather name={icon as any} size={20} color={C.primary} />
        <View style={styles.promptCardText}>
          <Text style={[styles.promptCardHeadline, { color: C.primary }]}>{headline}</Text>
          <Text style={[styles.promptCardSub, { color: C.textSecondary }]}>{sub}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={C.primary} />
      </View>
      <View style={[styles.promptCardCta, { backgroundColor: C.primary }]}>
        <Text style={styles.promptCardCtaText}>{ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function YourWeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPlan, estimatedCostBand, getRecipeById, preferences } = usePlanner();
  const { currencySymbol } = useLocale();

  const [obState, setObState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    getOnboardingState().then(setObState);
  }, []);

  const filledMeals = currentPlan.filter((e) => e.recipeId);
  const totalSlots = currentPlan.length;
  const hasMeals = obState?.hasMealsSetup ?? false;
  const hasMoney = obState?.hasMoneySetup ?? false;
  const moneySetup = obState?.moneySetup;

  const breathingRoom =
    moneySetup && moneySetup.weeklyIncome > 0
      ? Math.max(
          0,
          moneySetup.weeklyIncome -
            moneySetup.fixedWeeklyCosts -
            moneySetup.groceries -
            moneySetup.eatingOut
        )
      : null;

  const weeklyModeLabel = {
    easy: "Keep it easy",
    balanced: "Stay on track",
    budget: "Save where I can",
  }[obState?.weeklyMode ?? "balanced"] ?? "Stay on track";

  const paddingTop = Platform.OS === "web" ? 24 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 60 : insets.bottom + 40;

  const goToPlanner = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/planner");
  };

  const goToMoneySetup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
  };

  const goToOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/");
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop, paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Image source={sortiiLogo} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity
          onPress={() => router.push("/preferences")}
          style={[styles.settingsBtn, { backgroundColor: C.chipBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="sliders" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroSection}>
        <Text style={[styles.heroHeadline, { color: C.text }]}>Your week</Text>
        {obState?.weeklyMode && (
          <View style={[styles.modePill, { backgroundColor: C.tealTint }]}>
            <Text style={[styles.modePillText, { color: C.primary }]}>
              {weeklyModeLabel}
            </Text>
          </View>
        )}
        {!hasMeals && !hasMoney && (
          <Text style={[styles.heroSub, { color: C.textSecondary }]}>
            Let's sort your week. Takes 60 seconds.
          </Text>
        )}
      </View>

      {hasMeals && (
        <WeekCard title="THIS WEEK'S MEALS" accentColor={C.primary}>
          <View style={styles.mealSummaryRow}>
            <View style={styles.mealStat}>
              <Text style={[styles.mealStatNumber, { color: C.primary }]}>
                {filledMeals.length}
              </Text>
              <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>
                of {totalSlots} meals
              </Text>
            </View>
            <View style={[styles.mealStatDivider, { backgroundColor: C.border }]} />
            <View style={styles.mealStat}>
              <Text style={[styles.mealStatNumber, { color: C.text }]}>
                {estimatedCostBand || `${currencySymbol}0–${currencySymbol}0`}
              </Text>
              <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>
                est. weekly cost
              </Text>
            </View>
            <View style={[styles.mealStatDivider, { backgroundColor: C.border }]} />
            <View style={styles.mealStat}>
              <Text style={[styles.mealStatNumber, { color: C.text }]}>
                {preferences.householdSize}
              </Text>
              <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>
                people
              </Text>
            </View>
          </View>
          {filledMeals.length > 0 && (
            <View style={styles.mealPreviewList}>
              {filledMeals.slice(0, 3).map((entry) => {
                const recipe = getRecipeById(entry.recipeId!);
                return recipe ? (
                  <View key={`${entry.day}-${entry.slot}`} style={styles.mealPreviewRow}>
                    <Text style={[styles.mealPreviewDay, { color: C.textMuted }]}>
                      {entry.day.slice(0, 3).toUpperCase()}
                    </Text>
                    <Text style={[styles.mealPreviewName, { color: C.text }]} numberOfLines={1}>
                      {recipe.name}
                    </Text>
                  </View>
                ) : null;
              })}
              {filledMeals.length > 3 && (
                <Text style={[styles.mealMoreHint, { color: C.textMuted }]}>
                  + {filledMeals.length - 3} more
                </Text>
              )}
            </View>
          )}
          <TouchableOpacity
            onPress={goToPlanner}
            activeOpacity={0.8}
            style={[styles.cardCta, { backgroundColor: C.primary }]}
          >
            <Text style={styles.cardCtaText}>Open planner</Text>
            <Feather name="calendar" size={15} color="#fff" />
          </TouchableOpacity>
        </WeekCard>
      )}

      {hasMoney && moneySetup && (
        <WeekCard title="THIS WEEK'S MONEY" accentColor="#F0AC2E">
          <View style={styles.mealSummaryRow}>
            {moneySetup.weeklyIncome > 0 && (
              <>
                <View style={styles.mealStat}>
                  <Text style={[styles.mealStatNumber, { color: C.text }]}>
                    {currencySymbol}{Math.round(moneySetup.weeklyIncome)}
                  </Text>
                  <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>income</Text>
                </View>
                <View style={[styles.mealStatDivider, { backgroundColor: C.border }]} />
              </>
            )}
            <View style={styles.mealStat}>
              <Text style={[styles.mealStatNumber, { color: C.text }]}>
                {currencySymbol}{Math.round(moneySetup.groceries)}
              </Text>
              <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>groceries</Text>
            </View>
            {breathingRoom !== null && (
              <>
                <View style={[styles.mealStatDivider, { backgroundColor: C.border }]} />
                <View style={styles.mealStat}>
                  <Text
                    style={[
                      styles.mealStatNumber,
                      { color: breathingRoom > 0 ? C.primary : "#E05555" },
                    ]}
                  >
                    {currencySymbol}{Math.round(breathingRoom)}
                  </Text>
                  <Text style={[styles.mealStatLabel, { color: C.textMuted }]}>spare</Text>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity
            onPress={goToMoneySetup}
            activeOpacity={0.8}
            style={[styles.cardCta, { backgroundColor: "#F0AC2E" }]}
          >
            <Text style={styles.cardCtaText}>Update budget</Text>
            <Feather name="edit-2" size={15} color="#fff" />
          </TouchableOpacity>
        </WeekCard>
      )}

      {hasMeals && !hasMoney && (
        <PromptCard
          icon="dollar-sign"
          headline="Want to add a budget layer?"
          sub="Map your weekly spend — we'll help it stretch further."
          ctaLabel="Add money setup →"
          onPress={goToMoneySetup}
        />
      )}

      {hasMoney && !hasMeals && (
        <PromptCard
          icon="calendar"
          headline="Want dinners planned around this budget?"
          sub="Let Sortii fill the week with meals that fit your numbers."
          ctaLabel="Set up meal planning →"
          onPress={goToOnboarding}
        />
      )}

      {!hasMeals && !hasMoney && (
        <View style={styles.emptyState}>
          <Feather name="sunrise" size={40} color={C.border} />
          <Text style={[styles.emptyHeadline, { color: C.text }]}>
            Let's sort your week
          </Text>
          <Text style={[styles.emptySub, { color: C.textSecondary }]}>
            Choose what you want to sort — meals, money, or both.
          </Text>
          <TouchableOpacity
            onPress={goToOnboarding}
            activeOpacity={0.85}
            style={[styles.primaryCta, { backgroundColor: C.gold }]}
          >
            <Text style={styles.primaryCtaText}>Get started</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.navRow}>
        {hasMeals && (
          <>
            <TouchableOpacity
              onPress={goToPlanner}
              style={[styles.navBtn, { backgroundColor: C.chipBg }]}
            >
              <Feather name="calendar" size={16} color={C.primary} />
              <Text style={[styles.navBtnText, { color: C.primary }]}>Planner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace("/(tabs)/shopping")}
              style={[styles.navBtn, { backgroundColor: C.chipBg }]}
            >
              <Feather name="shopping-cart" size={16} color={C.primary} />
              <Text style={[styles.navBtnText, { color: C.primary }]}>Shopping</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={() => router.push("/preferences")}
          style={[styles.navBtn, { backgroundColor: C.chipBg }]}
        >
          <Feather name="sliders" size={16} color={C.primary} />
          <Text style={[styles.navBtnText, { color: C.primary }]}>Preferences</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footNote, { color: C.textMuted }]}>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 120,
    height: 44,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: {
    gap: 8,
  },
  heroHeadline: {
    fontSize: 32,
    fontFamily: "Manrope_700Bold",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  modePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  modePillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  heroSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  weekCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    backgroundColor: "#FFFFFF",
    position: "relative",
    overflow: "hidden",
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
  weekCardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  weekCardTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  mealSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  mealStatNumber: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  mealStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  mealStatDivider: {
    width: 1,
    height: 32,
  },
  mealPreviewList: {
    gap: 8,
    marginTop: -4,
  },
  mealPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mealPreviewDay: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    width: 32,
  },
  mealPreviewName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  mealMoreHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 42,
  },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cardCtaText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  promptCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  promptCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promptCardText: {
    flex: 1,
    gap: 2,
  },
  promptCardHeadline: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  promptCardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  promptCardCta: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  promptCardCtaText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
  },
  emptyHeadline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 18,
    marginTop: 8,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryCtaText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  navBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  footNote: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

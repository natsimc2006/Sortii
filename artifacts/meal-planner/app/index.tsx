import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_WEEKEND_OVERRIDES,
  EXCLUSION_OPTIONS,
  PlanPreferences,
} from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useLocale } from "@/context/LocaleContext";
import { useUserWeek } from "@/context/UserWeekContext";
import {
  OnboardingScope,
  WeeklyMode,
  updateOnboardingState,
} from "@/utils/onboardingState";

const C = Colors.light;
const sortiiLogo = require("@/assets/images/sortii-logo-yourweek.png");

const ROTATING_MESSAGES = [
  "Sorting your week…",
  "Balancing budget + time…",
  "Making sure Tuesday isn't boring…",
  "Keeping things realistic…",
  "Almost there…",
];

const MEAL_SETUP_STEPS = 6;

type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < current ? C.primary : i === current - 1 ? C.primary : C.border,
              width: i === current - 1 ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

function OptionCard({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.optionCard,
        {
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.tealTint : C.card,
        },
      ]}
    >
      <View style={styles.optionCardInner}>
        <Text style={[styles.optionCardLabel, { color: selected ? C.primary : C.text }]}>
          {label}
        </Text>
        {sub && (
          <Text style={[styles.optionCardSub, { color: C.textSecondary }]}>{sub}</Text>
        )}
      </View>
      {selected && (
        <Feather name="check-circle" size={18} color={C.primary} />
      )}
    </TouchableOpacity>
  );
}

function ScopeCard({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.scopeCard,
        {
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.tealTint : "#FFFFFF",
        },
      ]}
    >
      <View style={styles.scopeCardInner}>
        <Text style={[styles.scopeCardLabel, { color: selected ? C.primary : C.text }]}>
          {label}
        </Text>
        <Text style={[styles.scopeCardSub, { color: selected ? C.primary : C.textSecondary }]}>
          {sub}
        </Text>
      </View>
      {selected && (
        <View style={[styles.scopeCheckCircle, { backgroundColor: C.primary }]}>
          <Feather name="check" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function PillChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pillChip,
        {
          borderColor: active ? C.primary : C.border,
          backgroundColor: active ? C.tealTint : C.card,
        },
      ]}
    >
      <Text style={[styles.pillChipText, { color: active ? C.primary : C.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { setPreferences, setIsOnboarded, isOnboarded, isContextLoaded, autoGeneratePlan } = usePlanner();
  const { currencySymbol } = useLocale();
  const {
    setWeeklyMode: setContextWeeklyMode,
    setHasMealsSetup: setContextHasMealsSetup,
    updateWeekKey,
  } = useUserWeek();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>(0);

  const [scope, setScope] = useState<OnboardingScope>("meals");
  const [weeklyMode, setWeeklyMode] = useState<WeeklyMode>("balanced");
  const [planningMode, setPlanningMode] = useState<PlanPreferences["planningMode"]>("auto");
  const [householdSize, setHouseholdSize] = useState(4);
  const [budget, setBudget] = useState<PlanPreferences["budgetLevel"]>("standard");
  const [mealsPerWeek, setMealsPerWeek] = useState<3 | 5 | 7>(5);
  const [dietType, setDietType] = useState<PlanPreferences["dietType"]>("no-preference");
  const [exclusions, setExclusions] = useState<string[]>([]);

  const [generatingMsg, setGeneratingMsg] = useState(ROTATING_MESSAGES[0]);
  const [generatingDone, setGeneratingDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const msgIndex = useRef(0);
  const isInGeneratingFlow = useRef(false);

  useEffect(() => {
    if (!isContextLoaded) return;
    if (isInGeneratingFlow.current) return;
    if (isOnboarded) {
      router.replace("/(tabs)/planner");
    }
  }, [isContextLoaded, isOnboarded]);

  useEffect(() => {
    if (step !== 11) return;
    let interval: ReturnType<typeof setInterval>;

    const tick = () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        msgIndex.current = (msgIndex.current + 1) % ROTATING_MESSAGES.length;
        setGeneratingMsg(ROTATING_MESSAGES[msgIndex.current]);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    };
    interval = setInterval(tick, 700);

    const doneTimer = setTimeout(() => {
      clearInterval(interval);
      setGeneratingDone(true);
      setTimeout(() => {
        setStep(12 as OnboardingStep);
      }, 900);
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(doneTimer);
    };
  }, [step]);

  const startGenerating = async () => {
    const newPrefs: PlanPreferences = {
      ...DEFAULT_PREFERENCES,
      planningMode,
      householdSize,
      budgetLevel: budget,
      mealVariety: mealsPerWeek,
      dietType,
      exclusions,
      weekendOverrides: { ...DEFAULT_WEEKEND_OVERRIDES },
    };
    isInGeneratingFlow.current = true;
    await setPreferences(newPrefs);
    await setIsOnboarded(true);
    await updateOnboardingState({ hasMealsSetup: true, scope, weeklyMode });
    setContextWeeklyMode(weeklyMode);
    setContextHasMealsSetup(true);
    updateWeekKey();
    autoGeneratePlan(newPrefs);
    setStep(11);
  };

  const goBack = () => {
    if (step === 0) return;
    if (step === 1) { setStep(0); return; }
    if (step === 2) { setStep(1); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 10) { setStep(8); return; }
    // Step 12 is the post-generation money bridge — go back to meal filters
    if (step === 12) { setStep(8); return; }
    setStep((s) => (s - 1) as OnboardingStep);
  };

  const goNext = async () => {
    if (step === 0) { setStep(1); return; }
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (scope === "money") {
        await updateOnboardingState({ scope, weeklyMode });
        setContextWeeklyMode(weeklyMode);
        router.replace("/money-setup");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 8) {
      if (scope === "both") {
        setStep(10);
        return;
      }
      startGenerating();
      return;
    }
    if (step === 10) {
      const newPrefs: PlanPreferences = {
        ...DEFAULT_PREFERENCES,
        planningMode,
        householdSize,
        budgetLevel: budget,
        mealVariety: mealsPerWeek,
        dietType,
        exclusions,
        weekendOverrides: { ...DEFAULT_WEEKEND_OVERRIDES },
      };
      isInGeneratingFlow.current = true;
      await setPreferences(newPrefs);
      await setIsOnboarded(true);
      await updateOnboardingState({ hasMealsSetup: true, scope, weeklyMode });
      setContextWeeklyMode(weeklyMode);
      setContextHasMealsSetup(true);
      updateWeekKey();
      autoGeneratePlan(newPrefs);
      router.replace("/money-setup");
      return;
    }
    if (step === 11) return;
    setStep((s) => (s + 1) as OnboardingStep);
  };

  const toggleExclusion = (ex: string) => {
    Haptics.selectionAsync();
    setExclusions((prev) =>
      prev.includes(ex) ? prev.filter((e) => e !== ex) : [...prev, ex]
    );
  };

  const goToPreferencesWithSave = async () => {
    const newPrefs: PlanPreferences = {
      ...DEFAULT_PREFERENCES,
      planningMode,
      householdSize,
      budgetLevel: budget,
      mealVariety: mealsPerWeek,
      dietType,
      exclusions,
      weekendOverrides: { ...DEFAULT_WEEKEND_OVERRIDES },
    };
    isInGeneratingFlow.current = true;
    await setPreferences(newPrefs);
    await setIsOnboarded(true);
    router.replace("/preferences");
  };

  const paddingTop = Platform.OS === "web" ? 60 : insets.top;
  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 24;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Logo: 72% of window width, capped at 340px — maintains aspect ratio (507:233 ≈ 2.176)
  const logoWidth = Math.min(Math.round(windowWidth * 0.72), 340);
  const logoHeight = Math.round(logoWidth / 2.176);

  const mealStep = step >= 3 && step <= 8 ? step - 2 : 0;

  if (step === 11) {
    return (
      <View style={[styles.screen, { backgroundColor: C.background, paddingTop, paddingBottom }]}>
        <View style={styles.generatingCenter}>
          {generatingDone ? (
            <>
              <Feather name="check-circle" size={52} color={C.primary} />
              <Text style={[styles.generatingDone, { color: C.text }]}>
                Done. Your week's sorted.
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.generatingSpinner, { borderColor: C.primary }]} />
              <Text style={[styles.generatingHeadline, { color: C.text }]}>
                Alright… give us a sec
              </Text>
              <Animated.Text
                style={[styles.generatingMsg, { color: C.textSecondary, opacity: fadeAnim }]}
              >
                {generatingMsg}
              </Animated.Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (step === 12) {
    return (
      <View style={[styles.screen, { backgroundColor: C.background, paddingTop }]}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.backBtn, { backgroundColor: C.chipBg, alignSelf: "flex-start", marginBottom: 8 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.generatingCenter}>
          <View style={[styles.transitionIcon, { backgroundColor: C.tealTint }]}>
            <Feather name="check" size={36} color={C.primary} />
          </View>
          <Text style={[styles.transitionHeadline, { color: C.text }]}>
            Your week is sorted!
          </Text>
          <Text style={[styles.transitionSub, { color: C.textSecondary }]}>
            Want to see what this means for your budget this week?
          </Text>
          <Text style={[styles.transitionHelper, { color: C.textMuted }]}>
            We can show you how your week looks — food, spending, and what's left.
          </Text>
        </View>
        <View style={[styles.bridgeActions, { paddingBottom: paddingBottom + 8 }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace("/money-setup");
            }}
            activeOpacity={0.85}
            style={[styles.primaryCta, { backgroundColor: C.gold }]}
          >
            <Feather name="dollar-sign" size={18} color="#fff" />
            <Text style={styles.primaryCtaText}>Set my numbers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(tabs)/planner");
            }}
            activeOpacity={0.7}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipBtnText, { color: C.textMuted }]}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: C.background, paddingTop, height: windowHeight }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.welcomeContent,
            Platform.OS === 'web' && { paddingBottom: 130 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={sortiiLogo} style={[styles.logo, { width: logoWidth, height: logoHeight }]} resizeMode="contain" />
          <Text style={[styles.welcomeHeadline, { color: C.text }]}>
            No more "what's for dinner"{"\n"}Or "what can we afford this week?"
          </Text>
          <Text style={[styles.welcomeSub, { color: C.textSecondary }]}>
            Sortii plans your week in 60 seconds — meals, budget, shopping list. Done.
          </Text>
          <Text style={[styles.welcomeSupport, { color: "#6B4A5E" }]}>
            Less stress. Fewer takeaways. More money left.
          </Text>
        </ScrollView>
        <View
          style={[
            styles.welcomeActions,
            { paddingBottom: paddingBottom + 16 },
            Platform.OS === 'web' && {
              position: 'fixed' as any,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: C.background,
              paddingHorizontal: 24,
              paddingTop: 12,
              zIndex: 10,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              goNext();
            }}
            activeOpacity={0.85}
            style={[styles.primaryCta, { backgroundColor: C.gold }]}
          >
            <Text style={styles.primaryCtaText}>Get started</Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.welcomeHelper, { color: C.textMuted }]}>
            Takes about a minute. Promise.
          </Text>
        </View>
      </View>
    );
  }

  if (step === 10) {
    return (
      <View style={[styles.screen, { backgroundColor: C.background, paddingTop, paddingBottom }]}>
        <View style={styles.transitionCenter}>
          <View style={[styles.transitionIcon, { backgroundColor: C.tealTint }]}>
            <Feather name="check" size={36} color={C.primary} />
          </View>
          <Text style={[styles.transitionHeadline, { color: C.text }]}>
            Nice — dinners sorted.
          </Text>
          <Text style={[styles.transitionSub, { color: C.textSecondary }]}>
            Now let's make sure the numbers line up.
          </Text>
        </View>
        <View style={styles.stepFooter}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              goNext();
            }}
            activeOpacity={0.85}
            style={[styles.primaryCta, { backgroundColor: C.gold }]}
          >
            <Text style={styles.primaryCtaText}>Next</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              startGenerating();
            }}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipText, { color: C.textMuted }]}>
              Skip for now — just meals
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: C.background, paddingTop, paddingBottom }]}>
      <View style={styles.stepHeader}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.backBtn, { backgroundColor: C.chipBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={C.primary} />
        </TouchableOpacity>
        {step >= 3 && step <= 8 && (
          <ProgressDots current={mealStep} total={MEAL_SETUP_STEPS} />
        )}
        {step >= 3 && step <= 8 && (
          <Text style={[styles.stepCounter, { color: C.textMuted }]}>
            {mealStep} of {MEAL_SETUP_STEPS}
          </Text>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.stepBody}>
          {step === 1 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                What are we sorting this week?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                You can always add the other later.
              </Text>
              <View style={styles.scopeList}>
                <ScopeCard
                  label="🍽  Meals"
                  sub="Dinner… sorted."
                  selected={scope === "meals"}
                  onPress={() => { Haptics.selectionAsync(); setScope("meals"); }}
                />
                <ScopeCard
                  label="💰  Money"
                  sub="Budget… sorted."
                  selected={scope === "money"}
                  onPress={() => { Haptics.selectionAsync(); setScope("money"); }}
                />
                <ScopeCard
                  label="✨  Both"
                  sub="Whole week… sorted."
                  selected={scope === "both"}
                  onPress={() => { Haptics.selectionAsync(); setScope("both"); }}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                How do you want this week to feel?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                We'll shape your meals and spending to match.
              </Text>
              <View style={styles.optionList}>
                <OptionCard
                  label="Keep it easy"
                  sub="Quick meals. Low effort. No overthinking."
                  selected={weeklyMode === "easy"}
                  onPress={() => { Haptics.selectionAsync(); setWeeklyMode("easy"); }}
                />
                <OptionCard
                  label="Stay on track"
                  sub="Balanced meals. Sensible spend."
                  selected={weeklyMode === "balanced"}
                  onPress={() => { Haptics.selectionAsync(); setWeeklyMode("balanced"); }}
                />
                <OptionCard
                  label="Save where I can"
                  sub="More budget-friendly choices. Fewer extras."
                  selected={weeklyMode === "budget"}
                  onPress={() => { Haptics.selectionAsync(); setWeeklyMode("budget"); }}
                />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                How hands-on do you want to be?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                We've got this — but it's your call.
              </Text>
              <View style={styles.optionList}>
                <OptionCard
                  label="Auto"
                  sub="We've got this."
                  selected={planningMode === "auto"}
                  onPress={() => { Haptics.selectionAsync(); setPlanningMode("auto"); }}
                />
                <OptionCard
                  label="Mixed"
                  sub="You pick a few, we'll fill the gaps."
                  selected={planningMode === "mixed"}
                  onPress={() => { Haptics.selectionAsync(); setPlanningMode("mixed"); }}
                />
                <OptionCard
                  label="Manual"
                  sub="All yours."
                  selected={planningMode === "manual"}
                  onPress={() => { Haptics.selectionAsync(); setPlanningMode("manual"); }}
                />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                How many are we feeding?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                We'll size everything for you.
              </Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setHouseholdSize((n) => Math.max(1, n - 1)); }}
                  style={[styles.stepperBtn, { backgroundColor: C.chipBg }]}
                >
                  <Feather name="minus" size={22} color={C.primary} />
                </TouchableOpacity>
                <Text style={[styles.stepperValue, { color: C.text }]}>{householdSize}</Text>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setHouseholdSize((n) => Math.min(20, n + 1)); }}
                  style={[styles.stepperBtn, { backgroundColor: C.chipBg }]}
                >
                  <Feather name="plus" size={22} color={C.primary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.stepperLabel, { color: C.textMuted }]}>
                {householdSize === 1 ? "Just you" : `${householdSize} people`}
              </Text>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                What's the budget?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                No judgement. Just dinner.
              </Text>
              <View style={styles.optionList}>
                <OptionCard
                  label="Super Budget"
                  sub={`~${currencySymbol}5 per serve`}
                  selected={budget === "super-budget"}
                  onPress={() => { Haptics.selectionAsync(); setBudget("super-budget"); }}
                />
                <OptionCard
                  label="Budget"
                  sub={`~${currencySymbol}8 per serve`}
                  selected={budget === "budget"}
                  onPress={() => { Haptics.selectionAsync(); setBudget("budget"); }}
                />
                <OptionCard
                  label="Standard"
                  sub={`~${currencySymbol}12 per serve`}
                  selected={budget === "standard"}
                  onPress={() => { Haptics.selectionAsync(); setBudget("standard"); }}
                />
                <OptionCard
                  label="Premium"
                  sub="No limits"
                  selected={budget === "premium"}
                  onPress={() => { Haptics.selectionAsync(); setBudget("premium"); }}
                />
              </View>
            </>
          )}

          {step === 6 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                How many nights are we sorting?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                Even three nights is a win.
              </Text>
              <View style={styles.optionList}>
                <OptionCard
                  label="3 meals"
                  sub="A few solid nights"
                  selected={mealsPerWeek === 3}
                  onPress={() => { Haptics.selectionAsync(); setMealsPerWeek(3); }}
                />
                <OptionCard
                  label="5 meals"
                  sub="Most of the week"
                  selected={mealsPerWeek === 5}
                  onPress={() => { Haptics.selectionAsync(); setMealsPerWeek(5); }}
                />
                <OptionCard
                  label="7 meals"
                  sub="The full week"
                  selected={mealsPerWeek === 7}
                  onPress={() => { Haptics.selectionAsync(); setMealsPerWeek(7); }}
                />
              </View>
            </>
          )}

          {step === 7 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                Anything we should avoid?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                Hard no's only. We'll handle the rest.
              </Text>
              <View style={styles.optionList}>
                <OptionCard
                  label="No preference"
                  selected={dietType === "no-preference"}
                  onPress={() => { Haptics.selectionAsync(); setDietType("no-preference"); }}
                />
                <OptionCard
                  label="Vegetarian"
                  selected={dietType === "vegetarian"}
                  onPress={() => { Haptics.selectionAsync(); setDietType("vegetarian"); }}
                />
                <OptionCard
                  label="Vegan"
                  selected={dietType === "vegan"}
                  onPress={() => { Haptics.selectionAsync(); setDietType("vegan"); }}
                />
                <OptionCard
                  label="Pescatarian"
                  selected={dietType === "pescatarian"}
                  onPress={() => { Haptics.selectionAsync(); setDietType("pescatarian"); }}
                />
              </View>
            </>
          )}

          {step === 8 && (
            <>
              <Text style={[styles.stepHeadline, { color: C.text }]}>
                Any hard no's?
              </Text>
              <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
                Tap anything to skip it.
              </Text>
              <View style={styles.pillGrid}>
                {EXCLUSION_OPTIONS.map((ex) => (
                  <PillChip
                    key={ex}
                    label={ex}
                    active={exclusions.includes(ex)}
                    onPress={() => toggleExclusion(ex)}
                  />
                ))}
              </View>
              {exclusions.length === 0 && (
                <Text style={[styles.optionalHint, { color: C.textMuted }]}>
                  Nothing selected — we'll include everything.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.stepFooter}>
        {step === 8 ? (
          <>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (scope === "both") {
                  setStep(10);
                } else {
                  startGenerating();
                }
              }}
              activeOpacity={0.85}
              style={[styles.primaryCta, { backgroundColor: C.gold }]}
            >
              <Text style={styles.primaryCtaText}>
                {scope === "both" ? "Next — money setup" : "Sort my week"}
              </Text>
              <Feather name={scope === "both" ? "arrow-right" : "zap"} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                goToPreferencesWithSave();
              }}
              activeOpacity={0.85}
              style={[styles.secondaryCtaFull, { backgroundColor: C.secondaryActionBg }]}
            >
              <Text style={[styles.secondaryCtaText, { color: C.secondaryActionText }]}>More filters</Text>
              <Feather name="sliders" size={15} color={C.secondaryActionText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                if (scope === "both") {
                  setStep(10);
                } else {
                  startGenerating();
                }
              }}
              style={styles.skipBtn}
            >
              <Text style={[styles.skipText, { color: C.textMuted }]}>
                Skip — no exclusions
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                goNext();
              }}
              activeOpacity={0.85}
              style={[styles.primaryCta, { backgroundColor: C.gold }]}
            >
              <Text style={styles.primaryCtaText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
            {step === 7 && (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); goNext(); }}
                style={styles.skipBtn}
              >
                <Text style={[styles.skipText, { color: C.textMuted }]}>
                  Skip — no preference
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  welcomeContent: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  logo: {
    width: 507,
    height: 233,
    marginBottom: 4,
  },
  welcomeHeadline: {
    fontSize: 22,
    fontFamily: "Manrope_600SemiBold",
    textAlign: "center",
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  welcomeSub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  welcomeSupport: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
  },
  welcomeActions: {
    gap: 12,
    paddingBottom: 8,
  },
  welcomeHelper: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    paddingBottom: 20,
    minHeight: 60,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDots: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  } as any,
  stepCounter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  stepBody: {
    gap: 20,
    paddingBottom: 16,
  },
  stepHeadline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
  },
  stepHelper: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  scopeList: {
    gap: 12,
  },
  scopeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  scopeCardInner: {
    flex: 1,
    gap: 4,
  },
  scopeCardLabel: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  scopeCardSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  scopeCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionCardInner: {
    flex: 1,
    gap: 2,
  },
  optionCardLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  optionCardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 8,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    minWidth: 60,
    textAlign: "center",
  },
  stepperLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  pillChipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  optionalHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  transitionCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 40,
  },
  transitionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  transitionHeadline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 36,
  },
  transitionSub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  transitionHelper: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  bridgeActions: {
    gap: 12,
    paddingHorizontal: 4,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  stepFooter: {
    gap: 8,
    paddingTop: 12,
  },
  secondaryCtaFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryCtaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  generatingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  generatingSpinner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderTopColor: "transparent",
  } as any,
  generatingHeadline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  generatingMsg: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  generatingDone: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 12,
  },
});

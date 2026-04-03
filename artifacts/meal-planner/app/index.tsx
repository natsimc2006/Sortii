import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
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
import {
  DEFAULT_PREFERENCES,
  DEFAULT_WEEKEND_OVERRIDES,
  EXCLUSION_OPTIONS,
  PlanPreferences,
} from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";

const C = Colors.light;
const sortiiLogo = require("@/assets/images/sortii-logo.png");

const ROTATING_MESSAGES = [
  "Sorting your week…",
  "Balancing budget + time…",
  "Making sure Tuesday isn't boring…",
  "Keeping things realistic…",
  "Almost there…",
];

const TOTAL_STEPS = 6;

type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.progressDots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i < step ? C.primary : i === step - 1 ? C.primary : C.border,
              width: i === step - 1 ? 20 : 8,
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
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>(0);

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
    } else {
      router.replace("/home");
    }
  }, [isContextLoaded, isOnboarded]);

  useEffect(() => {
    if (step !== 7) return;
    let interval: ReturnType<typeof setInterval>;
    let stopAt = 2500;

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
        router.replace("/(tabs)/planner");
      }, 900);
    }, stopAt);

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
    autoGeneratePlan(newPrefs);
    setStep(7);
  };

  const goBack = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as OnboardingStep);
  };

  const goNext = () => {
    if (step === 6) {
      startGenerating();
    } else {
      setStep((s) => (s + 1) as OnboardingStep);
    }
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
    router.replace("/(tabs)/preferences");
  };

  const toggleExclusion = (ex: string) => {
    Haptics.selectionAsync();
    setExclusions((prev) =>
      prev.includes(ex) ? prev.filter((e) => e !== ex) : [...prev, ex]
    );
  };

  const paddingTop = Platform.OS === "web" ? 60 : insets.top;
  const paddingBottom = Platform.OS === "web" ? 40 : insets.bottom + 24;

  if (step === 7) {
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

  if (step === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: C.background, paddingTop, paddingBottom }]}>
        <View style={styles.welcomeContent}>
          <Image
            source={sortiiLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.welcomeSub, { color: C.textSecondary }]}>
            Let's sort your dinners. Takes 60 seconds.
          </Text>
        </View>
        <View style={styles.welcomeActions}>
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
            You can tweak things later.
          </Text>
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
        <ProgressDots step={step} />
        <Text style={[styles.stepCounter, { color: C.textMuted }]}>
          {step} of {TOTAL_STEPS}
        </Text>
      </View>

      <View style={styles.stepBody}>
        {step === 1 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              How hands-on do you want to be?
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

        {step === 2 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              How many are you feeding?
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

        {step === 3 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              What's the budget?
            </Text>
            <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
              Good meals don't have to cost a fortune.
            </Text>
            <View style={styles.optionList}>
              <OptionCard
                label="Super Budget"
                sub="~$5 per serve"
                selected={budget === "super-budget"}
                onPress={() => { Haptics.selectionAsync(); setBudget("super-budget"); }}
              />
              <OptionCard
                label="Budget"
                sub="~$8 per serve"
                selected={budget === "budget"}
                onPress={() => { Haptics.selectionAsync(); setBudget("budget"); }}
              />
              <OptionCard
                label="Standard"
                sub="~$12 per serve"
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

        {step === 4 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              How many nights are we sorting?
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

        {step === 5 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              Anything we should avoid?
            </Text>
            <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
              Skip if you're easy.
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

        {step === 6 && (
          <>
            <Text style={[styles.stepHeadline, { color: C.text }]}>
              Any hard no's?
            </Text>
            <Text style={[styles.stepHelper, { color: C.textSecondary }]}>
              We'll steer clear.
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

      <View style={styles.stepFooter}>
        {step === 6 ? (
          <>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); startGenerating(); }}
              activeOpacity={0.85}
              style={[styles.primaryCta, { backgroundColor: C.gold }]}
            >
              <Text style={styles.primaryCtaText}>Sort my week</Text>
              <Feather name="zap" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToPreferencesWithSave(); }}
              activeOpacity={0.85}
              style={[styles.secondaryCtaFull, { backgroundColor: C.secondaryActionBg }]}
            >
              <Text style={[styles.secondaryCtaText, { color: C.secondaryActionText }]}>More filters</Text>
              <Feather name="sliders" size={15} color={C.secondaryActionText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); startGenerating(); }} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: C.textMuted }]}>
                Skip — no exclusions
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goNext(); }}
              activeOpacity={0.85}
              style={[styles.primaryCta, { backgroundColor: C.gold }]}
            >
              <Text style={styles.primaryCtaText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
            {step === 5 && (
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
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 20,
    gap: 16,
  },
  logo: {
    width: 320,
    height: 148,
  },
  welcomeSub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
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
    transition: "width 0.2s",
  } as any,
  stepCounter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  stepBody: {
    flex: 1,
    gap: 20,
  },
  stepHeadline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
  },
  stepHelper: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
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
  },
  primaryCtaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  generatingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  generatingSpinner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderTopColor: "transparent",
  },
  generatingHeadline: {
    fontSize: 24,
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
    marginTop: 8,
  },
});

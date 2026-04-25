import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  Modal,
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
  DAYS,
  EASY_NIGHT_ID,
  MealPlanEntry,
  MealSlot,
  PANTRY_STAPLES,
  Recipe,
  WEEKEND_DAYS,
} from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { useLocale } from "@/context/LocaleContext";
import { MealSlotCard } from "@/components/MealSlotCard";
import { SwapSheet } from "@/components/SwapSheet";
import { MealSearchModal } from "@/components/MealSearchModal";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import { Toast, ToastState } from "@/components/Toast";
import { SwapTips } from "@/components/SwapTips";
import { PantryTips } from "@/components/PantryTips";
import { getSwapsForRecipe, getWeeklyPantryTips } from "@/utils/getSwapsForRecipe";
import { SWAP_RULES } from "@/constants/swapRules";
import allRecipesRaw from "@/data/recipes_unified_au.json";

const allRecipes = allRecipesRaw as { id: string; name: string }[];

const TEAL = "#2A8F88";
const GOLD = "#D29A22";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FULL_PLAN_MESSAGES = [
  "Week sorted. You're done here. ✓",
  "All 7 dinners planned. Future you says thanks.",
  "Nothing left to decide. That's the point.",
  "Dinner? Handled. Go do literally anything else.",
];

const EMPTY_PLAN_MESSAGES = [
  "Nothing planned yet. Let's fix that.",
  "Blank week. Endless possibilities. Or just tap Auto Plan.",
  "The week won't plan itself. Well — actually, it will. Tap below.",
];

const TOAST_AUTO_PLAN = [
  "Done. Seven dinners, zero decisions.",
  "Your week is sorted. Shopping list is next.",
  "That took longer to read than it did to plan.",
];

const MENTAL_LOAD_MSGS = [
  "Dinner? Handled. Go do literally anything else.",
  "Future you is already grateful.",
  "One less thing to think about.",
  "We've got this week sorted.",
  "Nothing left to decide.",
  "The hardest part is already done.",
  "Your week is sorted. You're welcome.",
  "Less deciding. More living.",
  "5pm has never looked this easy.",
  "All five nights, sorted.",
  "You've got a plan. That's half the battle.",
  "Groceries next. You've already won.",
];

const TOAST_SAVE = [
  "Saved. Your future self is already relieved.",
  "Plan locked in. Nice work.",
];

const TOAST_CLEAR_MEAL = [
  "Gone. We'll find you something better.",
  "Cleared. Fresh start for that day.",
];

const TOAST_AUTO_SWAP = [
  "Smarter choice.",
  "Same vibe, less spend.",
  "Swapped. That's better.",
  "Good call.",
];

const TOAST_HIDE_RECIPE = [
  "Got it — we won't suggest that one again.",
  "Noted. Not everyone loves a frittata.",
];

const TOAST_FILTERS_RESTRICTIVE = [
  "Your filters are working overtime. Relax one or two for more variety.",
  "We've hit the edges of your preferences. Want to give us a little more to work with?",
];

type ConfirmAction = "auto" | "clear" | null;

type PendingMealAction = {
  type: "remove";
  day: string;
  slot: MealSlot;
  recipe: Recipe;
} | null;

type SwapSheetTarget = {
  day: string;
  slot: MealSlot;
} | null;

// ── Quick-action chip definitions ────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "shopping-cart", label: "Shopping", route: "/(tabs)/shopping" },
  { icon: "book-open",     label: "Recipes",  route: "/(tabs)/recipes" },
] as const;

function getTodayName() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

export default function MealsScreen() {
  const {
    preferences,
    setPreferences,
    currentPlan,
    setCurrentPlan,
    getRecipeById,
    setMealSlot,
    fillRemainingSlots,
    fillSingleSlot,
    autoGeneratePlan,
    autoSwapSlot,
    clearPlan,
    savePlan,
    estimatedCostBand,
    hideRecipe,
    planHasLimitedVariety,
    favoriteIds,
    toggleFavorite,
  } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const { currencySymbol } = useLocale();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("dinner");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingMealAction, setPendingMealAction] = useState<PendingMealAction>(null);
  const [swapSheetTarget, setSwapSheetTarget] = useState<SwapSheetTarget>(null);
  const [toast, setToast] = useState<(ToastState & { visible: boolean }) | null>(null);
  const [justAutoGenerated, setJustAutoGenerated] = useState(false);
  const [activeChip, setActiveChip] = useState<"household" | "budget" | "cost" | null>(null);
  const [swapBannerDismissed, setSwapBannerDismissed] = useState(false);
  const [midWeekDismissed, setMidWeekDismissed] = useState(false);
  const [endWeekDismissed, setEndWeekDismissed] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSnapshotRef = useRef<MealPlanEntry[] | null>(null);
  const recipeTipShownRef = useRef(false);

  const weekSortedOpacity = useRef(new Animated.Value(0)).current;
  const [weekSortedMessage, setWeekSortedMessage] = useState("");
  const weekFullMountedRef = useRef(false);
  const prevWeekFullRef = useRef(false);

  const mountOpacity = useRef(new Animated.Value(0)).current;
  const [headerReassuranceMsg] = useState(() => pickRandom(MENTAL_LOAD_MSGS));

  // ── Tonight's dinner (for status line) ──────────────────────────────────
  const todayName = getTodayName();
  const filledDinners = currentPlan.filter((e) => e.slot === "dinner" && e.recipeId);
  const tonightEntry = currentPlan.find((e) => e.day === todayName && e.slot === "dinner");
  const tonightRecipe = tonightEntry?.recipeId
    ? allRecipes.find((r) => r.id === tonightEntry.recipeId) ?? null
    : null;
  const plannedCount = filledDinners.length;

  function getMealStatusLine() {
    if (plannedCount === 0) return "Nothing planned yet. The week's wide open.";
    if (plannedCount <= 2) return `${plannedCount} dinner${plannedCount > 1 ? "s" : ""} sorted. A start.`;
    if (plannedCount <= 5) return `${plannedCount} dinners sorted. A decent week taking shape.`;
    return `${plannedCount} dinners sorted. Dinner's behaving itself.`;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const openSearch = (day: string, slot: MealSlot) => {
    // When no meals are planned yet, direct user to set preferences first
    if (isWeekEmpty) {
      router.push("/(tabs)/preferences");
      return;
    }
    setSelectedDay(day);
    setSelectedSlot(slot);
    setModalVisible(true);
  };

  const getEntry = (day: string, slot: MealSlot) =>
    currentPlan.find((e) => e.day === day && e.slot === slot);

  const showToast = (state: ToastState, duration = 3000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ ...state, visible: true });
    if (!state.persistent) {
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, visible: false } : null));
      }, duration);
    }
  };

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast((prev) => (prev ? { ...prev, visible: false } : null));
  };

  const handleUndo = () => {
    if (undoSnapshotRef.current) {
      setCurrentPlan(undoSnapshotRef.current);
      undoSnapshotRef.current = null;
    }
    dismissToast();
  };

  useEffect(() => {
    AsyncStorage.getItem("sortii_recipe_tip_shown").then((v) => {
      if (v === "true") recipeTipShownRef.current = true;
    });
    Animated.timing(mountOpacity, {
      toValue: 1,
      duration: 350,
      delay: 250,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    if (justAutoGenerated) {
      setJustAutoGenerated(false);
      AsyncStorage.getItem("sortii_first_plan_shown").then((seen) => {
        if (!seen) {
          AsyncStorage.setItem("sortii_first_plan_shown", "true");
          setTimeout(() => {
            showToast({
              message: "Dinner plan sorted. 60 seconds and no more 'what's for dinner?'",
              variant: "success",
            }, 3000);
          }, 600);
        } else if (planHasLimitedVariety) {
          showToast({
            message: preferences.kidFriendly
              ? "You've made this tricky 😅 Try loosening a filter."
              : pickRandom(TOAST_FILTERS_RESTRICTIVE),
            variant: "smart-tip",
            persistent: true,
            actionLabel: "Open settings",
            onAction: () => {
              dismissToast();
              router.push("/(tabs)/preferences");
            },
            onDismiss: dismissToast,
          });
        } else if (!recipeTipShownRef.current) {
          recipeTipShownRef.current = true;
          AsyncStorage.setItem("sortii_recipe_tip_shown", "true");
          setTimeout(() => {
            showToast({
              message: "Tap a meal to open the recipe.",
              variant: "info",
            });
          }, 800);
        } else {
          setTimeout(() => {
            showToast({ message: pickRandom(TOAST_AUTO_PLAN), variant: "success" });
          }, 400);
        }
      });
    }
  }, [planHasLimitedVariety, justAutoGenerated]);

  const handleAutoGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmAction("auto");
  };

  const handleFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoSnapshotRef.current = [...currentPlan];
    fillRemainingSlots();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({
      message: "Filled.",
      variant: "success",
      actionLabel: "Undo",
      onAction: handleUndo,
    });
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmAction("clear");
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    savePlan();
    showToast({ message: pickRandom(TOAST_SAVE), variant: "success" });
  };

  const handleAutoFillSlot = (day: string, slot: MealSlot) => {
    undoSnapshotRef.current = [...currentPlan];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fillSingleSlot(day, slot);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleConfirm = () => {
    if (confirmAction === "auto") {
      undoSnapshotRef.current = [...currentPlan];
      setJustAutoGenerated(true);
      autoGeneratePlan();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (confirmAction === "clear") {
      undoSnapshotRef.current = [...currentPlan];
      clearPlan();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        message: "All clear. Fresh start.",
        variant: "undo",
        actionLabel: "Undo",
        onAction: handleUndo,
      });
    }
    setConfirmAction(null);
  };

  const handleMealRemove = (day: string, slot: MealSlot) => {
    const entry = getEntry(day, slot);
    const recipe = entry?.recipeId ? getRecipeById(entry.recipeId) ?? null : null;
    if (!recipe) {
      setMealSlot(day, slot, null);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingMealAction({ type: "remove", day, slot, recipe });
  };

  const handleSwitchMeal = (day: string, slot: MealSlot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSwapSheetTarget({ day, slot });
  };

  const handleSwapPickForMe = () => {
    if (!swapSheetTarget) return;
    const { day, slot } = swapSheetTarget;
    setSwapSheetTarget(null);
    undoSnapshotRef.current = [...currentPlan];
    autoSwapSlot(day, slot);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({
      message: "Swapped. That's better.",
      variant: "undo",
      actionLabel: "Undo",
      onAction: handleUndo,
    });
  };

  const handleSwapLetMeChoose = () => {
    if (!swapSheetTarget) return;
    const { day, slot } = swapSheetTarget;
    setSwapSheetTarget(null);
    openSearch(day, slot);
  };

  const handleMealHide = (recipe: Recipe) => {
    undoSnapshotRef.current = [...currentPlan];
    hideRecipe(recipe.id);
    showToast({
      message: pickRandom(TOAST_HIDE_RECIPE),
      variant: "undo",
      actionLabel: "Undo",
      onAction: handleUndo,
    }, 4000);
  };

  const handleMealActionConfirm = () => {
    if (!pendingMealAction) return;
    const { type, day, slot, recipe } = pendingMealAction;
    undoSnapshotRef.current = [...currentPlan];

    if (type === "remove") {
      setMealSlot(day, slot, null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: pickRandom(TOAST_CLEAR_MEAL),
        variant: "undo",
        actionLabel: "Undo",
        onAction: handleUndo,
      });
    }
    setPendingMealAction(null);
  };

  const filledCount = currentPlan.filter((m) => m.recipeId).length;
  const planHasEasyNight = currentPlan.some((e) => e.recipeId === EASY_NIGHT_ID);
  const totalSlots = currentPlan.length;
  const isWeekEmpty = filledCount === 0;
  const isWeekFull = filledCount === totalSlots && totalSlots > 0;

  useEffect(() => {
    if (!weekFullMountedRef.current) {
      weekFullMountedRef.current = true;
      if (isWeekFull) {
        const msg = pickRandom(FULL_PLAN_MESSAGES);
        setWeekSortedMessage(msg);
        weekSortedOpacity.setValue(1);
      }
      prevWeekFullRef.current = isWeekFull;
      return;
    }
    if (isWeekFull && !prevWeekFullRef.current) {
      const msg = pickRandom(FULL_PLAN_MESSAGES);
      setWeekSortedMessage(msg);
      weekSortedOpacity.setValue(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Animated.timing(weekSortedOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: false,
        }).start();
      }, 300);
    } else if (!isWeekFull) {
      weekSortedOpacity.setValue(0);
    }
    prevWeekFullRef.current = isWeekFull;
  }, [isWeekFull]);

  const budgeLabel =
    preferences.budgetLevel === "super-budget"
      ? "Super Budget"
      : preferences.budgetLevel === "budget"
        ? "Budget"
        : preferences.budgetLevel === "standard"
          ? "Standard"
          : "Premium";

  const planBudgetMismatch = useMemo(() => {
    const filled = currentPlan.filter((e) => e.recipeId);
    if (filled.length === 0) return false;
    const budget = preferences.budgetLevel;
    return filled.some((e) => {
      const recipe = getRecipeById(e.recipeId!);
      if (!recipe) return false;
      if (budget === "super-budget") return recipe.estimatedCostBand !== "low";
      if (budget === "budget") return recipe.estimatedCostBand === "high";
      if (budget === "standard") return false;
      if (budget === "premium") return recipe.estimatedCostBand === "low";
      return false;
    });
  }, [currentPlan, preferences.budgetLevel, getRecipeById]);

  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : 58;

  const _jsDay = new Date().getDay();
  const isMidWeek = _jsDay === 3 || _jsDay === 4;
  const isEndOfWeek = _jsDay === 6 || _jsDay === 0;
  const filledMeals = currentPlan.filter((e) => e.recipeId);

  const handleCheaperWeek = () => {
    const order: Array<typeof preferences.budgetLevel> = [
      "premium", "standard", "budget", "super-budget",
    ];
    const idx = order.indexOf(preferences.budgetLevel);
    if (idx === order.length - 1) {
      showToast({ message: "Already on super-budget — you're already saving big!", variant: "success" });
      return;
    }
    const next = order[idx + 1];
    undoSnapshotRef.current = [...currentPlan];
    setPreferences({ budgetLevel: next });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      setJustAutoGenerated(true);
      autoGeneratePlan();
      showToast({
        message: "Switching to cheaper meals — refreshing your week!",
        variant: "success",
        actionLabel: "Undo",
        onAction: handleUndo,
      });
    }, 80);
  };

  const sharedIngredients = useMemo(() => {
    if (!preferences.minimiseWaste) return [];
    const allR = currentPlan
      .filter((e) => e.recipeId)
      .map((e) => getRecipeById(e.recipeId!))
      .filter(Boolean) as Recipe[];
    if (allR.length < 2) return [];
    const ingredientCount: Record<string, number> = {};
    for (const r of allR) {
      for (const ing of r.ingredients) {
        const key = ing.name.toLowerCase().trim();
        if (PANTRY_STAPLES.some((s) => key.includes(s))) continue;
        ingredientCount[key] = (ingredientCount[key] ?? 0) + 1;
      }
    }
    return Object.entries(ingredientCount)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [currentPlan, preferences.minimiseWaste, getRecipeById]);

  const weeklySwapSaving = useMemo(() => {
    const filledRecipes = currentPlan
      .filter((e) => e.recipeId)
      .map((e) => getRecipeById(e.recipeId!))
      .filter(Boolean) as Recipe[];
    const ruleCount: Record<string, number> = {};
    for (const recipe of filledRecipes) {
      const matched = getSwapsForRecipe(recipe.ingredients.map((i) => i.name));
      for (const swap of matched) {
        ruleCount[swap.id] = (ruleCount[swap.id] ?? 0) + 1;
      }
    }
    const total = Object.entries(ruleCount).reduce((sum, [ruleId, count]) => {
      const rule = SWAP_RULES.find((r) => r.id === ruleId);
      return rule
        ? sum + rule.savingPerServeAUD * preferences.householdSize * count
        : sum;
    }, 0);
    return Math.round(total);
  }, [currentPlan, getRecipeById, preferences.householdSize]);

  const weeklyPantryTips = useMemo(() => {
    const filledRecipes = currentPlan
      .filter((e) => e.recipeId)
      .map((e) => getRecipeById(e.recipeId!))
      .filter(Boolean) as Recipe[];
    return getWeeklyPantryTips(filledRecipes);
  }, [currentPlan, getRecipeById]);

  const planKey = currentPlan.map((e) => e.recipeId ?? "empty").join(",");

  const handleQuickNav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.background,
        marginBottom: TAB_BAR_HEIGHT + insets.bottom,
      }}
    >
      {/* ── Sticky header: title + status + tools ───────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === "web" ? 14 : insets.top,
            backgroundColor: C.background,
            borderBottomColor: C.cardBorder,
          },
        ]}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: C.text }]}>Meals</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[
              styles.iconBtn,
              { backgroundColor: C.chipBg, borderWidth: 1.5, borderColor: C.border },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bookmark" size={15} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Status summary line */}
        <Text style={[styles.statusLine, { color: C.textMuted }]}>
          {getMealStatusLine()}
        </Text>

        {/* Tools row — prominent, horizontally scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.toolsScroll}
          contentContainerStyle={styles.toolsRow}
        >
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.route}
              style={[styles.toolBtn, { backgroundColor: C.tealTint, borderColor: TEAL + "30" }]}
              onPress={() => handleQuickNav(action.route)}
              activeOpacity={0.72}
              hitSlop={{ top: 4, bottom: 4 }}
            >
              <Feather name={action.icon as any} size={12} color={TEAL} />
              <Text style={[styles.toolBtnText, { color: C.primaryDark }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: GOLD, borderColor: GOLD + "60" }]}
            onPress={() => handleQuickNav("/(tabs)/preferences")}
            activeOpacity={0.80}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <Feather name="sliders" size={12} color="#fff" />
            <Text style={[styles.toolBtnText, { color: "#fff" }]}>Preferences</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Budget mismatch banner — shown just below sticky header */}
      {planBudgetMismatch && (
        <View
          style={[
            styles.budgetMismatchBanner,
            { backgroundColor: "#FFF8EC", borderColor: C.gold },
          ]}
        >
          <View style={styles.budgetMismatchTop}>
            <Feather name="alert-circle" size={16} color={C.goldDark} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.budgetMismatchTitle, { color: "#4A3A00" }]}>
                Some meals don't fit your {budgeLabel} budget
              </Text>
              <Text style={[styles.budgetMismatchBody, { color: "#7A6000" }]}>
                Refresh this week to pull meals that better match your selected budget.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              undoSnapshotRef.current = [...currentPlan];
              setJustAutoGenerated(true);
              autoGeneratePlan();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={[styles.budgetMismatchCTA, { backgroundColor: C.gold }]}
            activeOpacity={0.82}
          >
            <Feather name="refresh-cw" size={13} color="#fff" />
            <Text style={styles.budgetMismatchCTAText}>Refresh week</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Weekly planner scroll ─────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        {/* Plan settings + Preferences — lighter row, scrolls away */}
        <View style={styles.planSettingsSection}>
          <View style={styles.planSettingsChipRow}>
            <PlanChip
              label={`${preferences.householdSize} ${preferences.householdSize === 1 ? "person" : "people"}`}
              icon="users"
              onPress={() => setActiveChip("household")}
            />
            <PlanChip
              label={budgeLabel}
              icon="dollar-sign"
              range={filledCount > 0 ? estimatedCostBand : undefined}
              onPress={() => setActiveChip("budget")}
            />
            <TouchableOpacity
              style={styles.fridgeRescueChip}
              onPress={() => router.push("/(tabs)/cook-with" as any)}
              activeOpacity={0.72}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Feather name="search" size={10} color={TEAL} />
              <Text style={styles.fridgeRescueChipText}>Fridge Rescue</Text>
            </TouchableOpacity>
          </View>
          {preferences.kidFriendly && (
            <Text style={[styles.kidFriendlyNote, { color: C.textSecondary }]}>
              Showing kid-friendly meals only
            </Text>
          )}
          {filledCount >= 3 && !isWeekFull && (
            <Animated.Text style={[styles.headerReassurance, { opacity: mountOpacity }]}>
              {headerReassuranceMsg}
            </Animated.Text>
          )}
        </View>

        {/* Swap saving banner */}
        {weeklySwapSaving >= 2 && !swapBannerDismissed && (
          <View style={styles.swapBanner}>
            <Text style={[styles.swapBannerText, { flex: 1 }]}>
              💡 ~{currencySymbol}{weeklySwapSaving} in smarter swaps available
            </Text>
            <TouchableOpacity
              onPress={() => setSwapBannerDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 2, marginLeft: 8 }}
            >
              <Feather name="x" size={14} color="#3D1F2F" />
            </TouchableOpacity>
          </View>
        )}
        <PantryTips key={planKey} tips={weeklyPantryTips} />


        {/* Mid-week check-in */}
        {isMidWeek && filledMeals.length >= 3 && !midWeekDismissed && (
          <View
            style={[styles.checkInBanner, { backgroundColor: C.tealTint, borderColor: C.primary }]}
          >
            <View style={styles.checkInBannerBody}>
              <Text style={[styles.checkInBannerTitle, { color: C.primaryDark }]}>
                Halfway through your week
              </Text>
              <Text style={[styles.checkInBannerText, { color: C.textSecondary }]}>
                {filledMeals.length} meals locked in — you're ahead of most households. Keep it going!
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setMidWeekDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.checkInBannerClose}
            >
              <Feather name="x" size={14} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        )}


        {/* Day-by-day meal cards */}
        {DAYS.map((day, dayIdx) => {
          const dinnerEntry = getEntry(day, "dinner");
          const lunchEntry =
            preferences.mealCoverage === "lunch-dinner"
              ? getEntry(day, "lunch")
              : null;

          const isEasyNight = dinnerEntry?.recipeId === EASY_NIGHT_ID;
          const dinnerRecipe = !isEasyNight && dinnerEntry?.recipeId
            ? getRecipeById(dinnerEntry.recipeId) ?? null
            : null;
          const lunchRecipe = lunchEntry?.recipeId
            ? getRecipeById(lunchEntry.recipeId) ?? null
            : null;

          const isWeekend = WEEKEND_DAYS.includes(day);
          const hasWeekendOverride =
            isWeekend && preferences.weekendOverrides?.enabled;

          return (
            <React.Fragment key={day}>
              {dayIdx === 0 && (
                <Text style={styles.weekProgressLabel}>
                  {plannedCount} of 7 planned
                </Text>
              )}
              <View style={styles.dayBlock}>
              <View style={styles.dayLabelRow}>
                <Text style={[styles.dayLabel, { color: C.textSecondary }]}>{day}</Text>
                {hasWeekendOverride && (
                  <View
                    style={[styles.weekendBadge, { backgroundColor: C.mustard + "18" }]}
                  >
                    <Text style={[styles.weekendBadgeText, { color: C.mustard }]}>
                      weekend
                    </Text>
                  </View>
                )}
              </View>
              {lunchEntry !== undefined && lunchEntry !== null && (
                <>
                  <MealSlotCard
                    day={day}
                    slot="lunch"
                    recipe={lunchRecipe}
                    onAdd={() => openSearch(day, "lunch")}
                    onRemove={() => handleMealRemove(day, "lunch")}
                    onSwitchMeal={() => handleSwitchMeal(day, "lunch")}
                    onViewRecipe={lunchRecipe ? () => setDetailRecipe(lunchRecipe) : undefined}
                    onHideRecipe={lunchRecipe ? () => handleMealHide(lunchRecipe) : undefined}
                    onAutoFill={!lunchRecipe ? () => handleAutoFillSlot(day, "lunch") : undefined}
                    seasonalMode={preferences.seasonalMode ?? false}
                    kidFriendlyFilter={preferences.kidFriendly ?? false}
                    isFavorite={lunchRecipe ? favoriteIds.includes(lunchRecipe.id) : false}
                    onToggleFavorite={lunchRecipe ? () => toggleFavorite(lunchRecipe.id) : undefined}
                  />
                  {lunchRecipe && (
                    <SwapTips ingredientNames={lunchRecipe.ingredients.map((i) => i.name)} />
                  )}
                </>
              )}
              {isEasyNight ? (
                <View style={styles.easyNightCard}>
                  <View style={styles.easyNightHeader}>
                    <View style={styles.easyNightBadge}>
                      <Text style={styles.easyNightBadgeText}>DINNER</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setMealSlot(day, "dinner", null);
                        openSearch(day, "dinner");
                      }}
                      style={styles.easyNightSwapBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="refresh-cw" size={13} color="#999" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.easyNightBody}>
                    <View style={styles.easyNightIconBox}>
                      <Text style={styles.easyNightEmoji}>🛋️</Text>
                    </View>
                    <View style={styles.easyNightInfo}>
                      <Text style={styles.easyNightTitle}>Easy night</Text>
                      <Text style={styles.easyNightSub}>
                        Freezer, leftovers, or whatever's there.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <MealSlotCard
                    day={day}
                    slot="dinner"
                    recipe={dinnerRecipe}
                    onAdd={() => openSearch(day, "dinner")}
                    onRemove={() => handleMealRemove(day, "dinner")}
                    onSwitchMeal={() => handleSwitchMeal(day, "dinner")}
                    onViewRecipe={dinnerRecipe ? () => setDetailRecipe(dinnerRecipe) : undefined}
                    onHideRecipe={dinnerRecipe ? () => handleMealHide(dinnerRecipe) : undefined}
                    onAutoFill={!dinnerRecipe ? () => handleAutoFillSlot(day, "dinner") : undefined}
                    seasonalMode={preferences.seasonalMode ?? false}
                    kidFriendlyFilter={preferences.kidFriendly ?? false}
                    isFavorite={dinnerRecipe ? favoriteIds.includes(dinnerRecipe.id) : false}
                    onToggleFavorite={dinnerRecipe ? () => toggleFavorite(dinnerRecipe.id) : undefined}
                  />
                  {dinnerRecipe && (
                    <SwapTips ingredientNames={dinnerRecipe.ingredients.map((i) => i.name)} />
                  )}
                </>
              )}
              </View>
            </React.Fragment>
          );
        })}


        {/* Easy night quiet confirmation line */}
        {planHasEasyNight && (
          <Text style={styles.easyNightNote}>
            One easy night built in — busy week sorted.
          </Text>
        )}

        {/* Shared ingredients panel */}
        {sharedIngredients.length > 0 && (
          <View
            style={[styles.sharedPanel, { backgroundColor: C.card, borderColor: C.cardBorder }]}
          >
            <View style={styles.sharedPanelHeader}>
              <Text style={styles.sharedPanelIcon}>♻️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sharedPanelTitle, { color: C.text }]}>
                  Shared ingredients this week
                </Text>
                <Text style={[styles.sharedPanelSub, { color: C.textMuted }]}>
                  These items appear in multiple meals — buy once, use often
                </Text>
              </View>
            </View>
            <View style={styles.sharedChipRow}>
              {sharedIngredients.map(({ name, count }) => (
                <View
                  key={name}
                  style={[styles.sharedChip, { backgroundColor: C.chipBg }]}
                >
                  <Text style={[styles.sharedChipText, { color: C.primary }]}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Text>
                  <View style={[styles.sharedChipBadge, { backgroundColor: C.primary }]}>
                    <Text style={styles.sharedChipBadgeText}>×{count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Meal action confirm bar */}
      {pendingMealAction && (
        <View
          style={[styles.confirmBar, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}
        >
          <Text style={[styles.confirmTitle, { color: C.text }]}>Remove this meal?</Text>
          <Text style={[styles.confirmBody, { color: C.textSecondary }]}>
            This slot will be cleared.
          </Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity
              onPress={() => setPendingMealAction(null)}
              style={[styles.confirmCancel, { borderColor: C.cardBorder }]}
            >
              <Text style={[styles.confirmCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMealActionConfirm}
              style={[styles.confirmOk, { backgroundColor: C.dangerBg }]}
            >
              <Text style={[styles.confirmOkText, { color: C.danger }]}>Clear this day</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SwapSheet
        visible={swapSheetTarget !== null}
        onPickForMe={handleSwapPickForMe}
        onLetMeChoose={handleSwapLetMeChoose}
        onClose={() => setSwapSheetTarget(null)}
      />

      {/* Auto-plan / clear confirm bar */}
      {confirmAction && (
        <View
          style={[styles.confirmBar, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}
        >
          <Text style={[styles.confirmTitle, { color: C.text }]}>
            {confirmAction === "auto" ? "Sort the whole week?" : "Start fresh?"}
          </Text>
          <Text style={[styles.confirmBody, { color: C.textSecondary }]}>
            {confirmAction === "auto" ? "Sit back. We've got this." : "We'll clear everything."}
          </Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity
              onPress={() => setConfirmAction(null)}
              style={[styles.confirmCancel, { borderColor: C.cardBorder }]}
            >
              <Text style={[styles.confirmCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[
                styles.confirmOk,
                {
                  backgroundColor: confirmAction === "clear" ? C.dangerBg : C.gold,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmOkText,
                  { color: confirmAction === "clear" ? C.danger : "#fff" },
                ]}
              >
                {confirmAction === "auto" ? "Let's go" : "Clear week"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {toast && (
        <Toast {...toast} onAutoHide={dismissToast} onDismiss={dismissToast} />
      )}

      <MealSearchModal
        visible={modalVisible}
        day={selectedDay}
        slot={selectedSlot}
        onClose={() => setModalVisible(false)}
      />

      <RecipeDetailModal
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
      />

      {/* Quick-edit chip modal (household / budget / cost) */}
      <Modal
        visible={activeChip !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveChip(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.40)" }}
            activeOpacity={1}
            onPress={() => setActiveChip(null)}
          />
          <View
            style={[
              styles.quickEditSheet,
              {
                paddingBottom: Math.max(insets.bottom + 4, 24),
                backgroundColor: C.background,
              },
            ]}
          >
            <View style={[styles.quickEditHandle, { backgroundColor: C.border }]} />

            {activeChip === "household" && (
              <>
                <Text style={[styles.quickEditTitle, { color: C.text }]}>Household size</Text>
                <Text style={[styles.quickEditSub, { color: C.textMuted }]}>
                  How many people are you cooking for?
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: C.chipBg, borderColor: C.border },
                    ]}
                    onPress={() => {
                      const next = Math.max(1, preferences.householdSize - 1);
                      setPreferences({ ...preferences, householdSize: next });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={preferences.householdSize <= 1}
                  >
                    <Feather
                      name="minus"
                      size={22}
                      color={preferences.householdSize <= 1 ? C.textMuted : C.text}
                    />
                  </TouchableOpacity>
                  <View style={styles.stepperValueWrap}>
                    <Text style={[styles.stepperValue, { color: C.primary }]}>
                      {preferences.householdSize}
                    </Text>
                    <Text style={[styles.stepperValueLabel, { color: C.textMuted }]}>
                      {preferences.householdSize === 1 ? "person" : "people"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: C.chipBg, borderColor: C.border },
                    ]}
                    onPress={() => {
                      const next = Math.min(10, preferences.householdSize + 1);
                      setPreferences({ ...preferences, householdSize: next });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={preferences.householdSize >= 10}
                  >
                    <Feather
                      name="plus"
                      size={22}
                      color={preferences.householdSize >= 10 ? C.textMuted : C.text}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.quickEditDone, { backgroundColor: C.primary }]}
                  onPress={() => setActiveChip(null)}
                >
                  <Text style={styles.quickEditDoneText}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            {activeChip === "budget" && (
              <>
                <Text style={[styles.quickEditTitle, { color: C.text }]}>Budget level</Text>
                <Text style={[styles.quickEditSub, { color: C.textMuted }]}>
                  We'll match recipes to fit your budget.
                </Text>
                {(
                  ["super-budget", "budget", "standard", "premium"] as const
                ).map((lvl, idx, arr) => {
                  const labels: Record<string, string> = {
                    "super-budget": "Super Budget",
                    budget: "Budget",
                    standard: "Standard",
                    premium: "Premium",
                  };
                  const descs: Record<string, string> = {
                    "super-budget": "Lowest-cost meals, more pantry and batch wins",
                    budget: "Everyday value with a bit more variety",
                    standard: "Balanced meals with more flexibility",
                    premium: "More variety, nicer ingredients, less compromise",
                  };
                  const isSelected = preferences.budgetLevel === lvl;
                  return (
                    <TouchableOpacity
                      key={lvl}
                      onPress={() => {
                        const newPrefs = { ...preferences, budgetLevel: lvl };
                        setPreferences(newPrefs);
                        autoGeneratePlan(newPrefs);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setTimeout(() => {
                          setActiveChip(null);
                          showToast({ message: "Plan updated for new budget", variant: "success" });
                        }, 220);
                      }}
                      activeOpacity={0.75}
                      style={[
                        styles.budgetOptionRow,
                        {
                          borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                          borderBottomColor: C.border,
                          backgroundColor: isSelected ? C.tealTint : "transparent",
                          borderRadius: isSelected ? 12 : 0,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.budgetOptionLabel,
                            { color: isSelected ? C.primary : C.text },
                          ]}
                        >
                          {labels[lvl]}
                        </Text>
                        <Text style={[styles.budgetOptionDesc, { color: C.textMuted }]}>
                          {descs[lvl]}
                        </Text>
                      </View>
                      {isSelected && <Feather name="check" size={16} color={C.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {activeChip === "cost" && (
              <>
                <Text style={[styles.quickEditTitle, { color: C.text }]}>
                  Weekly grocery estimate
                </Text>
                <View style={[styles.costEstimatePill, { backgroundColor: C.tealTint }]}>
                  <Text style={[styles.costEstimateValue, { color: C.primary }]}>
                    {estimatedCostBand}
                  </Text>
                  <Text style={[styles.costEstimateNote, { color: C.textSecondary }]}>
                    estimated for your plan
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.costActionRow, { borderColor: C.border }]}
                  onPress={() => {
                    setActiveChip(null);
                    setTimeout(() => router.push("/money-setup"), 180);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.costActionIcon, { backgroundColor: C.tealTint }]}>
                    <Feather name="sliders" size={15} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.costActionLabel, { color: C.text }]}>
                      Update my budget figures
                    </Text>
                    <Text style={[styles.costActionDesc, { color: C.textMuted }]}>
                      Adjust income, costs & grocery spend
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={C.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.costActionRow, { borderColor: C.border }]}
                  onPress={() => {
                    setActiveChip(null);
                    setTimeout(() => router.push("/(tabs)/money"), 180);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.costActionIcon, { backgroundColor: "#FFF8EE" }]}>
                    <Feather name="bar-chart-2" size={15} color={C.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.costActionLabel, { color: C.text }]}>
                      See my money breakdown
                    </Text>
                    <Text style={[styles.costActionDesc, { color: C.textMuted }]}>
                      View savings, breathing room & goals
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={C.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Plan chip — quiet metadata chip for "Your plan" settings row ─────────────
function PlanChip({
  label,
  icon,
  range,
  onPress,
}: {
  label: string;
  icon: string;
  range?: string;
  onPress: () => void;
}) {
  const C = Colors.light;
  return (
    <TouchableOpacity
      style={[styles.planChip, { borderColor: C.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Feather name={icon as any} size={10} color={C.textMuted} />
      <Text style={[styles.planChipText, { color: C.textSecondary }]}>{label}</Text>
      {!!range && (
        <Text style={[styles.planChipRange, { color: C.textMuted }]}>· {range}</Text>
      )}
      <Feather name="chevron-down" size={9} color={C.textMuted} style={{ marginLeft: 1 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Sticky header ────────────────────────────────────────────────────────
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 2,
  },
  weekProgressLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#999",
    marginBottom: 6,
    marginTop: 2,
  },
  moneyFeedbackLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
    marginBottom: 2,
  },

  // ── Tools row (prominent navigation / action buttons) ────────────────────
  toolsScroll: { marginLeft: -2 },
  toolsRow: {
    flexDirection: "row",
    gap: 7,
    paddingRight: 6,
    paddingVertical: 2,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  toolBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 17,
  },

  // ── "Your plan" settings section (scrolls away) ──────────────────────────
  planSettingsSection: {
    gap: 6,
    marginBottom: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9E1",
  },
  planSettingsChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  planChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  planChipText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  planChipRange: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    opacity: 0.65,
  },
  prefIconBtn: {
    width: 30,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  prefBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#D6A23A",
    ...Platform.select({
      web: { boxShadow: "0px 2px 6px rgba(210,154,34,0.30)" },
      default: {
        shadowColor: "#D29A22",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  prefBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

  kidFriendlyNote: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    marginTop: 1,
  },
  headerReassurance: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "#6B4A5E",
    marginTop: 1,
  },
  swapBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8C8DA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#C49AB6",
  },
  swapBannerText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#3D1F2F",
  },

  // ── Budget mismatch ──────────────────────────────────────────────────────
  budgetMismatchBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(208,154,34,0.15)" },
      default: {
        shadowColor: "#D09A00",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  budgetMismatchTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  budgetMismatchTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    lineHeight: 19,
  },
  budgetMismatchBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  budgetMismatchCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingVertical: 11,
  },
  budgetMismatchCTAText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  // ── Planner content ──────────────────────────────────────────────────────
  content: { padding: 20, gap: 4 },
  progressBar: {
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  fridgeRescueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#E6F3F0",
    borderColor: "#2A8F8840",
  },
  fridgeRescueChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#2A8F88",
  },
  dayBlock: { gap: 8, marginBottom: 20 },
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  weekendBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  weekendBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Check-in banners ─────────────────────────────────────────────────────
  checkInBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkInBannerBody: { flex: 1, gap: 3 },
  checkInBannerTitle: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  checkInBannerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  checkInBannerClose: { padding: 2, flexShrink: 0, marginTop: 1 },
  checkInBannerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkInBannerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  checkInBannerBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 16,
  },

  // ── Confirm bars ─────────────────────────────────────────────────────────
  confirmBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  confirmTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  confirmBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  confirmBtns: { flexDirection: "row", gap: 8, marginTop: 2 },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmCancelText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  confirmOk: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmOkText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // ── Shared ingredients ───────────────────────────────────────────────────
  sharedPanel: {
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sharedPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sharedPanelIcon: { fontSize: 20, marginTop: 1 },
  sharedPanelTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  sharedPanelSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  sharedChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sharedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sharedChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  sharedChipBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  sharedChipBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },

  // ── Quick-edit bottom sheet ───────────────────────────────────────────────
  quickEditSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 14,
    ...Platform.select({
      web: { boxShadow: "0px -4px 24px rgba(0,0,0,0.13)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  quickEditHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  quickEditTitle: { fontSize: 19, fontFamily: "Inter_700Bold", marginBottom: 4 },
  quickEditSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 24,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 28,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  stepperValueWrap: { alignItems: "center", minWidth: 72 },
  stepperValue: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    lineHeight: 58,
  },
  stepperValueLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  quickEditDone: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 4,
  },
  quickEditDoneText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  budgetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 2,
  },
  budgetOptionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  budgetOptionDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  costEstimatePill: {
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
    gap: 4,
  },
  costEstimateValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  costEstimateNote: { fontSize: 12, fontFamily: "Inter_400Regular" },
  costActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  costActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  costActionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  costActionDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  // ── Easy night card ──────────────────────────────────────────────────────
  easyNightCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F8F8",
    padding: 12,
    gap: 10,
  },
  easyNightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  easyNightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#EBEBEB",
  },
  easyNightBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#999",
  },
  easyNightSwapBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  easyNightBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  easyNightIconBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  easyNightEmoji: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  easyNightInfo: {
    flex: 1,
    gap: 3,
  },
  easyNightTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#999",
  },
  easyNightSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#BBB",
  },
  easyNightNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "#2A8F88",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
});

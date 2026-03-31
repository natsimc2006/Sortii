import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentAustralianSeason, getRecipeSeasonalScore } from "@/utils/seasonUtils";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DAYS,
  DEFAULT_PREFERENCES,
  DEFAULT_WEEKEND_OVERRIDES,
  MealPlanEntry,
  MealSlot,
  PANTRY_STAPLES,
  PlanPreferences,
  RECIPES,
  Recipe,
  addIngredientsToSet,
  filterRecipes,
  ingredientOverlapScore,
  pickRecipes,
} from "@/constants/recipes";

export interface SavedPlan {
  id: string;
  createdAt: string;
  name: string;
  meals: MealPlanEntry[];
  preferences: PlanPreferences;
  estimatedCost: string;
}

interface PlannerContextType {
  preferences: PlanPreferences;
  setPreferences: (prefs: PlanPreferences) => void;
  currentPlan: MealPlanEntry[];
  setCurrentPlan: (plan: MealPlanEntry[]) => void;
  savedPlans: SavedPlan[];
  savePlan: (name?: string) => void;
  loadPlan: (plan: SavedPlan) => void;
  deletePlan: (id: string) => void;
  getRecipeById: (id: string) => Recipe | undefined;
  setMealSlot: (day: string, slot: MealSlot, recipeId: string | null) => void;
  fillRemainingSlots: () => void;
  autoGeneratePlan: (newPrefs?: PlanPreferences) => void;
  clearPlan: () => void;
  estimatedCostBand: string;
  isOnboarded: boolean;
  setIsOnboarded: (val: boolean) => void;
  preferencesDirty: boolean;
  setPreferencesDirty: (v: boolean) => void;
}

const PlannerContext = createContext<PlannerContextType | null>(null);

const STORAGE_KEYS = {
  preferences: "@mealplanner_preferences",
  savedPlans: "@mealplanner_savedplans",
  currentPlan: "@mealplanner_currentplan",
  onboarded: "@mealplanner_onboarded",
};

function buildEmptyPlan(prefs: PlanPreferences): MealPlanEntry[] {
  const entries: MealPlanEntry[] = [];
  for (const day of DAYS) {
    entries.push({ day, slot: "dinner", recipeId: null });
    if (prefs.mealCoverage === "lunch-dinner") {
      entries.push({ day, slot: "lunch", recipeId: null });
    }
  }
  return entries;
}

function estimateCost(
  plan: MealPlanEntry[],
  prefs: PlanPreferences
): string {
  const filledMeals = plan.filter((m) => m.recipeId);
  const count = filledMeals.length;
  const basePerMeal =
    prefs.budgetLevel === "super-budget"
      ? 6
      : prefs.budgetLevel === "budget"
        ? 12
        : prefs.budgetLevel === "standard"
          ? 18
          : 28;
  const total = Math.round(
    (basePerMeal * count * prefs.householdSize) /
      (prefs.leftoversMode === "cook-once" ? 1.4 : 1)
  );
  const lower = Math.round(total * 0.85);
  const upper = Math.round(total * 1.15);
  return `$${lower}–$${upper}`;
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] =
    useState<PlanPreferences>(DEFAULT_PREFERENCES);
  const [currentPlan, setCurrentPlanState] = useState<MealPlanEntry[]>(
    buildEmptyPlan(DEFAULT_PREFERENCES)
  );
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [preferencesDirty, setPreferencesDirtyState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prefStr, plansStr, planStr, onbStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.preferences),
          AsyncStorage.getItem(STORAGE_KEYS.savedPlans),
          AsyncStorage.getItem(STORAGE_KEYS.currentPlan),
          AsyncStorage.getItem(STORAGE_KEYS.onboarded),
        ]);
        if (prefStr) {
          const parsed = JSON.parse(prefStr);
          setPreferencesState({
            ...DEFAULT_PREFERENCES,
            ...parsed,
            weekendOverrides: parsed.weekendOverrides ?? { ...DEFAULT_WEEKEND_OVERRIDES },
          });
        }
        if (plansStr) setSavedPlans(JSON.parse(plansStr));
        if (planStr) setCurrentPlanState(JSON.parse(planStr));
        if (onbStr === "true") setIsOnboardedState(true);
      } catch (_) {}
    })();
  }, []);

  const setPreferences = useCallback(async (prefs: PlanPreferences) => {
    setPreferencesState(prefs);
    setPreferencesDirtyState(true);
    await AsyncStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(prefs));
  }, []);

  const setPreferencesDirty = useCallback((v: boolean) => {
    setPreferencesDirtyState(v);
  }, []);

  const setCurrentPlan = useCallback(async (plan: MealPlanEntry[]) => {
    setCurrentPlanState(plan);
    await AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(plan));
  }, []);

  const setIsOnboarded = useCallback(async (val: boolean) => {
    setIsOnboardedState(val);
    await AsyncStorage.setItem(STORAGE_KEYS.onboarded, val ? "true" : "false");
  }, []);

  const getRecipeById = useCallback(
    (id: string) => RECIPES.find((r) => r.id === id),
    []
  );

  const setMealSlot = useCallback(
    (day: string, slot: MealSlot, recipeId: string | null) => {
      setCurrentPlan(
        currentPlan.map((entry) =>
          entry.day === day && entry.slot === slot
            ? { ...entry, recipeId }
            : entry
        )
      );
    },
    [currentPlan, setCurrentPlan]
  );

  const fillRemainingSlots = useCallback(() => {
    const filledIds = currentPlan
      .filter((m) => m.recipeId)
      .map((m) => m.recipeId as string);

    const updatedPlan = currentPlan.map((entry) => {
      if (entry.recipeId) return entry;
      const pool = filterRecipes(preferences, entry.slot, entry.day);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length > 0) {
        if (preferences.leftoversMode === "none") filledIds.push(picks[0].id);
        return { ...entry, recipeId: picks[0].id };
      }
      return entry;
    });
    setCurrentPlan(updatedPlan);
  }, [currentPlan, preferences, setCurrentPlan]);

  const autoGeneratePlan = useCallback((newPrefs?: PlanPreferences) => {
    const p = newPrefs ?? preferences;
    const fresh = buildEmptyPlan(p);
    const filledIds: string[] = [];
    const selectedIngredients = new Set<string>();

    const currentSeason = p.seasonalMode ? getCurrentAustralianSeason() : null;

    const generated = fresh.map((entry) => {
      let pool = filterRecipes(p, entry.slot, entry.day);

      if (currentSeason) {
        pool = [...pool].sort((a, b) => {
          const sA = getRecipeSeasonalScore(a, currentSeason);
          const sB = getRecipeSeasonalScore(b, currentSeason);
          return sB - sA;
        });
      }

      let picked: Recipe | undefined;

      if (p.minimiseWaste && selectedIngredients.size > 0) {
        const uniquePool = pool.filter(
          (r) => p.leftoversMode === "none" ? !filledIds.includes(r.id) : true
        );
        const scored = uniquePool
          .map((r) => ({ r, score: ingredientOverlapScore(r, selectedIngredients) }))
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return Math.random() - 0.5;
          });
        picked = scored[0]?.r;
      }

      if (!picked) {
        const picks = pickRecipes(pool, 1, p.mealVariety, filledIds);
        picked = picks[0];
      }

      if (picked) {
        if (p.leftoversMode === "none") filledIds.push(picked.id);
        addIngredientsToSet(picked, selectedIngredients);
        return { ...entry, recipeId: picked.id };
      }
      return entry;
    });

    setCurrentPlan(generated);
    setPreferencesDirtyState(false);
  }, [preferences, setCurrentPlan]);

  const clearPlan = useCallback(() => {
    setCurrentPlan(buildEmptyPlan(preferences));
    setPreferencesDirtyState(false);
  }, [preferences, setCurrentPlan]);

  const savePlan = useCallback(
    async (name?: string) => {
      const newPlan: SavedPlan = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        createdAt: new Date().toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        name:
          name ||
          `Week of ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
        meals: currentPlan,
        preferences,
        estimatedCost: estimateCost(currentPlan, preferences),
      };
      const updated = [newPlan, ...savedPlans];
      setSavedPlans(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.savedPlans, JSON.stringify(updated));
    },
    [currentPlan, preferences, savedPlans]
  );

  const loadPlan = useCallback(
    (plan: SavedPlan) => {
      setCurrentPlanState(plan.meals);
      setPreferencesState(plan.preferences);
      AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(plan.meals));
      AsyncStorage.setItem(
        STORAGE_KEYS.preferences,
        JSON.stringify(plan.preferences)
      );
    },
    []
  );

  const deletePlan = useCallback(
    async (id: string) => {
      const updated = savedPlans.filter((p) => p.id !== id);
      setSavedPlans(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.savedPlans, JSON.stringify(updated));
    },
    [savedPlans]
  );

  const estimatedCostBand = estimateCost(currentPlan, preferences);

  return (
    <PlannerContext.Provider
      value={{
        preferences,
        setPreferences,
        currentPlan,
        setCurrentPlan,
        savedPlans,
        savePlan,
        loadPlan,
        deletePlan,
        getRecipeById,
        setMealSlot,
        fillRemainingSlots,
        autoGeneratePlan,
        clearPlan,
        estimatedCostBand,
        isOnboarded,
        setIsOnboarded,
        preferencesDirty,
        setPreferencesDirty,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}

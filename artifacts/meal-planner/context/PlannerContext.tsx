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
  getKidFriendlyScore,
  getRecipePrepStyles,
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
  autoSwapSlot: (day: string, slot: MealSlot) => void;
  clearPlan: () => void;
  estimatedCostBand: string;
  isOnboarded: boolean;
  isContextLoaded: boolean;
  setIsOnboarded: (val: boolean) => void;
  preferencesDirty: boolean;
  setPreferencesDirty: (v: boolean) => void;
  hiddenRecipes: string[];
  hideRecipe: (id: string) => void;
  planHasLimitedVariety: boolean;
}

const PlannerContext = createContext<PlannerContextType | null>(null);

const STORAGE_KEYS = {
  preferences: "@mealplanner_preferences",
  savedPlans: "@mealplanner_savedplans",
  currentPlan: "@mealplanner_currentplan",
  onboarded: "@mealplanner_onboarded",
  hiddenRecipes: "@mealplanner_hiddenrecipes",
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

function fallbackCostByBand(band: string): number {
  if (band === "low") return 4.50;
  if (band === "high") return 11.00;
  return 7.00;
}

function calculateWeeklyCost(
  plan: MealPlanEntry[],
  prefs: PlanPreferences
): string {
  const filledMeals = plan.filter((m) => m.recipeId);
  const totalCost = filledMeals.reduce((sum, meal) => {
    const recipe = RECIPES.find((r) => r.id === meal.recipeId);
    const costPerServe =
      recipe?.costPerServeAUD ?? fallbackCostByBand(recipe?.estimatedCostBand ?? "medium");
    return sum + costPerServe * prefs.householdSize;
  }, 0);
  const rangeLow = Math.round(totalCost * 0.92);
  const rangeHigh = Math.round(totalCost * 1.08);
  return `$${rangeLow}–$${rangeHigh}`;
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] =
    useState<PlanPreferences>(DEFAULT_PREFERENCES);
  const [currentPlan, setCurrentPlanState] = useState<MealPlanEntry[]>(
    buildEmptyPlan(DEFAULT_PREFERENCES)
  );
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [isContextLoaded, setIsContextLoaded] = useState(false);
  const [preferencesDirty, setPreferencesDirtyState] = useState(false);
  const [hiddenRecipes, setHiddenRecipes] = useState<string[]>([]);
  const [planHasLimitedVariety, setPlanHasLimitedVariety] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prefStr, plansStr, planStr, onbStr, hiddenStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.preferences),
          AsyncStorage.getItem(STORAGE_KEYS.savedPlans),
          AsyncStorage.getItem(STORAGE_KEYS.currentPlan),
          AsyncStorage.getItem(STORAGE_KEYS.onboarded),
          AsyncStorage.getItem(STORAGE_KEYS.hiddenRecipes),
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
        if (hiddenStr) setHiddenRecipes(JSON.parse(hiddenStr));
      } catch (_) {} finally {
        setIsContextLoaded(true);
      }
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
      const pool = filterRecipes(preferences, entry.slot, entry.day, hiddenRecipes);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length > 0) {
        if (preferences.leftoversMode === "none") filledIds.push(picks[0].id);
        return { ...entry, recipeId: picks[0].id };
      }
      return entry;
    });
    setCurrentPlan(updatedPlan);
  }, [currentPlan, preferences, hiddenRecipes, setCurrentPlan]);

  const autoGeneratePlan = useCallback((newPrefs?: PlanPreferences) => {
    const p = newPrefs ?? preferences;
    const fresh = buildEmptyPlan(p);
    const usedIds: string[] = [];
    const selectedIngredients = new Set<string>();
    const currentSeason = p.seasonalMode ? getCurrentAustralianSeason() : null;

    let lastProteinType: string | null = null;
    let lastCuisineType: string | null = null;
    let hadToRepeat = false;

    const scoreRecipe = (r: Recipe): number => {
      let score = 0;

      // Budget match: 25 pts
      const budget = p.budgetLevel;
      if (budget === "super-budget" && r.estimatedCostBand === "low") score += 25;
      else if (budget === "budget" && (r.estimatedCostBand === "low" || r.budgetTags.includes("budget"))) score += 25;
      else if (budget === "standard" && r.budgetTags.includes("standard")) score += 25;
      else if (budget === "premium" && r.budgetTags.includes("premium")) score += 25;
      else score += 10;

      // Cook time: 20 pts
      const effort = p.cookingEffort ?? "any";
      if (effort === "quick" && r.cookTimeMinutes <= 20) score += 20;
      else if (effort === "balanced" && r.cookTimeMinutes <= 35) score += 20;
      else if (effort === "any") score += 20;
      else if (r.cookTimeMinutes <= 35) score += 10;

      // Health style: 20 pts
      const health = p.healthStyle ?? "standard";
      if (health === "standard") score += 20;
      else if (r.healthTags.includes(health as "healthy" | "high-protein")) score += 20;
      else score += 5;

      // Cooking style: 10 pts
      const cs = p.cookingStyle ?? "mixed";
      if (cs === "mixed" || cs === "no-preference") score += 10;
      else if (r.cookingStyle === cs) score += 10;

      // Prep style: 10 pts
      const ps = p.prepStyle ?? "mixed";
      if (ps === "mixed") {
        score += 10;
      } else {
        const tags = getRecipePrepStyles(r);
        if (ps === "batch-cook" && tags.batchCook) score += 10;
        else if (ps === "quick-assembly" && tags.quickAssembly) score += 10;
        else if (ps === "family-style" && tags.familyStyle) score += 10;
        else score += 3;
      }

      // Leftovers: 8 pts
      if (p.leftoversMode === "none" || r.leftoversFriendly) score += 8;

      // Ingredient overlap: 7 pts (minimise waste mode)
      if (p.minimiseWaste && selectedIngredients.size > 0) {
        const overlap = ingredientOverlapScore(r, selectedIngredients);
        score += Math.min(7, overlap * 2);
      } else {
        score += 7;
      }

      // Seasonal bonus (up to 5 pts)
      if (currentSeason) {
        score += getRecipeSeasonalScore(r, currentSeason) * 5;
      }

      // Kid-friendly: score-2 = +10, score-1 = +3, score-0 already filtered out
      if (p.kidFriendly) {
        const kfScore = r.kidFriendlyScore ?? getKidFriendlyScore(r);
        if (kfScore === 2) score += 10;
        else if (kfScore === 1) score += 3;
      }

      return score;
    };

    const generated = fresh.map((entry) => {
      const pool = filterRecipes(p, entry.slot, entry.day, hiddenRecipes);

      // Score all candidates with small random tie-breaker for variety
      const scored = pool
        .map((r) => ({ r, score: scoreRecipe(r) + Math.random() * 3 }))
        .sort((a, b) => b.score - a.score);

      const isDinner = entry.slot === "dinner";

      // Stage 3: diversity-filtered pool (no repeat protein/cuisine on consecutive dinners)
      const diversePool = scored.filter(({ r }) => {
        if (usedIds.includes(r.id)) return false;
        if (isDinner && lastProteinType && r.proteinType === lastProteinType) return false;
        if (isDinner && lastCuisineType && r.cuisineType === lastCuisineType) return false;
        return true;
      });

      let picked: Recipe | undefined = diversePool[0]?.r;

      // Stage 4a: relax diversity — any not-yet-used
      if (!picked) {
        const noRepeat = scored.filter(({ r }) => !usedIds.includes(r.id));
        picked = noRepeat[0]?.r;
      }

      // Stage 4b: last resort — allow repeat (very small pool situations)
      if (!picked) {
        picked = scored[0]?.r;
        if (picked) hadToRepeat = true;
      }

      if (picked) {
        if (p.leftoversMode === "none") usedIds.push(picked.id);
        addIngredientsToSet(picked, selectedIngredients);
        if (isDinner) {
          lastProteinType = picked.proteinType ?? null;
          lastCuisineType = picked.cuisineType ?? null;
        }
        return { ...entry, recipeId: picked.id };
      }
      return entry;
    });

    setPlanHasLimitedVariety(hadToRepeat);
    setCurrentPlan(generated);
    setPreferencesDirtyState(false);
  }, [preferences, hiddenRecipes, setCurrentPlan]);

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
        estimatedCost: calculateWeeklyCost(currentPlan, preferences),
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

  const hideRecipe = useCallback(async (id: string) => {
    const updated = [...new Set([...hiddenRecipes, id])];
    setHiddenRecipes(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.hiddenRecipes, JSON.stringify(updated));
    setCurrentPlanState((prev) => {
      const newPlan = prev.map((entry) => {
        if (entry.recipeId !== id) return entry;
        const filledIds = prev.filter((m) => m.recipeId && m.recipeId !== id).map((m) => m.recipeId as string);
        const pool = filterRecipes(preferences, entry.slot, entry.day, updated);
        const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
        return { ...entry, recipeId: picks[0]?.id ?? null };
      });
      AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(newPlan));
      return newPlan;
    });
  }, [hiddenRecipes, preferences]);

  const autoSwapSlot = useCallback((day: string, slot: MealSlot) => {
    setCurrentPlanState((prev) => {
      const currentEntry = prev.find((e) => e.day === day && e.slot === slot);
      const currentId = currentEntry?.recipeId;
      const filledIds = prev
        .filter((m) => m.recipeId && !(m.day === day && m.slot === slot))
        .map((m) => m.recipeId as string);
      let pool = filterRecipes(preferences, slot, day, hiddenRecipes);
      if (currentId) pool = pool.filter((r) => r.id !== currentId);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length === 0) return prev;
      const newPlan = prev.map((e) =>
        e.day === day && e.slot === slot ? { ...e, recipeId: picks[0].id } : e
      );
      AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(newPlan));
      return newPlan;
    });
  }, [preferences, hiddenRecipes]);

  const estimatedCostBand = calculateWeeklyCost(currentPlan, preferences);

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
        autoSwapSlot,
        clearPlan,
        estimatedCostBand,
        isOnboarded,
        isContextLoaded,
        setIsOnboarded,
        preferencesDirty,
        setPreferencesDirty,
        hiddenRecipes,
        hideRecipe,
        planHasLimitedVariety,
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

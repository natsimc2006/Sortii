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
  Recipe,
  addIngredientsToSet,
  filterRecipes,
  getKidFriendlyScore,
  getRecipePrepStyles,
  ingredientOverlapScore,
  pickRecipes,
} from "@/constants/recipes";
import { useLocale } from "@/context/LocaleContext";
import {
  HouseholdProfile,
  DEFAULT_HOUSEHOLD_PROFILE,
  getHouseholdProfile,
  isCompatibleWithNeeds,
} from "@/utils/householdProfile";

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
  fillSingleSlot: (day: string, slot: MealSlot) => void;
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
  householdProfile: HouseholdProfile;
  reloadHouseholdProfile: () => Promise<void>;
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

function fallbackCostByBand(band: string, currSym: string): number {
  if (currSym === '£') {
    if (band === "low") return 1.20;
    if (band === "high") return 3.00;
    return 1.80;
  }
  if (band === "low") return 4.50;
  if (band === "high") return 11.00;
  return 7.00;
}

function calculateWeeklyCost(
  plan: MealPlanEntry[],
  prefs: PlanPreferences,
  recipes: Recipe[],
  currencySymbol: string
): string {
  const filledMeals = plan.filter((m) => m.recipeId);
  const totalCost = filledMeals.reduce((sum, meal) => {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    const costPerServe =
      recipe?.costPerServe ??
      fallbackCostByBand(recipe?.estimatedCostBand ?? "medium", currencySymbol);
    return sum + costPerServe * prefs.householdSize;
  }, 0);
  const rangeLow = Math.round(totalCost * 0.92);
  const rangeHigh = Math.round(totalCost * 1.08);
  return `${currencySymbol}${rangeLow}–${currencySymbol}${rangeHigh}`;
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const { appRecipes, currencySymbol } = useLocale();

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
  const [householdProfile, setHouseholdProfile] = useState<HouseholdProfile>(DEFAULT_HOUSEHOLD_PROFILE);

  const reloadHouseholdProfile = useCallback(async () => {
    const profile = await getHouseholdProfile();
    setHouseholdProfile(profile);
  }, []);

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
        const loadedProfile = await getHouseholdProfile();
        setHouseholdProfile(loadedProfile);
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
    (id: string) => appRecipes.find((r) => r.id === id),
    [appRecipes]
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
      const pool = filterRecipes(preferences, entry.slot, entry.day, hiddenRecipes, appRecipes);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length > 0) {
        if (preferences.leftoversMode === "none") filledIds.push(picks[0].id);
        return { ...entry, recipeId: picks[0].id };
      }
      return entry;
    });
    setCurrentPlan(updatedPlan);
  }, [currentPlan, preferences, hiddenRecipes, appRecipes, setCurrentPlan]);

  const fillSingleSlot = useCallback((targetDay: string, targetSlot: MealSlot) => {
    const filledIds = currentPlan
      .filter((m) => m.recipeId)
      .map((m) => m.recipeId as string);

    const updatedPlan = currentPlan.map((entry) => {
      if (entry.day !== targetDay || entry.slot !== targetSlot || entry.recipeId) return entry;
      const pool = filterRecipes(preferences, entry.slot, entry.day, hiddenRecipes, appRecipes);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length > 0) {
        return { ...entry, recipeId: picks[0].id };
      }
      return entry;
    });
    setCurrentPlan(updatedPlan);
  }, [currentPlan, preferences, hiddenRecipes, appRecipes, setCurrentPlan]);

  const autoGeneratePlan = useCallback((newPrefs?: PlanPreferences) => {
    const p = newPrefs ?? preferences;
    const fresh = buildEmptyPlan(p);
    const usedIds: string[] = [];
    const selectedIngredients = new Set<string>();
    const currentSeason = p.seasonalMode ? getCurrentAustralianSeason() : null;

    let lastProteinType: string | null = null;
    let lastCuisineType: string | null = null;
    let hadToRepeat = false;

    // Persona tracking — cap "medium-time" slots per week
    const persona = p.cookingPersona ?? "moderate";
    let personaMediumSlotsUsed = 0; // 26-40 (quick) or 46-60 (moderate) slots used

    const scoreRecipe = (r: Recipe): number => {
      let score = 0;

      // Budget match: up to 40 pts — decisive tier separation
      // Each tier strongly favours its cost band; other bands are heavily discounted.
      const budget = p.budgetLevel;
      if (budget === "super-budget") {
        if (r.estimatedCostBand === "low") score += 40;
        else if (r.estimatedCostBand === "medium") score += 4;
        // high: 0 pts — never selected for super-budget
        // Pantry/batch bonus: super-budget rewards flexibility & ingredient efficiency
        if (r.batchCook || r.leftoversFriendly) score += 8;
      } else if (budget === "budget") {
        if (r.estimatedCostBand === "low") score += 35;
        else if (r.estimatedCostBand === "medium") score += 10;
        // high: 0 pts — no high-cost meals for budget tier
        if (r.budgetTags.includes("budget") && r.estimatedCostBand !== "high") score += 4;
      } else if (budget === "standard") {
        if (r.estimatedCostBand === "medium") score += 28;
        else if (r.estimatedCostBand === "low") score += 18;
        else if (r.estimatedCostBand === "high") score += 10;
        if (r.budgetTags.includes("standard")) score += 4;
      } else if (budget === "premium") {
        if (r.estimatedCostBand === "high") score += 40;
        else if (r.estimatedCostBand === "medium") score += 16;
        // low: 0 pts — avoid low-cost meals for premium tier
        if (r.budgetTags.includes("premium")) score += 4;
      } else {
        score += 10;
      }

      // Cook time: 20 pts
      const effort = p.cookingEffort ?? "any";
      if (effort === "quick" && r.cookTimeMinutes <= 20) score += 20;
      else if (effort === "balanced" && r.cookTimeMinutes <= 35) score += 20;
      else if (effort === "any") score += 20;
      else if (r.cookTimeMinutes <= 35) score += 10;

      // Cooking persona scoring
      if (persona === "quick") {
        if (r.cookTimeMinutes <= 25) score += 18;
        else if (r.cookTimeMinutes <= 40) score += 6;
        // Prefer one-pan, batch, quick-assembly
        if (r.cookingStyle === "one-pan") score += 4;
        if (r.batchCook || r.leftoversFriendly) score += 3;
        if (r.quickAssembly) score += 3;
      } else if (persona === "moderate") {
        if (r.cookTimeMinutes <= 45) score += 18;
        else if (r.cookTimeMinutes <= 60) score += 6;
      }
      // 'cook': no persona score adjustment — full pool

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

      // Household profile — simpler kid situation leans toward kid-friendly even without hard filter
      if (householdProfile.kids_situation === "simpler" && !p.kidFriendly) {
        const kfScore = r.kidFriendlyScore ?? getKidFriendlyScore(r);
        if (kfScore === 2) score += 6;
        else if (kfScore === 1) score += 2;
      }

      return score;
    };

    // Always fill the preference-set days, but also preserve any days the user
    // has manually added meals to (via zap or manual search) beyond mealVariety.
    const mealVarietyDays = new Set(DAYS.slice(0, p.mealVariety));
    const currentlyFilledDays = new Set(
      currentPlan.filter((e) => e.recipeId != null).map((e) => e.day)
    );
    const daysToFill = new Set([...mealVarietyDays, ...currentlyFilledDays]);

    const generated = fresh.map((entry) => {
      // Leave days beyond active set as empty — user adds manually
      if (!daysToFill.has(entry.day)) return entry;

      const rawPool = filterRecipes(p, entry.slot, entry.day, hiddenRecipes, appRecipes);
      let pool = rawPool;
      if (householdProfile.dietary_needs.length > 0) {
        const dietFiltered = rawPool.filter((r) =>
          isCompatibleWithNeeds(r, householdProfile.dietary_needs)
        );
        if (dietFiltered.length >= 3) pool = dietFiltered;
      }

      // Persona hard suppression
      if (persona === "quick") {
        // Suppress cookTime > 45 entirely
        const quickFiltered = pool.filter((r) => r.cookTimeMinutes <= 45);
        if (quickFiltered.length >= 3) pool = quickFiltered;
        // If we've used up the 2 medium-time slots, restrict to <= 25
        if (personaMediumSlotsUsed >= 2) {
          const veryQuick = pool.filter((r) => r.cookTimeMinutes <= 25);
          if (veryQuick.length >= 3) pool = veryQuick;
        }
      } else if (persona === "moderate") {
        // Suppress cookTime > 75 entirely
        const moderateFiltered = pool.filter((r) => r.cookTimeMinutes <= 75);
        if (moderateFiltered.length >= 3) pool = moderateFiltered;
        // If we've used up the 2 longer slots, restrict to <= 45
        if (personaMediumSlotsUsed >= 2) {
          const capped = pool.filter((r) => r.cookTimeMinutes <= 45);
          if (capped.length >= 3) pool = capped;
        }
      }

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
        // Track medium-time slot usage for persona caps
        if (persona === "quick" && picked.cookTimeMinutes > 25 && picked.cookTimeMinutes <= 40) {
          personaMediumSlotsUsed++;
        } else if (persona === "moderate" && picked.cookTimeMinutes > 45 && picked.cookTimeMinutes <= 60) {
          personaMediumSlotsUsed++;
        }
        return { ...entry, recipeId: picked.id };
      }
      return entry;
    });

    setPlanHasLimitedVariety(hadToRepeat);
    setCurrentPlan(generated);
    setPreferencesDirtyState(false);
  }, [preferences, currentPlan, hiddenRecipes, appRecipes, setCurrentPlan, householdProfile]);

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
        estimatedCost: calculateWeeklyCost(currentPlan, preferences, appRecipes, currencySymbol),
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
        const pool = filterRecipes(preferences, entry.slot, entry.day, updated, appRecipes);
        const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
        return { ...entry, recipeId: picks[0]?.id ?? null };
      });
      AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(newPlan));
      return newPlan;
    });
  }, [hiddenRecipes, preferences, appRecipes]);

  const autoSwapSlot = useCallback((day: string, slot: MealSlot) => {
    setCurrentPlanState((prev) => {
      const currentEntry = prev.find((e) => e.day === day && e.slot === slot);
      const currentId = currentEntry?.recipeId;
      const filledIds = prev
        .filter((m) => m.recipeId && !(m.day === day && m.slot === slot))
        .map((m) => m.recipeId as string);
      let pool = filterRecipes(preferences, slot, day, hiddenRecipes, appRecipes);
      if (currentId) pool = pool.filter((r) => r.id !== currentId);
      const picks = pickRecipes(pool, 1, preferences.mealVariety, filledIds);
      if (picks.length === 0) return prev;
      const newPlan = prev.map((e) =>
        e.day === day && e.slot === slot ? { ...e, recipeId: picks[0].id } : e
      );
      AsyncStorage.setItem(STORAGE_KEYS.currentPlan, JSON.stringify(newPlan));
      return newPlan;
    });
  }, [preferences, hiddenRecipes, appRecipes]);

  const estimatedCostBand = calculateWeeklyCost(currentPlan, preferences, appRecipes, currencySymbol);

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
        fillSingleSlot,
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
        householdProfile,
        reloadHouseholdProfile,
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

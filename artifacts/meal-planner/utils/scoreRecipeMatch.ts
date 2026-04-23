import { RECIPES, PANTRY_STAPLES, Recipe } from "../constants/recipes";
import { CookWithPreference, CookWithResults, RecipeMatchResult } from "./cookWithTypes";
import { normalizeIngredient } from "./normalizeIngredients";

// Ingredients assumed always available — no penalty if missing
const ALWAYS_ASSUMED = new Set([
  "salt", "pepper", "oil", "olive oil", "vegetable oil", "cooking oil",
  "water", "butter", "garlic", "onion",
  ...PANTRY_STAPLES.map((s) => s.toLowerCase()),
]);

// Protein keywords — high value matches
const PROTEIN_KW = [
  "chicken", "beef", "mince", "pork", "egg", "eggs", "tuna",
  "bacon", "sausage", "tofu", "beans", "salmon", "prawn", "lamb",
  "turkey", "fish", "lentil",
];

// Starchy base keywords — high value matches
const BASE_KW = [
  "pasta", "rice", "noodle", "bread", "wrap", "potato",
  "couscous", "tortilla", "flatbread", "grain",
];

function isPantry(name: string): boolean {
  return (
    ALWAYS_ASSUMED.has(name) ||
    [...ALWAYS_ASSUMED].some((s) => name.includes(s) || s.includes(name))
  );
}

function isProtein(name: string): boolean {
  return PROTEIN_KW.some((k) => name.includes(k));
}

function isBase(name: string): boolean {
  return BASE_KW.some((k) => name.includes(k));
}

/** Fuzzy-match an ingredient name against the user's ingredient set. */
function userHas(ingName: string, userSet: Set<string>): boolean {
  if (userSet.has(ingName)) return true;
  // Substring match: "chicken breast" matches user "chicken", or user "chicken mince" matches recipe "mince"
  for (const u of userSet) {
    if (ingName.includes(u) || u.includes(ingName)) return true;
  }
  return false;
}

function scoreRecipe(
  recipe: Recipe,
  userSet: Set<string>,
): {
  score: number;
  matched: string[];
  missing: string[];
  missingCore: number;
  missingMinor: number;
} {
  const matched: string[] = [];
  const missing: string[] = [];
  let score = 0;
  let missingCore = 0;
  let missingMinor = 0;

  for (const ing of recipe.ingredients) {
    const name = normalizeIngredient(ing.name.toLowerCase());

    // Pantry basics are always assumed — skip scoring them
    if (isPantry(name)) continue;

    const inFridge = userHas(name, userSet);

    if (inFridge) {
      matched.push(ing.name);
      // Weight by ingredient importance
      if (isProtein(name)) score += 3.0;
      else if (isBase(name)) score += 2.5;
      else score += 1.0;
    } else if (!ing.optional) {
      missing.push(ing.name);
      if (isProtein(name) || isBase(name)) {
        // Missing a core ingredient heavily penalises the recipe
        score -= 3.0;
        missingCore++;
      } else {
        score -= 0.5;
        missingMinor++;
      }
    }
    // optional ingredients: no penalty if missing, no bonus if present (already counted above)
  }

  return { score, matched, missing, missingCore, missingMinor };
}

function preferenceBonus(recipe: Recipe, prefs: CookWithPreference[]): number {
  let bonus = 0;

  if (prefs.includes("fastest") || prefs.includes("15-min-max")) {
    const limit = prefs.includes("15-min-max") ? 15 : 20;
    if (recipe.cookTimeMinutes <= limit) bonus += 3;
    else if (recipe.cookTimeMinutes <= 25) bonus += 1;
    else bonus -= 1;
  }

  if (prefs.includes("cheapest")) {
    if (recipe.estimatedCostBand === "low") bonus += 2.5;
    else if (recipe.estimatedCostBand === "medium") bonus += 1;
    else bonus -= 1;
  }

  if (prefs.includes("kid-friendly")) {
    const kf = recipe.kidFriendly ?? (recipe.kidFriendlyScore ?? 0) >= 1;
    if (kf) bonus += 2;
  }

  if (prefs.includes("low-effort")) {
    if (recipe.difficulty === "easy") bonus += 2;
    if (recipe.cookTimeMinutes <= 25) bonus += 0.5;
  }

  if (prefs.includes("one-pan")) {
    if (recipe.cookingStyle === "one-pan") bonus += 3;
    else bonus -= 0.5;
  }

  return bonus;
}

function buildReason(
  recipe: Recipe,
  matched: string[],
  missing: string[],
): string {
  const top2 = matched.slice(0, 2).map((m) => m.toLowerCase());

  if (missing.length === 0) {
    if (top2.length >= 2) return `Good use of your ${top2[0]} and ${top2[1]}.`;
    if (top2.length === 1) return `Uses your ${top2[0]} — a solid no-shop option.`;
    return "Uses what you already have.";
  }

  const miss1 = missing[0].toLowerCase();
  if (top2.length >= 1) {
    return `Uses your ${top2[0]}${top2[1] ? ` and ${top2[1]}` : ""} — missing just ${miss1}.`;
  }
  return `Missing ${missing.slice(0, 2).map((m) => m.toLowerCase()).join(" and ")}.`;
}

export function scoreAndRankRecipes(
  allIngredients: string[],
  preferences: CookWithPreference[],
): CookWithResults {
  const userSet = new Set<string>(
    allIngredients.map((i) => normalizeIngredient(i.toLowerCase())),
  );

  const candidates: (RecipeMatchResult & { rawScore: number })[] = [];

  for (const recipe of RECIPES) {
    // Dinner rescue: only use dinner/both recipes
    if (recipe.mealType === "lunch") continue;

    const { score, matched, missing, missingCore, missingMinor } = scoreRecipe(
      recipe,
      userSet,
    );
    const bonus = preferenceBonus(recipe, preferences);
    const rawScore = score + bonus;

    // Must have at least one non-pantry ingredient match
    if (matched.length === 0) continue;

    // Classify into category:
    // make_now  → 0 missing core, ≤ 1 missing minor
    // very_close → ≤ 1 missing core OR ≤ 2 total missing (core+minor)
    let category: "make_now" | "very_close" | null = null;
    if (missingCore === 0 && missingMinor <= 1) {
      category = "make_now";
    } else if (missingCore <= 1 && missingCore + missingMinor <= 2) {
      category = "very_close";
    }

    if (!category) continue;

    const reason = buildReason(recipe, matched, missing);

    candidates.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      score: rawScore,
      rawScore,
      missingIngredients: missing,
      matchedIngredients: matched,
      category,
      cookTimeMinutes: recipe.cookTimeMinutes,
      difficulty: recipe.difficulty,
      reason,
      isOnePan: recipe.cookingStyle === "one-pan",
      isKidFriendly: !!(recipe.kidFriendly ?? (recipe.kidFriendlyScore ?? 0) >= 1),
    });
  }

  candidates.sort((a, b) => b.rawScore - a.rawScore);

  return {
    makeNow: candidates.filter((r) => r.category === "make_now").slice(0, 4),
    veryClose: candidates.filter((r) => r.category === "very_close").slice(0, 4),
    fallback: null,
  };
}

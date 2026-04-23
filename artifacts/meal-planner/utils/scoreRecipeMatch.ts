import { RECIPES, PANTRY_STAPLES, Recipe, RecipeIngredient } from "../constants/recipes";
import {
  CookWithPreference,
  CookWithResults,
  RecipeMatchResult,
  RescueMealIdea,
} from "./cookWithTypes";
import { normalizeIngredient } from "./normalizeIngredients";

// ─── TUNING CONSTANTS ──────────────────────────────────────────────────────────
// Adjust these to tighten or loosen matching without touching logic.
const READY_NOW_MAX_MISSING_MINOR    = 1;  // optional / herb ingredients that can be absent
const ALMOST_THERE_MAX_MISSING_SUPP  = 1;  // supporting (non-core) items allowed missing
const MAX_READY_NOW     = 4;
const MAX_ALMOST_THERE  = 3;
const MAX_RESCUE        = 3;
// ─────────────────────────────────────────────────────────────────────────────

// Pantry basics: always assumed present, never counted as missing
const ALWAYS_ASSUMED = new Set([
  "salt", "pepper", "oil", "olive oil", "vegetable oil", "cooking oil",
  "water", "butter",
  ...PANTRY_STAPLES.map((s) => s.toLowerCase()),
]);

// Core protein keywords
const PROTEIN_KW = [
  "chicken", "beef", "mince", "pork", "egg", "eggs", "tuna", "bacon",
  "sausage", "tofu", "salmon", "prawn", "lamb", "turkey", "fish",
  "lentil", "corned beef",
];

// Core starchy base keywords
const BASE_KW = [
  "pasta", "rice", "noodle", "bread", "wrap", "potato",
  "couscous", "tortilla", "flatbread",
];

// Key sauce / binding ingredients — fundamentally define the dish character.
// Missing one of these = the recipe is not what it claims to be.
const KEY_SAUCE_KW = [
  "tinned tomatoes", "tomato sauce", "tomato paste", "passata",
  "curry paste", "curry powder",
  "coconut milk", "coconut cream",
  "pesto",
  "teriyaki sauce", "hoisin sauce",
];

// Condiments that are skippable without ruining the dish
const SKIPPABLE_CONDIMENTS = new Set([
  "soy sauce", "lemon", "lime", "lemon juice", "lime juice",
  "mayo", "mayonnaise", "sour cream", "hot sauce", "chilli sauce",
  "spring onion", "coriander", "parsley", "chilli", "chili flakes",
  "worcestershire sauce", "sesame seeds", "sesame oil",
]);

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

function isKeySauce(name: string): boolean {
  return KEY_SAUCE_KW.some((k) => name.includes(k));
}

/** Fuzzy match: "chicken breast" in recipe matches "chicken" from user. */
function userHas(ingName: string, userSet: Set<string>): boolean {
  if (userSet.has(ingName)) return true;
  for (const u of userSet) {
    if (ingName.includes(u) || u.includes(ingName)) return true;
  }
  return false;
}

type IngClass =
  | "pantry"
  | "core_protein"
  | "core_base"
  | "core_sauce"
  | "supporting"
  | "minor";

/**
 * Classify an ingredient by how central it is to the recipe.
 * Uses the RecipeIngredient.category field, name patterns, and list position.
 *
 * Classification hierarchy:
 *   pantry      – always assumed present, never penalised
 *   minor       – optional flag or herbs category, fine to skip
 *   core_protein – recipe's protein source
 *   core_base   – main carb/starch
 *   core_sauce  – central binding sauce (tinned tomatoes, curry paste, etc.)
 *   supporting  – everything else non-optional (veg, dairy, condiments)
 */
function classifyIng(ing: RecipeIngredient, nonPantryIdx: number): IngClass {
  const name = normalizeIngredient(ing.name.toLowerCase());
  if (isPantry(name)) return "pantry";
  if (ing.optional) return "minor";
  if (ing.category === "herbs") return "minor";
  if (ing.category === "proteins" || isProtein(name)) return "core_protein";
  if (ing.category === "grains" || isBase(name)) return "core_base";
  // Key sauces in the first 5 non-pantry slots define the dish
  if (isKeySauce(name) && nonPantryIdx < 5) return "core_sauce";
  return "supporting";
}

/**
 * Score a recipe against the user's ingredient set.
 * Returns structured missing counts and a raw score.
 */
function analyseRecipe(
  recipe: Recipe,
  userSet: Set<string>,
): {
  score: number;
  matched: string[];
  missingCore: string[];         // protein, base, key sauce
  missingSupporting: string[];   // non-core required
  missingMinor: string[];        // optional / herbs
} {
  const matched: string[] = [];
  const missingCore: string[] = [];
  const missingSupporting: string[] = [];
  const missingMinor: string[] = [];
  let score = 0;
  let nonPantryIdx = 0;

  for (const ing of recipe.ingredients) {
    const name = normalizeIngredient(ing.name.toLowerCase());
    const cls = classifyIng(ing, nonPantryIdx);

    if (cls === "pantry") continue;
    nonPantryIdx++;

    const inFridge = userHas(name, userSet);

    if (inFridge) {
      matched.push(ing.name);
      if (cls === "core_protein") score += 4.0;
      else if (cls === "core_base")   score += 3.5;
      else if (cls === "core_sauce")  score += 3.0;
      else if (cls === "supporting")  score += 1.5;
      else score += 0.5; // minor
    } else {
      if (cls === "core_protein" || cls === "core_base" || cls === "core_sauce") {
        // Hard-penalise missing core — this blocks readyNow entirely
        missingCore.push(ing.name);
        score -= 5.0;
      } else if (cls === "supporting") {
        missingSupporting.push(ing.name);
        score -= 1.0;
      } else {
        missingMinor.push(ing.name);
        score -= 0.2;
      }
    }
  }

  return { score, matched, missingCore, missingSupporting, missingMinor };
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
    if (recipe.estimatedCostBand === "low")    bonus += 2.5;
    else if (recipe.estimatedCostBand === "medium") bonus += 1;
    else bonus -= 1;
  }
  if (prefs.includes("kid-friendly")) {
    if (recipe.kidFriendly ?? (recipe.kidFriendlyScore ?? 0) >= 1) bonus += 2;
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

/**
 * Build honest human-readable copy for a recipe result card.
 * reason     – why this meal works with what they have
 * missingNote – honest label for what's missing (if anything)
 */
function buildCardCopy(
  matched: string[],
  missingSupporting: string[],
  missingMinor: string[],
  category: "ready_now" | "almost_there",
): { reason: string; missingNote: string } {
  const top2 = matched.slice(0, 2).map((m) => m.toLowerCase());

  let reason = "Uses what you already have.";
  if (top2.length >= 2) reason = `Your ${top2[0]} and ${top2[1]} are the main event.`;
  else if (top2.length === 1) reason = `Your ${top2[0]} carries this meal.`;

  let missingNote = "";
  if (category === "almost_there" && missingSupporting.length > 0) {
    const item = missingSupporting[0].toLowerCase();
    // Is it realistically skippable?
    missingNote = SKIPPABLE_CONDIMENTS.has(item)
      ? `Works best with: ${item}`
      : `Needs: ${item}`;
  } else if (missingMinor.length > 0) {
    missingNote = `Optional: ${missingMinor[0].toLowerCase()}`;
  }

  return { reason, missingNote };
}

// ─── RESCUE MEAL PATTERNS ─────────────────────────────────────────────────────
// Pattern-based make-do meals for when recipe matches are thin or when the user
// just needs practical suggestions from what they have.

interface RescuePattern {
  id: string;
  title: string;
  requires: string[];     // ALL must be present (fuzzy matched)
  optional: string[];     // scored as bonuses
  reason: (matched: string[]) => string;
  steps: string[];
  cookTime: string;
  effort: string;
}

const RESCUE_PATTERNS: RescuePattern[] = [
  {
    id: "egg-fried-rice",
    title: "Egg fried rice",
    requires: ["eggs", "rice"],
    optional: ["mixed veg", "peas", "corn", "soy sauce", "onion", "carrots", "broccoli"],
    reason: (m) => `Your ${m.slice(0, 2).join(" and ")} — classic no-shop dinner.`,
    steps: [
      "Cook rice (or use leftover). Beat eggs.",
      "Fry eggs in hot oil, breaking up as they cook. Add rice and any veg.",
      "Stir-fry 3–4 mins. Season with soy sauce or salt.",
    ],
    cookTime: "15 mins",
    effort: "very easy",
  },
  {
    id: "chicken-fried-rice",
    title: "Chicken fried rice",
    requires: ["chicken", "rice"],
    optional: ["eggs", "mixed veg", "peas", "soy sauce", "onion"],
    reason: (m) => `Your ${m[0]} and rice are the whole meal.`,
    steps: [
      "Cook and shred or dice chicken. Cook rice if not already done.",
      "Stir-fry chicken and rice together. Add any veg.",
      "Season with soy sauce or salt. Done in 20 mins.",
    ],
    cookTime: "20 mins",
    effort: "easy",
  },
  {
    id: "quesadillas",
    title: "Quick quesadillas",
    requires: ["wraps"],
    optional: ["cheese", "beans", "corn", "capsicum", "chicken", "tuna", "onion"],
    reason: () => "Wraps + whatever's around = 10-minute dinner.",
    steps: [
      "Fill wraps with cheese and any fillings you have.",
      "Toast in a dry pan 2–3 mins each side until golden.",
      "Slice and serve.",
    ],
    cookTime: "10 mins",
    effort: "very easy",
  },
  {
    id: "cheesy-pasta",
    title: "Cheesy pasta",
    requires: ["pasta"],
    optional: ["cheese", "cream", "bacon", "peas", "butter", "mixed veg"],
    reason: () => "Pasta + cheese + whatever else = dinner sorted.",
    steps: [
      "Cook pasta. Save a cup of pasta water before draining.",
      "Mix through cheese, butter, and any extras.",
      "Add pasta water to loosen. Season well.",
    ],
    cookTime: "15 mins",
    effort: "very easy",
  },
  {
    id: "tuna-melt",
    title: "Tuna melts",
    requires: ["bread", "tuna"],
    optional: ["cheese", "mayo", "lemon", "onion"],
    reason: () => "Your tuna and bread is the whole plan.",
    steps: [
      "Mix tuna with mayo, seasoning, and any extras.",
      "Pile onto bread. Top with cheese if you have it.",
      "Grill or toast until golden.",
    ],
    cookTime: "10 mins",
    effort: "very easy",
  },
  {
    id: "egg-wraps",
    title: "Cheesy egg wraps",
    requires: ["eggs", "wraps"],
    optional: ["cheese", "spinach", "onion", "capsicum", "beans"],
    reason: () => "Eggs and wraps — 10-minute dinner sorted.",
    steps: [
      "Scramble eggs with seasoning.",
      "Warm wraps. Load with eggs, cheese, and any veg.",
      "Wrap and eat.",
    ],
    cookTime: "10 mins",
    effort: "very easy",
  },
  {
    id: "loaded-potatoes",
    title: "Loaded potatoes",
    requires: ["potatoes"],
    optional: ["cheese", "beans", "bacon", "cream", "onion", "mixed veg"],
    reason: () => "Your potatoes carry the whole meal.",
    steps: [
      "Microwave or bake potatoes until soft.",
      "Split and load with cheese, beans, or whatever you have.",
      "Optional: grill briefly to melt the cheese.",
    ],
    cookTime: "20–45 mins",
    effort: "easy",
  },
  {
    id: "pantry-noodle-bowl",
    title: "Pantry noodle bowl",
    requires: ["noodles"],
    optional: ["mixed veg", "eggs", "soy sauce", "peas", "corn", "broccoli", "chicken"],
    reason: () => "Noodles + veg + seasoning = quick satisfying bowl.",
    steps: [
      "Cook noodles. Fry any veg in a hot pan.",
      "Crack in an egg and scramble through if you have one.",
      "Toss everything together. Season with soy sauce or salt.",
    ],
    cookTime: "12 mins",
    effort: "very easy",
  },
  {
    id: "beans-on-toast",
    title: "Beans on toast (done properly)",
    requires: ["bread", "beans"],
    optional: ["cheese", "eggs", "bacon", "butter"],
    reason: () => "Classic for a reason — good done properly.",
    steps: [
      "Heat beans gently. Toast bread.",
      "Pile beans onto toast.",
      "Optional: top with cheese or a fried egg.",
    ],
    cookTime: "8 mins",
    effort: "very easy",
  },
  {
    id: "rice-beans",
    title: "Rice and beans",
    requires: ["rice", "beans"],
    optional: ["onion", "tinned tomatoes", "corn", "cheese", "mixed veg"],
    reason: () => "Rice and beans is a complete meal with what you have.",
    steps: [
      "Cook rice. Heat beans in a pan with seasoning.",
      "Mix together. Add any extras.",
      "Serve as is or with cheese on top.",
    ],
    cookTime: "20 mins",
    effort: "very easy",
  },
  {
    id: "corned-beef-hash",
    title: "Corned beef hash",
    requires: ["corned beef", "potatoes"],
    optional: ["onion", "eggs", "mixed veg"],
    reason: (m) => `Your ${m[0]} and potatoes — a proper no-fuss meal.`,
    steps: [
      "Dice and par-boil or microwave potatoes. Dice corned beef.",
      "Fry together in oil with onion until crispy.",
      "Optional: top with a fried egg.",
    ],
    cookTime: "20 mins",
    effort: "easy",
  },
  {
    id: "rice-and-canned",
    title: "Rice with tinned protein",
    requires: ["rice", "tuna"],
    optional: ["mixed veg", "peas", "corn", "soy sauce", "mayo"],
    reason: () => "Your tuna and rice — simple, filling, no-shop.",
    steps: [
      "Cook rice. Drain tuna.",
      "Mix through rice with any veg and seasoning.",
      "Serve warm or as a rice bowl.",
    ],
    cookTime: "15 mins",
    effort: "very easy",
  },
];

/**
 * Match rescue patterns against user's ingredients.
 * Scored by how many optional ingredients the user also has.
 */
function matchRescuePatterns(
  userSet: Set<string>,
  prefs: CookWithPreference[],
  limit: number,
): RescueMealIdea[] {
  const results: (RescueMealIdea & { score: number })[] = [];

  for (const p of RESCUE_PATTERNS) {
    const allRequiredPresent = p.requires.every((req) => userHas(req, userSet));
    if (!allRequiredPresent) continue;

    const optionalMatched = p.optional.filter((opt) => userHas(opt, userSet));
    let score = optionalMatched.length;

    // Preference bonuses
    if (prefs.includes("fastest") || prefs.includes("15-min-max")) {
      const mins = parseInt(p.cookTime.replace(/[^0-9].*/, ""), 10) || 30;
      if (mins <= 15) score += 2;
      else if (mins <= 20) score += 1;
    }
    if (prefs.includes("low-effort") && p.effort === "very easy") score += 1;
    if (prefs.includes("kid-friendly")) score += 0.5;

    const allMatched = [...p.requires, ...optionalMatched];
    results.push({
      id: p.id,
      title: p.title,
      reason: p.reason(allMatched),
      steps: p.steps,
      cookTime: p.cookTime,
      effort: p.effort,
      matchedIngredients: allMatched,
      score,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function scoreAndRankRecipes(
  allIngredients: string[],
  preferences: CookWithPreference[],
): CookWithResults {
  const userSet = new Set<string>(
    allIngredients.map((i) => normalizeIngredient(i.toLowerCase())),
  );

  const readyNowCandidates:   (RecipeMatchResult & { rawScore: number })[] = [];
  const almostThereCandidates:(RecipeMatchResult & { rawScore: number })[] = [];

  for (const recipe of RECIPES) {
    if (recipe.mealType === "lunch") continue;

    const { score, matched, missingCore, missingSupporting, missingMinor } =
      analyseRecipe(recipe, userSet);

    // Must match at least one non-pantry ingredient
    if (matched.length === 0) continue;

    const bonus    = preferenceBonus(recipe, preferences);
    const rawScore = score + bonus;

    // ── HARD EXCLUSION RULE ────────────────────────────────────────────────
    // Any missing core ingredient (protein, base, key sauce) = BLOCKED from
    // readyNow AND almostThere. The recipe is fundamentally not makeable.
    const blockedFully = missingCore.length > 0;

    // ── READY NOW ─────────────────────────────────────────────────────────
    // All core present, all supporting present, ≤READY_NOW_MAX_MISSING_MINOR
    // optional/herb ingredients allowed absent.
    if (
      !blockedFully &&
      missingSupporting.length === 0 &&
      missingMinor.length <= READY_NOW_MAX_MISSING_MINOR
    ) {
      const { reason, missingNote } = buildCardCopy(
        matched, missingSupporting, missingMinor, "ready_now",
      );
      readyNowCandidates.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        score: rawScore,
        rawScore,
        missingIngredients: [...missingSupporting, ...missingMinor],
        matchedIngredients: matched,
        category: "ready_now",
        cookTimeMinutes: recipe.cookTimeMinutes,
        difficulty: recipe.difficulty,
        reason,
        missingNote,
        isOnePan: recipe.cookingStyle === "one-pan",
        isKidFriendly: !!(recipe.kidFriendly ?? (recipe.kidFriendlyScore ?? 0) >= 1),
      });
      continue; // don't also add to almostThere
    }

    // ── ALMOST THERE ──────────────────────────────────────────────────────
    // All core present, exactly ALMOST_THERE_MAX_MISSING_SUPP supporting item
    // missing, ≤1 minor missing.
    if (
      !blockedFully &&
      missingSupporting.length <= ALMOST_THERE_MAX_MISSING_SUPP &&
      missingMinor.length <= 1
    ) {
      const { reason, missingNote } = buildCardCopy(
        matched, missingSupporting, missingMinor, "almost_there",
      );
      almostThereCandidates.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        score: rawScore,
        rawScore,
        missingIngredients: [...missingSupporting, ...missingMinor],
        matchedIngredients: matched,
        category: "almost_there",
        cookTimeMinutes: recipe.cookTimeMinutes,
        difficulty: recipe.difficulty,
        reason,
        missingNote,
        isOnePan: recipe.cookingStyle === "one-pan",
        isKidFriendly: !!(recipe.kidFriendly ?? (recipe.kidFriendlyScore ?? 0) >= 1),
      });
    }
  }

  readyNowCandidates.sort((a, b)    => b.rawScore - a.rawScore);
  almostThereCandidates.sort((a, b) => b.rawScore - a.rawScore);

  const readyNow    = readyNowCandidates.slice(0, MAX_READY_NOW);
  const almostThere = almostThereCandidates.slice(0, MAX_ALMOST_THERE);
  const rescue      = matchRescuePatterns(userSet, preferences, MAX_RESCUE);

  return { readyNow, almostThere, rescue, fallback: null };
}

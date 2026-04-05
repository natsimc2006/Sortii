import RECIPES_DATA from "../data/recipes.json";
import { getKidFriendlyScore } from "./kidFriendlyRules";
export { getKidFriendlyScore };

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  category:
    | "vegetables"
    | "proteins"
    | "dairy"
    | "pantry"
    | "herbs"
    | "frozen"
    | "grains"
    | "fruit"
    | "condiments";
  optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  baseServings: number;
  cookTimeMinutes: number;
  difficulty: "easy" | "moderate";
  cookingStyle: "mixed" | "one-pan" | "air-fryer";
  healthTags: ("standard" | "healthy" | "high-protein")[];
  budgetTags: ("budget" | "standard" | "premium")[];
  leftoversFriendly: boolean;
  mealType: "dinner" | "lunch" | "both";
  ingredients: RecipeIngredient[];
  instructions: string[];
  estimatedCostBand: "low" | "medium" | "high";
  costPerServeAUD?: number;
  costPerServeGBP?: number;
  costPerServe?: number;
  currency?: string;
  currencySymbol?: string;
  locale?: string[];
  batchCook?: boolean;
  quickAssembly?: boolean;
  familyStyle?: boolean;
  kidFriendly?: boolean;
  proteinType?: "chicken" | "beef" | "pork" | "seafood" | "eggs" | "legumes" | "lamb" | "poultry" | "none";
  cuisineType?: "australian" | "italian" | "asian" | "mexican" | "mediterranean" | "indian" | "middle-eastern" | "american" | "other";
  seasonTags?: string[];
  imageUrl?: string;
  kidFriendlyScore?: 0 | 1 | 2;
  kidFriendlyReason?: string;
  source?: string;
}

export const RECIPES: Recipe[] = RECIPES_DATA as unknown as Recipe[];

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKEND_DAYS = ["Saturday", "Sunday"];

export type MealSlot = "lunch" | "dinner";

export interface MealPlanEntry {
  day: string;
  slot: MealSlot;
  recipeId: string | null;
}

export interface WeekendOverrides {
  enabled: boolean;
  cookingEffort: "quick" | "balanced" | "any";
  budgetLevel: "super-budget" | "budget" | "standard" | "premium";
}

export interface PlanPreferences {
  planningMode: "manual" | "mixed" | "auto";
  householdSize: number;
  budgetLevel: "super-budget" | "budget" | "standard" | "premium";
  healthStyle: "standard" | "healthy" | "high-protein" | "low-carb" | "family-friendly";
  cookingEffort: "quick" | "balanced" | "any";
  leftoversMode: "none" | "cook-once";
  mealVariety: 3 | 5 | 7;
  cookingStyle: "mixed" | "one-pan" | "air-fryer" | "oven-based" | "no-preference";
  cuisinePreference: "mixed" | "italian" | "asian" | "mexican" | "aussie";
  exclusions: string[];
  mealCoverage: "dinner-only" | "lunch-dinner";
  weekendOverrides: WeekendOverrides;
  prepStyle: "mixed" | "batch-cook" | "quick-assembly" | "family-style";
  minimiseWaste: boolean;
  seasonalMode: boolean;
  dietType: "no-preference" | "omnivore" | "vegetarian" | "vegan" | "pescatarian";
  kidFriendly: boolean;
}

export const DEFAULT_WEEKEND_OVERRIDES: WeekendOverrides = {
  enabled: false,
  cookingEffort: "any",
  budgetLevel: "standard",
};

export const DEFAULT_PREFERENCES: PlanPreferences = {
  planningMode: "auto",
  householdSize: 4,
  budgetLevel: "standard",
  healthStyle: "standard",
  cookingEffort: "any",
  leftoversMode: "none",
  mealVariety: 5,
  cookingStyle: "mixed",
  cuisinePreference: "mixed",
  exclusions: [],
  mealCoverage: "dinner-only",
  weekendOverrides: { ...DEFAULT_WEEKEND_OVERRIDES },
  prepStyle: "mixed",
  minimiseWaste: false,
  seasonalMode: false,
  dietType: "no-preference",
  kidFriendly: false,
};

export function getApproxCostPerServe(recipe: Recipe): number {
  switch (recipe.estimatedCostBand) {
    case "low": return 3.50;
    case "medium": return 7.00;
    case "high": return 12.00;
    default: return 7.00;
  }
}

export const EXCLUSION_OPTIONS = [
  "Chicken",
  "Pork",
  "Beef",
  "Lamb",
  "Seafood",
  "Dairy",
  "Gluten",
  "Eggs",
  "Nuts",
];

export const PANTRY_STAPLES = [
  "salt", "pepper", "olive oil", "vegetable oil", "oil", "garlic",
  "onion", "butter", "water", "sugar", "flour", "cumin", "paprika",
  "oregano", "thyme", "coriander", "chilli", "bay leaf", "mixed herbs",
  "dried herbs", "seasoning", "stock cube", "chicken stock", "vegetable stock",
  "beef stock", "vinegar", "soy sauce", "sesame oil",
];

export function getRecipePrepStyles(r: Recipe): {
  batchCook: boolean;
  quickAssembly: boolean;
  familyStyle: boolean;
} {
  const name = r.name.toLowerCase();
  const batchCook =
    r.batchCook ??
    (r.leftoversFriendly &&
      r.cookTimeMinutes >= 25 &&
      /curry|stew|casserole|soup|bake|bolognese|chilli|dahl|rogan|risotto|cannelloni|pie|slow/.test(name));

  const quickAssembly =
    r.quickAssembly ??
    (r.cookTimeMinutes <= 20 ||
      /salad|bowl|wrap|quesadilla|taco|fritter|omelette|noodle|fried rice|satay noodle/.test(name));

  const familyStyle =
    r.familyStyle ??
    (r.difficulty === "easy" &&
      r.estimatedCostBand !== "high" &&
      /bolognese|schnitzel|pasta|chicken|taco|fish and chip|sausage|soup|bake|roast|lasagna|mac|pie|burger|pizza|fried rice|nugget|meatball/.test(name));

  return { batchCook, quickAssembly, familyStyle };
}

export function getPrepStyleLabel(r: Recipe): string | null {
  const { batchCook, quickAssembly, familyStyle } = getRecipePrepStyles(r);
  if (batchCook) return "Batch";
  if (quickAssembly) return "Quick";
  if (familyStyle) return "Family";
  return null;
}

export function ingredientOverlapScore(
  candidate: Recipe,
  selectedIngredients: Set<string>
): number {
  let score = 0;
  for (const ing of candidate.ingredients) {
    const name = ing.name.toLowerCase();
    const isStaple = PANTRY_STAPLES.some((s) => name.includes(s));
    if (!isStaple && selectedIngredients.has(name)) score++;
  }
  return score;
}

export function addIngredientsToSet(recipe: Recipe, set: Set<string>): void {
  for (const ing of recipe.ingredients) {
    const name = ing.name.toLowerCase();
    const isStaple = PANTRY_STAPLES.some((s) => name.includes(s));
    if (!isStaple) set.add(name);
  }
}

const MEAT_KEYWORDS = [
  "beef", "lamb", "pork", "chicken", "turkey", "duck", "bacon", "ham",
  "salami", "prosciutto", "chorizo", "sausage", "steak", "veal", "mince", "meat",
];
const SEAFOOD_KEYWORDS = [
  "fish", "salmon", "tuna", "prawn", "shrimp", "scallop", "crab",
  "lobster", "barramundi", "cod", "trout", "anchovy", "sardine", "squid", "seafood", "mussel",
];
const DAIRY_EGG_KEYWORDS = [
  "milk", "cream", "cheese", "butter", "yogurt", "yoghurt", "sour cream",
  "ricotta", "parmesan", "mozzarella", "cheddar", "feta", "halloumi", "egg",
];

function hasIngredientKeyword(ingredients: RecipeIngredient[], keywords: string[]): boolean {
  return ingredients.some((ing) => {
    const name = ing.name.toLowerCase();
    return keywords.some((kw) => {
      if (kw === "egg" && name.includes("eggplant")) return false;
      if (kw === "butter" && /peanut|almond|cashew/.test(name)) return false;
      return name.includes(kw);
    });
  });
}

function dietTypeOk(r: Recipe, dietType: string): boolean {
  if (!dietType || dietType === "omnivore" || dietType === "no-preference") return true;
  const hasMeat = hasIngredientKeyword(r.ingredients, MEAT_KEYWORDS);
  const hasSeafood = hasIngredientKeyword(r.ingredients, SEAFOOD_KEYWORDS);
  if (dietType === "pescatarian") return !hasMeat;
  if (dietType === "vegetarian") return !hasMeat && !hasSeafood;
  if (dietType === "vegan") {
    const hasDairyEgg = hasIngredientKeyword(r.ingredients, DAIRY_EGG_KEYWORDS);
    return !hasMeat && !hasSeafood && !hasDairyEgg;
  }
  return true;
}


const HIGH_CARB_INGREDIENTS = [
  "pasta", "spaghetti", "noodle", "rice", "bread", "tortilla",
  "naan", "couscous", "flatbread", "taco shell", "pita", "hokkien",
];

function matchesCuisine(r: Recipe, cuisine: string): boolean {
  if (cuisine === "mixed") return true;
  const text = (r.name + " " + r.description).toLowerCase();
  switch (cuisine) {
    case "italian":
      return /pasta|risotto|gnocchi|arrabbiata|bolognese|cannelloni|carbonara|pesto|lasagna/.test(text);
    case "asian":
      return /stir.fry|noodle|fried rice|teriyaki|pad |laksa|mee |thai|korean|japanese|satay|ramen|sushi|dumpling|wok|aglio|asian|szechuan|prawn.*soy/.test(text);
    case "mexican":
      return /taco|burrito|quesadilla|nachos|fajita|enchilada|mexican|jalape/.test(text);
    case "aussie":
      return /schnitzel|barramundi|fish.and.chip|fish & chip|sausage.*bake|tray bake.*sausage|schnitzel|pie|fish chip|aussie/.test(text);
    default:
      return true;
  }
}

function isOvenBased(r: Recipe): boolean {
  return r.instructions.some((s) => /oven|bak|roast|preheat/.test(s.toLowerCase()));
}

function isLowCarb(r: Recipe): boolean {
  return !r.ingredients.some(
    (i) => !i.optional && HIGH_CARB_INGREDIENTS.some((hc) => i.name.toLowerCase().includes(hc))
  );
}

function cookingEffortOk(r: Recipe, effort: "quick" | "balanced" | "any"): boolean {
  if (effort === "quick") return r.cookTimeMinutes <= 20 && r.difficulty === "easy";
  if (effort === "balanced") return r.cookTimeMinutes <= 35;
  return true;
}

function cookingStyleOk(r: Recipe, style: string): boolean {
  if (style === "mixed" || style === "no-preference") return true;
  if (style === "oven-based") return isOvenBased(r);
  return r.cookingStyle === style;
}

export function filterRecipes(
  prefs: PlanPreferences,
  mealType: MealSlot = "dinner",
  dayName?: string,
  hiddenIds?: string[],
  pool?: Recipe[]
): Recipe[] {
  const isWeekend = dayName ? WEEKEND_DAYS.includes(dayName) : false;
  const overrides = prefs.weekendOverrides ?? DEFAULT_WEEKEND_OVERRIDES;
  const effectiveEffort: "quick" | "balanced" | "any" =
    isWeekend && overrides.enabled ? (overrides.cookingEffort ?? "any") : (prefs.cookingEffort ?? "any");
  const effectiveBudget =
    isWeekend && overrides.enabled ? overrides.budgetLevel : prefs.budgetLevel;
  const cuisine = prefs.cuisinePreference ?? "mixed";
  const lowerExclusions = (prefs.exclusions ?? []).map((e) => e.toLowerCase());
  const diet = prefs.dietType ?? "no-preference";

  const mealTypeOk = (r: Recipe) => {
    if (mealType === "lunch" && r.mealType === "dinner") return false;
    if (mealType === "dinner" && r.mealType === "lunch") return false;
    return true;
  };

  const exclusionOk = (r: Recipe) => {
    for (const excl of lowerExclusions) {
      if (r.name.toLowerCase().includes(excl)) return false;
      for (const ing of r.ingredients) {
        if (ing.name.toLowerCase().includes(excl)) return false;
      }
    }
    return true;
  };

  const healthOk = (r: Recipe) => {
    const hs = prefs.healthStyle ?? "standard";
    if (hs === "standard") return true;
    if (hs === "low-carb") return isLowCarb(r);
    if (hs === "family-friendly") return r.difficulty === "easy";
    return r.healthTags.includes(hs as "healthy" | "high-protein");
  };

  const prepStyleOk = (r: Recipe) => {
    const ps = prefs.prepStyle ?? "mixed";
    if (ps === "mixed") return true;
    const tags = getRecipePrepStyles(r);
    if (ps === "batch-cook") return tags.batchCook;
    if (ps === "quick-assembly") return tags.quickAssembly;
    if (ps === "family-style") return tags.familyStyle;
    return true;
  };

  const isHidden = (r: Recipe) => !!(hiddenIds && hiddenIds.includes(r.id));

  const kidActive = !!(prefs.kidFriendly);
  const kidOk = (r: Recipe) => {
    if (!kidActive) return true;
    const score = r.kidFriendlyScore ?? getKidFriendlyScore(r);
    return score !== 0;
  };

  const sortKidFriendly = (pool: Recipe[]): Recipe[] => {
    if (!kidActive) return pool;
    return [...pool].sort((a, b) => {
      const sa = a.kidFriendlyScore ?? getKidFriendlyScore(a);
      const sb = b.kidFriendlyScore ?? getKidFriendlyScore(b);
      return sb - sa;
    });
  };

  const recipePool = pool ?? RECIPES;

  const full = recipePool.filter((r) => {
    if (isHidden(r)) return false;
    if (!mealTypeOk(r)) return false;
    if (!cookingEffortOk(r, effectiveEffort)) return false;
    if (!cookingStyleOk(r, prefs.cookingStyle ?? "mixed")) return false;
    if (!healthOk(r)) return false;
    if (!matchesCuisine(r, cuisine)) return false;
    if (!prepStyleOk(r)) return false;
    if (!dietTypeOk(r, diet)) return false;
    if (effectiveBudget === "super-budget" && r.estimatedCostBand !== "low") return false;
    if (effectiveBudget === "budget" && !r.budgetTags.includes("budget")) return false;
    if (prefs.leftoversMode === "cook-once" && !r.leftoversFriendly) return false;
    if (!exclusionOk(r)) return false;
    if (!kidOk(r)) return false;
    return true;
  });
  if (full.length >= 3) return sortKidFriendly(full);

  const relaxed = recipePool.filter((r) => {
    if (isHidden(r)) return false;
    if (!mealTypeOk(r)) return false;
    if (!cookingStyleOk(r, prefs.cookingStyle ?? "mixed")) return false;
    if (!healthOk(r)) return false;
    if (!matchesCuisine(r, cuisine)) return false;
    if (!dietTypeOk(r, diet)) return false;
    if (effectiveBudget === "super-budget" && r.estimatedCostBand !== "low") return false;
    if (effectiveBudget === "budget" && !r.budgetTags.includes("budget")) return false;
    if (prefs.leftoversMode === "cook-once" && !r.leftoversFriendly) return false;
    if (!exclusionOk(r)) return false;
    if (!kidOk(r)) return false;
    return true;
  });
  if (relaxed.length >= 3) return sortKidFriendly(relaxed);

  const minimal = recipePool.filter((r) => !isHidden(r) && mealTypeOk(r) && dietTypeOk(r, diet) && exclusionOk(r) && kidOk(r));
  if (minimal.length > 0) return sortKidFriendly(minimal);
  const fallback = recipePool.filter((r) => !isHidden(r) && mealTypeOk(r) && kidOk(r));
  return sortKidFriendly(fallback.length > 0 ? fallback : recipePool.filter((r) => !isHidden(r) && mealTypeOk(r)));
}

export function pickRecipes(
  pool: Recipe[],
  count: number,
  variety: number,
  existing: string[]
): Recipe[] {
  const uniquePool = pool.filter((r) => !existing.includes(r.id));
  const shuffled = [...uniquePool].sort(() => Math.random() - 0.5);
  const uniqueIds = new Set<string>();
  const result: Recipe[] = [];
  const repeatable = pool.filter((r) => r.leftoversFriendly);

  for (const r of shuffled) {
    if (result.length >= count) break;
    if (uniqueIds.size < variety) {
      uniqueIds.add(r.id);
      result.push(r);
    }
  }
  while (result.length < count) {
    const pick =
      repeatable[Math.floor(Math.random() * repeatable.length)] ||
      pool[Math.floor(Math.random() * pool.length)];
    if (pick) result.push(pick);
    else break;
  }
  return result;
}

export function scaleQuantity(
  baseQty: number,
  baseServings: number,
  targetServings: number
): number {
  const scaled = (targetServings / baseServings) * baseQty;
  if (scaled < 1) return Math.round(scaled * 10) / 10;
  if (scaled < 10) return Math.round(scaled * 2) / 2;
  return Math.round(scaled);
}

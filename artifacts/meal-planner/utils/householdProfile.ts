import AsyncStorage from "@react-native-async-storage/async-storage";

export type DietaryNeed = "vegan" | "vegetarian" | "gluten-free" | "dairy-free";
export type KidSituation = "same" | "simpler" | "separate";

export interface HouseholdProfile {
  dietary_needs: DietaryNeed[];
  kids_situation: KidSituation;
  setup_complete: boolean;
  setup_date: string | null;
}

export const HOUSEHOLD_PROFILE_KEY = "sortii_household_profile";

export const DEFAULT_HOUSEHOLD_PROFILE: HouseholdProfile = {
  dietary_needs: [],
  kids_situation: "same",
  setup_complete: false,
  setup_date: null,
};

export async function getHouseholdProfile(): Promise<HouseholdProfile> {
  try {
    const raw = await AsyncStorage.getItem(HOUSEHOLD_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_HOUSEHOLD_PROFILE };
    return { ...DEFAULT_HOUSEHOLD_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_HOUSEHOLD_PROFILE };
  }
}

export async function saveHouseholdProfile(profile: HouseholdProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(HOUSEHOLD_PROFILE_KEY, JSON.stringify(profile));
  } catch {
  }
}

// ── Ingredient keyword inference ────────────────────────────────────────────

const MEAT_KW = [
  "beef", "lamb", "pork", "chicken", "turkey", "duck", "bacon", "ham",
  "salami", "prosciutto", "chorizo", "sausage", "steak", "veal", "mince",
];
const SEAFOOD_KW = [
  "fish", "salmon", "tuna", "prawn", "shrimp", "scallop", "crab", "lobster",
  "barramundi", "cod", "trout", "anchovy", "sardine", "squid", "seafood", "mussel",
];
const DAIRY_KW = [
  "milk", "cream", "cheese", "butter", "yogurt", "yoghurt", "sour cream",
  "ricotta", "parmesan", "mozzarella", "cheddar", "feta", "halloumi", "brie",
];
const DAIRY_EGG_KW = [...DAIRY_KW, "egg"];
const GLUTEN_KW = [
  "flour", "pasta", "spaghetti", "penne", "fettuccine", "linguine",
  "bread", "breadcrumb", "panko", "soy sauce", "barley", "rye", "wheat",
  "tortilla", "wrap", "couscous", "noodle",
];

function nameOf(ing: any): string {
  return (ing?.name || ing?.ingredientLabel || "").toLowerCase();
}

function hasKw(ingredients: any[], keywords: string[]): boolean {
  return ingredients.some((ing) => {
    const n = nameOf(ing);
    return keywords.some((kw) => {
      if (kw === "egg" && n.includes("eggplant")) return false;
      if (kw === "butter" && /peanut|almond|cashew/.test(n)) return false;
      return n.includes(kw);
    });
  });
}

function getIngs(recipe: any): any[] {
  return recipe?.ingredients ?? recipe?.ingredientRows ?? [];
}

export function recipeIsVegan(recipe: any): boolean {
  const ings = getIngs(recipe);
  return !hasKw(ings, MEAT_KW) && !hasKw(ings, SEAFOOD_KW) && !hasKw(ings, DAIRY_EGG_KW);
}

export function recipeIsVegetarian(recipe: any): boolean {
  const ings = getIngs(recipe);
  return !hasKw(ings, MEAT_KW) && !hasKw(ings, SEAFOOD_KW);
}

export function recipeIsGlutenFree(recipe: any): boolean {
  const ings = getIngs(recipe);
  return !hasKw(ings, GLUTEN_KW);
}

export function recipeIsDairyFree(recipe: any): boolean {
  const ings = getIngs(recipe);
  return !hasKw(ings, DAIRY_KW);
}

export function isCompatibleWithNeeds(recipe: any, needs: DietaryNeed[]): boolean {
  for (const need of needs) {
    if (need === "vegan" && !recipeIsVegan(recipe)) return false;
    if (need === "vegetarian" && !recipeIsVegetarian(recipe)) return false;
    if (need === "gluten-free" && !recipeIsGlutenFree(recipe)) return false;
    if (need === "dairy-free" && !recipeIsDairyFree(recipe)) return false;
  }
  return true;
}

// ── Dietary pills shown on recipe cards ─────────────────────────────────────

export interface DietaryPill {
  label: string;
  emoji: string;
  bg: string;
  color: string;
}

const TEAL = "#2A8F88";
const TEAL_TINT = "#E6F3F0";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";

export function getDietaryPills(
  recipe: any,
  profile: HouseholdProfile
): DietaryPill[] {
  if (!profile.setup_complete && profile.dietary_needs.length === 0) return [];
  const pills: DietaryPill[] = [];
  const needs = profile.dietary_needs;

  if (needs.includes("vegan") && recipeIsVegan(recipe)) {
    pills.push({ label: "Vegan", emoji: "🌱", bg: PLUM_TINT, color: PLUM });
  }
  if (needs.includes("vegetarian") && !needs.includes("vegan") && recipeIsVegetarian(recipe)) {
    pills.push({ label: "Vegetarian", emoji: "🥚", bg: PLUM_TINT, color: PLUM });
  }
  if (needs.includes("gluten-free") && recipeIsGlutenFree(recipe)) {
    pills.push({ label: "GF", emoji: "🌾", bg: TEAL_TINT, color: TEAL });
  }
  if (needs.includes("dairy-free") && recipeIsDairyFree(recipe)) {
    pills.push({ label: "DF", emoji: "🥛", bg: TEAL_TINT, color: TEAL });
  }

  return pills.slice(0, 2);
}

// ── Swap badge shown on recipe cards ────────────────────────────────────────

export interface SwapBadge {
  label: string;
  need: DietaryNeed;
}

export function getSwapBadge(recipe: any, profile: HouseholdProfile): SwapBadge | null {
  if (!profile.setup_complete && profile.dietary_needs.length === 0) return null;
  const ings = getIngs(recipe);

  for (const need of profile.dietary_needs) {
    if (need === "vegan" && !recipeIsVegan(recipe)) {
      const count = ings.filter((ing: any) => {
        const n = nameOf(ing);
        return [...MEAT_KW, ...SEAFOOD_KW, ...DAIRY_EGG_KW].some((kw) => n.includes(kw));
      }).length;
      if (count >= 1 && count <= 3) return { label: "Make it vegan →", need: "vegan" };
    }
    if (need === "vegetarian" && !recipeIsVegetarian(recipe)) {
      const count = ings.filter((ing: any) => {
        const n = nameOf(ing);
        return [...MEAT_KW, ...SEAFOOD_KW].some((kw) => n.includes(kw));
      }).length;
      if (count >= 1 && count <= 3) return { label: "Veggie swap →", need: "vegetarian" };
    }
    if (need === "dairy-free" && !recipeIsDairyFree(recipe)) {
      const count = ings.filter((ing: any) => DAIRY_KW.some((kw) => nameOf(ing).includes(kw))).length;
      if (count >= 1 && count <= 3) return { label: "Dairy-free swap →", need: "dairy-free" };
    }
    if (need === "gluten-free" && !recipeIsGlutenFree(recipe)) {
      const count = ings.filter((ing: any) => GLUTEN_KW.some((kw) => nameOf(ing).includes(kw))).length;
      if (count >= 1 && count <= 3) return { label: "Gluten-free swap →", need: "gluten-free" };
    }
  }
  return null;
}

// ── Plan header indicator ────────────────────────────────────────────────────

export function getProfileHeaderText(profile: HouseholdProfile): string | null {
  const parts: string[] = [];
  if (profile.dietary_needs.includes("vegan")) parts.push("🌱 Vegan-friendly");
  else if (profile.dietary_needs.includes("vegetarian")) parts.push("🥚 Vegetarian");
  if (profile.dietary_needs.includes("gluten-free")) parts.push("🌾 Gluten-free");
  if (profile.dietary_needs.includes("dairy-free")) parts.push("🥛 Dairy-free");
  if (profile.kids_situation === "simpler") parts.push("kid-friendly lean");
  if (parts.length === 0) return null;
  return parts.join(" · ") + " this week";
}

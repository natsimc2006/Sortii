export type CookWithPreference =
  | "fastest"
  | "cheapest"
  | "kid-friendly"
  | "low-effort"
  | "one-pan"
  | "use-fridge-first"
  | "15-min-max";

export interface RecipeMatchResult {
  recipeId: string;
  recipeName: string;
  score: number;
  missingIngredients: string[];
  matchedIngredients: string[];
  category: "make_now" | "very_close";
  cookTimeMinutes: number;
  difficulty: "easy" | "moderate";
  reason: string;
  isOnePan: boolean;
  isKidFriendly: boolean;
}

export interface FallbackMealIdea {
  title: string;
  reason: string;
  steps: string[];
  cookTime: string;
  effort: string;
}

export interface CookWithResults {
  makeNow: RecipeMatchResult[];
  veryClose: RecipeMatchResult[];
  fallback: FallbackMealIdea | null;
}

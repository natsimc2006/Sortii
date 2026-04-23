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
  category: "ready_now" | "almost_there";
  cookTimeMinutes: number;
  difficulty: "easy" | "moderate";
  reason: string;
  missingNote: string;
  isOnePan: boolean;
  isKidFriendly: boolean;
}

export interface RescueMealIdea {
  id: string;
  title: string;
  reason: string;
  steps: string[];
  cookTime: string;
  effort: string;
  matchedIngredients: string[];
}

export interface FallbackMealIdea {
  title: string;
  reason: string;
  steps: string[];
  cookTime: string;
  effort: string;
}

export interface CookWithResults {
  readyNow: RecipeMatchResult[];
  almostThere: RecipeMatchResult[];
  rescue: RescueMealIdea[];
  fallback: FallbackMealIdea | null;
}

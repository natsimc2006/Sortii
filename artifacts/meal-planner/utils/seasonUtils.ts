import seasonsData from "@/constants/australian_seasons.json";
import { Recipe } from "@/constants/recipes";

type Season = "summer" | "autumn" | "winter" | "spring";

const SEASONS = seasonsData.seasons as Record<
  Season,
  { months: number[]; vegetables: string[]; fruit: string[]; herbs: string[] }
>;

const PANTRY_STAPLES_SET = new Set(
  seasonsData.pantry_staples.map((s) => s.toLowerCase().trim())
);

export function getCurrentAustralianSeason(): Season {
  const month = new Date().getMonth() + 1;
  for (const [season, data] of Object.entries(SEASONS) as [Season, { months: number[] }][]) {
    if (data.months.includes(month)) return season;
  }
  return "summer";
}

export function getSeasonalIngredients(season: Season): string[] {
  const data = SEASONS[season];
  return [
    ...data.vegetables,
    ...data.fruit,
    ...data.herbs,
  ].map((s) => s.toLowerCase().trim());
}

export function getRecipeSeasonalScore(recipe: Recipe, season: Season): number {
  const seasonal = getSeasonalIngredients(season);
  const nonPantryNames = recipe.ingredients
    .map((i) => i.name.toLowerCase().trim())
    .filter((name) => !PANTRY_STAPLES_SET.has(name));

  let score = 0;
  for (const ingName of nonPantryNames) {
    const matched = seasonal.some(
      (s) => ingName.includes(s) || s.includes(ingName)
    );
    if (matched) score++;
  }
  return score;
}

export function isRecipeSeasonal(recipe: Recipe, season: Season): boolean {
  return getRecipeSeasonalScore(recipe, season) >= 2;
}

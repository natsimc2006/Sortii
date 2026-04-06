import { AppLocale } from './locale';
import auRecipes from '../data/recipes_unified_au.json';
import ukRecipes from '../data/recipes_uk_clean.json';

function deriveProteinType(ingredientRows: any[]): string {
  const names = (ingredientRows ?? []).map((i: any) =>
    (i.ingredientLabel || i.name || '').toLowerCase()
  );
  if (names.some((n) => /chicken/.test(n))) return 'chicken';
  if (names.some((n) => /beef|mince/.test(n))) return 'beef';
  if (names.some((n) => /sausage|pork/.test(n))) return 'pork';
  if (names.some((n) => /lamb/.test(n))) return 'lamb';
  if (names.some((n) => /fish|salmon|cod|trout|tuna/.test(n))) return 'seafood';
  if (names.some((n) => /egg/.test(n))) return 'eggs';
  return 'none';
}

function deriveCostBand(gbpPerServe: number): 'low' | 'medium' | 'high' {
  if (gbpPerServe < 1.5) return 'low';
  if (gbpPerServe < 2.5) return 'medium';
  return 'high';
}

function normaliseUKRecipe(r: any): any {
  const costPerServe = r.estimatedCostPerServeGBP ?? 1.80;
  const tags: string[] = r.tags ?? [];
  return {
    ...r,
    id: r.recipeId,
    name: r.title,
    description: '',
    baseServings: r.serves ?? 4,
    cookTimeMinutes: r.cookTimeMins ?? 30,
    difficulty: 'easy',
    cookingStyle: 'mixed',
    healthTags: ['standard'],
    budgetTags: costPerServe < 1.5
      ? ['budget', 'standard']
      : costPerServe < 2.5
        ? ['standard']
        : ['standard', 'premium'],
    leftoversFriendly: tags.includes('batch_cook'),
    mealType: r.mealType ?? 'dinner',
    estimatedCostBand: deriveCostBand(costPerServe),
    ingredients: (r.ingredientRows ?? []).map((i: any) => ({
      name: i.ingredientLabel,
      quantity: i.quantity,
      unit: i.unit,
      category: 'pantry',
    })),
    instructions: [],
    proteinType: deriveProteinType(r.ingredientRows),
    cuisineType: 'other',
    kidFriendlyScore: tags.includes('family') ? 2 : 1,
    locale: ['UK'],
    source: 'uk_pack',
    costPerServe,
    currency: 'GBP',
    currencySymbol: '£',
  };
}

export function getRecipesForLocale(locale: AppLocale) {
  if (locale === 'UK') {
    const universalRecipes = (auRecipes as any[])
      .filter((r) => Array.isArray(r.locale) && r.locale.includes('UK'))
      .map((r) => ({
        ...r,
        ingredients: r.ingredientsUK ?? r.ingredients,
        costPerServe: r.costPerServeGBP ?? null,
        currency: 'GBP',
        currencySymbol: '£',
      }));

    const ukOnlyRecipes = (ukRecipes as any[]).map(normaliseUKRecipe);

    return [...universalRecipes, ...ukOnlyRecipes];
  }

  return (auRecipes as any[]).map((r) => ({
    ...r,
    ingredients: r.ingredientsAU ?? r.ingredients,
    costPerServe: r.costPerServeAUD ?? null,
    currency: 'AUD',
    currencySymbol: '$',
  }));
}

export function getCostDisplay(recipe: any, locale: AppLocale): string {
  const symbol = locale === 'UK' ? '£' : '$';
  const cost = recipe.costPerServe;
  if (!cost) return '';
  return `${symbol}${cost.toFixed(2)}/serve`;
}

export function getWeeklyCost(
  plannedMeals: any[],
  householdSize: number,
  locale: AppLocale
): { low: number; high: number; total: number } {
  const total = plannedMeals.reduce((sum, meal) => {
    const cost = meal.costPerServe ?? fallbackCost(meal.estimatedCostBand, locale);
    return sum + cost * householdSize;
  }, 0);

  return {
    low: Math.round(total * 0.92),
    high: Math.round(total * 1.08),
    total: Math.round(total),
  };
}

function fallbackCost(band: string, locale: AppLocale): number {
  if (locale === 'UK') {
    if (band === 'low') return 1.20;
    if (band === 'high') return 3.00;
    return 1.80;
  }
  if (band === 'low') return 4.50;
  if (band === 'high') return 11.00;
  return 7.00;
}

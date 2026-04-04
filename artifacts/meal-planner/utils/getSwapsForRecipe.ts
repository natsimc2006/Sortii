import { SWAP_RULES, SwapRule } from "@/constants/swapRules";

export function getSwapsForRecipe(ingredientNames: string[]): SwapRule[] {
  const text = ingredientNames.join(" ").toLowerCase();
  return SWAP_RULES.filter((rule) =>
    rule.matchKeywords.some((kw) => text.includes(kw.toLowerCase()))
  ).sort((a, b) => b.savingPerServeAUD - a.savingPerServeAUD);
}

export function getWeeklyPantryTips(allPlannedMeals: { ingredients: { name: string }[] }[]): string[] {
  const tips: string[] = [];
  const allIngredients = allPlannedMeals
    .flatMap((m) => m.ingredients.map((i) => i.name.toLowerCase()));

  const garlicCount = allIngredients.filter((i) => i.includes("garlic")).length;
  if (garlicCount >= 3) {
    tips.push(
      `Garlic features in ${garlicCount} of your meals this week. ` +
      `A jar of minced garlic (~$3) or garlic powder covers the whole week ` +
      `and keeps for months.`
    );
  }

  const freshHerbCount = allIngredients.filter(
    (i) =>
      i.includes("fresh") ||
      ["basil", "coriander", "parsley", "thyme", "rosemary", "dill"].some((h) =>
        i.includes(h)
      )
  ).length;
  if (freshHerbCount >= 3) {
    tips.push(
      `You have ${freshHerbCount} fresh herb requirements this week. ` +
      `Dried herbs at ⅓ quantity work just as well in cooked dishes ` +
      `and cost a fraction of fresh bunches.`
    );
  }

  const onionCount = allIngredients.filter((i) => i.includes("onion")).length;
  if (onionCount >= 4) {
    tips.push(
      `Onion appears in ${onionCount} meals. Buy a 1kg bag (~$2.50) ` +
      `rather than individual onions — much better value.`
    );
  }

  return tips;
}

import { SWAP_RULES, SwapRule } from "@/constants/swapRules";

export function getSwapsForRecipe(ingredientNames: string[]): SwapRule[] {
  const text = ingredientNames.join(" ").toLowerCase();
  return SWAP_RULES.filter((rule) =>
    rule.matchKeywords.some((kw) => text.includes(kw.toLowerCase()))
  ).sort((a, b) => b.savingPerServeAUD - a.savingPerServeAUD);
}

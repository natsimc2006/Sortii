import { normalizeIngredient } from "./normalizeIngredients";
import { CookWithPreference } from "./cookWithTypes";

const PREF_PATTERNS: Array<[RegExp, CookWithPreference]> = [
  [/\b(quick|fast|fastest|speedy|asap|hurry|rushed|fast dinner)\b/i, "fastest"],
  [/\b(cheap|cheapest|budget|low.?cost|broke|tight|no money)\b/i, "cheapest"],
  [/\b(kid|kids|children|toddler|fussy|picky|child|family.?friendly)\b/i, "kid-friendly"],
  [/\b(easy|simple|low.?effort|lazy|no.?fuss|minimal|effortless)\b/i, "low-effort"],
  [/\b(one.?pan|single pan|sheet pan|one pot)\b/i, "one-pan"],
  [/\b(fridge|clear.{0,10}fridge|use.{0,10}fridge|leftover|leftovers)\b/i, "use-fridge-first"],
  [/\b(15 min|15min|fifteen.?min|under 15|under fifteen)\b/i, "15-min-max"],
];

const NOISE_WORDS = new Set([
  "have", "got", "i've", "ive", "i", "just", "only", "some", "maybe",
  "a", "an", "the", "few", "bit", "bits", "piece", "pieces", "handful",
  "couple", "of", "with", "and", "plus", "also", "or", "but", "need",
  "something", "anything", "dinner", "tonight", "for", "tea", "lunch",
  "supper", "meal", "food", "cook", "make", "want", "like", "prefer",
  "random", "leftover", "leftovers", "stuff", "things", "bit of",
  "want to", "trying to", "hoping", "maybe some", "think i",
]);

function stripNoise(tokens: string[]): string {
  return tokens.filter((w) => !NOISE_WORDS.has(w)).join(" ").trim();
}

export function parseIngredientText(
  text: string,
): { ingredients: string[]; preferences: CookWithPreference[] } {
  if (!text.trim()) return { ingredients: [], preferences: [] };

  const preferences: CookWithPreference[] = [];
  for (const [pattern, pref] of PREF_PATTERNS) {
    if (pattern.test(text) && !preferences.includes(pref)) {
      preferences.push(pref);
    }
  }

  // Split on separators
  const parts = text
    .replace(/[.!?;:]/g, ",")
    .split(/,|&|\band\b|\bor\b|\bwith\b|\bplus\b|\n/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const ingredients: string[] = [];

  for (const part of parts) {
    const words = part.toLowerCase().split(/\s+/);
    const cleaned = stripNoise(words);
    if (!cleaned || cleaned.length < 2) continue;

    // Skip pure preference phrases
    const isPrefOnly = PREF_PATTERNS.some(([p]) => p.test(cleaned));
    if (isPrefOnly && cleaned.split(" ").length <= 3) continue;

    // Skip generic non-ingredient words
    if (
      /\b(need|want|make|cook|have|dinner|something|anything|quick|easy|fast|cheap|tonight|tonight's)\b/.test(
        cleaned,
      )
    )
      continue;

    const normalized = normalizeIngredient(cleaned);
    if (normalized && normalized.length >= 2 && !ingredients.includes(normalized)) {
      ingredients.push(normalized);
    }
  }

  return { ingredients, preferences };
}

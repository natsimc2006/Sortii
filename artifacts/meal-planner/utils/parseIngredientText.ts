import { normalizeIngredient } from "./normalizeIngredients";
import { CookWithPreference } from "./cookWithTypes";

// ─── Preference detection ─────────────────────────────────────────────────────
const PREF_PATTERNS: Array<[RegExp, CookWithPreference]> = [
  [/\b(quick|fast|fastest|speedy|asap|hurry|rushed|fast dinner|in a hurry)\b/i, "fastest"],
  [/\b(cheap|cheapest|budget|low.?cost|broke|tight|no money|saving)\b/i, "cheapest"],
  [/\b(kid|kids|children|toddler|fussy|picky|child|family.?friendly)\b/i, "kid-friendly"],
  [/\b(easy|simple|low.?effort|lazy|no.?fuss|minimal|effortless|can't be bothered)\b/i, "low-effort"],
  [/\b(one.?pan|single pan|sheet pan|one pot|one dish)\b/i, "one-pan"],
  [/\b(fridge|clear.{0,10}fridge|use.{0,10}fridge|leftover|leftovers|use up)\b/i, "use-fridge-first"],
  [/\b(15 min|15min|fifteen.?min|under 15|under fifteen|ten minutes|10 min)\b/i, "15-min-max"],
];

// ─── Words to strip from tokens before normalising ────────────────────────────
const NOISE_WORDS = new Set([
  "have", "got", "i've", "ive", "i", "just", "only", "some", "maybe",
  "a", "an", "the", "few", "bit", "bits", "piece", "pieces", "handful",
  "couple", "of", "with", "and", "plus", "also", "or", "but", "need",
  "something", "anything", "dinner", "tonight", "for", "tea", "lunch",
  "supper", "meal", "food", "cook", "make", "want", "like", "prefer",
  "random", "leftover", "leftovers", "stuff", "things",
]);

// Quantity / modifier prefixes to strip from the beginning of a token
const QUANTITY_PREFIXES =
  /^(half an?|half|quarter|a bit of|a few|some|maybe some|a can of|a tin of|a jar of|a bag of|a bunch of|a pack of|left over)\s+/i;

// Descriptor prefixes that don't change the ingredient identity
const DESCRIPTOR_PREFIXES =
  /^(tinned|canned|frozen|leftover|cooked|raw|fresh|dried|shredded|grated|sliced|diced|chopped|minced)\s+/i;

// Generic non-ingredient phrases to skip entirely
const SKIP_PATTERNS =
  /\b(need|want|make|cook|have|dinner|something|anything|quick|easy|fast|cheap|tonight|tonight's|not much|not sure|don't know)\b/i;

function stripNoise(words: string[]): string {
  return words.filter((w) => !NOISE_WORDS.has(w)).join(" ").trim();
}

/**
 * Strip leading quantity and descriptor words from a token so the
 * normaliser can recognise the base ingredient.
 *
 * e.g. "half an onion" → "onion"
 *      "tinned corned beef" → first tries synonym map via normaliser (wins)
 *      "frozen peas"  → "peas" (but normaliser synonym already handles this)
 *      "some shredded cheese" → "cheese" (normaliser handles "shredded cheese")
 */
function cleanToken(raw: string): string {
  let t = raw.trim().toLowerCase();
  // Strip quantity prefix first
  t = t.replace(QUANTITY_PREFIXES, "");
  // Try normalising with descriptor intact (catches "tinned corned beef" etc.)
  const withDescriptor = normalizeIngredient(t);
  if (withDescriptor !== t) return withDescriptor; // synonym matched
  // Strip descriptor prefix and try again
  const withoutDescriptor = t.replace(DESCRIPTOR_PREFIXES, "");
  return normalizeIngredient(withoutDescriptor);
}

export function parseIngredientText(
  text: string,
): { ingredients: string[]; preferences: CookWithPreference[] } {
  if (!text.trim()) return { ingredients: [], preferences: [] };

  // ── Detect preferences from the full text ──
  const preferences: CookWithPreference[] = [];
  for (const [pattern, pref] of PREF_PATTERNS) {
    if (pattern.test(text) && !preferences.includes(pref)) {
      preferences.push(pref);
    }
  }

  // ── Split on common separators ──
  const parts = text
    .replace(/[.!?;:]/g, ",")
    .split(/,|&|\band\b|\bor\b|\bplus\b|\n/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const ingredients: string[] = [];

  for (const part of parts) {
    // Strip noise words first
    const words = part.toLowerCase().split(/\s+/);
    const stripped = stripNoise(words);
    if (!stripped || stripped.length < 2) continue;

    // Skip pure intent / preference phrases
    if (SKIP_PATTERNS.test(stripped)) continue;
    const isPrefPhrase = PREF_PATTERNS.some(([p]) => p.test(stripped));
    if (isPrefPhrase && stripped.split(" ").length <= 4) continue;

    // Clean and normalise
    const cleaned = cleanToken(stripped);
    if (cleaned && cleaned.length >= 2 && !ingredients.includes(cleaned)) {
      ingredients.push(cleaned);
    }
  }

  return { ingredients, preferences };
}

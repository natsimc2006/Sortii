/**
 * localRecipeImages.ts
 * ────────────────────
 * Maps recipe names (lowercase) to bundled local assets via require().
 * These always win over Unsplash, TheMealDB, or any cached URL.
 *
 * To add a new pinned image:
 *   1. Drop the file into assets/images/recipes/
 *   2. Add an entry below: "recipe name" → require(...)
 */

const LOCAL_RECIPE_IMAGES: Record<string, number> = {
  "shepherd's pie": require("@/assets/images/recipes/shepherds-pie.webp"),
  "shepherds pie":  require("@/assets/images/recipes/shepherds-pie.webp"),
};

/**
 * Returns a local require() asset if one is pinned for this recipe name,
 * otherwise returns undefined.
 */
export function getLocalRecipeImage(recipeName: string): number | undefined {
  const lc = recipeName.toLowerCase().trim();
  for (const [key, asset] of Object.entries(LOCAL_RECIPE_IMAGES)) {
    if (lc.includes(key)) return asset;
  }
  return undefined;
}

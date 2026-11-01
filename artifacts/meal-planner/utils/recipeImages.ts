/**
 * recipeImages.ts
 * ───────────────
 * Resolves the photo for a recipe. Sortii now owns its recipe photos: each
 * recipe's `imageUrl` points at a generated image hosted on the Sortii site
 * (see scripts/generate-recipe-images.mjs). No live image search, no
 * third-party hotlinking.
 *
 * Priority (local bundled assets are handled in hooks/useRecipeImage.ts):
 *   1. The recipe's own imageUrl
 *   2. null → the card shows its placeholder
 *
 * The recipe data is the source of truth, so image URLs are not cached in
 * AsyncStorage. Old cache entries from the previous Unsplash/Bing approach
 * are cleared once per app session.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_CACHE_PREFIX = "sortii_img_";
let legacyCleared = false;

async function clearLegacyImageCache(): Promise<void> {
  if (legacyCleared) return;
  legacyCleared = true;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const old = keys.filter((k) => k.startsWith(LEGACY_CACHE_PREFIX));
    if (old.length > 0) await AsyncStorage.multiRemove(old);
  } catch {}
}

export async function getRecipeImage(
  _recipeId: string,
  _recipeName: string,
  existingUrl?: string
): Promise<string | null> {
  clearLegacyImageCache();
  const url = existingUrl?.trim();
  return url ? url : null;
}

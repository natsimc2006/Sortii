/**
 * useRecipeImage hook
 * ───────────────────
 * Returns the best available image source for a recipe, plus a refresh callback.
 *
 * Priority order (see unsplashImages.ts for full logic):
 *   1. Locally bundled asset (require()) — always wins, no network needed
 *   2. Pinned URL (curated overrides in unsplashImages.ts)
 *   3. AsyncStorage cached URL
 *   4. TheMealDB existingUrl (dish-matched, preferred over Unsplash search)
 *   5. Live Unsplash fetch (fallback for recipes with no TheMealDB URL)
 *
 * Return type is `number | string | null`:
 *   - number  → local require() asset (use directly as <Image source={...} />)
 *   - string  → remote URI (wrap as <Image source={{ uri: ... }} />)
 *   - null    → no image available yet (show placeholder)
 *
 * Usage:
 *   const { src, refresh, refreshing } = useRecipeImage(recipe.id, recipe.name, recipe.imageUrl);
 *   <Image source={toImageSource(src)} ... />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getRecipeImage, refreshRecipeImage } from "@/utils/unsplashImages";
import { getLocalRecipeImage } from "@/utils/localRecipeImages";

export type RecipeImageSource = number | string | null;

/** Converts the hook's return value into a React Native Image `source` prop. */
export function toImageSource(
  src: RecipeImageSource
): { uri: string } | number | null {
  if (src === null) return null;
  if (typeof src === "number") return src;
  return { uri: src };
}

export interface UseRecipeImageResult {
  src: RecipeImageSource;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): UseRecipeImageResult {
  const localAsset = getLocalRecipeImage(recipeName);
  const [imageSource, setImageSource] = useState<RecipeImageSource>(
    localAsset !== undefined ? localAsset : null
  );
  const [refreshing, setRefreshing] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (localAsset !== undefined) {
      setImageSource(localAsset);
      return;
    }

    async function load() {
      const url = await getRecipeImage(recipeId, recipeName, existingUrl);
      if (!cancelledRef.current) setImageSource(url);
    }

    load();
    return () => { cancelledRef.current = true; };
  }, [recipeId, recipeName, existingUrl, localAsset]);

  const refresh = useCallback(async () => {
    // Local assets are always correct — nothing to refresh
    if (localAsset !== undefined) return;

    setRefreshing(true);
    try {
      const url = await refreshRecipeImage(recipeId, recipeName, existingUrl);
      if (!cancelledRef.current) setImageSource(url);
    } finally {
      setRefreshing(false);
    }
  }, [recipeId, recipeName, existingUrl, localAsset]);

  return { src: imageSource, refreshing, refresh };
}

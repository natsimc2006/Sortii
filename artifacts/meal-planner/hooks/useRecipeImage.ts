/**
 * useRecipeImage hook
 * ───────────────────
 * Returns the best available image source for a recipe.
 *
 * Priority order:
 *   1. Locally bundled asset (require()) — always wins, no network needed
 *   2. AsyncStorage cached Unsplash URL
 *   3. Live Unsplash fetch
 *   4. TheMealDB fallback URL from the recipe data
 *
 * Return type is `number | string | null`:
 *   - number  → local require() asset (use directly as <Image source={...} />)
 *   - string  → remote URI (wrap as <Image source={{ uri: ... }} />)
 *   - null    → no image available yet (show placeholder)
 *
 * Usage:
 *   const imgSrc = useRecipeImage(recipe.id, recipe.name, recipe.imageUrl);
 *   <Image source={toImageSource(imgSrc)} ... />
 */

import { useEffect, useState } from "react";
import { getRecipeImage } from "@/utils/unsplashImages";
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

export function useRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): RecipeImageSource {
  // Local bundled asset takes immediate priority — no async needed
  const localAsset = getLocalRecipeImage(recipeName);
  const [imageSource, setImageSource] = useState<RecipeImageSource>(
    localAsset !== undefined ? localAsset : null
  );

  useEffect(() => {
    // If there's a local asset, we're done — skip any network calls
    if (localAsset !== undefined) {
      setImageSource(localAsset);
      return;
    }

    let cancelled = false;

    async function load() {
      const url = await getRecipeImage(recipeId, recipeName, existingUrl);
      if (!cancelled) setImageSource(url);
    }

    load();
    return () => { cancelled = true; };
  }, [recipeId, recipeName, existingUrl, localAsset]);

  return imageSource;
}

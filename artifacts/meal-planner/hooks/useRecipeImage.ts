/**
 * useRecipeImage hook
 * ───────────────────
 * Returns the best available image source for a recipe.
 *
 * Priority order:
 *   1. Locally bundled asset (require()) — always wins, no network needed
 *   2. The recipe's own imageUrl (Sortii-hosted photo, see utils/recipeImages.ts)
 *   3. null → no image, show the placeholder
 *
 * Return type is `number | string | null`:
 *   - number  → local require() asset (use directly as <Image source={...} />)
 *   - string  → remote URI (wrap as <Image source={{ uri: ... }} />)
 *   - null    → no image available (show placeholder)
 *
 * Usage:
 *   const { src } = useRecipeImage(recipe.id, recipe.name, recipe.imageUrl);
 *   <Image source={toImageSource(src)} ... />
 */

import { useEffect, useRef, useState } from "react";
import { getRecipeImage } from "@/utils/recipeImages";
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
}

export function useRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): UseRecipeImageResult {
  const localAsset = getLocalRecipeImage(recipeName);
  const [imageSource, setImageSource] = useState<RecipeImageSource>(
    localAsset !== undefined ? localAsset : existingUrl?.trim() || null
  );
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (localAsset !== undefined) {
      setImageSource(localAsset);
      return;
    }

    getRecipeImage(recipeId, recipeName, existingUrl).then((url) => {
      if (!cancelledRef.current) setImageSource(url);
    });

    return () => { cancelledRef.current = true; };
  }, [recipeId, recipeName, existingUrl, localAsset]);

  return { src: imageSource };
}

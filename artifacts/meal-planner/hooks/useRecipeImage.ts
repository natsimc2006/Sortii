/**
 * useRecipeImage hook
 * ───────────────────
 * Returns the best available image URL for a recipe.
 * Starts with whatever is already on the recipe (TheMealDB),
 * then upgrades to Unsplash in the background once fetched.
 *
 * Usage:
 *   const imageUrl = useRecipeImage(recipe.id, recipe.name, recipe.imageUrl);
 */

import { useEffect, useState } from "react";
import { getRecipeImage } from "@/utils/unsplashImages";

export function useRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): string | null {
  // Start with null — Unsplash is the primary source.
  // TheMealDB URL is only used as fallback inside getRecipeImage if Unsplash returns nothing.
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const url = await getRecipeImage(recipeId, recipeName, existingUrl);
      if (!cancelled) setImageUrl(url);
    }

    load();
    return () => { cancelled = true; };
  }, [recipeId, recipeName, existingUrl]);

  return imageUrl;
}

/**
 * Unsplash Recipe Image Utility
 * ─────────────────────────────
 * Fetches food images from Unsplash for each recipe and caches them
 * in AsyncStorage so we never re-fetch the same recipe.
 *
 * Swap provider: replace the fetchFromUnsplash() function to use a
 * different image source (Spoonacular, AI-generated, etc.) without
 * changing any call sites.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Config ────────────────────────────────────────────────────────────────────

// Unsplash client-side access key (public demo key — safe to bundle in the app;
// rate limit is per-key at 50 req/hr on Unsplash's demo tier).
// To swap provider: replace fetchFromUnsplash() below without changing call sites.
const UNSPLASH_KEY = "cWU-u6hsZoSKXaZJ_-YfD5s09NoHtfmHmuaKZ_LXXF4";

const UNSPLASH_BASE = "https://api.unsplash.com";
const CACHE_PREFIX = "sortii_img_v3_";
const SESSION_CACHE: Record<string, string | null> = {};

// ── Query builder ─────────────────────────────────────────────────────────────

/**
 * Converts a recipe name into a focused food-image search query.
 * Examples:
 *   "One-Pan Sausage and Veggie Bake" → "sausage veggie bake dinner food"
 *   "Butter Chicken"                  → "butter chicken curry food"
 *   "Prawn Tacos"                     → "prawn tacos food"
 */
export function buildImageQuery(recipeName: string): string {
  const lc = recipeName.toLowerCase();

  // Remove cooking-method prefixes that don't describe the dish
  const cleaned = lc
    .replace(/\b(air fryer|one-pan|one pan|slow cooker|instant pot|classic|quick|easy|simple|creamy)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Detect dish format to append a helpful context word
  const contextWord = (() => {
    if (/\bsoup\b|\bchowder\b|\bbisque\b/.test(cleaned))                              return "soup";
    if (/\bcurry\b|\bmasala\b|\btikka\b|\bkorma\b|\bdal\b|\bdahl\b/.test(cleaned))   return "curry";
    if (/\bstir[- ]?fry\b|\bchow mein\b/.test(cleaned))                              return "stir fry";
    if (/\bpasta\b|\bspaghetti\b|\blasagne\b|\brigatoni\b|\bcarbonara\b/.test(cleaned)) return "pasta";
    if (/\bnoodle\b|\bramen\b|\blaksa\b|\bpad thai\b|\bpho\b/.test(cleaned))          return "noodles";
    if (/\bpizza\b/.test(cleaned))                                                     return "pizza";
    if (/\bsalad\b/.test(cleaned))                                                     return "salad";
    if (/\bburger\b/.test(cleaned))                                                    return "burger";
    if (/\btaco\b|\bburrito\b|\bwrap\b|\bfajita\b|\bquesadilla\b/.test(cleaned))      return "food";
    if (/\brisotto\b/.test(cleaned))                                                   return "risotto";
    if (/\bsteak\b|\bchop\b|\bschnitzel\b|\bkebab\b|\bkofta\b/.test(cleaned))         return "dinner";
    if (/\bbreakfast\b|\bfrittata\b|\bomelette\b|\bfritter\b/.test(cleaned))          return "breakfast";
    if (/\bbake\b|\broast\b|\btraybake\b|\bstew\b|\bcasserole\b|\bpie\b/.test(cleaned)) return "dinner";
    return "food";
  })();

  // Build final query: cleaned name + context word
  const query = `${cleaned} ${contextWord}`.replace(/\s+/g, " ").trim();
  return query;
}

// ── Unsplash fetch ────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt_description: string | null;
  width: number;
  height: number;
}

/**
 * Calls Unsplash search API and returns the best image URL.
 * Returns null on any failure (no crash).
 */
async function fetchFromUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) {
    console.warn("[Unsplash] UNSPLASH_ACCESS_KEY not set — skipping fetch");
    return null;
  }

  try {
    const url = `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&content_filter=high&order_by=relevant`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_KEY}`,
        "Accept-Version": "v1",
      },
    });

    if (res.status === 403 || res.status === 401) {
      console.warn("[Unsplash] Auth failed — check UNSPLASH_ACCESS_KEY");
      return null;
    }
    if (res.status === 429) {
      console.warn("[Unsplash] Rate limit hit — will use cached/fallback images");
      return null;
    }
    if (!res.ok) {
      console.warn(`[Unsplash] Request failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const photos: UnsplashPhoto[] = data?.results ?? [];

    if (photos.length === 0) return null;

    // Pick the best photo:
    // - Prefer landscape (wider than tall)
    // - Prefer photos with food-related alt text
    // - Take first result if nothing better
    const ranked = photos
      .filter(p => p.urls?.regular)
      .sort((a, b) => {
        const aLandscape = a.width > a.height ? 1 : 0;
        const bLandscape = b.width > b.height ? 1 : 0;
        return bLandscape - aLandscape;
      });

    return ranked[0]?.urls?.regular ?? null;
  } catch (err) {
    console.warn("[Unsplash] Network error:", err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get (or fetch+cache) an image URL for a recipe.
 *
 * Priority:
 *   1. Session cache (in-memory, no async overhead)
 *   2. AsyncStorage cache (persists across app restarts)
 *   3. Fetch from Unsplash → save to both caches
 *   4. Fallback: return the imageUrl already on the recipe (TheMealDB)
 *   5. Return null (caller shows placeholder icon)
 */
export async function getRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): Promise<string | null> {
  const cacheKey = `${CACHE_PREFIX}${recipeId}`;

  // 1. Session cache
  if (SESSION_CACHE[cacheKey] !== undefined) {
    return SESSION_CACHE[cacheKey];
  }

  // 2. AsyncStorage
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached !== null) {
      SESSION_CACHE[cacheKey] = cached === "null" ? null : cached;
      return SESSION_CACHE[cacheKey];
    }
  } catch {
    // AsyncStorage unavailable — proceed
  }

  // 3. Fetch from Unsplash
  const query = buildImageQuery(recipeName);
  const unsplashUrl = await fetchFromUnsplash(query);

  if (unsplashUrl) {
    SESSION_CACHE[cacheKey] = unsplashUrl;
    try { await AsyncStorage.setItem(cacheKey, unsplashUrl); } catch {}
    return unsplashUrl;
  }

  // 4. Try simplified query (first 2 meaningful words)
  const simpleWords = recipeName
    .split(/\s+/)
    .filter(w => w.length > 3 && !/^(with|and|the)$/i.test(w))
    .slice(0, 2);

  if (simpleWords.length >= 1) {
    const simpleQuery = `${simpleWords.join(" ")} food`;
    const simpleUrl = await fetchFromUnsplash(simpleQuery);
    if (simpleUrl) {
      SESSION_CACHE[cacheKey] = simpleUrl;
      try { await AsyncStorage.setItem(cacheKey, simpleUrl); } catch {}
      return simpleUrl;
    }
  }

  // 5. Fall back to existing TheMealDB URL (already on recipe)
  const fallback = existingUrl ?? null;
  SESSION_CACHE[cacheKey] = fallback;
  // Don't cache fallback to AsyncStorage — next launch will try Unsplash again
  return fallback;
}

/**
 * Prefetch images for a batch of recipes (call after generating a plan).
 * Fires all requests in parallel, capped to avoid rate-limiting.
 */
export async function prefetchRecipeImages(
  recipes: Array<{ id: string; name: string; imageUrl?: string }>
): Promise<void> {
  const BATCH_SIZE = 5;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(r => getRecipeImage(r.id, r.name, r.imageUrl))
    );
    if (i + BATCH_SIZE < recipes.length) {
      await delay(300); // ~33 req/s — well within Unsplash's 50 req/hr demo limit
    }
  }
}

/**
 * Clear all cached Unsplash images (e.g. for a "refresh images" button).
 */
export async function clearImageCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const imgKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (imgKeys.length > 0) await AsyncStorage.multiRemove(imgKeys);
    Object.keys(SESSION_CACHE).forEach(k => delete SESSION_CACHE[k]);
  } catch {}
}

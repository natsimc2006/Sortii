/**
 * Unsplash Recipe Image Utility
 * ─────────────────────────────
 * Fetches food images from Unsplash for each recipe and caches them
 * in AsyncStorage so we never re-fetch the same recipe.
 *
 * Priority order:
 *   1. Pinned URL (curated, always wins)
 *   2. AsyncStorage cached URL
 *   3. TheMealDB existingUrl (dish-matched, preferred over Unsplash keyword search)
 *   4. Live Unsplash fetch (fallback for recipes with no TheMealDB URL)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Config ────────────────────────────────────────────────────────────────────

const UNSPLASH_KEY = "cWU-u6hsZoSKXaZJ_-YfD5s09NoHtfmHmuaKZ_LXXF4";
const UNSPLASH_BASE = "https://api.unsplash.com";
// Bumped to v5 — forces a refresh of all previously cached images
const CACHE_PREFIX = "sortii_img_v5_";
const SESSION_CACHE: Record<string, string | null> = {};

// Unsplash "Food & Drink" topic — ensures results are actually food photos
const FOOD_TOPIC_ID = "bo8jQKTaE0Y";

// ── Food keyword list for scoring ─────────────────────────────────────────────

const FOOD_WORDS = [
  "food", "meal", "dish", "dinner", "lunch", "plate", "served", "eat",
  "cuisine", "cook", "recipe", "restaurant", "kitchen", "tasty", "delicious",
  "fresh", "ingredient", "chef", "plated",
];

// ── Pinned images — curated, bypass all cache + Unsplash lookups ─────────────
// Add a recipe name (lowercase) → URL here to lock a specific photo for a dish.
// This takes priority over everything: session cache, AsyncStorage, and Unsplash.

const PINNED_IMAGE_URLS: Record<string, string> = {
  // Shepherd's Pie — bundled local image takes priority via localRecipeImages.ts,
  // but keep the pin here as a backup
  "shepherd's pie":  "https://www.themealdb.com/images/media/meals/sxrpws1511555907.jpg",
  "shepherds pie":   "https://www.themealdb.com/images/media/meals/sxrpws1511555907.jpg",

  // Chicken Satay — fix mismatch where script assigned Tikka Masala photo
  "chicken satay":   "https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg",
  "satay chicken":   "https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg",

  // Sausages with Mashed Potato / Bangers and Mash
  "sausages with mashed potato": "https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg",
  "bangers and mash":            "https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg",

  // Mac and Cheese
  "mac and cheese": "https://www.themealdb.com/images/media/meals/uyxrwq1555249033.jpg",
  "mac & cheese":   "https://www.themealdb.com/images/media/meals/uyxrwq1555249033.jpg",

  // Toad in the Hole
  "toad in the hole": "https://www.themealdb.com/images/media/meals/1550441882.jpg",

  // Chicken Nuggets
  "chicken nuggets": "https://www.themealdb.com/images/media/meals/bsxr381548942529.jpg",

  // Fish fingers / fish and chips
  "fish fingers":    "https://www.themealdb.com/images/media/meals/xxyupu1468262513.jpg",
  "fish and chips":  "https://www.themealdb.com/images/media/meals/xxyupu1468262513.jpg",

  // Beef and mushroom pie
  "beef and mushroom pie": "https://www.themealdb.com/images/media/meals/toywww1476041291.jpg",
  "beef mince and vegetable pie": "https://www.themealdb.com/images/media/meals/toywww1476041291.jpg",

  // Pulled pork
  "pulled pork":     "https://www.themealdb.com/images/media/meals/ursuup1487348423.jpg",
};

// ── Curated query overrides for dishes that return poor Unsplash results ──────
// Used ONLY when there is no TheMealDB imageUrl in the recipe data.

const DISH_QUERY_OVERRIDES: Record<string, string> = {
  // Known Unsplash problem dishes
  "bbq pork ribs":          "pork ribs barbecue smoked food plated",
  "pork ribs":              "pork ribs barbecue smoked food plated",
  "pad thai":               "pad thai noodles thai food dish",
  "shepherd's pie":         "shepherd's pie comfort food baked dish",
  "shepherds pie":          "shepherd's pie comfort food baked dish",
  "haloumi wrap":           "halloumi wrap food photography fresh",
  "halloumi wrap":          "halloumi wrap food photography fresh",
  "prawn tacos":            "prawn shrimp tacos food dish",
  "beef nachos":            "nachos loaded beef food photography",
  "fried rice":             "fried rice food plate dish",
  "chicken fried rice":     "chicken fried rice food dish wok",
  "butter chicken":         "butter chicken curry indian food",
  "sausage pasta":          "sausage pasta dinner food plate",
  "beef stir fry":          "beef stir fry asian food plate",
  "pork belly":             "pork belly food plated dish",
  "fish tacos":             "fish tacos food plate fresh",
  "lemon chicken":          "lemon chicken dinner plated food",
  "honey soy chicken":      "honey soy chicken drumsticks dinner plate",
  "teriyaki chicken":       "teriyaki chicken plate rice food",
  "satay chicken":          "satay chicken skewers peanut sauce food",
  "chicken schnitzel":      "chicken schnitzel crumbed plate food",
  "chicken satay":          "satay chicken skewers peanut sauce food",

  // 30 recipes with no TheMealDB imageUrl — explicit queries for better Unsplash results
  "mac and cheese":                   "macaroni cheese baked food plate",
  "mac & cheese":                     "macaroni cheese baked food plate",
  "homemade chicken nuggets":         "chicken nuggets golden crumbed plate food",
  "chicken nuggets":                  "chicken nuggets golden crispy plate food",
  "honey soy chicken drumsticks":     "honey soy glazed chicken drumsticks plate food",
  "homemade sausage rolls":           "sausage rolls pastry golden baked food",
  "sausage rolls":                    "sausage rolls golden pastry baked plate",
  "toad in the hole":                 "toad in the hole sausage batter baked food",
  "english muffin mini pizzas":       "mini pizza english muffin topped cheese food",
  "cheesy pizza scrolls":             "pizza scrolls swirled cheese baked food",
  "mince and pasta bake":             "pasta bake mince beef baked dish",
  "chicken and sweet corn soup":      "chicken corn soup bowl food",
  "sweet corn soup":                  "corn soup bowl food warm",
  "baked beans on toast":             "baked beans on toast food plate meal",
  "cheesy scrambled eggs on toast":   "scrambled eggs toast plate breakfast food",
  "tomato soup with cheesy toast":    "tomato soup bowl toast cheese food",
  "crumbed chicken tenders":          "chicken tenders crumbed golden plate food",
  "chicken tenders":                  "chicken tenders fried golden plate food",
  "sausages with mashed potato":      "bangers mash sausages mashed potato gravy plate",
  "bangers and mash":                 "bangers mash sausages mashed potato gravy plate",
  "loaded potato skins":              "loaded potato skins cheese bacon food",
  "potato skins":                     "loaded potato skins cheese food",
  "beef and vegetable pasties":       "beef pasty pastry baked food plate",
  "pasties":                          "beef pasty pastry golden baked food",
  "spaghetti with butter and parmesan": "spaghetti butter parmesan pasta simple plate",
  "potato wedges":                    "potato wedges crispy golden food plate",
  "cheese and vegemite scrolls":      "cheese scrolls baked golden food plate",
  "ham and cheese toasties":          "toasted sandwich ham cheese golden food",
  "ham and pineapple mini pizzas":    "ham pineapple pizza topped food",
  "cheese and capsicum omelette":     "omelette cheese capsicum breakfast food plate",
  "savoury bacon pancakes":           "bacon pancakes savoury food plate breakfast",
  "chicken and potato bake":          "chicken potato bake tray oven food",
  "baked sausages with roast veg":    "baked sausages roasted vegetables tray food",
  "plain beef noodle stir-fry":       "beef noodle stir fry wok plate food",
  "ham and cheese":                   "ham cheese toastie sandwich food plate",
  "homemade cheese and tomato pizza": "cheese tomato pizza homemade baked food",
  "fish fingers with oven chips":     "fish fingers chips plate food",
};

// ── Query builder ─────────────────────────────────────────────────────────────

export function buildImageQuery(recipeName: string): string {
  const lc = recipeName.toLowerCase().trim();

  // Check override map first — most reliable for known problematic dishes
  for (const [key, override] of Object.entries(DISH_QUERY_OVERRIDES)) {
    if (lc.includes(key)) return override;
  }

  const cleaned = lc
    .replace(/\b(air fryer|one-pan|one pan|slow cooker|instant pot|classic|quick|easy|simple|creamy|homemade|baked)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const contextWord = (() => {
    if (/\bsoup\b|\bchowder\b|\bbisque\b/.test(cleaned))                               return "soup bowl";
    if (/\bcurry\b|\bmasala\b|\btikka\b|\bkorma\b|\bdal\b|\bdahl\b/.test(cleaned))    return "curry dish";
    if (/\bstir[- ]?fry\b|\bchow mein\b/.test(cleaned))                               return "stir fry wok";
    if (/\bpasta\b|\bspaghetti\b|\blasagne\b|\brigatoni\b|\bcarbonara\b/.test(cleaned)) return "pasta plate";
    if (/\bnoodle\b|\bramen\b|\blaksa\b|\bpad thai\b|\bpho\b/.test(cleaned))           return "noodles bowl";
    if (/\bpizza\b/.test(cleaned))                                                      return "pizza";
    if (/\bsalad\b/.test(cleaned))                                                      return "salad bowl fresh";
    if (/\bburger\b/.test(cleaned))                                                     return "burger meal";
    if (/\btaco\b|\bburrito\b|\bwrap\b|\bfajita\b|\bquesadilla\b/.test(cleaned))       return "food fresh";
    if (/\brisotto\b/.test(cleaned))                                                    return "risotto plate";
    if (/\bsteak\b|\bchop\b|\bschnitzel\b|\bkebab\b|\bkofta\b/.test(cleaned))          return "dinner plated";
    if (/\bbreakfast\b|\bfrittata\b|\bomelette\b|\bfritter\b/.test(cleaned))           return "breakfast plate";
    if (/\bbake\b|\broast\b|\btraybake\b|\bstew\b|\bcasserole\b|\bpie\b/.test(cleaned)) return "dinner baked";
    if (/\bchicken\b/.test(cleaned))                                                    return "chicken dinner plate";
    if (/\bbeef\b|\blamb\b/.test(cleaned))                                              return "meat dinner plate";
    if (/\bsalmon\b|\bfish\b|\bprawn\b|\bseafood\b/.test(cleaned))                     return "seafood plate";
    return "food plated";
  })();

  return `${cleaned} ${contextWord}`.replace(/\s+/g, " ").trim();
}

// ── Unsplash fetch ────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt_description: string | null;
  description: string | null;
  width: number;
  height: number;
}

function scoreFoodRelevance(photo: UnsplashPhoto, queryWords: string[]): number {
  let score = 0;
  const altDesc = (photo.alt_description ?? "").toLowerCase();
  const desc = (photo.description ?? "").toLowerCase();
  const combined = `${altDesc} ${desc}`;

  // Strongly prefer landscape orientation
  if (photo.width > photo.height) score += 3;

  // Prefer high-res images
  if (photo.width >= 1200) score += 1;

  // Reward food-related keywords in description
  const foodMatches = FOOD_WORDS.filter(w => combined.includes(w)).length;
  score += Math.min(foodMatches * 2, 6);

  // Reward query word matches in description
  const queryMatches = queryWords.filter(w => w.length > 3 && combined.includes(w)).length;
  score += queryMatches * 3;

  // Penalise images with no alt text at all (more likely to be non-food)
  if (!photo.alt_description && !photo.description) score -= 1;

  return score;
}

async function fetchFromUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;

  try {
    const queryWords = query.toLowerCase().split(/\s+/);
    const encodedQuery = encodeURIComponent(query);
    // Include Food & Drink topic to improve food photo quality
    const url = `${UNSPLASH_BASE}/search/photos?query=${encodedQuery}&per_page=15&orientation=landscape&content_filter=high&order_by=relevant&topics=${FOOD_TOPIC_ID}`;

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
    if (!res.ok) return null;

    const data = await res.json();
    let photos: UnsplashPhoto[] = data?.results ?? [];

    if (photos.length === 0) {
      // No results with topic filter — retry without it for broader coverage
      const fallbackUrl = `${UNSPLASH_BASE}/search/photos?query=${encodedQuery}&per_page=10&orientation=landscape&content_filter=high&order_by=relevant`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_KEY}`,
          "Accept-Version": "v1",
        },
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        photos = fallbackData?.results ?? [];
      }
    }

    if (photos.length === 0) return null;

    // Score and rank — pick highest food-relevance photo
    const scored = photos
      .filter(p => p.urls?.regular)
      .map(p => ({ photo: p, score: scoreFoodRelevance(p, queryWords) }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.photo?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): Promise<string | null> {
  // ── 1. Pinned images — always win, no cache or API calls ─────────────────────
  const nameLc = recipeName.toLowerCase().trim();
  for (const [key, pinnedUrl] of Object.entries(PINNED_IMAGE_URLS)) {
    if (nameLc.includes(key)) return pinnedUrl;
  }

  const cacheKey = `${CACHE_PREFIX}${recipeId}`;

  // ── 2. Session cache ─────────────────────────────────────────────────────────
  if (SESSION_CACHE[cacheKey] !== undefined) {
    return SESSION_CACHE[cacheKey];
  }

  // ── 3. AsyncStorage cache ────────────────────────────────────────────────────
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached !== null) {
      SESSION_CACHE[cacheKey] = cached === "null" ? null : cached;
      return SESSION_CACHE[cacheKey];
    }
  } catch {}

  // ── 4. TheMealDB existingUrl — prefer over Unsplash keyword search ───────────
  // TheMealDB images are professionally photographed and dish-matched by our
  // script. They're more accurate than a keyword search that might return a
  // similar-looking but wrong dish.
  if (existingUrl && existingUrl.includes("themealdb.com")) {
    SESSION_CACHE[cacheKey] = existingUrl;
    try { await AsyncStorage.setItem(cacheKey, existingUrl); } catch {}
    return existingUrl;
  }

  // ── 5. Unsplash live fetch — only for recipes without a TheMealDB URL ────────
  const query = buildImageQuery(recipeName);
  const unsplashUrl = await fetchFromUnsplash(query);

  if (unsplashUrl) {
    SESSION_CACHE[cacheKey] = unsplashUrl;
    try { await AsyncStorage.setItem(cacheKey, unsplashUrl); } catch {}
    return unsplashUrl;
  }

  // ── 6. Simplified fallback query ─────────────────────────────────────────────
  const simpleWords = recipeName
    .split(/\s+/)
    .filter(w => w.length > 3 && !/^(with|and|the|one|pan)$/i.test(w))
    .slice(0, 2);

  if (simpleWords.length >= 1) {
    const simpleUrl = await fetchFromUnsplash(`${simpleWords.join(" ")} food plated`);
    if (simpleUrl) {
      SESSION_CACHE[cacheKey] = simpleUrl;
      try { await AsyncStorage.setItem(cacheKey, simpleUrl); } catch {}
      return simpleUrl;
    }
  }

  // ── 7. Last resort — any existingUrl ─────────────────────────────────────────
  const fallback = existingUrl ?? null;
  SESSION_CACHE[cacheKey] = fallback;
  return fallback;
}

/**
 * Clears the cached image for a single recipe and re-fetches from Unsplash.
 * Used by the "Refresh photo" long-press action on meal cards.
 */
export async function refreshRecipeImage(
  recipeId: string,
  recipeName: string,
  existingUrl?: string
): Promise<string | null> {
  const cacheKey = `${CACHE_PREFIX}${recipeId}`;

  // Clear both caches
  delete SESSION_CACHE[cacheKey];
  try { await AsyncStorage.removeItem(cacheKey); } catch {}

  // Force Unsplash fetch (skip TheMealDB — user wants a fresh alternative)
  const query = buildImageQuery(recipeName);
  const unsplashUrl = await fetchFromUnsplash(query);

  const result = unsplashUrl ?? existingUrl ?? null;
  SESSION_CACHE[cacheKey] = result;
  if (result) {
    try { await AsyncStorage.setItem(cacheKey, result); } catch {}
  }
  return result;
}

export async function prefetchRecipeImages(
  recipes: Array<{ id: string; name: string; imageUrl?: string }>
): Promise<void> {
  const BATCH_SIZE = 5;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(r => getRecipeImage(r.id, r.name, r.imageUrl)));
    if (i + BATCH_SIZE < recipes.length) await delay(300);
  }
}

export async function clearImageCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const imgKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (imgKeys.length > 0) await AsyncStorage.multiRemove(imgKeys);
    Object.keys(SESSION_CACHE).forEach(k => delete SESSION_CACHE[k]);
  } catch {}
}

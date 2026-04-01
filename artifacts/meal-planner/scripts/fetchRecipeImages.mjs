/**
 * Fetches ALL TheMealDB meals by category (just ~14 API calls total),
 * then matches each recipe to the best available image.
 * Safe to re-run — already-set imageUrl fields are skipped.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, "../data/recipes.json");
const BASE_URL = "https://www.themealdb.com/api/json/v1/1";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Fetch all meal stubs for a category.
 * Returns array of { idMeal, strMeal, strMealThumb }
 */
async function getMealsByCategory(category) {
  const data = await get(`${BASE_URL}/filter.php?c=${encodeURIComponent(category)}`);
  return data.meals ?? [];
}

/** Get all TheMealDB categories */
async function getAllCategories() {
  const data = await get(`${BASE_URL}/categories.php`);
  return (data.categories ?? []).map((c) => c.strCategory);
}

/** Normalise a string for comparison */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract significant words (skip stop words) */
const STOP = new Set(["with", "and", "the", "a", "an", "in", "of", "on", "for", "to", "au", "de", "le"]);
function keywords(s) {
  return norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Score how well a TheMealDB meal name matches our recipe name.
 * Higher = better match.
 */
function matchScore(ourName, theirName) {
  const ourKw = keywords(ourName);
  const theirKw = new Set(keywords(theirName));
  let score = 0;
  for (const w of ourKw) {
    if (theirKw.has(w)) score += 2;
    else {
      for (const tw of theirKw) {
        if (tw.includes(w) || w.includes(tw)) score += 1;
      }
    }
  }
  return score;
}

/**
 * Given our recipe name, find the best matching TheMealDB meal
 * from the pre-loaded meal pool.
 */
function findBestMatch(ourName, pool) {
  let best = null;
  let bestScore = 0;
  for (const meal of pool) {
    const score = matchScore(ourName, meal.strMeal);
    if (score > bestScore) {
      bestScore = score;
      best = meal;
    }
  }
  // Only accept matches with at least 1 keyword hit
  return bestScore >= 2 ? best : null;
}

/**
 * For a given recipe, determine which TheMealDB category pool to search first.
 */
function primaryCategory(recipe) {
  const name = recipe.name.toLowerCase();
  const pt = (recipe.proteinType ?? "").toLowerCase();
  const ct = (recipe.cuisineType ?? "").toLowerCase();

  if (pt === "chicken" || name.includes("chicken") || name.includes("poultry")) return "Chicken";
  if (pt === "beef" || name.includes("beef") || name.includes("steak") || name.includes("mince")) return "Beef";
  if (pt === "pork" || name.includes("pork") || name.includes("ham") || name.includes("sausage") || name.includes("bacon") || name.includes("chorizo")) return "Pork";
  if (pt === "lamb" || name.includes("lamb") || name.includes("souvlaki") || name.includes("kofta")) return "Lamb";
  if (pt === "seafood" || name.includes("prawn") || name.includes("salmon") || name.includes("fish") || name.includes("tuna") || name.includes("seafood") || name.includes("barramundi") || name.includes("scallop") || name.includes("calamari")) return "Seafood";
  if (name.includes("pasta") || name.includes("spaghetti") || name.includes("penne") || name.includes("risotto") || name.includes("lasagna") || name.includes("carbonara") || name.includes("bolognese")) return "Pasta";
  if (name.includes("goat")) return "Goat";
  if (pt === "eggs" || name.includes("egg") || name.includes("frittata") || name.includes("omelette") || name.includes("shakshuka") || name.includes("pancake")) return "Breakfast";
  if (pt === "none" || name.includes("tofu") || name.includes("vegan") || name.includes("tempeh")) return "Vegan";
  if (pt === "legumes" || name.includes("chickpea") || name.includes("lentil") || name.includes("dahl") || name.includes("dal") || name.includes("bean") || name.includes("falafel")) return "Vegetarian";

  return "Miscellaneous";
}

async function main() {
  const recipes = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const needImages = recipes.filter((r) => !r.imageUrl);
  console.log(`Loaded ${recipes.length} recipes. Need images: ${needImages.length}`);

  if (needImages.length === 0) {
    console.log("All recipes already have images!");
    return;
  }

  // Step 1: Load all TheMealDB categories
  console.log("\nLoading TheMealDB categories...");
  const categories = await getAllCategories();
  console.log(`Found ${categories.length} categories: ${categories.join(", ")}`);
  await sleep(500);

  // Step 2: Fetch all meals for each category
  const poolByCategory = {};
  for (const cat of categories) {
    try {
      const meals = await getMealsByCategory(cat);
      poolByCategory[cat] = meals;
      console.log(`  ${cat}: ${meals.length} meals`);
      await sleep(300);
    } catch (e) {
      console.log(`  ${cat}: failed — ${e.message}`);
      poolByCategory[cat] = [];
    }
  }

  // Combine all meals into one global pool for fallback
  const allMeals = Object.values(poolByCategory).flat();
  console.log(`\nTotal meals in pool: ${allMeals.length}`);

  // Step 3: Match each recipe to best available image
  let found = 0;
  let missing = 0;

  for (const recipe of recipes) {
    if (recipe.imageUrl) continue;

    // Try primary category first, then all meals
    const primaryCat = primaryCategory(recipe);
    const primaryPool = poolByCategory[primaryCat] ?? [];
    const searchPools = [primaryPool, allMeals];

    let matched = null;
    for (const pool of searchPools) {
      matched = findBestMatch(recipe.name, pool);
      if (matched) break;
    }

    if (matched) {
      recipe.imageUrl = matched.strMealThumb;
      found++;
      console.log(`  ✓ [${recipe.id}] ${recipe.name} → ${matched.strMeal}`);
    } else {
      // Last resort: assign a category-appropriate placeholder from the pool
      const fallbackPool = primaryPool.length > 0 ? primaryPool : allMeals;
      const fallback = fallbackPool[Math.floor(Math.abs(hashCode(recipe.id)) % fallbackPool.length)];
      if (fallback) {
        recipe.imageUrl = fallback.strMealThumb;
        found++;
        console.log(`  ~ [${recipe.id}] ${recipe.name} → (category fallback: ${fallback.strMeal})`);
      } else {
        missing++;
        console.log(`  ✗ [${recipe.id}] ${recipe.name}`);
      }
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(recipes, null, 2));
  const total = recipes.filter((r) => r.imageUrl).length;
  console.log(`\n=== Done ===`);
  console.log(`Newly assigned: ${found} | Still missing: ${missing}`);
  console.log(`Total with images: ${total}/${recipes.length} (${Math.round(total / recipes.length * 100)}%)`);
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});

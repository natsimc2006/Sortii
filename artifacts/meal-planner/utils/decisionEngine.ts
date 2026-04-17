/**
 * Sortii Decision Engine
 * Produces 1–2 calm status items for "Help me sort this" mode.
 *
 * Priority:
 *  1. Tonight's dinner (always shown)
 *  2. Tomorrow's dinner — or a family note — or quiet reassurance
 *
 * Items are statements, not tasks. Tone is observational, never urgent.
 */

export interface HelpItem {
  id: string;
  text: string;
  positive: boolean; // true = reassuring, false = gentle heads-up
}

interface PlanEntry {
  day: string;
  slot: string;
  recipeId?: string;
}

interface Recipe {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

const DAYS = [
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
];

function getTodayIdx(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getDinnerFor(
  day: string,
  plan: PlanEntry[],
  recipes: Recipe[]
): Recipe | null {
  const entry = plan.find(
    (e) => e.day === day && e.slot === "dinner" && e.recipeId
  );
  if (!entry?.recipeId) return null;
  return recipes.find((r) => r.id === entry.recipeId) ?? null;
}

export function buildHelpItems(
  currentPlan: PlanEntry[],
  allRecipes: Recipe[],
  kidsActivities: Activity[]
): HelpItem[] {
  const items: HelpItem[] = [];
  const todayIdx    = getTodayIdx();
  const todayName   = DAYS[todayIdx];
  const tomorrowName = DAYS[(todayIdx + 1) % 7];

  // ── Item 1: Tonight ──────────────────────────────────────────
  const tonightRecipe = getDinnerFor(todayName, currentPlan, allRecipes);
  items.push({
    id: "tonight",
    text: tonightRecipe
      ? `Tonight's dinner is sorted.`
      : "Tonight's dinner isn't sorted yet.",
    positive: !!tonightRecipe,
  });

  // ── Item 2: Tomorrow, family note, or quiet reassurance ──────
  const tomorrowRecipe = getDinnerFor(tomorrowName, currentPlan, allRecipes);

  if (tomorrowRecipe) {
    items.push({
      id: "tomorrow",
      text: "Tomorrow's looking fine.",
      positive: true,
    });
  } else if (kidsActivities.length > 0) {
    items.push({
      id: "family",
      text: `${kidsActivities[0].name} is on the list.`,
      positive: true,
    });
  } else {
    // Only add a second item if there's something worth saying
    const anyMealsPlanned = currentPlan.some(
      (e) => e.slot === "dinner" && e.recipeId
    );
    if (anyMealsPlanned && !tonightRecipe) {
      items.push({
        id: "general",
        text: "No rush on anything else right now.",
        positive: true,
      });
    } else if (!anyMealsPlanned) {
      items.push({
        id: "general",
        text: "One thing at a time is enough.",
        positive: true,
      });
    }
    // If tonight is sorted and nothing else notable — just show the one item
  }

  return items.slice(0, 2);
}

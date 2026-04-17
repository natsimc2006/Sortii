/**
 * Sortii Decision Engine
 * Selects 2–3 contextual, calm actions for "Help me sort this" mode.
 *
 * Priority order:
 *  1. Today (tonight's dinner)
 *  2. Next 48h (tomorrow, family activities)
 *  3. Gaps (first empty day after tomorrow)
 *  4. General affirmation
 */

export interface HelpAction {
  id: string;
  icon: string;
  text: string;
  sub: string;
  color: string;
  startDone: boolean;
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

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";

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

export function buildHelpActions(
  currentPlan: PlanEntry[],
  allRecipes: Recipe[],
  kidsActivities: Activity[]
): HelpAction[] {
  const actions: HelpAction[] = [];
  const todayIdx = getTodayIdx();
  const todayName = DAYS[todayIdx];
  const tomorrowName = DAYS[(todayIdx + 1) % 7];

  // ── Priority 1: Tonight ──────────────────────────────────────
  const tonightRecipe = getDinnerFor(todayName, currentPlan, allRecipes);
  if (tonightRecipe) {
    actions.push({
      id: "tonight",
      icon: "moon",
      text: `Tonight: ${tonightRecipe.name}`,
      sub: "Already sorted. Nothing to do here.",
      color: TEAL,
      startDone: true,
    });
  } else {
    actions.push({
      id: "tonight",
      icon: "moon",
      text: "Glance at tonight's dinner",
      sub: "Just a quick look. No commitment needed.",
      color: GOLD,
      startDone: false,
    });
  }

  if (actions.length >= 3) return actions.slice(0, 3);

  // ── Priority 2: Tomorrow ─────────────────────────────────────
  const tomorrowRecipe = getDinnerFor(tomorrowName, currentPlan, allRecipes);
  if (tomorrowRecipe) {
    actions.push({
      id: "tomorrow",
      icon: "calendar",
      text: `Tomorrow: ${tomorrowRecipe.name}`,
      sub: "One less thing to think about.",
      color: TEAL,
      startDone: true,
    });
  } else {
    // Is there a family activity to surface instead?
    if (kidsActivities.length > 0) {
      actions.push({
        id: "family_check",
        icon: "star",
        text: `${kidsActivities[0].name} is on the list`,
        sub: "Already noted. Nothing else needed.",
        color: GOLD,
        startDone: true,
      });
    } else {
      actions.push({
        id: "tomorrow_gap",
        icon: "calendar",
        text: "Tomorrow's dinner isn't sorted",
        sub: "Add something quick if that helps.",
        color: GOLD,
        startDone: false,
      });
    }
  }

  if (actions.length >= 3) return actions.slice(0, 3);

  // ── Priority 3: Gaps later in week / Family / Affirmation ────
  const remainingDays = DAYS.slice(todayIdx + 2);
  const firstGap = remainingDays.find(
    (day) => !getDinnerFor(day, currentPlan, allRecipes)
  );

  if (kidsActivities.length > 1) {
    // Multiple kids activities — surface as a reassurance
    actions.push({
      id: "family_count",
      icon: "star",
      text: `${kidsActivities.length} things on for the kids this week`,
      sub: "All noted. You've got it covered.",
      color: GOLD,
      startDone: true,
    });
  } else if (firstGap) {
    actions.push({
      id: "week_gap",
      icon: "plus-circle",
      text: `${firstGap}'s dinner isn't sorted yet`,
      sub: "Add one. That's enough for now.",
      color: GOLD,
      startDone: false,
    });
  } else {
    // Week is in good shape — affirmation
    actions.push({
      id: "affirm",
      icon: "heart",
      text: "One thing at a time is enough.",
      sub: "That's not a pep talk. It's just true.",
      color: PLUM,
      startDone: false,
    });
  }

  return actions.slice(0, 3);
}

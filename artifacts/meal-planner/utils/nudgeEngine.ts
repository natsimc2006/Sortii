/**
 * Sortii Nudge Engine
 * Computes a single, calm in-app nudge when the user opens the home screen.
 *
 * Rules:
 * – Max 1 nudge per day
 * – Only trigger when genuinely meaningful
 * – Warm, observational, never urgent or guilt-driven
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

function lastOpenedKey() { return SK.lastOpened(getCurrentUserId()); }
function nudgeDateKey()  { return SK.nudgeDate(getCurrentUserId()); }

const DAYS = [
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
];

export interface Nudge {
  id: string;
  message: string;
  sub: string;
  color: string;
  icon: string;
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Nudge copy pools ─────────────────────────────────────────────

const REENTRY_NUDGES = [
  {
    message: "Haven't checked in for a few days.",
    sub: "Want a quick look at how the week's sitting?",
  },
  {
    message: "Been a little while.",
    sub: "Nothing dramatic. Worth a glance when you're ready.",
  },
  {
    message: "Good to see you back.",
    sub: "The week's still here. Want a quick look?",
  },
];

const TONIGHT_EMPTY_NUDGES = [
  {
    message: "Dinner tonight isn't sorted.",
    sub: "Worth a quick look if you haven't already.",
  },
  {
    message: "Nothing planned for tonight.",
    sub: "Could be a moment to add something quick.",
  },
];

const GAP_NUDGES = [
  (day: string) => ({
    message: `Dinner's not sorted after ${day}.`,
    sub: "No rush. Worth a glance when you get a moment.",
  }),
  (day: string) => ({
    message: `${day} onwards is looking a bit light on dinner.`,
    sub: "One meal at a time if that's easier.",
  }),
];

const EMPTY_WEEK_NUDGES = [
  {
    message: "The week's still wide open.",
    sub: "Add one thing when you're ready. No pressure.",
  },
  {
    message: "Nothing planned yet this week.",
    sub: "Could be worth a quick look when you've got a moment.",
  },
];

// ── Main export ──────────────────────────────────────────────────

export async function computeNudge(
  currentPlan: PlanEntry[],
  allRecipes: Recipe[]
): Promise<Nudge | null> {
  const today = new Date().toDateString();

  // Enforce max 1 nudge per day
  const lastNudgeDate = await AsyncStorage.getItem(nudgeDateKey());
  if (lastNudgeDate === today) return null;

  const todayIdx = getTodayIdx();
  const todayName = DAYS[todayIdx];

  // ── Re-entry: user hasn't opened in 3+ days ──────────────────
  const lastOpenedStr = await AsyncStorage.getItem(lastOpenedKey());
  if (lastOpenedStr) {
    const daysSince =
      (Date.now() - parseInt(lastOpenedStr, 10)) / (1000 * 60 * 60 * 24);
    if (daysSince >= 3) {
      const copy = pick(REENTRY_NUDGES);
      await AsyncStorage.setItem(nudgeDateKey(), today);
      return { id: "reentry", ...copy, color: "#2A8F88", icon: "clock" };
    }
  }

  // ── Tonight is empty ─────────────────────────────────────────
  const anyMealsPlanned = currentPlan.some(
    (e) => e.slot === "dinner" && e.recipeId
  );

  if (!anyMealsPlanned) {
    const copy = pick(EMPTY_WEEK_NUDGES);
    await AsyncStorage.setItem(nudgeDateKey(), today);
    return { id: "empty_week", ...copy, color: "#D29A22", icon: "calendar" };
  }

  const tonightRecipe = getDinnerFor(todayName, currentPlan, allRecipes);
  if (!tonightRecipe) {
    const copy = pick(TONIGHT_EMPTY_NUDGES);
    await AsyncStorage.setItem(nudgeDateKey(), today);
    return { id: "tonight_gap", ...copy, color: "#D29A22", icon: "moon" };
  }

  // ── Gap within next 3 days ────────────────────────────────────
  for (let i = todayIdx + 1; i <= todayIdx + 3 && i < 7; i++) {
    const day = DAYS[i];
    if (!getDinnerFor(day, currentPlan, allRecipes)) {
      const lastDayWithDinner = i > 0 ? DAYS[i - 1] : todayName;
      const copy = pick(GAP_NUDGES)(lastDayWithDinner);
      await AsyncStorage.setItem(nudgeDateKey(), today);
      return { id: "gap", ...copy, color: "#D29A22", icon: "calendar" };
    }
  }

  // ── Gap later in the week (only surface Mon/Wed to avoid fatigue) ──
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon
  if (dayOfWeek === 1 || dayOfWeek === 3) {
    for (let i = todayIdx + 4; i < 7; i++) {
      const day = DAYS[i];
      if (!getDinnerFor(day, currentPlan, allRecipes)) {
        await AsyncStorage.setItem(nudgeDateKey(), today);
        return {
          id: "late_gap",
          message: `${day}'s looking unplanned.`,
          sub: "Worth adding something when you get a moment.",
          color: "#D29A22",
          icon: "calendar",
        };
      }
    }
  }

  return null;
}

/** Call this on every home screen mount — after computing nudge */
export async function recordAppOpen(): Promise<void> {
  await AsyncStorage.setItem(lastOpenedKey(), Date.now().toString());
}

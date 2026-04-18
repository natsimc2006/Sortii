import { WeeklyMode } from './onboardingState';
import type { LifestyleSpendData } from './onboardingState';

export type { LifestyleSpendData };

export interface MoneySuggestion {
  id: string;
  label: string;
  impactAmount: number;
  reason?: string;
  category?: SuggestionCategory;
  isGoalProjection?: boolean;
  isMonthlyNudge?: boolean;
  goalEmoji?: string;
}

export type SuggestionCategory = 'money' | 'meals' | 'combined';
export type WeekGoal = 'holiday' | 'house' | 'wedding' | 'general' | 'none';
export type WeeklyState = 'over' | 'tight' | 'ok' | 'good' | 'great';

export interface MoneyEngineInput {
  weeklyIncome: number;
  fixedWeeklyCosts: number;
  groceriesWeekly: number;
  eatingOutWeekly?: number;
  otherWeeklySpend?: number;
}

export interface MealsEngineInput {
  dinnersPlanned: number;
  dinnerPlanCost: number;
  householdSize?: number;
}

export interface YourWeekInputs {
  weeklyMode: WeeklyMode | null;
  goal: WeekGoal;
  hasMealsSetup: boolean;
  hasMoneySetup: boolean;
  meals: MealsEngineInput | null;
  money: MoneyEngineInput | null;
}

export interface WeekSummary {
  dinnersPlanned: number;
  dinnerPlanCost: number;
  groceriesWeekly: number;
  weeklyState: WeeklyState | null;
  dinnerInsight: string;
}

export interface QuickFix {
  id: string;
  text: string;
}

export interface YourWeekResult {
  headline: string;
  summary: WeekSummary;
  suggestions: QuickFix[];
  goalNudge: string | null;
  weeklyState: WeeklyState | null;
}

function computeWeeklyState(money: MoneyEngineInput): WeeklyState {
  const {
    weeklyIncome,
    fixedWeeklyCosts,
    groceriesWeekly,
    eatingOutWeekly = 0,
    otherWeeklySpend = 0,
  } = money;
  if (weeklyIncome <= 0) return 'ok';
  const totalSpend = fixedWeeklyCosts + groceriesWeekly + eatingOutWeekly + otherWeeklySpend;
  const breathing = weeklyIncome - totalSpend;
  const ratio = breathing / weeklyIncome;
  if (ratio < 0) return 'over';
  if (ratio < 0.05) return 'tight';
  if (ratio < 0.15) return 'ok';
  if (ratio < 0.3) return 'good';
  return 'great';
}

function headlineForState(state: WeeklyState, weeklyMode: WeeklyMode | null): string {
  switch (state) {
    case 'over':  return "Tight week ahead — let's find some room";
    case 'tight': return 'A few small swaps could make a difference';
    case 'ok':    return weeklyMode === 'budget'
                    ? 'Holding steady — every bit counts'
                    : "You've got a handle on things";
    case 'good':  return "This week's looking pretty solid";
    case 'great': return "You're in a good place this week";
  }
}

function dinnerInsightFor(
  dinnersPlanned: number,
  weeklyMode: WeeklyMode | null
): string {
  if (dinnersPlanned === 0) return 'No meals planned yet';
  const label = `${dinnersPlanned} dinner${dinnersPlanned !== 1 ? 's' : ''} planned`;
  if (weeklyMode === 'easy') return `${label} — keeping it relaxed`;
  if (weeklyMode === 'budget') return `${label} — keeping costs down`;
  return label;
}

const PLANNER_QUICK_FIXES: QuickFix[] = [
  { id: '1', text: 'Cook once, eat twice — batch one dinner to cover tomorrow night' },
  { id: '2', text: 'Swap one takeaway meal for a home cook this week' },
  { id: '3', text: 'Check the freezer before the weekly shop — avoid buying doubles' },
  { id: '4', text: 'Pick the cheapest protein option for at least two dinners' },
  { id: '5', text: "Plan around what's already in the fridge before buying more" },
  { id: '6', text: 'One big-batch meal covers two nights — less cooking, less cost' },
];

function goalNudgeFor(goal: WeekGoal): string | null {
  switch (goal) {
    case 'holiday': return "Every dinner at home brings the trip a little closer. ✈️";
    case 'house':   return "Each week you cook is a step toward your deposit. 🏠";
    case 'wedding': return "Small savings now add up faster than you think. 💍";
    case 'general': return "You're building a great habit, week by week.";
    default:        return null;
  }
}

export function buildYourWeek(inputs: YourWeekInputs): YourWeekResult {
  const { weeklyMode, goal, hasMealsSetup, hasMoneySetup, meals, money } = inputs;

  const weeklyState = money ? computeWeeklyState(money) : null;

  let headline: string;
  if (!hasMealsSetup && !hasMoneySetup) {
    headline = "Let's sort your week";
  } else if (hasMealsSetup && !hasMoneySetup) {
    headline = 'Add a budget layer';
  } else if (!hasMealsSetup && hasMoneySetup) {
    headline = 'Plan dinners around this budget';
  } else if (weeklyState) {
    headline = headlineForState(weeklyState, weeklyMode);
  } else {
    headline = "Your week, sorted";
  }

  const summary: WeekSummary = {
    dinnersPlanned: meals?.dinnersPlanned ?? 0,
    dinnerPlanCost: meals?.dinnerPlanCost ?? 0,
    groceriesWeekly: money?.groceriesWeekly ?? 0,
    weeklyState,
    dinnerInsight: dinnerInsightFor(meals?.dinnersPlanned ?? 0, weeklyMode),
  };

  const showSuggestions = weeklyState === 'over' || weeklyState === 'tight';
  const suggestions = showSuggestions ? PLANNER_QUICK_FIXES.slice(0, 3) : [];

  return {
    headline,
    summary,
    suggestions,
    goalNudge: goalNudgeFor(goal),
    weeklyState,
  };
}

// ─── Money page ───────────────────────────────────────────────

export interface MoneyPageResult {
  weeklyState: WeeklyState | null;
  snapshotHeadline: string;
  remaining: number;
  suggestions: MoneySuggestion[];
  dinnerInsight: string;
  estimatedDinnerSpend: number;
  fullWeekDinnerEstimate: number;
  plannedMealsCount: number;
  hasGroceries: boolean;
  hasEatingOutData: boolean;
  isPartialSetup: boolean;
}

function snapshotHeadlineFor(state: WeeklyState): string {
  switch (state) {
    case 'over':  return "Slightly over — nothing a leftover night won't fix.";
    case 'tight': return 'A little tight. Tap the quick wins below.';
    case 'ok':    return "Holding steady. Not bad at all.";
    case 'good':  return "You're in a good spot. Dinner's doing the work.";
    case 'great': return "You're smashing it. Dinner at home is paying off.";
  }
}

// ─── Dynamic suggestion builder ───────────────────────────────

const GOAL_TARGETS: Partial<Record<WeekGoal, number>> = {
  holiday: 500,
  house: 800,
  wedding: 600,
  general: 300,
};

const GOAL_LABELS: Partial<Record<WeekGoal, string>> = {
  holiday: 'trip fund',
  house: 'deposit goal',
  wedding: 'wedding fund',
  general: 'savings goal',
};

const GOAL_EMOJIS: Partial<Record<WeekGoal, string>> = {
  holiday: '✈️',
  house: '🏠',
  wedding: '💍',
  general: '🐷',
};

function buildDynamicSuggestions(
  weeklyState: WeeklyState | null,
  money: MoneyEngineInput | null,
  hasMealsSetup: boolean,
  dinnerPlanCost: number,
  weeklySortiiSaving: number,
  lifestyleSpend: LifestyleSpendData | null,
  hasBatchMeal: boolean,
  goal: WeekGoal,
  fmt: (n: number) => string,
): MoneySuggestion[] {
  if (!weeklyState) return [];

  const ls = lifestyleSpend ?? { streaming: 0, coffee: 0, entertainment: 0 };
  const eatingOutWeekly = money?.eatingOutWeekly ?? 0;
  const groceriesWeekly = money?.groceriesWeekly ?? 0;
  const isOverOrTight = weeklyState === 'over' || weeklyState === 'tight';
  const isOkOrBetter = !isOverOrTight;

  // ── Personalised tips — shown in all states when thresholds met ─
  const personalised: MoneySuggestion[] = [];

  if (eatingOutWeekly >= 30) {
    const impact = Math.max(Math.round(eatingOutWeekly * 0.4), 20);
    personalised.push({
      id: 'skip_takeaway',
      label: "You're leaning a bit on takeaway.",
      reason: "Skipping one this week could ease things nicely.",
      impactAmount: impact,
      category: 'money',
    });
  }

  if (ls.streaming > 15) {
    const impact = Math.round(ls.streaming * 0.5);
    if (impact > 0) {
      personalised.push({
        id: 'pause_subscription',
        label: "Subscriptions are quietly stacking up.",
        reason: "Pausing one for a month wouldn't hurt.",
        impactAmount: impact,
        category: 'money',
      });
    }
  }

  if (ls.coffee > 12) {
    const impact = Math.round(ls.coffee / 3);
    if (impact > 0) {
      personalised.push({
        id: 'skip_coffee',
        label: "Coffee's doing its thing.",
        reason: "Skip a couple this week if things feel tight.",
        impactAmount: impact,
        category: 'money',
      });
    }
  }

  if (groceriesWeekly > 150) {
    personalised.push({
      id: 'grocery_trim',
      label: "Your grocery shop is on the higher side.",
      reason: "One or two brand swaps could take the edge off.",
      impactAmount: 18,
      category: 'money',
    });
  }

  if (ls.entertainment > 25) {
    const impact = Math.round(ls.entertainment * 0.4);
    if (impact > 0) {
      personalised.push({
        id: 'skip_entertainment',
        label: "A lot happening this week.",
        reason: "One quieter night in could help balance things.",
        impactAmount: impact,
        category: 'money',
      });
    }
  }

  // ── Meals-based tips ──────────────────────────────────────
  const mealsTips: MoneySuggestion[] = [];

  if (hasMealsSetup && hasBatchMeal) {
    mealsTips.push({
      id: 'leftover_night',
      label: "You've got a batch meal this week. Let it cover two nights.",
      reason: "Cook once. Eat twice. The shopping list already accounts for it.",
      impactAmount: 15,
      category: 'meals',
    });
  } else if (eatingOutWeekly > 0 && !hasMealsSetup) {
    mealsTips.push({
      id: 'eating_out_nomeal',
      label: `You've got ${fmt(eatingOutWeekly)} on eating out and no dinners planned.`,
      reason: "Lock in a few dinners and watch that number shrink.",
      impactAmount: Math.round(eatingOutWeekly * 0.3),
      category: 'combined',
    });
  }

  // ── Fallback static tip ───────────────────────────────────
  const freezerCheck: MoneySuggestion = {
    id: 'freezer_check',
    label: "There's almost definitely something in the freezer.",
    reason: "Check before you shop — free food you forgot about.",
    impactAmount: 10,
    category: 'money',
  };

  // ── Always-last nudges (goal projections) ─────────────────
  const alwaysLast: MoneySuggestion[] = [];

  let goalAlmostThereFired = false;
  if (goal !== 'none' && isOkOrBetter && weeklySortiiSaving > 0) {
    const target = GOAL_TARGETS[goal];
    const goalLabel = GOAL_LABELS[goal];
    const goalEmoji = GOAL_EMOJIS[goal];
    if (target && goalLabel && goalEmoji) {
      const weeksLeft = Math.ceil(target / weeklySortiiSaving);
      if (weeksLeft >= 1 && weeksLeft <= 3) {
        goalAlmostThereFired = true;
        let label: string;
        let reason: string;
        if (weeksLeft === 1) {
          label = `One more week and ${goalLabel} is yours.`;
          reason = "This is the one. Make it count.";
        } else if (weeksLeft === 2) {
          label = `Two weeks away from ${goalLabel}. Don't stop now.`;
          reason = "You've done the hard part. Keep dinners sorted and you're there.";
        } else {
          label = `${goalLabel} is closer than it looks.`;
          reason = "Three more weeks like this one and you're done.";
        }
        alwaysLast.unshift({
          id: 'goal_almost_there',
          label,
          reason,
          impactAmount: 0,
          category: 'combined',
          isGoalProjection: true,
          goalEmoji,
        });
      }
    }
  }

  if (!goalAlmostThereFired && isOkOrBetter && hasMealsSetup && weeklySortiiSaving > 0) {
    const monthlyProjection = Math.round(weeklySortiiSaving * 4);
    if (monthlyProjection > 0) {
      alwaysLast.push({
        id: 'monthly_projection_nudge',
        label: `Keep this up — that's ~${fmt(monthlyProjection)}/month saved on dinners.`,
        impactAmount: 0,
        category: 'combined',
        isMonthlyNudge: true,
      });
    }
  }

  if (goal !== 'none' && isOkOrBetter && hasMealsSetup && dinnerPlanCost > 0 && weeklySortiiSaving > 0) {
    const target = GOAL_TARGETS[goal];
    const goalLabel = GOAL_LABELS[goal];
    const goalEmoji = GOAL_EMOJIS[goal];
    if (target && goalLabel && goalEmoji) {
      const monthlyRate = weeklySortiiSaving * 4;
      const weeksToGoal = Math.ceil(target / monthlyRate);
      if (weeksToGoal >= 4 && weeksToGoal <= 52) {
        alwaysLast.push({
          id: 'goal_projection_forward',
          label: `At this rate, you're hitting your ${goalLabel} in about ${weeksToGoal} weeks.`,
          reason: "Small habit. Real result.",
          impactAmount: 0,
          category: 'combined',
          isGoalProjection: true,
          goalEmoji,
        });
      }
    }
  }

  // ── Select ────────────────────────────────────────────────
  const sortedPersonalised = [...personalised].sort((a, b) => b.impactAmount - a.impactAmount);

  if (isOverOrTight) {
    const combined = [...sortedPersonalised, ...mealsTips];
    if (combined.length < 3) combined.push(freezerCheck);
    return combined.slice(0, 3);
  } else {
    const topPersonalised = sortedPersonalised.slice(0, 2);
    const base = [...topPersonalised, ...mealsTips];
    if (base.length < 2) base.push(freezerCheck);
    return [...base.slice(0, 2), ...alwaysLast].slice(0, 3);
  }
}

export function buildMoneyPage(
  inputs: YourWeekInputs,
  dinnerPlanCost: number,
  weeklySortiiSaving: number = 0,
  lifestyleSpend: LifestyleSpendData | null = null,
  hasBatchMeal: boolean = false,
  fmt: (n: number) => string = (n) => `$${n}`,
): MoneyPageResult {
  const { hasMealsSetup, money, meals, goal } = inputs;

  const dinnersPlanned = meals?.dinnersPlanned ?? 0;
  const TOTAL_DINNERS_IN_WEEK = 7;

  if (!money) {
    return {
      weeklyState: null,
      snapshotHeadline: "Add your numbers to see a snapshot.",
      remaining: 0,
      suggestions: [],
      dinnerInsight: 'No dinners planned yet.',
      estimatedDinnerSpend: 0,
      fullWeekDinnerEstimate: 0,
      plannedMealsCount: dinnersPlanned,
      hasGroceries: false,
      hasEatingOutData: false,
      isPartialSetup: false,
    };
  }

  const {
    weeklyIncome,
    fixedWeeklyCosts,
    groceriesWeekly,
    eatingOutWeekly = 0,
    otherWeeklySpend = 0,
  } = money;

  const hasGroceries = groceriesWeekly > 0;
  const hasEatingOutData = eatingOutWeekly > 0;
  const isPartialSetup = weeklyIncome > 0 && !hasGroceries;

  const weeklyState = computeWeeklyState(money);
  const remaining = weeklyIncome - fixedWeeklyCosts - groceriesWeekly - eatingOutWeekly - otherWeeklySpend;

  // Full-week estimate: ~65% of groceries covers all 7 dinners
  const fullWeekDinnerEstimate = Math.round(groceriesWeekly * 0.65);

  // Proportional estimate: scaled to how many dinners are actually planned
  const proportion = dinnersPlanned > 0 ? Math.min(dinnersPlanned / TOTAL_DINNERS_IN_WEEK, 1) : 1;
  const estimatedDinnerSpend = hasGroceries
    ? Math.round(fullWeekDinnerEstimate * proportion)
    : 0;

  // Dinner insight
  let dinnerInsight: string;
  if (!hasGroceries) {
    dinnerInsight = 'Add your weekly grocery spend to see how your dinners track.';
  } else if (!hasMealsSetup || dinnerPlanCost === 0) {
    dinnerInsight = `Based on your grocery input, dinners would normally land around ${fmt(Math.round(fullWeekDinnerEstimate > 0 ? fullWeekDinnerEstimate : groceriesWeekly * 0.65))} for the week.`;
  } else {
    const coverageNote = dinnersPlanned < TOTAL_DINNERS_IN_WEEK
      ? `This plan covers ${dinnersPlanned} of ${TOTAL_DINNERS_IN_WEEK} dinners. `
      : '';

    if (dinnerPlanCost < estimatedDinnerSpend * 0.9) {
      dinnerInsight = `${coverageNote}Sortii has already helped pull some of that back this week.`;
    } else if (dinnerPlanCost > estimatedDinnerSpend * 1.2) {
      dinnerInsight = `${coverageNote}Dinner spend is nudging over your usual. One swap could sort it.`;
    } else {
      dinnerInsight = `${coverageNote}Dinners are tracking close to your usual spend. Nothing to worry about.`;
    }
  }

  const suggestions = buildDynamicSuggestions(
    weeklyState,
    money,
    hasMealsSetup,
    dinnerPlanCost,
    weeklySortiiSaving,
    lifestyleSpend,
    hasBatchMeal,
    goal,
    fmt,
  );

  return {
    weeklyState,
    snapshotHeadline: snapshotHeadlineFor(weeklyState),
    remaining,
    suggestions,
    dinnerInsight,
    estimatedDinnerSpend,
    fullWeekDinnerEstimate,
    plannedMealsCount: dinnersPlanned,
    hasGroceries,
    hasEatingOutData,
    isPartialSetup,
  };
}

import { WeeklyMode } from './onboardingState';

export interface MoneySuggestion {
  id: string;
  label: string;
  impactAmount: number;
  reason?: string;
}

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

const ALL_SUGGESTIONS: QuickFix[] = [
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
  const suggestions = showSuggestions ? ALL_SUGGESTIONS.slice(0, 3) : [];

  return {
    headline,
    summary,
    suggestions,
    goalNudge: goalNudgeFor(goal),
    weeklyState,
  };
}

// ─── Money page ───────────────────────────────────────────────

const MONEY_SUGGESTIONS: MoneySuggestion[] = [
  {
    id: 'm1',
    label: 'Swap one takeaway for a home cook',
    impactAmount: 25,
    reason: 'The easiest saving you\'ll make all week.',
  },
  {
    id: 'm2',
    label: 'Batch one dinner — it covers two nights',
    impactAmount: 15,
    reason: 'Cook once, eat twice. Less faff, less cost.',
  },
  {
    id: 'm3',
    label: 'Pick the cheaper protein this week',
    impactAmount: 12,
    reason: 'Chicken thighs beat chicken breast every time.',
  },
  {
    id: 'm4',
    label: 'One fridge-raid night — skip the shop',
    impactAmount: 20,
  },
  {
    id: 'm5',
    label: 'Check the freezer before you shop',
    impactAmount: 10,
    reason: 'Avoid buying what you already have.',
  },
  {
    id: 'm6',
    label: 'Meal-prep lunch instead of buying it',
    impactAmount: 30,
    reason: 'Four bought lunches add up faster than you think.',
  },
];

export interface MoneyPageResult {
  weeklyState: WeeklyState | null;
  snapshotHeadline: string;
  remaining: number;
  suggestions: MoneySuggestion[];
  dinnerInsight: string;
  // Proportional estimate — scaled to meals actually planned (not full-week)
  estimatedDinnerSpend: number;
  // Full-week dinner allocation (65% of groceries, all 7 nights)
  fullWeekDinnerEstimate: number;
  plannedMealsCount: number;
  // Gating flags for conditional UI
  hasGroceries: boolean;
  hasEatingOutData: boolean;
  isPartialSetup: boolean;   // true when income/fixed costs entered but no groceries
}

function snapshotHeadlineFor(state: WeeklyState): string {
  switch (state) {
    case 'over':  return 'Slight overspend — a couple of easy fixes below.';
    case 'tight': return 'A little tight this week — worth a look.';
    case 'ok':    return "Holding steady this week.";
    case 'good':  return "You're in a good spot this week.";
    case 'great': return "You're in a great spot — looking solid.";
  }
}

export function buildMoneyPage(
  inputs: YourWeekInputs,
  dinnerPlanCost: number,
): MoneyPageResult {
  const { hasMealsSetup, money, meals } = inputs;

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
  // Partial setup: user has income/fixed costs but hasn't entered grocery spend yet
  const isPartialSetup = weeklyIncome > 0 && !hasGroceries;

  const weeklyState = computeWeeklyState(money);
  const remaining = weeklyIncome - fixedWeeklyCosts - groceriesWeekly - eatingOutWeekly - otherWeeklySpend;

  const isOver = weeklyState === 'over' || weeklyState === 'tight';
  const suggestions = isOver ? MONEY_SUGGESTIONS.slice(0, 3) : MONEY_SUGGESTIONS.slice(3, 5);

  // Full-week estimate: ~65% of groceries covers all 7 dinners
  const fullWeekDinnerEstimate = Math.round(groceriesWeekly * 0.65);

  // Proportional estimate: scaled to how many dinners are actually planned
  const proportion = dinnersPlanned > 0 ? Math.min(dinnersPlanned / TOTAL_DINNERS_IN_WEEK, 1) : 1;
  const estimatedDinnerSpend = hasGroceries
    ? Math.round(fullWeekDinnerEstimate * proportion)
    : 0;

  // Dinner insight — proportional and coverage-aware
  let dinnerInsight: string;
  if (!hasGroceries) {
    dinnerInsight = 'Add your weekly grocery spend to see how your dinners track.';
  } else if (!hasMealsSetup || dinnerPlanCost === 0) {
    dinnerInsight = `About 65% of your grocery spend goes to dinners — roughly ${Math.round(fullWeekDinnerEstimate > 0 ? fullWeekDinnerEstimate : groceriesWeekly * 0.65)} for the week.`;
  } else {
    const coverageNote = dinnersPlanned < TOTAL_DINNERS_IN_WEEK
      ? `This plan covers ${dinnersPlanned} of ${TOTAL_DINNERS_IN_WEEK} dinners. `
      : '';

    if (dinnerPlanCost < estimatedDinnerSpend * 0.9) {
      dinnerInsight = `${coverageNote}Your planned dinners come in under the estimate — nice work.`;
    } else if (dinnerPlanCost > estimatedDinnerSpend * 1.2) {
      dinnerInsight = `${coverageNote}Your dinner plan is a little over the estimate — a swap or two could help.`;
    } else {
      dinnerInsight = `${coverageNote}Your planned dinners track close to the estimate. Looks good.`;
    }
  }

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

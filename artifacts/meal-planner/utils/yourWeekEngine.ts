import { WeeklyMode } from './onboardingState';

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

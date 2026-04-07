import { SavingsGoal } from './onboardingState';

export function getSavingsGoalCopy(goal: SavingsGoal, weeklyDinnerSaving: number): string {
  const { name, targetAmount, currentSaved, weeklyContributions } = goal;
  const remaining = Math.max(0, targetAmount - currentSaved);
  const percentSaved = targetAmount > 0 ? currentSaved / targetAmount : 0;

  // 1. First week — just set, no contributions yet
  if (weeklyContributions.length === 0) {
    const weeksToGoal =
      weeklyDinnerSaving > 0 ? Math.ceil(remaining / weeklyDinnerSaving) : null;
    return weeksToGoal && weeksToGoal >= 1 && weeksToGoal <= 104
      ? `Goal set. Keep this up and you'll hit it in ~${weeksToGoal} weeks.`
      : `Goal set. Every dinner at home is doing something.`;
  }

  // Derived averages
  const avgContribution =
    weeklyContributions.length > 0
      ? weeklyContributions.reduce((a, b) => a + b, 0) / weeklyContributions.length
      : weeklyDinnerSaving;

  const weeksToGoalAtCurrent =
    weeklyDinnerSaving > 0 ? Math.ceil(remaining / weeklyDinnerSaving) : null;
  const weeksToGoalAtAvg =
    avgContribution > 0 ? Math.ceil(remaining / avgContribution) : null;

  // 2. Big week — this week's saving covers > 10% of remaining
  if (remaining > 0 && weeklyDinnerSaving > 0.1 * remaining) {
    const pct = Math.round((weeklyDinnerSaving / remaining) * 100);
    return `This week covered ${pct}% of your ${name} fund. Big one.`;
  }

  // 3. Milestone hits — check for 75%, 50%, 25%
  if (percentSaved >= 0.75 && percentSaved < 0.95) {
    return `Three-quarters of the way to ${name}. You're basically already there.`;
  }
  if (percentSaved >= 0.5 && percentSaved < 0.75) {
    return `Halfway to ${name}. This is exactly how it's supposed to work.`;
  }
  if (percentSaved >= 0.25 && percentSaved < 0.5) {
    return `One quarter down on ${name}. It's starting to stack up.`;
  }

  // 4. Ahead of schedule — actual pace better than average projected
  if (
    weeksToGoalAtCurrent !== null &&
    weeksToGoalAtAvg !== null &&
    weeksToGoalAtCurrent < weeksToGoalAtAvg - 1
  ) {
    const ahead = weeksToGoalAtAvg - weeksToGoalAtCurrent;
    return `You're ${ahead} week${ahead === 1 ? '' : 's'} ahead of schedule. Dinner at home is quietly doing the work.`;
  }

  // 5. Slow/tight week — this week meaningfully below average (requires 3+ weeks history)
  if (
    weeklyDinnerSaving < avgContribution * 0.7 &&
    weeklyContributions.length >= 3
  ) {
    return `Tight week — ${name} isn't going anywhere. Reset next week.`;
  }

  // 6. Default — on track
  if (weeksToGoalAtCurrent !== null && weeksToGoalAtCurrent >= 1 && weeksToGoalAtCurrent <= 104) {
    return `You're on track for ${name}. About ${weeksToGoalAtCurrent} weeks away.`;
  }

  return `Every week at home builds your ${name} fund.`;
}

export function weeksToGoalFromGoal(goal: SavingsGoal, weeklyDinnerSaving: number): number | null {
  const remaining = Math.max(0, goal.targetAmount - goal.currentSaved);
  const rate = weeklyDinnerSaving > 0 ? weeklyDinnerSaving : 0;
  if (rate <= 0) return null;
  return Math.ceil(remaining / rate);
}

export function goalPercent(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(1, goal.currentSaved / goal.targetAmount);
}

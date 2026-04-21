import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  WeeklyMode,
  SavingsGoal,
  clearOnboardingState,
  getOnboardingState,
  updateOnboardingState,
  LifestyleSpendData,
} from '@/utils/onboardingState';
import { WeekGoal } from '@/utils/yourWeekEngine';
import { getCurrentWeekKey } from '@/utils/weekKey';

export type { WeekGoal };
export type { LifestyleSpendData as LifestyleSpend };
export type { SavingsGoal };

export interface MoneyInput {
  weeklyIncome: number;
  fixedWeeklyCosts: number;
  groceriesWeekly: number;
  eatingOutWeekly?: number;
  otherWeeklySpend?: number;
  rawIncome?: number;
  incomePeriod?: string;
}

interface UserWeekContextType {
  weeklyMode: WeeklyMode | null;
  goal: WeekGoal;
  hasMealsSetup: boolean;
  hasMoneySetup: boolean;
  money: MoneyInput | null;
  lifestyleSpend: LifestyleSpendData | null;
  savingsGoal: SavingsGoal | null;
  lastPlannedWeekKey: string | null;
  lastUpdatedAt: string | null;
  isLoaded: boolean;
  setWeeklyMode: (mode: WeeklyMode) => void;
  setGoal: (goal: WeekGoal) => void;
  setHasMealsSetup: (v: boolean) => void;
  setMoney: (money: MoneyInput) => void;
  setLifestyleSpend: (v: LifestyleSpendData) => void;
  setSavingsGoal: (g: SavingsGoal | null) => void;
  addWeeklyContribution: (amount: number) => void;
  updateWeekKey: () => void;
  resetUserWeek: () => void;
  saveMoneySetup: (money: MoneyInput, lifestyle: LifestyleSpendData, goal: WeekGoal) => void;
}

const UserWeekContext = createContext<UserWeekContextType>({
  weeklyMode: null,
  goal: 'none',
  hasMealsSetup: false,
  hasMoneySetup: false,
  money: null,
  lifestyleSpend: null,
  savingsGoal: null,
  lastPlannedWeekKey: null,
  lastUpdatedAt: null,
  isLoaded: false,
  setWeeklyMode: () => {},
  setGoal: () => {},
  setHasMealsSetup: () => {},
  setMoney: () => {},
  setLifestyleSpend: () => {},
  setSavingsGoal: () => {},
  addWeeklyContribution: () => {},
  updateWeekKey: () => {},
  resetUserWeek: () => {},
  saveMoneySetup: () => {},
});

export function UserWeekProvider({ children }: { children: React.ReactNode }) {
  const [weeklyMode, setWeeklyModeState] = useState<WeeklyMode | null>(null);
  const [goal, setGoalState] = useState<WeekGoal>('none');
  const [hasMealsSetup, setHasMealsSetupState] = useState(false);
  const [hasMoneySetup, setHasMoneySetupState] = useState(false);
  const [money, setMoneyState] = useState<MoneyInput | null>(null);
  const [lifestyleSpend, setLifestyleSpendState] = useState<LifestyleSpendData | null>(null);
  const [savingsGoal, setSavingsGoalState] = useState<SavingsGoal | null>(null);
  const [lastPlannedWeekKey, setLastPlannedWeekKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getOnboardingState().then((state) => {
      if (state.weeklyMode) setWeeklyModeState(state.weeklyMode);
      setHasMealsSetupState(state.hasMealsSetup);
      if (state.goal) setGoalState(state.goal as WeekGoal);
      if (state.savingsGoal) setSavingsGoalState(state.savingsGoal);

      if (state.moneySetup) {
        const m = state.moneySetup;
        const hasValues = m.weeklyIncome > 0 || m.groceries > 0 || m.fixedWeeklyCosts > 0;
        const isSetup = state.hasMoneySetup || hasValues;
        setHasMoneySetupState(isSetup);
        setMoneyState({
          weeklyIncome: m.weeklyIncome,
          fixedWeeklyCosts: m.fixedWeeklyCosts,
          groceriesWeekly: m.groceries,
          eatingOutWeekly: m.eatingOut,
          otherWeeklySpend: m.otherWeeklySpend,
          rawIncome: m.rawIncome,
          incomePeriod: m.incomePeriod,
        });
      } else {
        setHasMoneySetupState(state.hasMoneySetup);
      }

      if (state.lifestyleSpend) {
        setLifestyleSpendState(state.lifestyleSpend);
      }

      if (state.lastPlannedWeekKey) setLastPlannedWeekKey(state.lastPlannedWeekKey);
      if (state.lastUpdatedAt) setLastUpdatedAt(state.lastUpdatedAt);
      setIsLoaded(true);
    });
  }, []);

  const setWeeklyMode = (mode: WeeklyMode) => {
    setWeeklyModeState(mode);
    updateOnboardingState({ weeklyMode: mode });
  };

  const setGoal = (g: WeekGoal) => {
    setGoalState(g);
    updateOnboardingState({ goal: g });
  };

  const setHasMealsSetup = (v: boolean) => {
    setHasMealsSetupState(v);
    updateOnboardingState({ hasMealsSetup: v });
  };

  const setMoney = (m: MoneyInput) => {
    setMoneyState(m);
    setHasMoneySetupState(true);
    updateOnboardingState({
      hasMoneySetup: true,
      moneySetup: {
        weeklyIncome: m.weeklyIncome,
        fixedWeeklyCosts: m.fixedWeeklyCosts,
        groceries: m.groceriesWeekly,
        eatingOut: m.eatingOutWeekly ?? 0,
        otherWeeklySpend: m.otherWeeklySpend,
        rawIncome: m.rawIncome,
        incomePeriod: m.incomePeriod,
      },
    });
  };

  const setLifestyleSpend = (v: LifestyleSpendData) => {
    setLifestyleSpendState(v);
    updateOnboardingState({ lifestyleSpend: v });
  };

  const setSavingsGoal = (g: SavingsGoal | null) => {
    setSavingsGoalState(g);
    updateOnboardingState({ savingsGoal: g });
  };

  const addWeeklyContribution = (amount: number) => {
    if (amount <= 0) return;
    setSavingsGoalState((prev) => {
      if (!prev) return prev;
      const next: SavingsGoal = {
        ...prev,
        currentSaved: Math.min(prev.targetAmount, prev.currentSaved + amount),
        weeklyContributions: [...prev.weeklyContributions, amount],
      };
      updateOnboardingState({ savingsGoal: next });
      return next;
    });
  };

  const updateWeekKey = () => {
    const weekKey = getCurrentWeekKey();
    const now = new Date().toISOString();
    setLastPlannedWeekKey(weekKey);
    setLastUpdatedAt(now);
    updateOnboardingState({ lastPlannedWeekKey: weekKey, lastUpdatedAt: now });
  };

  /**
   * Batches all money-setup writes into ONE AsyncStorage call, avoiding the
   * race condition where four separate `updateOnboardingState` calls each do
   * read-then-write and clobber each other.
   */
  const saveMoneySetup = (m: MoneyInput, lifestyle: LifestyleSpendData, g: WeekGoal) => {
    const weekKey = getCurrentWeekKey();
    const now = new Date().toISOString();
    setMoneyState(m);
    setHasMoneySetupState(true);
    setLifestyleSpendState(lifestyle);
    setGoalState(g);
    setLastPlannedWeekKey(weekKey);
    setLastUpdatedAt(now);
    updateOnboardingState({
      hasMoneySetup: true,
      moneySetup: {
        weeklyIncome: m.weeklyIncome,
        fixedWeeklyCosts: m.fixedWeeklyCosts,
        groceries: m.groceriesWeekly,
        eatingOut: m.eatingOutWeekly ?? 0,
        otherWeeklySpend: m.otherWeeklySpend,
        rawIncome: m.rawIncome,
        incomePeriod: m.incomePeriod,
      },
      lifestyleSpend: lifestyle,
      goal: g,
      lastPlannedWeekKey: weekKey,
      lastUpdatedAt: now,
    });
  };

  const resetUserWeek = () => {
    setWeeklyModeState(null);
    setGoalState('none');
    setHasMealsSetupState(false);
    setHasMoneySetupState(false);
    setMoneyState(null);
    setLifestyleSpendState(null);
    setSavingsGoalState(null);
    setLastPlannedWeekKey(null);
    setLastUpdatedAt(null);
    clearOnboardingState();
  };

  return (
    <UserWeekContext.Provider
      value={{
        weeklyMode,
        goal,
        hasMealsSetup,
        hasMoneySetup,
        money,
        lifestyleSpend,
        savingsGoal,
        lastPlannedWeekKey,
        lastUpdatedAt,
        isLoaded,
        setWeeklyMode,
        setGoal,
        setHasMealsSetup,
        setMoney,
        setLifestyleSpend,
        setSavingsGoal,
        addWeeklyContribution,
        updateWeekKey,
        resetUserWeek,
        saveMoneySetup,
      }}
    >
      {children}
    </UserWeekContext.Provider>
  );
}

export function useUserWeek() {
  return useContext(UserWeekContext);
}

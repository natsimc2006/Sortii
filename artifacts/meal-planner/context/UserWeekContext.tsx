import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  WeeklyMode,
  clearOnboardingState,
  getOnboardingState,
  updateOnboardingState,
} from '@/utils/onboardingState';
import { WeekGoal } from '@/utils/yourWeekEngine';
import { getCurrentWeekKey } from '@/utils/weekKey';

export type { WeekGoal };

export interface MoneyInput {
  weeklyIncome: number;
  fixedWeeklyCosts: number;
  groceriesWeekly: number;
  eatingOutWeekly?: number;
  otherWeeklySpend?: number;
}

interface UserWeekContextType {
  weeklyMode: WeeklyMode | null;
  goal: WeekGoal;
  hasMealsSetup: boolean;
  hasMoneySetup: boolean;
  money: MoneyInput | null;
  lastPlannedWeekKey: string | null;
  lastUpdatedAt: string | null;
  isLoaded: boolean;
  setWeeklyMode: (mode: WeeklyMode) => void;
  setGoal: (goal: WeekGoal) => void;
  setHasMealsSetup: (v: boolean) => void;
  setMoney: (money: MoneyInput) => void;
  updateWeekKey: () => void;
  resetUserWeek: () => void;
}

const UserWeekContext = createContext<UserWeekContextType>({
  weeklyMode: null,
  goal: 'none',
  hasMealsSetup: false,
  hasMoneySetup: false,
  money: null,
  lastPlannedWeekKey: null,
  lastUpdatedAt: null,
  isLoaded: false,
  setWeeklyMode: () => {},
  setGoal: () => {},
  setHasMealsSetup: () => {},
  setMoney: () => {},
  updateWeekKey: () => {},
  resetUserWeek: () => {},
});

export function UserWeekProvider({ children }: { children: React.ReactNode }) {
  const [weeklyMode, setWeeklyModeState] = useState<WeeklyMode | null>(null);
  const [goal, setGoalState] = useState<WeekGoal>('none');
  const [hasMealsSetup, setHasMealsSetupState] = useState(false);
  const [hasMoneySetup, setHasMoneySetupState] = useState(false);
  const [money, setMoneyState] = useState<MoneyInput | null>(null);
  const [lastPlannedWeekKey, setLastPlannedWeekKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getOnboardingState().then((state) => {
      if (state.weeklyMode) setWeeklyModeState(state.weeklyMode);
      setHasMealsSetupState(state.hasMealsSetup);
      setHasMoneySetupState(state.hasMoneySetup);
      if (state.moneySetup) {
        setMoneyState({
          weeklyIncome: state.moneySetup.weeklyIncome,
          fixedWeeklyCosts: state.moneySetup.fixedWeeklyCosts,
          groceriesWeekly: state.moneySetup.groceries,
          eatingOutWeekly: state.moneySetup.eatingOut,
        });
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
      },
    });
  };

  const updateWeekKey = () => {
    const weekKey = getCurrentWeekKey();
    const now = new Date().toISOString();
    setLastPlannedWeekKey(weekKey);
    setLastUpdatedAt(now);
    updateOnboardingState({ lastPlannedWeekKey: weekKey, lastUpdatedAt: now });
  };

  const resetUserWeek = () => {
    setWeeklyModeState(null);
    setGoalState('none');
    setHasMealsSetupState(false);
    setHasMoneySetupState(false);
    setMoneyState(null);
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
        lastPlannedWeekKey,
        lastUpdatedAt,
        isLoaded,
        setWeeklyMode,
        setGoal,
        setHasMealsSetup,
        setMoney,
        updateWeekKey,
        resetUserWeek,
      }}
    >
      {children}
    </UserWeekContext.Provider>
  );
}

export function useUserWeek() {
  return useContext(UserWeekContext);
}

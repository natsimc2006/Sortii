import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  WeeklyMode,
  getOnboardingState,
  updateOnboardingState,
} from '@/utils/onboardingState';
import { WeekGoal } from '@/utils/yourWeekEngine';

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
  isLoaded: boolean;
  setWeeklyMode: (mode: WeeklyMode) => void;
  setGoal: (goal: WeekGoal) => void;
  setHasMealsSetup: (v: boolean) => void;
  setMoney: (money: MoneyInput) => void;
}

const UserWeekContext = createContext<UserWeekContextType>({
  weeklyMode: null,
  goal: 'none',
  hasMealsSetup: false,
  hasMoneySetup: false,
  money: null,
  isLoaded: false,
  setWeeklyMode: () => {},
  setGoal: () => {},
  setHasMealsSetup: () => {},
  setMoney: () => {},
});

export function UserWeekProvider({ children }: { children: React.ReactNode }) {
  const [weeklyMode, setWeeklyModeState] = useState<WeeklyMode | null>(null);
  const [goal, setGoalState] = useState<WeekGoal>('none');
  const [hasMealsSetup, setHasMealsSetupState] = useState(false);
  const [hasMoneySetup, setHasMoneySetupState] = useState(false);
  const [money, setMoneyState] = useState<MoneyInput | null>(null);
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

  return (
    <UserWeekContext.Provider
      value={{
        weeklyMode,
        goal,
        hasMealsSetup,
        hasMoneySetup,
        money,
        isLoaded,
        setWeeklyMode,
        setGoal,
        setHasMealsSetup,
        setMoney,
      }}
    >
      {children}
    </UserWeekContext.Provider>
  );
}

export function useUserWeek() {
  return useContext(UserWeekContext);
}

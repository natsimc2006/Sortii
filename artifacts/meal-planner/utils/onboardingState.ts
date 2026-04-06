import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingScope = 'meals' | 'money' | 'both';
export type WeeklyMode = 'easy' | 'balanced' | 'budget';

export interface MoneySetupData {
  weeklyIncome: number;
  fixedWeeklyCosts: number;
  groceries: number;
  eatingOut: number;
}

export interface OnboardingState {
  scope: OnboardingScope | null;
  weeklyMode: WeeklyMode | null;
  hasMealsSetup: boolean;
  hasMoneySetup: boolean;
  moneySetup: MoneySetupData | null;
  lastPlannedWeekKey: string | null;
  lastUpdatedAt: string | null;
}

const KEY = '@sortii_onboarding_v2';

const DEFAULT_STATE: OnboardingState = {
  scope: null,
  weeklyMode: null,
  hasMealsSetup: false,
  hasMoneySetup: false,
  moneySetup: null,
  lastPlannedWeekKey: null,
  lastUpdatedAt: null,
};

export async function getOnboardingState(): Promise<OnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function updateOnboardingState(updates: Partial<OnboardingState>): Promise<void> {
  try {
    const current = await getOnboardingState();
    const next = { ...current, ...updates };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function clearOnboardingState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

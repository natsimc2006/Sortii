import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppLocale, detectLocale, getStoredLocale, storeLocale } from '@/utils/locale';
import { getRecipesForLocale } from '@/utils/recipeService';
import { formatMoney, formatMoneyRound, formatMoneyRange } from '@/utils/formatMoney';
import { Recipe } from '@/constants/recipes';

export { formatMoney, formatMoneyRound, formatMoneyRange };

interface LocaleContextType {
  locale: AppLocale;
  currencySymbol: string;
  appRecipes: Recipe[];
  isLocaleLoaded: boolean;
  formatMoney: (amount: number) => string;
  formatMoneyRound: (amount: number) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'AU',
  currencySymbol: '$',
  appRecipes: [],
  isLocaleLoaded: false,
  formatMoney: (amount: number) => `$${Math.round(amount)}`,
  formatMoneyRound: (amount: number) => `$${Math.round(amount)}`,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('AU');
  const [isLocaleLoaded, setIsLocaleLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = getStoredLocale();
        if (stored) {
          setLocale(stored);
        } else {
          const detected = await detectLocale();
          storeLocale(detected);
          setLocale(detected);
        }
      } catch {
      } finally {
        setIsLocaleLoaded(true);
      }
    })();
  }, []);

  const currencySymbol = locale === 'UK' ? '£' : '$';
  const appRecipes = getRecipesForLocale(locale) as Recipe[];

  const boundFormatMoney = (amount: number) => formatMoney(amount, locale);
  const boundFormatMoneyRound = (amount: number) => formatMoneyRound(amount, locale);

  return (
    <LocaleContext.Provider value={{
      locale,
      currencySymbol,
      appRecipes,
      isLocaleLoaded,
      formatMoney: boundFormatMoney,
      formatMoneyRound: boundFormatMoneyRound,
    }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

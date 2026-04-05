import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppLocale, detectLocale, getStoredLocale, storeLocale } from '@/utils/locale';
import { getRecipesForLocale } from '@/utils/recipeService';
import { Recipe } from '@/constants/recipes';

interface LocaleContextType {
  locale: AppLocale;
  currencySymbol: string;
  appRecipes: Recipe[];
  isLocaleLoaded: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'AU',
  currencySymbol: 'A$',
  appRecipes: [],
  isLocaleLoaded: false,
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

  const currencySymbol = locale === 'UK' ? '£' : 'A$';
  const appRecipes = getRecipesForLocale(locale) as Recipe[];

  return (
    <LocaleContext.Provider value={{ locale, currencySymbol, appRecipes, isLocaleLoaded }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

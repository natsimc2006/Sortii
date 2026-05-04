export type AppLocale = 'AU' | 'UK';

export async function detectLocale(): Promise<AppLocale> {
  const deviceLocale =
    (typeof navigator !== 'undefined' && navigator.language) || '';

  if (deviceLocale.toLowerCase().includes('en-gb')) return 'UK';
  if (deviceLocale.toLowerCase().includes('en-au')) return 'AU';

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data?.country_code === 'GB') return 'UK';
    if (data?.country_code === 'AU') return 'AU';
  } catch {
  }

  return 'AU';
}

export function getStoredLocale(): AppLocale | null {
  try {
    const stored = localStorage.getItem('sortii_locale');
    if (stored === 'AU' || stored === 'UK') return stored;
  } catch {}
  return null;
}

export function storeLocale(locale: AppLocale): void {
  try {
    localStorage.setItem('sortii_locale', locale);
  } catch {}
}

export function getLocale(): AppLocale {
  return getStoredLocale() ?? 'AU';
}

export const getLocaleConfig = (locale: AppLocale) => ({

  currency: {
    symbol: locale === 'AU' ? '$' : '£',
    code: locale === 'AU' ? 'AUD' : 'GBP',
    format: (amount: number) =>
      locale === 'AU'
        ? `$${amount.toFixed(2)}`
        : `£${amount.toFixed(2)}`,
  },

  bills: {
    councilLabel: locale === 'AU' ? 'Council rates' : 'Council tax',
    internetLabel: locale === 'AU' ? 'NBN / Internet' : 'Broadband',
    defaultBillTypes: locale === 'AU'
      ? [
          'Electricity',
          'Gas',
          'Water rates',
          'Council rates',
          'NBN / Internet',
          'Insurance',
        ]
      : [
          'Electricity',
          'Gas',
          'Water rates',
          'Council tax',
          'Broadband',
          'Insurance',
        ],
    councilCycle: locale === 'AU' ? 'quarterly' : 'monthly',
  },

  activities: {
    foundationLabel: locale === 'AU' ? 'Kindy / Prep' : 'Reception',
    seniorSchoolEnd: locale === 'AU' ? 12 : 13,
    termLabel: 'Term',
  },

  supermarkets: {
    primary: locale === 'AU' ? 'Woolworths' : 'Tesco',
    secondary: locale === 'AU' ? 'Coles' : "Sainsbury's",
    budget: 'Aldi',
  },

});

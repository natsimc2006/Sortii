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

  pricing: {
    bands: [
      {
        key: 'budget',
        emoji: '💚',
        label: 'Budget feed',
        maxPerServe: locale === 'AU' ? 3 : 2,
        color: '#2A8F88',
        tint: '#E6F3F0',
      },
      {
        key: 'mid',
        emoji: '🟡',
        label: 'Easy mid',
        maxPerServe: locale === 'AU' ? 6 : 4,
        color: '#D29A22',
        tint: '#F6E6BA',
      },
      {
        key: 'generous',
        emoji: '🟠',
        label: 'Worth it',
        maxPerServe: locale === 'AU' ? 10 : 7,
        color: '#C47B2B',
        tint: '#FAE8D4',
      },
      {
        key: 'splash',
        emoji: '🔴',
        label: 'Splash out',
        maxPerServe: null,
        color: '#B86557',
        tint: '#F7E9E8',
      },
    ],
    disclaimerShort: locale === 'AU'
      ? 'Costs are estimates based on Woolworths / Coles prices, updated quarterly.'
      : "Costs are estimates based on Tesco / Sainsbury's prices, updated quarterly.",
    editHint: "Set your local price — we'll remember it.",
    editConfirm: 'Saved. Your prices now.',
    weeklyTotalPrefix: 'Around',
    pricePrefix: '~',
  },

});

export const getPriceBand = (
  costPerServe: number,
  locale: AppLocale
) => {
  const { bands } = getLocaleConfig(locale).pricing;
  return (
    bands.find(b => b.maxPerServe !== null && costPerServe < b.maxPerServe)
    ?? bands[bands.length - 1]
  );
};

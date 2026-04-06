import { AppLocale } from './locale';

function getCurrencySymbol(locale: AppLocale): string {
  return locale === 'UK' ? '£' : '$';
}

export function formatMoney(amount: number, locale: AppLocale): string {
  const symbol = getCurrencySymbol(locale);
  const rounded = Math.round(amount * 100) / 100;
  const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
  return `${symbol}${str}`;
}

export function formatMoneyRound(amount: number, locale: AppLocale): string {
  const symbol = getCurrencySymbol(locale);
  return `${symbol}${Math.round(amount)}`;
}

export function formatMoneyRange(low: number, high: number, locale: AppLocale): string {
  const symbol = getCurrencySymbol(locale);
  return `${symbol}${Math.round(low)}–${symbol}${Math.round(high)}`;
}

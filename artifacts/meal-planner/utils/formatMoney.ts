import { AppLocale } from './locale';

export function formatMoney(amount: number, locale: AppLocale): string {
  const symbol = locale === 'UK' ? '£' : 'A$';
  const rounded = Math.round(amount * 100) / 100;
  const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
  return `${symbol}${str}`;
}

export function formatMoneyRound(amount: number, locale: AppLocale): string {
  const symbol = locale === 'UK' ? '£' : 'A$';
  return `${symbol}${Math.round(amount)}`;
}

export function formatMoneyRange(low: number, high: number, locale: AppLocale): string {
  const symbol = locale === 'UK' ? '£' : 'A$';
  return `${symbol}${Math.round(low)}–${symbol}${Math.round(high)}`;
}

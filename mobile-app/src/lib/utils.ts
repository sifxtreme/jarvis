import { format, parseISO } from 'date-fns';

export const YEARS = [2026, 2025, 2024, 2023] as const;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatCurrencyDollars(amount: number): string {
  return Math.round(amount).toLocaleString();
}

export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return format(utcDate, 'yyyy-MM-dd');
  } catch {
    return dateString;
  }
}

export function getMonthKey(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  try {
    const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T');
    const date = parseISO(normalized);
    if (Number.isNaN(date.getTime())) return dateString.slice(0, 7);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return format(utcDate, 'yyyy-MM');
  } catch {
    return dateString.slice(0, 7);
  }
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
}

export function getShortMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('default', { month: 'short' });
}

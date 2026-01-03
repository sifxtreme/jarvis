import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

// Available years for filtering - update annually
export const YEARS = [2026, 2025, 2024, 2023] as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    const formattedDate = format(utcDate, 'yyyy-MM-dd');
    return formattedDate;
  } catch (error) {
    console.error('[Date Formatting] Error formatting date:', error);
    return dateString; // Fallback to original string if parsing fails
  }
}

export function getMonthKey(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  try {
    const normalized = dateString.includes("T") ? dateString : dateString.replace(" ", "T");
    const date = parseISO(normalized);
    if (Number.isNaN(date.getTime())) return dateString.slice(0, 7);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return format(utcDate, "yyyy-MM");
  } catch (error) {
    console.error('[Date Formatting] Error formatting month key:', error);
    return dateString.slice(0, 7);
  }
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    const formattedDate = format(date, 'MMM d, yyyy');
    return formattedDate;
  } catch (error) {
    console.error('[Date Formatting] Error formatting date:', error);
    return dateString; // Fallback to original string if parsing fails
  }
}
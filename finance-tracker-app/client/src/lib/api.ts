import axios from 'axios';
import { create } from 'zustand';

// Define constants first
export const API_BASE_URL = 'https://sifxtre.me/api';

interface AuthStore {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),
  isAuthenticated: false,
  setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
}));

// Create an axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Add response interceptor
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // If we get a 401, we know we're unauthenticated
      useAuthStore.getState().setIsAuthenticated(false);
      useAuthStore.getState().setShowAuthModal(true);
    }
    return Promise.reject(error);
  }
);

// Add request interceptor to update auth header
axiosInstance.interceptors.request.use(config => {
  config.headers.Authorization = undefined;
  return config;
});

// Function to verify if the current API key is valid
export const verifyAuthentication = async (): Promise<boolean> => {
  try {
    // Verify session cookie
    await axiosInstance.get('/auth/session', {
      timeout: 3000 // Set a timeout to prevent long waits
    });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // If we get a 401, we know we're unauthenticated
      return false;
    }
    // For other errors, assume the API is down but the key might be valid
    console.error('Error verifying authentication:', error);
    return true;
  }
};

// Function to set authentication
export const setAuthentication = (): void => {
  useAuthStore.getState().setIsAuthenticated(true);
};

// Function to clear authentication
export const clearAuthentication = (): void => {
  useAuthStore.getState().setIsAuthenticated(false);
};

export const getGoogleCalendarAuthUrl = async (): Promise<string> => {
  return `${API_BASE_URL}/auth/google_oauth2`;
};

export const createSession = async (idToken: string): Promise<void> => {
  await axiosInstance.post('/auth/session', { id_token: idToken });
};

export const destroySession = async (): Promise<void> => {
  await axiosInstance.delete('/auth/session');
};

export type CalendarItem = {
  id: number;
  type: "event" | "busy";
  event_id?: string;
  event_uid?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  calendar_id: string;
  calendar_summary?: string | null;
  user_id: number;
  busy_only: boolean;
};

export type CalendarOverviewResponse = {
  window: { start_at: string; end_at: string };
  users: { id: number; email: string }[];
  items: CalendarItem[];
};

export const getCalendarOverview = async (
  view: string,
  date: string
): Promise<CalendarOverviewResponse> => {
  const response = await axiosInstance.get('/calendar/overview', {
    params: { view, date }
  });
  return response.data as CalendarOverviewResponse;
};

export interface Transaction {
  id: number;
  transacted_at: string;
  plaid_name: string;
  merchant_name: string;
  category: string;
  source: string;
  amount: number;
  hidden: boolean;
  reviewed: boolean;
  amortized_months?: string[];
  raw_data?: Record<string, unknown>;
}

export interface Budget {
  id: number;
  name: string;
  amount: number;
  expense_type: "income" | "expense";
  display_order: number;
}

// Category used for transactions that don't match any budget category
export const OTHER_CATEGORY = "Other" as const;
export type OtherCategory = typeof OTHER_CATEGORY;

export interface TransactionFilters {
  year?: number;
  month?: number;
  show_hidden: boolean;
  show_needs_review: boolean;
  query: string;
}

export interface BudgetFilters {
  year?: number;
  month?: number;
  show_hidden: boolean;
  show_needs_review: boolean;
}

interface APIResponse<T> {
  total?: number;
  error?: string;
  results?: T[];
}

export const api = {
  async getTransaction(id: number): Promise<Transaction> {
    const response = await axiosInstance.get<Transaction>(`/financial_transactions/${id}`);
    return response.data;
  },

  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    const response = await axiosInstance.post<Transaction>('/financial_transactions', data);
    return response.data;
  },

  async updateTransaction(id: number, data: UpdateTransactionData): Promise<Transaction> {
    const response = await axiosInstance.put<Transaction>(`/financial_transactions/${id}`, data);
    return response.data;
  }
};

export const getTransactions = async (filters: TransactionFilters): Promise<Transaction[]> => {
  const params = new URLSearchParams();

  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());
  if (filters.show_hidden !== undefined) params.append('show_hidden', filters.show_hidden.toString());
  if (filters.show_needs_review !== undefined) params.append('show_needs_review', filters.show_needs_review.toString());
  if (filters.query) params.append('query', filters.query);

  try {
    const response = await axiosInstance.get<APIResponse<Transaction>>('/financial_transactions', { params });

    if (!response.data) {
      console.error('[API] No data in response');
      throw new Error('No data received from server');
    }

    const { results, error } = response.data;

    if (error) {
      console.error('[API] Server returned error:', error);
      throw new Error(error);
    }

    if (!Array.isArray(results)) {
      console.error('[API] Invalid response structure:', response.data);
      throw new Error('Invalid response format: results is not an array');
    }

    const validTransactions = results.filter(transaction => {
      const isValid = (
        typeof transaction.id === 'number' &&
        typeof transaction.amount === 'number' &&
        typeof transaction.transacted_at === 'string'
      );

      if (!isValid) {
        const issues: string[] = [];
        if (typeof transaction.id !== 'number') issues.push(`id: ${transaction.id} (${typeof transaction.id})`);
        if (typeof transaction.amount !== 'number') issues.push(`amount: ${transaction.amount} (${typeof transaction.amount})`);
        if (typeof transaction.transacted_at !== 'string') issues.push(`transacted_at: ${transaction.transacted_at} (${typeof transaction.transacted_at})`);
        console.error(`[API] Invalid transaction - ${issues.join(', ')} | name: ${transaction.plaid_name || transaction.merchant_name || 'unknown'}`);
      }
      return isValid;
    });

    return validTransactions;
  } catch (error: any) {
    console.error('[API] Error details:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch transactions';
    throw new Error(`Failed to fetch transactions: ${errorMessage}`);
  }
};

export const getBudgets = async (filters: BudgetFilters): Promise<Budget[]> => {
  const params = new URLSearchParams();

  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());

  try {
    const response = await axiosInstance.get<Budget[]>('/budgets', { params });

    return response.data;
  } catch (error: any) {
    console.error('[API] Budget error details:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch budgets';
    throw new Error(`Failed to fetch budgets: ${errorMessage}`);
  }
};

interface CreateTransactionData {
  transacted_at: string;
  plaid_name: string;
  merchant_name: string;
  category: string;
  source: string;
  amount: number;
  hidden: boolean;
  reviewed: boolean;
}

interface UpdateTransactionData extends CreateTransactionData {
  // Same fields as CreateTransactionData
}

// Trends API types
export interface TrendsPeriod {
  year: number;
  total_transactions: number;
  total_spent: number;
  total_income: number;
  net_savings: number;
}

export interface MonthlyTotal {
  month: string;
  spent: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  transaction_count: number;
  budget: number;
  variance: number | null;
  monthly_avg: number;
}

export interface MerchantBreakdown {
  merchant: string;
  total: number;
  transaction_count: number;
  categories: string[];
  last_transaction: string;
}

export interface BudgetComparison {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  variance_percent: number;
  on_track: boolean;
}

export interface MonthlyDataPoint {
  month: string;
  total: number;
  transaction_count?: number;
}

export interface MonthlyCategoryData {
  category: string;
  months: MonthlyDataPoint[];
}

export interface MonthlyMerchantData {
  merchant: string;
  months: MonthlyDataPoint[];
}

export interface TrendsData {
  period: TrendsPeriod;
  monthly_totals: MonthlyTotal[];
  by_category: CategoryBreakdown[];
  by_merchant: MerchantBreakdown[];
  budget_comparison: BudgetComparison[];
  monthly_by_category: MonthlyCategoryData[];
  monthly_by_merchant: MonthlyMerchantData[];
}

export interface TrendsFilters {
  year?: number;
  category?: string;
}

export const getTrends = async (filters: TrendsFilters = {}): Promise<TrendsData> => {
  const params = new URLSearchParams();

  if (filters.year) params.append('year', filters.year.toString());
  if (filters.category) params.append('category', filters.category);

  try {
    const response = await axiosInstance.get<TrendsData>('/financial_transactions/trends', { params });
    return response.data;
  } catch (error: any) {
    console.error('[API] Trends error details:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch trends';
    throw new Error(`Failed to fetch trends: ${errorMessage}`);
  }
};

// Recurring Status types
export interface RecurringPattern {
  merchant_key: string;
  display_name: string;
  plaid_name: string | null;
  merchant_name: string | null;
  typical_day: number;
  typical_amount: number;
  source: string;
  category: string;
  months_present: number;
  last_occurrence: string;
  is_income: boolean;
  status?: 'overdue' | 'due_soon' | 'upcoming';
  days_difference?: number;
}

export interface RecurringStatusData {
  year: number;
  month: number;
  current_day: number;
  missing: RecurringPattern[];
  present: RecurringPattern[];
}

export interface RecurringStatusFilters {
  year?: number;
  month?: number;
}

export const getRecurringStatus = async (filters: RecurringStatusFilters = {}): Promise<RecurringStatusData> => {
  const params = new URLSearchParams();

  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());

  try {
    const response = await axiosInstance.get<RecurringStatusData>('/financial_transactions/recurring_status', { params });
    return response.data;
  } catch (error: any) {
    console.error('[API] Recurring status error:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch recurring status';
    throw new Error(`Failed to fetch recurring status: ${errorMessage}`);
  }
};

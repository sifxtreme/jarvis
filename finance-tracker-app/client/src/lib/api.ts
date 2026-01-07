import axios from 'axios';
import { toast } from '@/hooks/use-toast';
import { create } from 'zustand';

// Define constants first
export const API_BASE_URL = 'https://sifxtre.me/api';
const AUTH_TOKEN_KEY = 'jarvis_auth_token';

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

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

// Create an axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false
});

// Add response interceptor
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // If we get a 401, we know we're unauthenticated
      clearAuthToken();
      useAuthStore.getState().setIsAuthenticated(false);
      useAuthStore.getState().setShowAuthModal(true);
    } else {
      const status = error.response?.status;
      const baseMessage =
        error.response?.data?.msg ||
        error.response?.data?.message ||
        error.message ||
        'Request failed';
      const debug = error.response?.data?.debug
        ? ` (event_id=${error.response.data.debug.event_id}, calendar_id=${error.response.data.debug.calendar_id}, owner_id=${error.response.data.debug.owner_id})`
        : '';
      const message = `${baseMessage}${debug}`;
      toast({
        title: status ? `API error (${status})` : 'API error',
        description: message,
        variant: 'destructive',
      });
    }
    return Promise.reject(error);
  }
);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

// Add request interceptor to update auth header
axiosInstance.interceptors.request.use(config => {
  const token = getAuthToken();
  config.headers.Authorization = token ? `Bearer ${token}` : undefined;
  return config;
});

// Function to verify if the current API key is valid
export const verifyAuthentication = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  try {
    // Verify session cookie
    await axiosInstance.get('/auth/session', {
      timeout: 15000 // Allow slower cold starts before showing errors
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
  clearAuthToken();
  useAuthStore.getState().setIsAuthenticated(false);
};

export const getGoogleCalendarAuthUrl = async (): Promise<string> => {
  return `${API_BASE_URL}/auth/google_oauth2`;
};

export const createSession = async (idToken: string): Promise<void> => {
  const response = await axiosInstance.post<{ token: string }>('/auth/session', { id_token: idToken });
  if (response.data?.token) {
    setAuthToken(response.data.token);
  }
};

export const destroySession = async (): Promise<void> => {
  await axiosInstance.delete('/auth/session');
  clearAuthToken();
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
  is_recurring?: boolean;
};

export type CalendarOverviewResponse = {
  window: { start_at: string; end_at: string };
  current_user_id?: number | null;
  users: { id: number; email: string }[];
  work_calendars?: { calendar_id: string; summary?: string | null }[];
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

export const deleteCalendarEvent = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/calendar/events/${id}`);
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

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string | null;
  image_url?: string | null;
  created_at: string;
  event_created?: boolean;
  action?: string | null;
};

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

export const getChatMessages = async (params?: {
  limit?: number;
  beforeId?: number;
}): Promise<{ messages: ChatMessage[]; has_more?: boolean; next_before_id?: number | null }> => {
  const response = await axiosInstance.get<{
    messages: ChatMessage[];
    has_more?: boolean;
    next_before_id?: number | null;
  }>('/chat/messages', {
    params: {
      limit: params?.limit,
      before_id: params?.beforeId,
    },
  });
  return response.data || { messages: [] };
};

export const createChatMessage = async (
  text: string,
  imageFile?: File
): Promise<{ message: ChatMessage; reply: ChatMessage & { event_created?: boolean; action?: string | null } }> => {
  if (imageFile) {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('image', imageFile);
    const response = await axiosInstance.post<{ message: ChatMessage; reply: ChatMessage & { event_created?: boolean } }>(
      '/chat/messages',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }

  const response = await axiosInstance.post<{ message: ChatMessage; reply: ChatMessage & { event_created?: boolean } }>(
    '/chat/messages',
    { text }
  );
  return response.data;
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
  } catch (error: unknown) {
    console.error('[API] Error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch transactions');
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
  } catch (error: unknown) {
    console.error('[API] Budget error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch budgets');
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

type UpdateTransactionData = CreateTransactionData;

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
  merchant_trend?: MerchantTrendsData | null;
}

export interface MerchantTrendPoint {
  month: string;
  total: number;
}

export interface MerchantTrendsData {
  merchant: string | null;
  months: MerchantTrendPoint[];
  start_month: string;
  end_month: string;
  total_spent: number;
}

export interface MerchantSuggestion {
  merchant: string;
  total: number;
}

export interface MerchantSuggestionsData {
  suggestions: MerchantSuggestion[];
  start_month: string;
  end_month: string;
}

export interface TrendsFilters {
  year?: number;
  category?: string;
}

export interface MerchantTrendsFilters {
  query: string;
  exact?: boolean;
  start_month?: string;
  end_month?: string;
}

export interface MerchantSuggestionsFilters {
  query: string;
  exact?: boolean;
  start_month?: string;
  end_month?: string;
  limit?: number;
}

export interface MerchantTransactionsFilters {
  query: string;
  exact?: boolean;
  start_month?: string;
  end_month?: string;
}

export const getTrends = async (filters: TrendsFilters = {}): Promise<TrendsData> => {
  const params = new URLSearchParams();

  if (filters.year) params.append('year', filters.year.toString());
  if (filters.category) params.append('category', filters.category);

  try {
    const response = await axiosInstance.get<TrendsData>('/financial_transactions/trends', { params });
    return response.data;
  } catch (error: unknown) {
    console.error('[API] Trends error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch trends');
    throw new Error(`Failed to fetch trends: ${errorMessage}`);
  }
};

export const getMerchantTrends = async (filters: MerchantTrendsFilters): Promise<MerchantTrendsData> => {
  const params = new URLSearchParams();

  if (filters.query) params.append('merchant', filters.query);
  if (filters.exact !== undefined) params.append('exact', filters.exact.toString());
  if (filters.start_month) params.append('start_month', filters.start_month);
  if (filters.end_month) params.append('end_month', filters.end_month);

  try {
    const response = await axiosInstance.get<TrendsData>('/financial_transactions/trends', { params });
    return (
      response.data.merchant_trend || {
        merchant: filters.query || null,
        months: [],
        start_month: filters.start_month || '',
        end_month: filters.end_month || '',
        total_spent: 0,
      }
    );
  } catch (error: unknown) {
    console.error('[API] Merchant trends error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch merchant trends');
    throw new Error(`Failed to fetch merchant trends: ${errorMessage}`);
  }
};

export const getMerchantSuggestions = async (filters: MerchantSuggestionsFilters): Promise<MerchantSuggestionsData> => {
  const params = new URLSearchParams();

  if (filters.query) params.append('query', filters.query);
  if (filters.exact !== undefined) params.append('exact', filters.exact.toString());
  if (filters.start_month) params.append('start_month', filters.start_month);
  if (filters.end_month) params.append('end_month', filters.end_month);
  if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
  params.append('aggregate', 'merchant_suggestions');

  try {
    const response = await axiosInstance.get<MerchantSuggestionsData>('/financial_transactions', { params });
    return response.data;
  } catch (error: unknown) {
    console.error('[API] Merchant suggestions error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch merchant suggestions');
    throw new Error(`Failed to fetch merchant suggestions: ${errorMessage}`);
  }
};

export const getMerchantTransactions = async (filters: MerchantTransactionsFilters): Promise<Transaction[]> => {
  const params = new URLSearchParams();

  if (filters.query) params.append('query', filters.query);
  if (filters.exact !== undefined) params.append('exact', filters.exact.toString());
  if (filters.start_month) params.append('start_month', filters.start_month);
  if (filters.end_month) params.append('end_month', filters.end_month);
  params.append('exclude_income', 'true');
  params.append('show_hidden', 'false');

  try {
    const response = await axiosInstance.get<APIResponse<Transaction>>('/financial_transactions', { params });

    const { results, error } = response.data || {};
    if (error) throw new Error(error);
    return Array.isArray(results) ? results : [];
  } catch (error: unknown) {
    console.error('[API] Merchant transactions error details:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch merchant transactions');
    throw new Error(`Failed to fetch merchant transactions: ${errorMessage}`);
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
  } catch (error: unknown) {
    console.error('[API] Recurring status error:', error);
    const errorMessage = getErrorMessage(error, 'Failed to fetch recurring status');
    throw new Error(`Failed to fetch recurring status: ${errorMessage}`);
  }
};

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { EventEmitter } from './events';

// ─── Config ──────────────────────────────────────────────
const API_BASE_URL = 'https://sifxtre.me/api';
const AUTH_TOKEN_KEY = 'jarvis_auth_token';

// ─── Axios Instance ──────────────────────────────────────
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      useAuthStore.getState().setIsAuthenticated(false);
      useAuthStore.getState().setShowAuthModal(true);
    }
    return Promise.reject(error);
  }
);

// ─── Auth Store ──────────────────────────────────────────
interface AuthState {
  isAuthenticated: boolean;
  showAuthModal: boolean;
  setIsAuthenticated: (v: boolean) => void;
  setShowAuthModal: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  showAuthModal: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setShowAuthModal: (showAuthModal) => set({ showAuthModal }),
}));

// ─── Auth Functions ──────────────────────────────────────
export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function createSession(idToken: string): Promise<boolean> {
  try {
    const response = await axiosInstance.post('/auth/session', { id_token: idToken });
    const token = response.data?.token;
    if (token) {
      await storeToken(token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function verifyAuthentication(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  try {
    await axiosInstance.get('/auth/session');
    return true;
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────
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

export interface TransactionFilters {
  year?: number;
  month?: number;
  query?: string;
  show_hidden?: boolean;
  show_needs_review?: boolean;
}

export interface Budget {
  id: number;
  name: string;
  amount: number;
  expense_type: 'income' | 'expense';
  display_order: number;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string | null;
  image_url?: string | null;
  created_at: string;
  event_created?: boolean;
  action?: string | null;
}

export interface CalendarItem {
  id: number;
  type: 'event' | 'busy';
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
}

export interface CalendarOverviewResponse {
  window: { start_at: string; end_at: string };
  current_user_id?: number | null;
  users: { id: number; email: string }[];
  work_calendars?: { calendar_id: string; summary?: string | null }[];
  items: CalendarItem[];
}

export interface CreateTransactionData {
  transacted_at: string;
  plaid_name: string;
  merchant_name: string;
  category: string;
  source: string;
  amount: number;
  hidden: boolean;
  reviewed: boolean;
}

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

interface APIResponse<T> {
  results?: T[];
  error?: string;
}

export interface MonthlyTotal {
  month: string;
  total: number;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number | null;
  monthly_avg: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  transaction_count: number;
  percentage: number;
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
  period: { start_month: string; end_month: string; year: number };
  monthly_totals: MonthlyTotal[];
  by_category: CategoryBreakdown[];
  by_merchant: MerchantBreakdown[];
  budget_comparison: BudgetComparison[];
  monthly_by_category: MonthlyCategoryData[];
  monthly_by_merchant: MonthlyMerchantData[];
  merchant_trend?: MerchantTrendsData | null;
}

export interface MerchantTrendsData {
  merchant: string | null;
  months: { month: string; total: number }[];
  start_month: string;
  end_month: string;
  total_spent: number;
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

// ─── Helpers ─────────────────────────────────────────────
function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.response?.data?.message || error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ─── API Functions ───────────────────────────────────────

export const getTransactions = async (filters: TransactionFilters): Promise<Transaction[]> => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());
  if (filters.query) params.append('query', filters.query);
  if (filters.show_hidden !== undefined) params.append('show_hidden', filters.show_hidden.toString());
  if (filters.show_needs_review !== undefined) params.append('show_needs_review', filters.show_needs_review.toString());

  try {
    const response = await axiosInstance.get<APIResponse<Transaction>>('/financial_transactions', { params });
    const { results, error } = response.data || {};
    if (error) throw new Error(error);
    return Array.isArray(results) ? results : [];
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, 'Failed to fetch transactions');
    throw new Error(errorMessage);
  }
};

export const getTransaction = async (id: number): Promise<Transaction> => {
  const response = await axiosInstance.get<Transaction>(`/financial_transactions/${id}`);
  return response.data;
};

export const createTransaction = async (data: CreateTransactionData): Promise<Transaction> => {
  const response = await axiosInstance.post<Transaction>('/financial_transactions', data);
  EventEmitter.emit('transactions-changed');
  return response.data;
};

export const updateTransaction = async (id: number, data: Record<string, unknown>): Promise<Transaction> => {
  const response = await axiosInstance.put<Transaction>(`/financial_transactions/${id}`, data);
  EventEmitter.emit('transactions-changed');
  return response.data;
};

export const getBudgets = async (filters: TransactionFilters = {}): Promise<Budget[]> => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());

  const response = await axiosInstance.get<Budget[]>('/budgets', { params });
  return response.data || [];
};

export const getCalendarOverview = async (view: string, date: string): Promise<CalendarOverviewResponse> => {
  const params = new URLSearchParams();
  params.append('view', view);
  params.append('date', date);

  const response = await axiosInstance.get<CalendarOverviewResponse>('/calendar/overview', { params });
  return response.data;
};

export const destroySession = async (): Promise<void> => {
  await axiosInstance.delete('/auth/session');
  await clearToken();
  useAuthStore.getState().setIsAuthenticated(false);
};

export const deleteCalendarEvent = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/calendar/events/${id}`);
  EventEmitter.emit('calendar-changed');
};

export const updateCalendarEvent = async (id: number, updates: Record<string, unknown>): Promise<void> => {
  await axiosInstance.patch(`/calendar/events/${id}`, updates);
  EventEmitter.emit('calendar-changed');
};

export const getChatMessages = async (params: { limit?: number; before_id?: number } = {}): Promise<{
  messages: ChatMessage[];
  has_more: boolean;
  next_before_id: number | null;
}> => {
  const urlParams = new URLSearchParams();
  if (params.limit) urlParams.append('limit', params.limit.toString());
  if (params.before_id) urlParams.append('before_id', params.before_id.toString());

  const response = await axiosInstance.get('/chat/messages', { params: urlParams });
  return response.data;
};

export const createChatMessage = async (
  text: string,
  imageUri?: string
): Promise<{ message: ChatMessage; reply: ChatMessage }> => {
  if (imageUri) {
    const formData = new FormData();
    formData.append('text', text);
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('image', { uri: imageUri, name: filename, type } as unknown as Blob);

    const response = await axiosInstance.post('/chat/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  }

  const response = await axiosInstance.post('/chat/messages', { text });
  return response.data;
};

export const resetChatThread = async (): Promise<void> => {
  await axiosInstance.delete('/chat/thread');
};

export const getTrends = async (filters: TrendsFilters = {}): Promise<TrendsData> => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.category) params.append('category', filters.category);

  const response = await axiosInstance.get<TrendsData>('/financial_transactions/trends', { params });
  return response.data;
};

export const getMerchantTrends = async (filters: MerchantTrendsFilters): Promise<MerchantTrendsData> => {
  const params = new URLSearchParams();
  if (filters.query) params.append('merchant', filters.query);
  if (filters.exact !== undefined) params.append('exact', filters.exact.toString());
  if (filters.start_month) params.append('start_month', filters.start_month);
  if (filters.end_month) params.append('end_month', filters.end_month);

  const response = await axiosInstance.get<TrendsData>('/financial_transactions/trends', { params });
  return response.data.merchant_trend || {
    merchant: filters.query || null,
    months: [],
    start_month: filters.start_month || '',
    end_month: filters.end_month || '',
    total_spent: 0,
  };
};

export const getRecurringStatus = async (filters: { year?: number; month?: number } = {}): Promise<RecurringStatusData> => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.month) params.append('month', filters.month.toString());

  const response = await axiosInstance.get<RecurringStatusData>('/financial_transactions/recurring_status', { params });
  return response.data;
};

export const getMerchantSuggestions = async (filters: MerchantSuggestionsFilters) => {
  const params = new URLSearchParams();
  if (filters.query) params.append('query', filters.query);
  if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
  params.append('aggregate', 'merchant_suggestions');

  const response = await axiosInstance.get('/financial_transactions', { params });
  return response.data;
};

export const getGoogleOAuthUrl = async (): Promise<string> => {
  const response = await axiosInstance.get('/auth/google_oauth2');
  return response.data?.url || '';
};

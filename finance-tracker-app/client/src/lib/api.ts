import axios from 'axios';
import { create } from 'zustand';

interface AuthStore {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),
}));

export const API_BASE_URL = 'https://sifxtre.me/api';
export const API_PASSWORD_KEY = 'JARVIS_RAILS_PASS'

// Create an axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': localStorage.getItem(API_PASSWORD_KEY)
  }
});

// Add response interceptor
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setShowAuthModal(true);
    }
    return Promise.reject(error);
  }
);

// Add request interceptor to update auth header
axiosInstance.interceptors.request.use(config => {
  config.headers.Authorization = localStorage.getItem(API_PASSWORD_KEY);
  return config;
});

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
}

export interface Budget {
  id: number;
  category: string;
  amount: number;
  year: number;
  month: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionFilters {
  year: number;
  month: number;
  show_hidden: boolean;
  show_needs_review: boolean;
  query?: string;
}

export interface BudgetFilters {
  year: number;
  month: number;
  show_hidden: boolean;
  show_needs_review: boolean;
}

interface APIResponse<T> {
  results: T[];
  total?: number;
  error?: string;
}

export const api = {
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

  console.log('[API] Using filters:', filters);

  try {
    const response = await axiosInstance.get<APIResponse<Transaction>>('/financial_transactions', { params });
    console.log('[API] Raw response:', response.data);

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
        console.error('[API] Invalid transaction object:', transaction);
      }
      return isValid;
    });

    console.log('[API] Successfully fetched:', {
      status: response.status,
      totalCount: results.length,
      validCount: validTransactions.length,
      sampleDates: validTransactions.slice(0, 3).map(t => t.transacted_at)
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

  const url = `${API_BASE_URL}/budgets?${params.toString()}`;
  console.log('[API] Fetching budgets:', url);

  try {
    const response = await axiosInstance.get<APIResponse<Budget>>(url);

    if (!response.data) {
      throw new Error('No data received from server');
    }

    const { results, error } = response.data;

    if (error) {
      throw new Error(error);
    }

    if (!Array.isArray(results)) {
      throw new Error('Invalid response format: results is not an array');
    }

    return results;
  } catch (error: any) {
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
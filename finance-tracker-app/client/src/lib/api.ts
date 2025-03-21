import axios from 'axios';
import { create } from 'zustand';

// Define constants first
export const API_BASE_URL = 'https://sifxtre.me/api';
export const API_PASSWORD_KEY = 'JARVIS_RAILS_PASS';

interface AuthStore {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),
  isAuthenticated: !!localStorage.getItem(API_PASSWORD_KEY),
  setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
}));

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
      // If we get a 401, we know we're unauthenticated
      // Clear the API key and update authentication state
      localStorage.removeItem(API_PASSWORD_KEY);
      useAuthStore.getState().setIsAuthenticated(false);
      useAuthStore.getState().setShowAuthModal(true);
    }
    return Promise.reject(error);
  }
);

// Add request interceptor to update auth header
axiosInstance.interceptors.request.use(config => {
  const apiKey = localStorage.getItem(API_PASSWORD_KEY);
  config.headers.Authorization = apiKey;
  return config;
});

// Function to verify if the current API key is valid
export const verifyAuthentication = async (): Promise<boolean> => {
  try {
    const apiKey = localStorage.getItem(API_PASSWORD_KEY);
    if (!apiKey) {
      return false;
    }

    // Make a lightweight request to verify the API key
    // Using the budgets endpoint with a minimal request
    await axiosInstance.get('/budgets', {
      params: { limit: 1 },
      timeout: 3000 // Set a timeout to prevent long waits
    });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // If we get a 401, we know we're unauthenticated
      localStorage.removeItem(API_PASSWORD_KEY);
      return false;
    }
    // For other errors, assume the API is down but the key might be valid
    console.error('Error verifying authentication:', error);
    return !!localStorage.getItem(API_PASSWORD_KEY);
  }
};

// Function to set authentication
export const setAuthentication = (apiKey: string): void => {
  localStorage.setItem(API_PASSWORD_KEY, apiKey);
  useAuthStore.getState().setIsAuthenticated(true);
};

// Function to clear authentication
export const clearAuthentication = (): void => {
  localStorage.removeItem(API_PASSWORD_KEY);
  useAuthStore.getState().setIsAuthenticated(false);
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
}

export interface Budget {
  id: number;
  name: string;
  amount: number;
  expense_type: "income" | "expense";
  display_order: number;
}

export interface TransactionFilters {
  year: number;
  month: number;
  show_hidden: boolean;
  show_needs_review: boolean;
  query: string;
}

export interface BudgetFilters {
  year: number;
  month: number;
  show_hidden: boolean;
  show_needs_review: boolean;
}

interface APIResponse<T> {
  total?: number;
  error?: string;
  results?: T[];
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
        console.error('[API] Invalid transaction object:', transaction);
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
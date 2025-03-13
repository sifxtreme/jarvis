import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import TransactionsPage from './pages/TransactionsPage';
import YearlyBudgetPage from './pages/YearlyBudgetPage';
import { AuthModal } from '@/components/AuthModal';
import { API_PASSWORD_KEY, verifyAuthentication, useAuthStore } from '@/lib/api';

function App() {
  // Use the authentication state from the store
  const { isAuthenticated, setIsAuthenticated, showAuthModal, setShowAuthModal } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have an API key in localStorage
    const apiKey = localStorage.getItem(API_PASSWORD_KEY);

    if (!apiKey) {
      // No API key, we're definitely not authenticated
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    // We have an API key, assume we're authenticated until proven otherwise
    setIsAuthenticated(true);
    setIsLoading(false);

    // Verify the API key in the background
    // This will update the auth state if the key is invalid
    verifyAuthentication().then(isValid => {
      if (!isValid) {
        setIsAuthenticated(false);
      }
    }).catch(error => {
      console.error('Authentication verification failed:', error);
      // Don't change authentication state for network errors
      // The API interceptor will handle 401 errors during API calls
    });
  }, [setIsAuthenticated]);

  // Don't render anything while checking authentication
  if (isLoading) {
    return null; // Or a loading spinner if preferred
  }

  return (
    <>
      <AuthModal
        isOpen={showAuthModal}
        onAuthenticate={() => {
          setIsAuthenticated(true);
          setShowAuthModal(false);
        }}
      />

      {isAuthenticated ? (
        <Routes>
          <Route path="/" element={<TransactionsPage />} />
          <Route path="/yearly-budget" element={<YearlyBudgetPage />} />
        </Routes>
      ) : (
        // Show login prompt only if not authenticated and modal not already showing
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Login
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
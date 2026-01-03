import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import TransactionsPage from './pages/TransactionsPage';
import YearlyBudgetPage from './pages/YearlyBudgetPage';
import TrendsPage from './pages/TrendsPage';
import TellerRepairPage from './pages/TellerRepairPage';
import CalendarPage from './pages/CalendarPage';
import { AuthModal } from '@/components/AuthModal';
import { Navbar } from '@/components/Navbar';
import { verifyAuthentication, useAuthStore } from '@/lib/api';

function App() {
  // Use the authentication state from the store
  const { isAuthenticated, setIsAuthenticated, showAuthModal, setShowAuthModal } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Verify session in the background
    // This will update the auth state if the key is invalid
    verifyAuthentication().then(isValid => {
      setIsAuthenticated(isValid);
      setIsLoading(false);
    }).catch(error => {
      console.error('Authentication verification failed:', error);
      // Don't change authentication state for network errors
      // The API interceptor will handle 401 errors during API calls
      setIsLoading(false);
    });
  }, [setIsAuthenticated]);

  useEffect(() => {
    const titleMap: Record<string, string> = {
      "/": "Transactions",
      "/calendar": "Calendar",
      "/trends": "Trends",
      "/yearly-budget": "Yearly Budget",
      "/teller-repair": "Teller Repair",
    };
    const suffix = titleMap[location.pathname] || "Dashboard";
    document.title = `Jarvis — ${suffix}`;
  }, [location.pathname]);

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
        <div className="flex flex-col h-screen">
          <Navbar />
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<TransactionsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/yearly-budget" element={<YearlyBudgetPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/teller-repair" element={<TellerRepairPage />} />
            </Routes>
          </div>
        </div>
      ) : (
        // Show login prompt only if not authenticated and modal not already showing
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Sign in to Jarvis</h1>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

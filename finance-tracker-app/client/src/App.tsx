import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import TransactionsPage from './pages/TransactionsPage';
import { AuthModal } from '@/components/AuthModal';
import { API_PASSWORD_KEY } from '@/lib/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if there's an existing API key in localStorage
    const apiKey = localStorage.getItem(API_PASSWORD_KEY);
    if (apiKey) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <>
      <AuthModal
        isOpen={!isAuthenticated}
        onAuthenticate={() => setIsAuthenticated(true)}
      />

      {isAuthenticated ? (
        <Routes>
          <Route path="/" element={<TransactionsPage />} />
        </Routes>
      ) : null}
    </>
  );
}

export default App;
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import TransactionsPage from "./pages/TransactionsPage";
import BudgetPage from "./pages/BudgetPage";
import { API_PASSWORD_KEY } from './lib/api'
import { AuthModal } from "./components/AuthModal";
import { useAuthStore } from "./lib/api";

// Check for password in URL
const urlParams = new URLSearchParams(window.location.search);
const password = urlParams.get('p');
if (password) {
  localStorage.setItem(API_PASSWORD_KEY, password);
  // Remove password from URL
  urlParams.delete('p');
  const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
  window.history.replaceState({}, '', newUrl);
  window.location.reload();
}

function App() {
  const { showAuthModal, setShowAuthModal } = useAuthStore();

  const handleAuthenticate = () => {
    setShowAuthModal(false);
    window.location.reload(); // Reload to retry failed requests with new auth
  };

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={TransactionsPage} />
          <Route path="/budget" component={BudgetPage} />
          <Route>404 Page Not Found</Route>
        </Switch>
        <Toaster />
        <AuthModal
          isOpen={showAuthModal}
          onAuthenticate={handleAuthenticate}
        />
      </QueryClientProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
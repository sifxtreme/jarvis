import { Routes, Route } from 'react-router-dom';
import TransactionsPage from './pages/TransactionsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<TransactionsPage />} />
    </Routes>
  );
}

export default App;
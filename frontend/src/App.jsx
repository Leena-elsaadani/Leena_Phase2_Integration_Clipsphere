import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/login" element={token ? <Navigate to="/chat" replace /> : <LoginPage />} />
      <Route path="/chat" element={token ? <ChatPage /> : <Navigate to="/login" replace />} />
      <Route path="/dashboard" element={token ? <DashboardPage /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
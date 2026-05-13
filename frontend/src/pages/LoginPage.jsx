import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEffect } from 'react';
import LoginButton from '../components/auth/LoginButton';

const LoginPage = () => {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate('/chat');
    }
  }, [token, navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      login(tokenFromUrl);
      navigate('/chat');
    }
  }, [login, navigate]);

  const handleGitHubLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/github/login`;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>
        <h1>Login</h1>
        <LoginButton onClick={handleGitHubLogin} text="Login with GitHub" />
      </div>
    </div>
  );
};

export default LoginPage;
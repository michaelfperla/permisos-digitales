import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import LoginForm from '../components/auth/LoginForm';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

/**
 * Login page with automatic redirection for authenticated users
 */
const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  return <LoginForm />;
};

export default LoginPage;

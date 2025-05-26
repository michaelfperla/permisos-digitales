import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import LoginForm from '../components/auth/LoginForm';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from location state, or default to dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // If user is already authenticated, redirect to dashboard or the page they were trying to access
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // If not authenticated, show the login form
  return <LoginForm />;
};

export default LoginPage;

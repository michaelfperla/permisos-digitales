import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import RegisterForm from '../components/auth/RegisterForm';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

/**
 * Registration page with automatic redirection for authenticated users
 */
const RegisterPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return <RegisterForm onRegistrationSuccess={() => {}} />;
};

export default RegisterPage;

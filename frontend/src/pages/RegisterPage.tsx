import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import RegisterForm from '../components/auth/RegisterForm';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const RegisterPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Show the registration form
  return <RegisterForm onRegistrationSuccess={() => {}} />;
};

export default RegisterPage;

import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

interface PermitRouteGuardProps {
  children: React.ReactNode;
}

const PermitRouteGuard: React.FC<PermitRouteGuardProps> = ({ children }) => {
  const { id } = useParams<{ id: string }>();

  // Check if ID exists
  const isIdValid = !!id && id.trim() !== '';

  // If ID is valid, render children
  if (isIdValid) {
    return <>{children}</>;
  }

  // If ID is invalid, redirect to dashboard with error message
  return <Navigate to="/dashboard" replace state={{ error: 'ID de permiso inválido.' }} />;
};

export default PermitRouteGuard;

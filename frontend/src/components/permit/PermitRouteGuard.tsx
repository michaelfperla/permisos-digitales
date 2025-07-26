import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

interface PermitRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that validates permit ID parameter before rendering children
 */
const PermitRouteGuard: React.FC<PermitRouteGuardProps> = ({ children }) => {
  const { id } = useParams<{ id: string }>();

  const isIdValid = !!id && id.trim() !== '';

  if (isIdValid) {
    return <>{children}</>;
  }

  return <Navigate to="/dashboard" replace state={{ error: 'ID de permiso inválido.' }} />;
};

export default PermitRouteGuard;

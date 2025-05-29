import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Route guard that requires user authentication.
 * Redirects to login if not authenticated, preserving intended destination.
 */
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  console.debug(
    `[ProtectedRoute] Render - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, location: ${location.pathname}`,
  );

  if (isLoading) {
    console.debug('[ProtectedRoute] DECISION: isLoading is true. Rendering spinner.');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    console.debug(
      `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is false. Redirecting to /login.`,
    );
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.debug(
    `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is true. Rendering Outlet.`,
  );
  return <Outlet />;
};

export default ProtectedRoute;
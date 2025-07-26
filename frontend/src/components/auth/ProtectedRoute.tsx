import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';
import { logger } from '../../utils/logger';

/**
 * Route guard that requires user authentication.
 * Redirects to login if not authenticated, preserving intended destination.
 */
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Check session storage as additional verification
  const hasUserInStorage = sessionStorage.getItem('user') !== null;

  logger.debug(
    `[ProtectedRoute] Render - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, hasUserInStorage: ${hasUserInStorage}, location: ${location.pathname}`,
  );

  if (isLoading) {
    logger.debug('[ProtectedRoute] DECISION: isLoading is true. Rendering spinner.');
    return <LoadingSpinner />;
  }

  // If not authenticated in context but user exists in storage, still show spinner
  // This handles the case where auth context is still initializing after navigation
  if (!isAuthenticated && hasUserInStorage) {
    logger.debug(
      '[ProtectedRoute] DECISION: Not authenticated in context but user exists in storage. Showing spinner while auth initializes.',
    );
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    logger.debug(
      `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is false. Redirecting to /login.`,
    );
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  logger.debug(
    `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is true. Rendering Outlet.`,
  );
  return <Outlet />;
};

export default ProtectedRoute;
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Log state values *immediately* upon render
  console.debug( // Changed to debug
    `[ProtectedRoute] Render - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, location: ${location.pathname}`,
  );

  // If authentication is still being checked, show loading spinner
  if (isLoading) {
    console.debug('[ProtectedRoute] DECISION: isLoading is true. Rendering spinner.'); // Changed to debug
    return <LoadingSpinner />;
  }

  // If user is not authenticated, redirect to login page
  // Pass the current location in state so we can redirect back after login
  if (!isAuthenticated) {
    console.debug( // Changed to debug
      `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is false. Redirecting to /login.`,
    );
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated, render the child routes
  console.debug( // Changed to debug
    `[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is true. Rendering Outlet.`,
  );
  return <Outlet />;
};

export default ProtectedRoute;
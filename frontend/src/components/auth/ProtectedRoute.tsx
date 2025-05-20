import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Log state values *immediately* upon render
  console.log(`[ProtectedRoute] Render - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, location: ${location.pathname}`);

  // If authentication is still being checked, show loading spinner
  if (isLoading) {
    console.log('[ProtectedRoute] DECISION: isLoading is true. Rendering spinner.');
    return <LoadingSpinner />;
  }

  // If user is not authenticated, redirect to login page
  // Pass the current location in state so we can redirect back after login
  if (!isAuthenticated) {
    console.log(`[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is false. Redirecting to /login.`);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated, render the child routes
  console.log(`[ProtectedRoute] DECISION: isLoading is false AND isAuthenticated is true. Rendering Outlet.`);
  return <Outlet />;
};

export default ProtectedRoute;

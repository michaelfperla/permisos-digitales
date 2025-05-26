import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useAdminAuth as useAuth } from '../../../shared/hooks/useAuth';

const ProtectedAdminRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Log state values on every render for debugging
  console.debug( // Changed to debug
    `[ProtectedAdminRoute] Render - Path: ${location.pathname}, isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, user: ${user?.email || 'null'}`,
  );

  // Log detailed user info when available
  useEffect(() => {
    if (user) {
      console.debug('[ProtectedAdminRoute] User details:', { // Changed to debug
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        is_admin_portal: user.is_admin_portal,
        accessDetails: user.accessDetails,
      });
    }
  }, [user]);

  // If still loading, show spinner
  if (isLoading) {
    console.debug('[ProtectedAdminRoute] DECISION: Still loading, showing spinner'); // Changed to debug
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is authenticated and has admin access
  const hasAdminAccess =
    isAuthenticated && user?.accountType === 'admin' && user?.is_admin_portal === true;

  console.debug( // Changed to debug
    `[ProtectedAdminRoute] Access check - hasAdminAccess: ${hasAdminAccess}, isAuthenticated: ${isAuthenticated}, accountType: ${user?.accountType}, is_admin_portal: ${user?.is_admin_portal}`,
  );

  // If not authenticated or not an admin, redirect to login
  if (!hasAdminAccess) {
    console.debug('[ProtectedAdminRoute] DECISION: No admin access, redirecting to login'); // Changed to debug
    // Redirect to login page with the return URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated and has admin access, render the protected route
  console.debug('[ProtectedAdminRoute] DECISION: Has admin access, rendering protected route'); // Changed to debug
  return <Outlet />;
};

export default ProtectedAdminRoute;
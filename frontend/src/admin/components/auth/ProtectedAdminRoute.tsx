import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const ProtectedAdminRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Log state values on every render for debugging
  console.log(`[ProtectedAdminRoute] Render - Path: ${location.pathname}, isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, user: ${user?.email || 'null'}`);

  // Log detailed user info when available
  useEffect(() => {
    if (user) {
      console.log('[ProtectedAdminRoute] User details:', {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        is_admin_portal: user.is_admin_portal,
        accessDetails: user.accessDetails
      });
    }
  }, [user]);

  // If still loading, show spinner
  if (isLoading) {
    console.log('[ProtectedAdminRoute] DECISION: Still loading, showing spinner');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is authenticated and has admin access
  const hasAdminAccess = isAuthenticated &&
                         user?.accountType === 'admin' &&
                         user?.is_admin_portal === true;

  console.log(`[ProtectedAdminRoute] Access check - hasAdminAccess: ${hasAdminAccess}, isAuthenticated: ${isAuthenticated}, accountType: ${user?.accountType}, is_admin_portal: ${user?.is_admin_portal}`);

  // If not authenticated or not an admin, redirect to login
  if (!hasAdminAccess) {
    console.log('[ProtectedAdminRoute] DECISION: No admin access, redirecting to login');
    // Redirect to login page with the return URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated and has admin access, render the protected route
  console.log('[ProtectedAdminRoute] DECISION: Has admin access, rendering protected route');
  return <Outlet />;
};

export default ProtectedAdminRoute;

import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useAdminAuth as useAuth } from '../../../shared/hooks/useAuth';

/**
 * Route guard that requires admin authentication and permissions.
 * Redirects to login if not authenticated or lacks admin access.
 */
const ProtectedAdminRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  console.debug(
    `[ProtectedAdminRoute] Render - Path: ${location.pathname}, isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, user: ${user?.email || 'null'}`,
  );

  useEffect(() => {
    if (user) {
      console.debug('[ProtectedAdminRoute] User details:', {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        is_admin_portal: user.is_admin_portal,
        accessDetails: user.accessDetails,
      });
    }
  }, [user]);

  if (isLoading) {
    console.debug('[ProtectedAdminRoute] DECISION: Still loading, showing spinner');
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  const hasAdminAccess =
    isAuthenticated && user?.accountType === 'admin' && user?.is_admin_portal === true;

  console.debug(
    `[ProtectedAdminRoute] Access check - hasAdminAccess: ${hasAdminAccess}, isAuthenticated: ${isAuthenticated}, accountType: ${user?.accountType}, is_admin_portal: ${user?.is_admin_portal}`,
  );

  if (!hasAdminAccess) {
    console.debug('[ProtectedAdminRoute] DECISION: No admin access, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.debug('[ProtectedAdminRoute] DECISION: Has admin access, rendering protected route');
  return <Outlet />;
};

export default ProtectedAdminRoute;
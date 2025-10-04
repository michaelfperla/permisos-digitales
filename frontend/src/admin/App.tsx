import { Routes, Route, Navigate } from 'react-router-dom';

import AdminErrorBoundary from './components/ErrorBoundary';
import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute';
import AdminLayout from './layouts/AdminLayout';
import ApplicationDetailsPage from './pages/ApplicationDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import DashboardPage from './pages/DashboardPage';
import FailedPermitsPage from './pages/FailedPermitsPage';
import LoginPage from './pages/LoginPage';
import UserDetailsPage from './pages/UserDetailsPage';
import UsersPage from './pages/UsersPage';
import WhatsAppMonitoringPage from './pages/WhatsAppMonitoringPage';
import AdminLoadingSpinner from './components/AdminLoadingSpinner';
import { useAdminAuth as useAuth } from '../shared/hooks/useAuth';

/**
 * Admin application component that defines routes for the administrative interface.
 * Handles admin authentication and provides access to user and application management.
 */
function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <AdminLoadingSpinner 
        size="lg" 
        variant="branded"
        message="Inicializando Portal Administrativo..."
      />
    );
  }

  return (
    <AdminErrorBoundary>
      <Routes>
        {/* Login route - outside error boundary for authentication issues */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected admin routes - wrapped in error boundary */}
        <Route element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/failed" element={<FailedPermitsPage />} />
            <Route path="/applications/:id" element={<ApplicationDetailsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:userId" element={<UserDetailsPage />} />
            <Route path="/whatsapp-monitoring" element={<WhatsAppMonitoringPage />} />
          </Route>
        </Route>
        
        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AdminErrorBoundary>
  );
}

export default App;
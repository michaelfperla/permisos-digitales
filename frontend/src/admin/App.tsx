import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute';
import AdminLayout from './layouts/AdminLayout';
import ApplicationDetailsPage from './pages/ApplicationDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import DashboardPage from './pages/DashboardPage';
import FailedPermitsPage from './pages/FailedPermitsPage';
import LoginPage from './pages/LoginPage';
import UserDetailsPage from './pages/UserDetailsPage';
import UsersPage from './pages/UsersPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAdminAuth as useAuth } from '../shared/hooks/useAuth';

/**
 * Admin application component that defines routes for the administrative interface.
 * Handles admin authentication and provides access to user and application management.
 */
function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/applications/failed" element={<FailedPermitsPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:userId" element={<UserDetailsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
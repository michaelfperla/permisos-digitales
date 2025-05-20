import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ApplicationDetailsPage from './pages/ApplicationDetailsPage';
// [Refactor - Remove Manual Payment] Import for manual payment verification page
import PendingVerificationsPage from './pages/PendingVerificationsPage';
import VerificationHistoryPage from './pages/VerificationHistoryPage';
import UsersPage from './pages/UsersPage';
import UserDetailsPage from './pages/UserDetailsPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import useAuth from './hooks/useAuth';

function App() {
  const { isLoading } = useAuth();

  // Show loading spinner while checking authentication status
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Log the current path for debugging
  console.log('[AdminApp] Rendering with path:', window.location.pathname);

  return (
    <Routes>
      {/* Public route for login */}
      <Route path="/login" element={<LoginPage />} />

      {/* All admin routes require authentication */}
      <Route element={<ProtectedAdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailsPage />} />
          {/* [Refactor - Remove Manual Payment] Route for manual payment verification page */}
          <Route path="/pending-verifications" element={<PendingVerificationsPage />} />
          <Route path="/verification-history" element={<VerificationHistoryPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:userId" element={<UserDetailsPage />} />
        </Route>
      </Route>

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

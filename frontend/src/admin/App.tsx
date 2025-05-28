import { Routes, Route, Navigate } from 'react-router-dom';

// Corrected import paths assuming components are in ./components, pages in ./pages etc.
// And shared components are in ../shared/
import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute'; // Path was correct
import AdminLayout from './layouts/AdminLayout';                           // Path was correct
import ApplicationDetailsPage from './pages/ApplicationDetailsPage';       // Path was correct
import ApplicationsPage from './pages/ApplicationsPage';                 // Path was correct
import DashboardPage from './pages/DashboardPage';                       // Path was correct
import LoginPage from './pages/LoginPage';                               // Path was correct
import UserDetailsPage from './pages/UserDetailsPage';                   // Path was correct
import UsersPage from './pages/UsersPage';                               // Path was correct
import LoadingSpinner from '../components/ui/LoadingSpinner'; // Adjusted path from ../../ to ../
import { useAdminAuth as useAuth } from '../shared/hooks/useAuth';  // Adjusted path from ../../../ to ../shared/

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  console.debug('[AdminApp] Rendering with path:', window.location.pathname); // Changed to debug

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
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
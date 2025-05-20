import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import UserLayout from './layouts/UserLayout';
import AuthLayout from './layouts/AuthLayout';
import HomeLayout from './layouts/HomeLayout';
import VerificationLayout from './layouts/VerificationLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PermitRouteGuard from './components/permit/PermitRouteGuard';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResendVerificationPage from './pages/ResendVerificationPage';
import PreVerificationPage from './pages/PreVerificationPage';
import NewDashboardPage from './pages/NewDashboardPage';
import UserDashboardPage from './pages/UserDashboardPage';
import PermitsListPage from './pages/PermitsListPage';
import UserPermitsPage from './pages/UserPermitsPage';
import CompletePermitFormPage from './pages/CompletePermitFormPage';
import PermitDetailsPage from './pages/PermitDetailsPage';
import PermitRenewalPage from './pages/PermitRenewalPage';
import ProfilePage from './pages/ProfilePage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentErrorPage from './pages/PaymentErrorPage';
import PermitPaymentPage from './pages/PermitPaymentPage';
import MobileDesignSystemTest from './pages/MobileDesignSystemTest';
import LoadingSpinner from './components/ui/LoadingSpinner';
import useAuth from './hooks/useAuth';

function App() {
  const { isLoading } = useAuth();

  // Show loading spinner while checking authentication status
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Verification routes */}
      <Route element={<VerificationLayout />}>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
        <Route path="/pre-verification" element={<PreVerificationPage />} />
      </Route>

      {/* Routes requiring authentication */}
      <Route element={<ProtectedRoute />}>
        {/* Legacy layout */}
        <Route element={<MainLayout />}>
          {/* Keep the original dashboard for backward compatibility */}
          <Route path="/dashboard-legacy" element={<NewDashboardPage />} />
          <Route path="/permits-legacy" element={<PermitsListPage />} />

          {/* Payment result pages */}
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/error" element={<PaymentErrorPage />} />

          {/* Test pages */}
          <Route path="/mobile-design-test" element={<MobileDesignSystemTest />} />
        </Route>

        {/* New User Layout */}
        <Route element={<UserLayout />}>
          {/* Main dashboard and permits pages */}
          <Route path="/dashboard" element={<UserDashboardPage />} />
          <Route path="/permits" element={<UserPermitsPage />} />
          <Route path="/permits/new" element={<Navigate to="/permits/complete" replace />} />
          <Route path="/permits/complete" element={<CompletePermitFormPage />} />

          {/* Routes that need permit validation */}
          <Route path="/permits/:id" element={
            <PermitRouteGuard>
              <PermitDetailsPage />
            </PermitRouteGuard>
          } />
          <Route path="/permits/:id/renew" element={
            <PermitRouteGuard>
              <PermitRenewalPage />
            </PermitRouteGuard>
          } />

          <Route path="/permits/:id/payment" element={
            <PermitRouteGuard>
              <PermitPaymentPage />
            </PermitRouteGuard>
          } />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/documents" element={<div>Mis Documentos (En desarrollo)</div>} />
        </Route>
      </Route>

      {/* Public Home page - with custom layout */}
      <Route element={<HomeLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      {/* 404 Route - can be added later */}
      {/* <Route path="*" element={<NotFoundPage />} /> */}
    </Routes>
  );
}

export default App;

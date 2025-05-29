import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/auth/ProtectedRoute';
import PermitRouteGuard from './components/permit/PermitRouteGuard';
import LoadingSpinner from './components/ui/LoadingSpinner';
import AuthLayout from './layouts/AuthLayout';
import HomeLayout from './layouts/HomeLayout';
import MainLayout from './layouts/MainLayout';
import UserLayout from './layouts/UserLayout';
import VerificationLayout from './layouts/VerificationLayout';
import CompletePermitFormPage from './pages/CompletePermitFormPage';
import ContactPage from './pages/ContactPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PaymentErrorPage from './pages/PaymentErrorPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PermitDetailsPage from './pages/PermitDetailsPage';
import PermitPaymentPage from './pages/PermitPaymentPage';
import PermitsListPage from './pages/PermitsListPage';
import PreVerificationPage from './pages/PreVerificationPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ResendVerificationPage from './pages/ResendVerificationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsAndConditionsPage from './pages/TermsAndConditionsPage';
import UserDashboardPage from './pages/UserDashboardPage';
import UserPermitsPage from './pages/UserPermitsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { useUserAuth as useAuth } from './shared/hooks/useAuth';

/**
 * Main application component that defines all routes for the digital permits platform.
 * Handles authentication state and renders appropriate layouts for different user flows.
 */
function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Authentication routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Email verification routes */}
      <Route element={<VerificationLayout />}>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
        <Route path="/pre-verification" element={<PreVerificationPage />} />
      </Route>

      {/* Protected user routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/permits-legacy" element={<PermitsListPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/error" element={<PaymentErrorPage />} />
        </Route>

        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<UserDashboardPage />} />
          <Route path="/permits" element={<UserPermitsPage />} />
          <Route path="/permits/new" element={<Navigate to="/permits/complete" replace />} />
          <Route path="/permits/complete" element={<CompletePermitFormPage />} />

          <Route path="/permits/:id" element={
            <PermitRouteGuard>
              <PermitDetailsPage />
            </PermitRouteGuard>
          } />

          <Route path="/permits/:id/payment" element={
            <PermitRouteGuard>
              <PermitPaymentPage />
            </PermitRouteGuard>
          } />

          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Public routes */}
      <Route element={<HomeLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route path="/terminos-y-condiciones" element={<TermsAndConditionsPage />} />
      <Route path="/politica-de-privacidad" element={<PrivacyPolicyPage />} />
      <Route path="/contacto" element={<ContactPage />} />
    </Routes>
  );
}

export default App;

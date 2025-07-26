import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PermitRouteGuard from './components/permit/PermitRouteGuard';
import LoadingSpinner from './components/ui/LoadingSpinner';
import AuthLayout from './layouts/AuthLayout';
import HomeLayout from './layouts/HomeLayout';
import MainLayout from './layouts/MainLayout';
import UserLayout from './layouts/UserLayout';
import VerificationLayout from './layouts/VerificationLayout';
import { cleanupEventListeners, logMemoryUsage, forceGarbageCollection } from './utils/memoryCleanup';
import { useUserAuth as useAuth } from './shared/hooks/useAuth';

// Suspense wrapper component for cleaner code
const SuspenseRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);

// Lazy load page components for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const CompletePermitFormPage = lazy(() => import('./pages/CompletePermitFormPage'));
const PermitDetailsPage = lazy(() => import('./pages/PermitDetailsPage'));
const PermitPaymentPage = lazy(() => import('./pages/PermitPaymentPage'));
const UserPermitsPage = lazy(() => import('./pages/UserPermitsPage'));
const PermitsListPage = lazy(() => import('./pages/PermitsListPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const OxxoConfirmationPage = lazy(() => import('./pages/OxxoConfirmationPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentErrorPage = lazy(() => import('./pages/PaymentErrorPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PreVerificationPage = lazy(() => import('./pages/PreVerificationPage'));
const ResendVerificationPage = lazy(() => import('./pages/ResendVerificationPage'));
const ResponsiveUserPermitsPage = lazy(() => import('./pages/ResponsiveUserPermitsPage'));
const ResponsivePermitDetailsPage = lazy(() => import('./pages/ResponsivePermitDetailsPage'));
const PermitRenewalPage = lazy(() => import('./pages/PermitRenewalPage'));
const ResumePaymentPage = lazy(() => import('./pages/ResumePaymentPage'));

// Static pages (less frequently accessed)
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage'));
const DataDeletionPage = lazy(() => import('./pages/DataDeletionPage'));

// Design system pages (development only)
const CleanDesignSystem = lazy(() => import('./pages/CleanDesignSystem'));
const PermisosDesignSystem = lazy(() => import('./pages/PermisosDesignSystem'));

/**
 * Main application component that defines all routes for the digital permits platform.
 * Handles authentication state and renders appropriate layouts for different user flows.
 */
function App() {
  const { isLoading } = useAuth();
  const location = useLocation();

  // Cleanup and memory management on route change
  useEffect(() => {
    // Cleanup global DOM state
    cleanupEventListeners();
    
    // Log memory usage in development
    logMemoryUsage();
    
    // Force garbage collection hint in development
    forceGarbageCollection();
  }, [location.pathname]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Routes>
      {/* Authentication routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<SuspenseRoute><LoginPage /></SuspenseRoute>} />
        <Route path="/register" element={<SuspenseRoute><RegisterPage /></SuspenseRoute>} />
        <Route path="/forgot-password" element={<SuspenseRoute><ForgotPasswordPage /></SuspenseRoute>} />
        <Route path="/reset-password" element={<SuspenseRoute><ResetPasswordPage /></SuspenseRoute>} />
      </Route>

      {/* Email verification routes */}
      <Route element={<VerificationLayout />}>
        <Route path="/verify-email" element={<SuspenseRoute><VerifyEmailPage /></SuspenseRoute>} />
        <Route path="/resend-verification" element={<SuspenseRoute><ResendVerificationPage /></SuspenseRoute>} />
        <Route path="/pre-verification" element={<SuspenseRoute><PreVerificationPage /></SuspenseRoute>} />
      </Route>

      {/* Protected user routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/permits-legacy" element={<SuspenseRoute><PermitsListPage /></SuspenseRoute>} />
          <Route path="/payment/success" element={<SuspenseRoute><PaymentSuccessPage /></SuspenseRoute>} />
          <Route path="/payment/error" element={<SuspenseRoute><PaymentErrorPage /></SuspenseRoute>} />
          <Route path="/payment/resume/:id" element={<SuspenseRoute><ResumePaymentPage /></SuspenseRoute>} />
        </Route>

        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<SuspenseRoute><UserDashboardPage /></SuspenseRoute>} />
          <Route path="/permits" element={<SuspenseRoute><ResponsiveUserPermitsPage /></SuspenseRoute>} />
          <Route path="/permits/new" element={<Navigate to="/permits/complete" replace />} />
          <Route path="/permits/complete" element={<SuspenseRoute><CompletePermitFormPage /></SuspenseRoute>} />

          <Route path="/permits/:id" element={
            <PermitRouteGuard>
              <SuspenseRoute><ResponsivePermitDetailsPage /></SuspenseRoute>
            </PermitRouteGuard>
          } />

          <Route path="/permits/:id/payment" element={
            <PermitRouteGuard>
              <SuspenseRoute><PermitPaymentPage /></SuspenseRoute>
            </PermitRouteGuard>
          } />

          <Route path="/permits/:id/renew" element={
            <PermitRouteGuard>
              <SuspenseRoute><PermitRenewalPage /></SuspenseRoute>
            </PermitRouteGuard>
          } />

          <Route path="/profile" element={<SuspenseRoute><ProfilePage /></SuspenseRoute>} />
          
          {/* Legal pages for authenticated users - these will use UserLayout */}
          <Route path="/terminos-y-condiciones" element={<SuspenseRoute><TermsAndConditionsPage /></SuspenseRoute>} />
          <Route path="/politica-de-privacidad" element={<SuspenseRoute><PrivacyPolicyPage /></SuspenseRoute>} />
          <Route path="/contacto" element={<SuspenseRoute><ContactPage /></SuspenseRoute>} />
          <Route path="/eliminar-datos" element={<SuspenseRoute><DataDeletionPage /></SuspenseRoute>} />
        </Route>
      </Route>

      <Route path="/permits/oxxo-confirmation" element={<SuspenseRoute><OxxoConfirmationPage /></SuspenseRoute>} />

      {/* Public routes */}
      <Route element={<HomeLayout />}>
        <Route path="/" element={<SuspenseRoute><HomePage /></SuspenseRoute>} />
      </Route>

      {/* Public legal and contact pages - accessible without authentication */}
      <Route path="/acerca-de" element={<SuspenseRoute><AboutPage /></SuspenseRoute>} />
      <Route path="/ayuda" element={<SuspenseRoute><HelpPage /></SuspenseRoute>} />
      <Route path="/terminos-y-condiciones" element={<SuspenseRoute><TermsAndConditionsPage /></SuspenseRoute>} />
      <Route path="/politica-de-privacidad" element={<SuspenseRoute><PrivacyPolicyPage /></SuspenseRoute>} />
      <Route path="/contacto" element={<SuspenseRoute><ContactPage /></SuspenseRoute>} />
      <Route path="/eliminar-datos" element={<SuspenseRoute><DataDeletionPage /></SuspenseRoute>} />
      <Route path="/design-system" element={<SuspenseRoute><PermisosDesignSystem /></SuspenseRoute>} />
      <Route path="/design-system-generic" element={<SuspenseRoute><CleanDesignSystem /></SuspenseRoute>} />

      {/* Redirect admin routes to admin app */}
      <Route path="/admin/*" element={<Navigate to="/admin/admin.html" replace />} />

    </Routes>
    </ErrorBoundary>
  );
}

export default App;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// CRITICAL: Initialize API configuration BEFORE importing any services
import { initializeApi } from './services/api';
initializeApi();

// NOW it's safe to import services that depend on the configured API
import App from './App';
import * as authService from './services/authService';
import { AuthProvider } from './shared/contexts/AuthContext';
import { ToastProvider } from './shared/contexts/ToastContext';
import { getCsrfToken } from './utils/csrf';
import { setupGlobalErrorHandler, debugLog, errorLog } from './utils/debug';
import { initializeTimerTracking } from './utils/memoryCleanup';

import './styles/global.css';
import './styles/text-standardization.css';

// Initialize timer tracking after imports are resolved
initializeTimerTracking();

// Register service worker for offline functionality in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.info('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

setupGlobalErrorHandler();

// Expose CSRF token function for debugging
(window as any).getCsrfToken = getCsrfToken;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Disable automatic refetch on window focus
      refetchOnReconnect: false, // Disable automatic refetch on reconnect
      retry: 1, // Reduce retries to prevent memory buildup
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider type="user" authService={authService} debugUtils={{ debugLog, errorLog }}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import * as authService from './services/authService';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthProvider } from '../shared/contexts/AuthContext';
import { ToastProvider } from '../shared/contexts/ToastContext';
import { logger } from '../utils/logger';
import { initializeTimerTracking } from '../utils/memoryCleanup';
import '../styles/global.css';
import '../styles/text-standardization.css';

// Initialize timer tracking after imports are resolved
initializeTimerTracking();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('admin-root') || document.getElementById('root');

if (!rootElement) {
  throw new Error('Required root element not found. Expected element with id "admin-root" or "root".');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <ErrorBoundary>
          <AuthProvider type="admin" authService={authService}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import authService from './services/authService';
import { AuthProvider } from './shared/contexts/AuthContext';
import { ToastProvider } from './shared/contexts/ToastContext';
import { getCsrfToken } from './utils/csrf';
import { setupGlobalErrorHandler, debugLog, errorLog } from './utils/debug';

import './styles/global.css';

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

const queryClient = new QueryClient();

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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import authService from './services/authService';
// Corrected import paths assuming shared is a sibling of admin, or one level up from src/admin
import { AuthProvider } from '../shared/contexts/AuthContext'; 
import { ToastProvider } from '../shared/contexts/ToastContext';
import '../styles/global.css'; // Assuming styles is a sibling of admin, or one level up from src/admin

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
  console.error('Root element not found. Creating a new div element.');
  const newRoot = document.createElement('div');
  newRoot.id = 'admin-root';
  document.body.appendChild(newRoot);

  ReactDOM.createRoot(newRoot).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/admin">
          <AuthProvider type="admin" authService={authService}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
} else {
  console.debug('Admin app mounting with root element:', rootElement); // Changed to debug

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/admin">
          <AuthProvider type="admin" authService={authService}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
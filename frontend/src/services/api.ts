import axios from 'axios';

import { addCsrfTokenInterceptor } from '../utils/csrf';

// In development, use the Vite proxy which forwards requests to the backend
// In production, use the environment variable or default to relative path
const isDevelopment = import.meta.env.DEV;
const apiBaseUrl = isDevelopment
  ? '/api' // Use relative path for proxy in development
  : import.meta.env.VITE_API_URL || '/api'; // Use env var or relative path in production

// Create axios instance with default config
export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true, // Important for cookies
});

// Log the API base URL for debugging (development only)
if (import.meta.env.DEV) {
  console.info('API base URL (using proxy in dev):', apiBaseUrl);
}

// Add CSRF token interceptor
addCsrfTokenInterceptor(api);

export default api;

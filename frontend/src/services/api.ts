import axios from 'axios';

import { addCsrfTokenInterceptor } from '../utils/csrf';

// Industry standard: clean subdomain routing
// In development, use relative paths (proxied by Vite)
// In production, use the clean API subdomain
const isDevelopment = import.meta.env.DEV;
const apiBaseUrl = isDevelopment
  ? '' // Use relative paths for proxy in development (clean routing)
  : import.meta.env.VITE_API_URL || ''; // Use env var in production

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
  console.info('API base URL (clean subdomain routing):', apiBaseUrl || 'relative paths');
}

// Add CSRF token interceptor
addCsrfTokenInterceptor(api);

export default api;

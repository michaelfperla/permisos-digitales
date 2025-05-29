import axios from 'axios';

import { addCsrfTokenInterceptor } from '../utils/csrf';

const isDevelopment = import.meta.env.DEV;
const apiBaseUrl = isDevelopment
  ? ''
  : import.meta.env.VITE_API_URL || '';

/**
 * Main API instance with CSRF protection and cookie support
 */
export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

if (import.meta.env.DEV) {
  console.info('API base URL:', apiBaseUrl || 'relative paths');
}

addCsrfTokenInterceptor(api);

export default api;

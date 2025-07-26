import { apiInstance } from './api-instance';
import { addCsrfTokenInterceptor } from '../utils/csrf';
import { getApiBaseUrl, logApiConfig, getIsDevelopment } from '../config/api-config';

let initialized = false;

/**
 * Configure the API instance with base URL and interceptors
 * This is called after all modules are loaded to avoid circular dependencies
 */
export function configureApi() {
  if (initialized) return;
  
  // Set base URL
  apiInstance.defaults.baseURL = getApiBaseUrl();
  
  // Add CSRF interceptor
  addCsrfTokenInterceptor(apiInstance);
  
  // Development logging
  if (getIsDevelopment()) {
    logApiConfig();
  }
  
  initialized = true;
}

// Export the instance for backward compatibility
export const api = apiInstance;
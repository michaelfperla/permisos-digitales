// Centralized API configuration with lazy initialization
// This prevents circular dependency issues in the build

let _apiBaseUrl: string | null = null;
let _isDevelopment: boolean | null = null;

/**
 * Detect if running in WSL environment
 */
function isWSLEnvironment(): boolean {
  // Check multiple WSL indicators
  return !!(
    import.meta.env.VITE_WSL_ENVIRONMENT === 'true' ||
    import.meta.env.VITE_WSL_DISTRO_NAME ||
    // Check if we're in a WSL-like environment based on user agent or other browser indicators
    (typeof navigator !== 'undefined' && navigator.userAgent?.includes('WSL'))
  );
}

/**
 * Get the API base URL for the current environment.
 * Priority: VITE_API_URL > production default > development default (WSL-aware)
 */
export function getApiBaseUrl(): string {
  if (_apiBaseUrl === null) {
    const envUrl = import.meta.env.VITE_API_URL;
    const isProduction = import.meta.env.PROD;
    const isDevelopment = import.meta.env.DEV;
    const isWSL = isWSLEnvironment();
    
    if (envUrl) {
      // Use explicitly set environment variable
      _apiBaseUrl = envUrl;
    } else if (isProduction) {
      // Production default
      _apiBaseUrl = 'https://api.permisosdigitales.com.mx';
    } else if (isDevelopment) {
      // Development - use relative paths (proxied by Vite dev server)
      // This works for both WSL and native environments due to Vite proxy
      _apiBaseUrl = '';
    } else {
      // Fallback for build-time or other environments
      _apiBaseUrl = 'http://localhost:3001';
    }
    
    // Log WSL detection for debugging
    if (isDevelopment && isWSL) {
      console.info('🐧 WSL environment detected, using Vite proxy for API calls');
    }
  }
  
  return _apiBaseUrl as string;
}

/**
 * Check if running in development mode
 */
export function getIsDevelopment(): boolean {
  if (_isDevelopment === null) {
    _isDevelopment = import.meta.env.DEV;
  }
  return _isDevelopment;
}

/**
 * Check if running in production mode
 */
export function getIsProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Get the full API URL for a given endpoint
 * @param endpoint - The API endpoint (e.g., '/auth/login')
 * @returns Full URL for the endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (baseUrl === '') {
    // Development mode - return relative path
    return cleanEndpoint;
  }
  
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Log current API configuration (development only)
 */
export function logApiConfig(): void {
  if (getIsDevelopment()) {
    const isWSL = isWSLEnvironment();
    console.info('🔗 API Configuration:', {
      baseURL: getApiBaseUrl() || 'relative paths (proxied)',
      environment: import.meta.env.MODE,
      isDevelopment: getIsDevelopment(),
      isProduction: getIsProduction(),
      isWSL: isWSL,
      envApiUrl: import.meta.env.VITE_API_URL,
      wslEnvironment: import.meta.env.VITE_WSL_ENVIRONMENT,
      wslDistroName: import.meta.env.VITE_WSL_DISTRO_NAME,
    });
  }
}
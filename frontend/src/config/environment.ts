import type { FrontendConfig } from '../types/env';

// Helper function to validate required environment variables
function getRequiredEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Helper function to get optional environment variables with defaults
function getOptionalEnv(key: string, defaultValue: string): string {
  return import.meta.env[key] || defaultValue;
}

// Validate and build configuration
function createConfig(): FrontendConfig {
  // Validate required variables at startup
  const stripePublicKey = getRequiredEnv('VITE_STRIPE_PUBLIC_KEY');
  
  // Validate Stripe key format
  if (!stripePublicKey.startsWith('pk_')) {
    throw new Error('VITE_STRIPE_PUBLIC_KEY must start with pk_test_ or pk_live_');
  }
  
  // Check for environment mismatch
  const isProduction = import.meta.env.PROD;
  const isTestKey = stripePublicKey.includes('test');
  
  if (isProduction && isTestKey) {
    console.warn('⚠️ WARNING: Using test Stripe key in production build');
  }
  
  // Determine API base URL
  const apiBaseUrl = (() => {
    const envUrl = import.meta.env.VITE_API_URL;
    
    // If explicitly set, use it
    if (envUrl) {
      return envUrl;
    }
    
    // In production, use the API subdomain
    if (isProduction) {
      return 'https://api.permisosdigitales.com.mx';
    }
    
    // In development, use localhost
    return 'http://localhost:3001';
  })();
  
  // Build configuration object
  const config: FrontendConfig = {
    stripe: {
      publicKey: stripePublicKey,
    },
    api: {
      baseUrl: apiBaseUrl,
    },
    features: {
      useTestTokens: getOptionalEnv('VITE_USE_TEST_TOKENS', 'false') === 'true',
    },
  };
  
  // Validate production configuration
  if (isProduction) {
    // Ensure we're not using localhost in production
    if (config.api.baseUrl.includes('localhost') || config.api.baseUrl.includes('127.0.0.1')) {
      throw new Error('Invalid API URL for production: Cannot use localhost. Please set VITE_API_URL.');
    }
    
    // Ensure we're using secure connections
    if (config.api.baseUrl.startsWith('http://') && !config.api.baseUrl.startsWith('http://localhost')) {
      console.warn('⚠️ WARNING: Using insecure HTTP connection in production build');
    }
  }
  
  // Log configuration summary (without sensitive data)
  if (import.meta.env.DEV) {
    console.info('🔧 Frontend configuration loaded:', {
      environment: import.meta.env.MODE,
      stripeMode: isTestKey ? 'test' : 'live',
      apiUrl: config.api.baseUrl,
      features: config.features,
    });
  }
  
  return config;
}

// Create and export configuration
export const config = createConfig();

// Export individual values for convenience
export const stripePublicKey = config.stripe.publicKey;
export const apiBaseUrl = config.api.baseUrl;
export const useTestTokens = config.features.useTestTokens;

// Helper functions for environment checks
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const environment = import.meta.env.MODE;

// Helper function to build API endpoints
export function buildApiUrl(path: string): string {
  const base = config.api.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

// Helper function to check if using test mode
export function isTestMode(): boolean {
  return config.stripe.publicKey.includes('test');
}

// Re-export the type guards and types
// Type guard for required env vars
export function assertEnvVar(key: string, value: string | undefined): asserts value is string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
// Re-export types from the declaration file
// Note: These types are available globally from env.d.ts
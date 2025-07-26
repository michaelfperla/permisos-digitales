/**
 * Configuration validator for API setup
 * This helps ensure the API configuration is correct across environments
 */

import { getApiBaseUrl, getIsDevelopment, getIsProduction, getApiUrl } from '../config/api-config';

export interface ConfigValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  info: {
    environment: string;
    apiBaseUrl: string;
    isDevelopment: boolean;
    isProduction: boolean;
    hasCustomApiUrl: boolean;
  };
}

/**
 * Validate the current API configuration
 */
export function validateApiConfig(): ConfigValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const isDevelopment = getIsDevelopment();
  const isProduction = getIsProduction();
  const apiBaseUrl = getApiBaseUrl();
  const hasCustomApiUrl = !!import.meta.env.VITE_API_URL;
  
  // Validate development setup
  if (isDevelopment) {
    if (apiBaseUrl !== '') {
      warnings.push('Development mode should use empty baseURL for Vite proxy');
    }
    if (!hasCustomApiUrl) {
      // This is expected in development
    }
  }
  
  // Validate production setup
  if (isProduction) {
    if (apiBaseUrl === '') {
      errors.push('Production mode requires a full API URL');
    }
    if (apiBaseUrl.includes('localhost')) {
      errors.push('Production mode should not use localhost URLs');
    }
    if (!apiBaseUrl.startsWith('https://')) {
      warnings.push('Production API URL should use HTTPS');
    }
  }
  
  // Validate API URL format
  if (apiBaseUrl && apiBaseUrl !== '') {
    try {
      new URL(apiBaseUrl);
    } catch {
      errors.push(`Invalid API URL format: ${apiBaseUrl}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    info: {
      environment: import.meta.env.MODE,
      apiBaseUrl,
      isDevelopment,
      isProduction,
      hasCustomApiUrl,
    }
  };
}

/**
 * Log configuration validation results
 */
export function logConfigValidation(): void {
  const result = validateApiConfig();
  
  console.group('🔍 API Configuration Validation');
  
  // Log basic info
  console.log('Environment:', result.info.environment);
  console.log('API Base URL:', result.info.apiBaseUrl || 'relative paths (proxied)');
  console.log('Development Mode:', result.info.isDevelopment);
  console.log('Production Mode:', result.info.isProduction);
  console.log('Custom API URL:', result.info.hasCustomApiUrl);
  
  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Log errors
  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (result.isValid) {
    console.log('✅ Configuration is valid');
  } else {
    console.error('❌ Configuration has errors');
  }
  
  console.groupEnd();
}

/**
 * Test API URL generation
 */
export function testApiUrls(): void {
  if (!getIsDevelopment()) return;
  
  console.group('🧪 API URL Testing');
  
  const testEndpoints = [
    '/auth/login',
    '/applications',
    '/user/profile',
    '/payments/create',
    '/admin/users',
    '/status'
  ];
  
  testEndpoints.forEach(endpoint => {
    const fullUrl = getApiUrl(endpoint);
    console.log(`${endpoint} → ${fullUrl}`);
  });
  
  console.groupEnd();
}
import axios from 'axios';

import { AdminUser } from '../../shared/contexts/AuthContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminAuthService');

const api = axios.create({
  baseURL: import.meta.env.PROD ? 'https://api.permisosdigitales.com.mx' : '/',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin',
  },
  withCredentials: true,
  timeout: 15000, // 15 second timeout
});

// CSRF token cache key - includes timestamp to ensure fresh cache per login
const CSRF_CACHE_KEY = 'admin_csrf_token';

// Pending token request to prevent concurrent fetches
let pendingTokenRequest: Promise<string> | null = null;

interface StatusResponse {
  isLoggedIn: boolean;
  user?: AdminUser;
}

/**
 * Get CSRF token for admin requests with caching and retry
 */
export const getCsrfToken = async (retries = 3): Promise<string> => {
  // If there's already a request in progress, wait for it
  if (pendingTokenRequest) {
    logger.debug('CSRF token request already in progress, waiting...');
    try {
      return await pendingTokenRequest;
    } catch (error) {
      // If the pending request failed, continue to fetch a new one
      logger.debug('Pending CSRF request failed, fetching new token');
    }
  }

  // Check sessionStorage cache first (survives navigation, clears on logout)
  try {
    const cached = sessionStorage.getItem(CSRF_CACHE_KEY);
    if (cached) {
      const { token, expiry } = JSON.parse(cached);
      if (expiry > Date.now()) {
        return token;
      }
      // Clear expired cache
      sessionStorage.removeItem(CSRF_CACHE_KEY);
    }
  } catch (e) {
    // Ignore parse errors, fetch new token
    logger.debug('CSRF cache read error:', e);
  }

  // Create new token request with concurrency protection
  pendingTokenRequest = (async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add exponential backoff for retries
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

        const response = await api.get<any>('/auth/csrf-token');

        let token: string | null = null;

        if (response.data.data && response.data.data.csrfToken) {
          token = response.data.data.csrfToken;
        } else if (response.data.csrfToken) {
          token = response.data.csrfToken;
        }

        if (token) {
          // Cache for 5 minutes in sessionStorage
          try {
            const cacheData = {
              token,
              expiry: Date.now() + 5 * 60 * 1000
            };
            sessionStorage.setItem(CSRF_CACHE_KEY, JSON.stringify(cacheData));
          } catch (e) {
            // Continue even if caching fails
            logger.debug('CSRF cache write error:', e);
          }
          return token;
        }

        throw new Error('Invalid CSRF token response structure');
      } catch (error) {
        lastError = error as Error;
        logger.error(`CSRF token attempt ${attempt + 1} failed`, {
          error: lastError.message,
          attempt: attempt + 1
        });
      }
    }

    throw new Error(`Failed to get CSRF token after ${retries} attempts: ${lastError?.message}`);
  })();

  try {
    const token = await pendingTokenRequest;
    return token;
  } finally {
    // Clear pending request after completion (success or failure)
    pendingTokenRequest = null;
  }
};

/**
 * Clear CSRF token cache (MUST be called on logout and login)
 */
export const clearCsrfTokenCache = (): void => {
  try {
    sessionStorage.removeItem(CSRF_CACHE_KEY);
  } catch (e) {
    logger.debug('CSRF cache clear error:', e);
  }
};

/**
 * Check admin authentication status
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  try {
    logger.debug('Starting API call to /auth/status');
    const response = await api.get<any>('/auth/status', { signal });

    logger.debug('API call successful', { response: response.data });

    if (response.data.data) {
      return response.data.data;
    } else {
      return response.data;
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      logger.info('Request cancelled/aborted. Rethrowing...');
      throw error;
    } else {
      logger.error('Failed to check auth status', { error: (error as Error).message });
    }
    return { isLoggedIn: false };
  }
};

/**
 * Log out current admin user
 */
export const logout = async (): Promise<void> => {
  try {
    const csrfTokenVal = await getCsrfToken();
    await api.post(
      '/auth/logout',
      {},
      {
        headers: {
          'X-CSRF-Token': csrfTokenVal,
        },
      },
    );
    // Clear CSRF cache after logout
    clearCsrfTokenCache();
  } catch (error) {
    // Still clear cache even if logout fails
    clearCsrfTokenCache();
    logger.error('Failed to logout', { error: (error as Error).message });
    throw new Error('Failed to logout');
  }
};

// Functions are already exported individually above, no need to re-export
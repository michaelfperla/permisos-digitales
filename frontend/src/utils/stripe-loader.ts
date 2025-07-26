// frontend/src/utils/stripe-loader.ts
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { logger } from './logger';
import { stripePublicKey, isTestMode, isDevelopment } from '../config/environment';

let stripePromise: Promise<Stripe | null> | null = null;
let isStripeLoaded = false;
let isStripeLoading = false;

/**
 * Dynamically loads the Stripe.js library
 * @returns Promise that resolves when Stripe is loaded
 */
export const loadStripeScript = (): Promise<Stripe | null> => {
  if (stripePromise) {
    if (isDevelopment) {
      logger.debug('[StripeLoader] Stripe already loading or loaded');
    }
    return stripePromise;
  }

  if (isStripeLoading) {
    if (isDevelopment) {
      logger.debug('[StripeLoader] Stripe already loading, waiting...');
    }
    return stripePromise || Promise.resolve(null);
  }

  isStripeLoading = true;
  if (isDevelopment) {
    logger.info(`[StripeLoader] Loading Stripe.js in ${isTestMode() ? 'TEST' : 'LIVE'} mode...`);
  }

  stripePromise = loadStripe(stripePublicKey, {
    locale: 'es', // Set locale to Spanish for Mexico
  }).then((stripe) => {
    if (stripe) {
      if (isDevelopment) {
        logger.info('[StripeLoader] Stripe.js loaded successfully');
      }
      isStripeLoaded = true;
      isStripeLoading = false;
      return stripe;
    } else {
      logger.error('[StripeLoader] Failed to load Stripe.js');
      isStripeLoading = false;
      return null;
    }
  }).catch((error) => {
    logger.error('[StripeLoader] Error loading Stripe.js:', error);
    isStripeLoading = false;
    stripePromise = null;
    return null;
  });

  return stripePromise;
};

/**
 * Initializes Stripe with the provided public key
 * @param publicKey Stripe public key (optional, will use env var if not provided)
 * @returns Promise that resolves when Stripe is initialized
 */
export const initializeStripe = async (publicKey?: string): Promise<Stripe | null> => {
  try {
    const stripe = await loadStripeScript();
    
    if (stripe) {
      if (isDevelopment) {
        const keyToUse = publicKey || stripePublicKey;
        logger.info(
          '[StripeLoader] Stripe initialized with public key:',
          keyToUse ? keyToUse.substring(0, 8) + '...' : 'undefined',
        );
      }
    } else {
      throw new Error('Stripe not available after loading');
    }
    
    return stripe;
  } catch (error) {
    logger.error('[StripeLoader] Error initializing Stripe:', error);
    throw error;
  }
};

/**
 * Gets the current Stripe instance
 * @returns Promise that resolves to Stripe instance or null
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (isStripeLoaded && stripePromise) {
    return stripePromise;
  }
  
  return loadStripeScript();
};

/**
 * Checks if Stripe is ready to use
 * @returns boolean indicating if Stripe is loaded and ready
 */
export const isStripeReady = (): boolean => {
  return isStripeLoaded;
};

/**
 * Resets the Stripe loader state (useful for testing)
 */
export const resetStripeLoader = (): void => {
  stripePromise = null;
  isStripeLoaded = false;
  isStripeLoading = false;
  if (isDevelopment) {
    logger.debug('[StripeLoader] Stripe loader state reset');
  }
};

// Functions are already exported individually above, no need for default export

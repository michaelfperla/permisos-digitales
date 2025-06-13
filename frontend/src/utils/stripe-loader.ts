// frontend/src/utils/stripe-loader.ts
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
let isStripeLoaded = false;
let isStripeLoading = false;

/**
 * Dynamically loads the Stripe.js library
 * @returns Promise that resolves when Stripe is loaded
 */
export const loadStripeScript = (): Promise<Stripe | null> => {
  if (stripePromise) {
    if (import.meta.env.DEV) {
      console.debug('[StripeLoader] Stripe already loading or loaded');
    }
    return stripePromise;
  }

  if (isStripeLoading) {
    if (import.meta.env.DEV) {
      console.debug('[StripeLoader] Stripe already loading, waiting...');
    }
    return stripePromise || Promise.resolve(null);
  }

  isStripeLoading = true;
  if (import.meta.env.DEV) {
    console.info('[StripeLoader] Loading Stripe.js...');
  }

  // Get the public key from environment variables
  const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  
  if (!stripePublicKey) {
    console.error('[StripeLoader] VITE_STRIPE_PUBLIC_KEY environment variable is not set');
    isStripeLoading = false;
    return Promise.resolve(null);
  }

  stripePromise = loadStripe(stripePublicKey, {
    locale: 'es', // Set locale to Spanish for Mexico
  }).then((stripe) => {
    if (stripe) {
      if (import.meta.env.DEV) {
        console.info('[StripeLoader] Stripe.js loaded successfully');
      }
      isStripeLoaded = true;
      isStripeLoading = false;
      return stripe;
    } else {
      console.error('[StripeLoader] Failed to load Stripe.js');
      isStripeLoading = false;
      return null;
    }
  }).catch((error) => {
    console.error('[StripeLoader] Error loading Stripe.js:', error);
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
      if (import.meta.env.DEV) {
        const keyToUse = publicKey || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        console.info(
          '[StripeLoader] Stripe initialized with public key:',
          keyToUse ? keyToUse.substring(0, 8) + '...' : 'undefined',
        );
      }
    } else {
      throw new Error('Stripe not available after loading');
    }
    
    return stripe;
  } catch (error) {
    console.error('[StripeLoader] Error initializing Stripe:', error);
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
  if (import.meta.env.DEV) {
    console.debug('[StripeLoader] Stripe loader state reset');
  }
};

export default {
  loadStripeScript,
  initializeStripe,
  getStripe,
  isStripeReady,
  resetStripeLoader,
};

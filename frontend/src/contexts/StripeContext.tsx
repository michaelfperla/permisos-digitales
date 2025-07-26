import React, { createContext, useContext, ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import { stripePublicKey, isTestMode } from '../config/environment';

// Initialize Stripe outside of component to avoid recreating the Stripe object on every render
const stripePromise = (() => {
  try {
    const promise = loadStripe(stripePublicKey, {
      locale: 'es', // Spanish locale for Mexico
    });
    
    return promise;
  } catch (error) {
    console.error('❌ Error initializing Stripe:', error);
    return Promise.resolve(null);
  }
})();

// Initialize in development mode
if (import.meta.env.DEV) {
  // Silent initialization in dev mode
}

interface StripeContextType {
  stripe: Promise<Stripe | null>;
}

const StripeContext = createContext<StripeContextType | undefined>(undefined);

interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  options?: StripeElementsOptions;
}

/**
 * Stripe Provider Component
 * Provides Stripe context to the entire application
 */
export const StripeProvider: React.FC<StripeProviderProps> = ({ 
  children, 
  clientSecret,
  options = {} 
}) => {
  
  // Minimal options for Stripe Elements - just what's needed
  const defaultOptions: StripeElementsOptions = {
    locale: 'es',
    loader: 'never', // Prevents Link preloading
  };

  // Add client secret if provided
  if (clientSecret) {
    defaultOptions.clientSecret = clientSecret;
  }

  // Add any additional options passed in (but filter out problematic ones)
  const { amount, currency, ...safeOptions } = options as any;
  Object.assign(defaultOptions, safeOptions);

  const contextValue: StripeContextType = {
    stripe: stripePromise,
  };

  return (
    <StripeContext.Provider value={contextValue}>
      <Elements stripe={stripePromise} options={defaultOptions}>
        {children}
      </Elements>
    </StripeContext.Provider>
  );
};

/**
 * Hook to use Stripe context
 */
export const useStripeContext = (): StripeContextType => {
  const context = useContext(StripeContext);
  if (context === undefined) {
    throw new Error('useStripeContext must be used within a StripeProvider');
  }
  return context;
};

export default StripeProvider;

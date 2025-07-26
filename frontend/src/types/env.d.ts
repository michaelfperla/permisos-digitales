/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Stripe Configuration
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  
  // API Configuration
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  
  // Feature Flags
  readonly VITE_USE_TEST_TOKENS?: string;
  
  // Build Information
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Helper type for accessing env vars with defaults
export type EnvVar<T extends keyof ImportMetaEnv> = ImportMetaEnv[T] extends string ? string : string | undefined;

// Validated frontend configuration
export interface FrontendConfig {
  stripe: {
    publicKey: string;
  };
  api: {
    baseUrl: string;
  };
  features: {
    useTestTokens: boolean;
  };
}


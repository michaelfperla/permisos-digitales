/**
 * Development Configuration
 * Simple, synchronous configuration for development environment
 * 
 * Design principles:
 * - Synchronous loading for simplicity
 * - Clear defaults for all values
 * - Helpful error messages
 * - No external dependencies during config phase
 */

const path = require('path');

// Helper to get env var with default
const env = (key, defaultValue = '') => process.env[key] || defaultValue;

// Helper to get boolean env var
const envBool = (key, defaultValue = false) => {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
};

// Helper to get number env var
const envInt = (key, defaultValue) => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
};

// Build configuration object
const config = {
  // Environment
  env: env('NODE_ENV', 'development'),
  isDevelopment: env('NODE_ENV', 'development') === 'development',
  isProduction: env('NODE_ENV', 'development') === 'production',
  
  // Server
  server: {
    port: envInt('PORT', 3001),
    host: env('HOST', '0.0.0.0'),
    url: env('APP_URL', 'http://localhost:3001'),
  },
  
  // Frontend URL for email links, redirects, etc.
  frontendUrl: env('FRONTEND_URL', 'http://localhost:3002'),
  
  // Database
  database: {
    url: env('DATABASE_URL', 'postgres://permisos_user:password@localhost:5432/permisos_digitales_v2'),
    // Pool settings
    pool: {
      min: envInt('DB_POOL_MIN', 2),
      max: envInt('DB_POOL_MAX', 10),
      idleTimeoutMillis: envInt('DB_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: envInt('DB_CONNECTION_TIMEOUT', 10000),
    },
    // SSL settings (disabled for local dev)
    ssl: envBool('DB_SSL', false) ? {
      rejectUnauthorized: false,
      ca: env('DB_SSL_CA', null)
    } : false,
  },
  
  // Redis
  redis: {
    enabled: envBool('REDIS_ENABLED', false), // Default to mock in dev
    host: env('REDIS_HOST', 'localhost'),
    port: envInt('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD', null),
    db: envInt('REDIS_DB', 0),
    // Retry settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryDelayOnFailover: 100,
  },
  
  // Session
  session: {
    secret: env('SESSION_SECRET', 'dev-session-secret-change-me-in-production'),
    maxAge: envInt('SESSION_MAX_AGE', 14400000), // 4 hours
    ttl: envInt('SESSION_TTL', 14400), // 4 hours in seconds
    // Security settings
    secure: envBool('SESSION_SECURE', false), // false for local dev
    httpOnly: true,
    sameSite: 'lax',
  },
  
  // CORS
  cors: {
    origins: env('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3002').split(','),
    credentials: true,
  },
  
  // Email (using Ethereal for dev)
  email: {
    enabled: envBool('EMAIL_ENABLED', true),
    host: env('EMAIL_HOST', 'smtp.ethereal.email'),
    port: envInt('EMAIL_PORT', 587),
    user: env('EMAIL_USER'), // Must be set to actual Ethereal account
    pass: env('EMAIL_PASS'), // Must be set to actual Ethereal password
    from: env('EMAIL_FROM', 'noreply@permisos-digitales.dev'),
    // If no credentials are provided, will use console transport
    useConsoleTransport: !env('EMAIL_USER') || !env('EMAIL_PASS'),
  },
  
  // Stripe
  stripe: {
    publicKey: env('STRIPE_PUBLIC_KEY', 'pk_test_placeholder'),
    privateKey: env('STRIPE_PRIVATE_KEY', 'sk_test_placeholder'),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder'),
    apiVersion: '2022-11-15',
    maxNetworkRetries: 3,
    timeout: 10000,
  },
  
  // Security
  security: {
    jwtSecret: env('JWT_SECRET', 'dev-jwt-secret-' + Date.now()),
    bcryptRounds: envInt('BCRYPT_ROUNDS', 10), // Lower for dev
    rateLimit: {
      windowMs: envInt('RATE_LIMIT_WINDOW', 900000), // 15 minutes
      max: envInt('RATE_LIMIT_MAX', 100), // 100 requests per window
    },
  },
  
  // Storage
  storage: {
    provider: env('STORAGE_PROVIDER', 'local'),
    localPath: env('STORAGE_DIR', path.join(process.cwd(), 'storage')),
  },
  
  // Logging
  logging: {
    level: env('LOG_LEVEL', 'debug'),
    pretty: envBool('LOG_PRETTY', true), // Pretty print in dev
    file: envBool('LOG_TO_FILE', false),
  },
  
  // Features
  features: {
    swagger: envBool('SWAGGER_ENABLED', true),
    metrics: envBool('METRICS_ENABLED', false),
    healthChecks: envBool('HEALTH_CHECKS_ENABLED', true),
    paymentVelocity: envBool('PAYMENT_VELOCITY_ENABLED', true),
  },
  
  // Development specific
  dev: {
    debugRoutes: envBool('DEBUG_ROUTES', true),
    mockServices: envBool('MOCK_SERVICES', false),
    autoReload: envBool('AUTO_RELOAD', true),
    verboseErrors: true,
  },
  
  // Government portal configuration
  govtLoginUrl: env('GOVT_SITE_LOGIN_URL', 'https://example-govt-portal.gob.mx/login'),
  govtUsername: env('GOVT_USERNAME', 'demo_user'),
  govtPassword: env('GOVT_PASSWORD', 'demo_password'),
};

// Validate critical configuration
function validateConfig() {
  const errors = [];
  
  // Check database URL
  if (!config.database.url || config.database.url === 'postgres://') {
    errors.push('DATABASE_URL is not properly configured');
  }
  
  // Check session secret in production
  if (config.isProduction && config.session.secret.startsWith('dev-')) {
    errors.push('SESSION_SECRET must be set in production');
  }
  
  // Check JWT secret in production
  if (config.isProduction && config.security.jwtSecret.startsWith('dev-')) {
    errors.push('JWT_SECRET must be set in production');
  }
  
  // Check Stripe keys
  if (config.stripe.privateKey === 'sk_test_placeholder') {
    console.warn('[Config] Warning: Using placeholder Stripe keys');
  }
  
  return errors;
}

// Add validation function to config object for optional use
config.validate = validateConfig;

// Only validate in development environment (not production)
if (config.isDevelopment) {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.warn('[Config] Configuration warnings:');
    errors.forEach(err => console.warn(`  - ${err}`));
  }
}

// Log configuration summary (only in dev)
if (config.isDevelopment) {
  console.log('[Config] Development configuration loaded:');
  console.log(`  - Environment: ${config.env}`);
  console.log(`  - Server: ${config.server.host}:${config.server.port}`);
  console.log(`  - Database: ${config.database.url.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`  - Redis: ${config.redis.enabled ? 'Enabled' : 'Mock mode'}`);
  console.log(`  - Email: ${config.email.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  - Features: Swagger=${config.features.swagger}, Metrics=${config.features.metrics}`);
}

module.exports = config;
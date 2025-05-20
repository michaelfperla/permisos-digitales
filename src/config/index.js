// src/config/index.js
require('dotenv-flow').config(); // Load environment variables based on NODE_ENV

// Import the logger
const { logger } = require('../utils/enhanced-logger');

// Define constants
const DEFAULT_SESSION_SECRET = 'default_fallback_secret_change_me';

// Export configuration object
const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3002, // Changed to 3002 to avoid port conflicts
  databaseUrl: process.env.DATABASE_URL,
  disableSsl: process.env.DISABLE_SSL === 'true',
  govtLoginUrl: process.env.GOVT_SITE_LOGIN_URL,
  govtUsername: process.env.GOVT_USERNAME,
  govtPassword: process.env.GOVT_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET, // Only use default in non-production

  // Email configuration
  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  emailFrom: process.env.EMAIL_FROM || 'noreply@permisos-digitales.com',

  // Mailgun configuration
  mailgunApiKey: process.env.MAILGUN_API_KEY,
  mailgunDomain: process.env.MAILGUN_DOMAIN,

  // Redis configuration
  redisUrl: process.env.REDIS_URL, // Use URL if available
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  redisPassword: process.env.REDIS_PASSWORD,

  // Conekta payment gateway configuration
  conektaPublicKey: process.env.CONEKTA_PUBLIC_KEY,
  conektaPrivateKey: process.env.CONEKTA_PRIVATE_KEY,
  conektaWebhookSecret: process.env.CONEKTA_WEBHOOK_SECRET,

  // Application URLs
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3002}`, // Base URL for the application
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000', // Frontend development server URL
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 3002}/api`, // API base URL

  // Storage configuration
  storageType: process.env.STORAGE_TYPE || 'local', // 'local' or 's3'

  // AWS S3 configuration (only used if storageType is 's3')
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Endpoint: process.env.S3_ENDPOINT, // Optional, for non-AWS S3 compatible services
  s3UrlExpiration: process.env.S3_URL_EXPIRATION ? parseInt(process.env.S3_URL_EXPIRATION, 10) : 3600, // Default 1 hour

  // Internal API key for secure internal endpoints
  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-api-key-change-in-production'
};

// Validate critical environment variables in production
if (config.nodeEnv === 'production') {
  // Define critical variables that must be present in production
  const criticalVariables = [
    { name: 'DATABASE_URL', value: config.databaseUrl },
    { name: 'SESSION_SECRET', value: config.sessionSecret, customCheck: (val) => val === DEFAULT_SESSION_SECRET, customMessage: 'is using the default value' },
    { name: 'CONEKTA_PRIVATE_KEY', value: config.conektaPrivateKey },
    { name: 'CONEKTA_PUBLIC_KEY', value: config.conektaPublicKey },
    { name: 'APP_URL', value: config.appUrl },
    { name: 'INTERNAL_API_KEY', value: config.internalApiKey, customCheck: (val) => val === 'dev-internal-api-key-change-in-production', customMessage: 'is using the default value' }
  ];

  // Check if either email service is configured
  const hasEmailConfig = (
    config.emailHost && config.emailUser && config.emailPass
  ) || (
    config.mailgunApiKey && config.mailgunDomain
  );

  if (!hasEmailConfig) {
    const errorMessage = 'FATAL ERROR: No email configuration is set for production environment. ' +
      'Either configure SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) or Mailgun (MAILGUN_API_KEY, MAILGUN_DOMAIN).';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Check each critical variable
  for (const variable of criticalVariables) {
    // Check if the variable is missing or empty
    if (!variable.value || variable.value === '') {
      const errorMessage = `FATAL ERROR: ${variable.name} is not set in production environment.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Run custom check if provided
    if (variable.customCheck && variable.customCheck(variable.value)) {
      const errorMessage = `FATAL ERROR: ${variable.name} ${variable.customMessage} in production environment.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Log successful validation
  logger.info('Production environment variables validated successfully');
}

module.exports = config;
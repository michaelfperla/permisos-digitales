// Only load dotenv-flow in non-test environments
if (process.env.NODE_ENV !== 'test') {
  try {
    require('dotenv-flow').config();
  } catch (error) {
    // Silently fail in test environment or if dotenv-flow has issues
    console.warn('Warning: dotenv-flow failed to load:', error.message);
  }
}

const { logger } = require('../utils/enhanced-logger');

const DEFAULT_SESSION_SECRET = 'default_fallback_secret_change_me';

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3002,
  databaseUrl: process.env.DATABASE_URL,
  disableSsl: process.env.DISABLE_SSL === 'true',
  govtLoginUrl: process.env.GOVT_SITE_LOGIN_URL,
  govtUsername: process.env.GOVT_USERNAME,
  govtPassword: process.env.GOVT_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,

  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  emailFrom: process.env.EMAIL_FROM || 'contacto@permisosdigitales.com.mx',

  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  redisPassword: process.env.REDIS_PASSWORD,

  conektaPublicKey: process.env.CONEKTA_PUBLIC_KEY,
  conektaPrivateKey: process.env.CONEKTA_PRIVATE_KEY,
  conektaWebhookSecret: process.env.CONEKTA_WEBHOOK_SECRET,

  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3002}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 3002}/api`,

  storageType: process.env.STORAGE_TYPE || 'local',

  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3UrlExpiration: process.env.S3_URL_EXPIRATION ? parseInt(process.env.S3_URL_EXPIRATION, 10) : 3600,

  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-api-key-change-in-production'
};

if (config.nodeEnv === 'production') {
  const criticalVariables = [
    { name: 'DATABASE_URL', value: config.databaseUrl },
    { name: 'SESSION_SECRET', value: config.sessionSecret, customCheck: (val) => val === DEFAULT_SESSION_SECRET, customMessage: 'is using the default value' },
    { name: 'CONEKTA_PRIVATE_KEY', value: config.conektaPrivateKey },
    { name: 'CONEKTA_PUBLIC_KEY', value: config.conektaPublicKey },
    { name: 'APP_URL', value: config.appUrl },
    { name: 'INTERNAL_API_KEY', value: config.internalApiKey, customCheck: (val) => val === 'dev-internal-api-key-change-in-production', customMessage: 'is using the default value' }
  ];

  const hasEmailConfig = config.emailHost && config.emailUser && config.emailPass;

  if (!hasEmailConfig) {
    const errorMessage = 'FATAL ERROR: SMTP email configuration is not set for production environment. ' +
      'Please configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASS.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  for (const variable of criticalVariables) {
    if (!variable.value || variable.value === '') {
      const errorMessage = `FATAL ERROR: ${variable.name} is not set in production environment.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (variable.customCheck && variable.customCheck(variable.value)) {
      const errorMessage = `FATAL ERROR: ${variable.name} ${variable.customMessage} in production environment.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  logger.info('Production environment variables validated successfully');
}

module.exports = config;
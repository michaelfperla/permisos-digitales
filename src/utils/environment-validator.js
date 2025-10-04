/**
 * Environment Variable Validator
 * Ensures required configuration is present before starting
 */

const { logger } = require('./logger');

class EnvironmentValidator {
  static validate() {
    const requiredVars = {
      // Core configuration
      NODE_ENV: 'Environment mode',
      PORT: 'Server port',
      
      // Database
      DATABASE_URL: 'PostgreSQL connection string',
      
      // Security
      SESSION_SECRET: 'Session encryption key',
      
      // WhatsApp (required in production)
      ...(process.env.NODE_ENV === 'production' ? {
        WHATSAPP_APP_SECRET: 'WhatsApp webhook signature secret',
        WHATSAPP_ACCESS_TOKEN: 'WhatsApp API access token',
        WHATSAPP_VERIFY_TOKEN: 'WhatsApp webhook verification token',
        WHATSAPP_PHONE_NUMBER_ID: 'WhatsApp phone number ID',
      } : {}),
      
      // Redis encryption (required if enabled)
      ...(process.env.ENABLE_REDIS_ENCRYPTION === 'true' ? {
        REDIS_ENCRYPTION_KEY: 'Redis encryption key (32 bytes hex)',
      } : {}),
      
      // Privacy
      PRIVACY_POLICY_VERSION: 'Current privacy policy version',
    };
    
    const warnings = [];
    const errors = [];
    
    // Check required variables
    Object.entries(requiredVars).forEach(([key, description]) => {
      if (!process.env[key]) {
        errors.push(`Missing ${key}: ${description}`);
      }
    });
    
    // Validate specific formats
    if (process.env.REDIS_ENCRYPTION_KEY && process.env.ENABLE_REDIS_ENCRYPTION === 'true') {
      try {
        const keyBuffer = Buffer.from(process.env.REDIS_ENCRYPTION_KEY, 'hex');
        if (keyBuffer.length !== 32) {
          errors.push('REDIS_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
        }
      } catch (error) {
        errors.push('REDIS_ENCRYPTION_KEY must be a valid hex string');
      }
    }
    
    // Validate WhatsApp phone number format
    if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
      // Meta phone number IDs are typically numeric strings
      if (!/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID)) {
        errors.push('WHATSAPP_PHONE_NUMBER_ID must be a numeric string');
      }
    }
    
    // Check recommended variables
    const recommendedVars = {
      PSEUDO_SALT: 'Salt for pseudonymization',
      FIELD_ENCRYPTION_KEY: 'Key for field-level encryption',
      MAX_WHATSAPP_RATE_LIMIT: 'WhatsApp rate limit',
      DATA_RETENTION_DAYS: 'Default data retention period',
    };
    
    Object.entries(recommendedVars).forEach(([key, description]) => {
      if (!process.env[key]) {
        warnings.push(`Recommended: ${key} - ${description}`);
      }
    });
    
    // Security warnings
    if (process.env.SESSION_SECRET === 'default-session-secret') {
      errors.push('SESSION_SECRET must be changed from default value');
    }
    
    if (process.env.NODE_ENV === 'production') {
      // Production-specific checks
      if (!process.env.DATABASE_URL.includes('ssl')) {
        warnings.push('Database connection should use SSL in production');
      }
      
      if (process.env.ENABLE_REDIS_ENCRYPTION !== 'true') {
        warnings.push('Redis encryption should be enabled in production');
      }
    }
    
    // Log results
    if (warnings.length > 0) {
      logger.warn('Environment configuration warnings:', warnings);
    }
    
    if (errors.length > 0) {
      logger.error('Environment configuration errors:', errors);
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
    
    logger.info('Environment validation passed', {
      nodeEnv: process.env.NODE_ENV,
      redisEncryption: process.env.ENABLE_REDIS_ENCRYPTION === 'true',
      privacyVersion: process.env.PRIVACY_POLICY_VERSION,
    });
    
    return true;
  }
  
  /**
   * Get configuration summary (without sensitive values)
   */
  static getConfigSummary() {
    return {
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      database: {
        configured: !!process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('ssl'),
      },
      whatsapp: {
        configured: !!process.env.WHATSAPP_APP_SECRET,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      },
      redis: {
        encryption: process.env.ENABLE_REDIS_ENCRYPTION === 'true',
        keyConfigured: !!process.env.REDIS_ENCRYPTION_KEY,
      },
      privacy: {
        version: process.env.PRIVACY_POLICY_VERSION,
        retentionDays: process.env.DATA_RETENTION_DAYS,
      },
    };
  }
}

module.exports = EnvironmentValidator;
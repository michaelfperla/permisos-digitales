/**
 * Unified Production Config System
 * Race-condition-free configuration management for Permisos Digitales
 * 
 * DESIGN PRINCIPLES:
 * - NO race conditions: Config must be initialized before any service access
 * - Backward compatibility: Maintains existing getSync() interface
 * - Production ready: Integrates with AWS Secrets Manager
 * - Service container friendly: Provides dependency injection interface
 * 
 * @module UnifiedConfig
 */

const { logger } = require('../utils/logger');
const path = require('path');

/**
 * Production-grade configuration manager
 * Ensures config is always available and prevents race conditions
 */
class UnifiedProductionConfig {
  constructor() {
    this._config = null;
    this._initialized = false;
    this._initializing = false;
    this._initPromise = null;
    this.startTime = Date.now();
    
    // Auto-initialize in development for backward compatibility
    if (process.env.NODE_ENV !== 'production') {
      this._initializeSync();
    }
  }

  /**
   * Initialize configuration system
   * For development, this is synchronous and immediate
   * @param {Object} options - Initialization options
   * @returns {Promise<Object>} Initialized configuration
   */
  async initialize(options = {}) {
    if (this._initialized) {
      return this._config;
    }

    // In development, load config synchronously
    if (process.env.NODE_ENV !== 'production') {
      this._initializeSync();
      return this._config;
    }

    // Production keeps async behavior
    if (this._initializing) {
      logger.debug('[UnifiedConfig] Initialization in progress, waiting...');
      return this._initPromise;
    }

    this._initializing = true;
    logger.info('[UnifiedConfig] Starting configuration initialization...');

    this._initPromise = this._performInitialization(options);
    
    try {
      this._config = await this._initPromise;
      this._initialized = true;
      this._initializing = false;
      
      const initTime = Date.now() - this.startTime;
      logger.info('[UnifiedConfig] Configuration initialized successfully', {
        environment: this._config.env,
        initTimeMs: initTime,
        hasSecrets: this._hasSecrets(this._config)
      });
      
      return this._config;
    } catch (error) {
      this._initializing = false;
      this._initPromise = null;
      logger.error('[UnifiedConfig] Configuration initialization failed', error);
      throw error;
    }
  }

  /**
   * Perform the actual configuration loading
   * @private
   */
  async _performInitialization(options) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Start with base configuration
    const baseConfig = this._getBaseConfiguration();
    
    // Load environment-specific configuration
    const envConfig = this._getEnvironmentConfiguration(nodeEnv);
    
    // In production, integrate with AWS Secrets Manager
    let secretsConfig = {};
    if (nodeEnv === 'production' && !options.skipSecrets) {
      try {
        secretsConfig = await this._loadAWSSecrets();
        logger.info('[UnifiedConfig] AWS Secrets Manager integration successful');
      } catch (error) {
        logger.error('[UnifiedConfig] AWS Secrets Manager integration failed', error);
        if (options.requireSecrets) {
          throw error;
        }
        // Continue with environment variables in production as fallback
        logger.warn('[UnifiedConfig] Falling back to environment variables');
      }
    }
    
    // Merge configurations (secrets override env vars)
    const finalConfig = this._mergeConfigurations(baseConfig, envConfig, secretsConfig);
    
    // Validate configuration
    this._validateConfiguration(finalConfig);
    
    return finalConfig;
  }

  /**
   * Get base configuration structure
   * @private
   */
  _getBaseConfiguration() {
    return {
      env: process.env.NODE_ENV || 'development',
      app: {
        name: 'permisos-digitales',
        version: process.env.npm_package_version || '1.0.0',
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || '0.0.0.0'
      },
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      features: {
        emailQueue: process.env.EMAIL_QUEUE_ENABLED !== 'false',
        pdfGeneration: process.env.PDF_GENERATION_ENABLED !== 'false',
        paymentRecovery: process.env.PAYMENT_RECOVERY_ENABLED !== 'false'
      }
    };
  }

  /**
   * Get environment-specific configuration
   * @private
   */
  _getEnvironmentConfiguration(env) {
    const config = {
      database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/permisos_digitales',
        ssl: {
          enabled: env === 'production',
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA || null
        },
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '2', 10),
          max: parseInt(process.env.DB_POOL_MAX || '10', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        }
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || null,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100
      },
      stripe: {
        privateKey: process.env.STRIPE_PRIVATE_KEY || 'sk_test_placeholder',
        publicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_placeholder',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
        apiVersion: '2022-11-15',
        maxNetworkRetries: 3,
        timeout: 10000
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        sessionSecret: process.env.SESSION_SECRET || 'default-session-secret',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
      },
      // Government portal configuration
      govtLoginUrl: process.env.GOVT_SITE_LOGIN_URL || 'https://example-govt-portal.gob.mx/login',
      govtUsername: process.env.GOVT_USERNAME || 'demo_user',
      govtPassword: process.env.GOVT_PASSWORD || 'demo_password',
      
      services: {
        email: {
          enabled: process.env.EMAIL_ENABLED !== 'false',
          provider: process.env.EMAIL_PROVIDER || 'smtp',
          host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
          port: parseInt(process.env.EMAIL_PORT || '587', 10),
          from: process.env.EMAIL_FROM || 'noreply@permisos-digitales.com',
          auth: {
            user: process.env.EMAIL_USER || null,
            pass: process.env.EMAIL_PASS || null
          }
        },
        storage: {
          provider: process.env.STORAGE_PROVIDER || 'local',
          localPath: process.env.STORAGE_LOCAL_PATH || './storage',
          s3Bucket: process.env.S3_BUCKET || null
        },
        notification: {
          enabled: process.env.NOTIFICATIONS_ENABLED !== 'false'
        }
      }
    };

    // Environment-specific overrides
    if (env === 'test') {
      config.database.url = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/permisos_digitales_test';
      config.redis.db = 1; // Use different Redis DB for tests
    }

    return config;
  }

  /**
   * Load configuration from AWS Secrets Manager
   * @private
   */
  async _loadAWSSecrets() {
    logger.info('[UnifiedConfig] Loading secrets from AWS Secrets Manager...');
    
    try {
      // Use the existing secrets manager service
      const secretsManager = require('../services/secrets/secrets-manager.service');
      
      // Load all secrets from AWS
      const secrets = await secretsManager.loadAllSecrets();
      
      // Map AWS secrets to config structure
      const secretsConfig = {
        nodeEnv: 'production',
        database: {
          url: secrets.database.url,
          ssl: {
            enabled: true,
            rejectUnauthorized: true,
            ca: secrets.database.sslCa || this._loadRDSCertificate()
          },
          pool: {
            min: secrets.database.poolMin || 2,
            max: secrets.database.poolMax || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
          }
        },
        redis: {
          host: secrets.redis.host,
          port: secrets.redis.port,
          password: secrets.redis.password,
          db: secrets.redis.db || 0,
          enabled: true,
          keyPrefix: 'pd:',
          tls: secrets.redis.tls || {
            servername: secrets.redis.host,
            rejectUnauthorized: false // AWS ElastiCache uses self-signed certificates
          }
        },
        stripe: {
          privateKey: secrets.stripe.privateKey,
          publicKey: secrets.stripe.publicKey,
          webhookSecret: secrets.stripe.webhookSecret
        },
        security: {
          jwtSecret: secrets.security.jwtSecret || secrets.security.sessionSecret,
          sessionSecret: secrets.security.sessionSecret,
          bcryptRounds: secrets.security.bcryptRounds || 12,
          internalApiKey: secrets.security.internalApiKey
        },
        services: {
          email: {
            enabled: true,
            provider: 'ses',
            host: 'email-smtp.us-east-1.amazonaws.com',
            port: 587,
            secure: false, // STARTTLS for port 587
            from: secrets.email.fromAddress,
            auth: {
              user: secrets.email.smtpUser,
              pass: secrets.email.smtpPassword
            }
          }
        },
        // Government portal credentials
        govtLoginUrl: secrets.government.loginUrl,
        govtUsername: secrets.government.username,
        govtPassword: secrets.government.password
      };
      
      logger.info('[UnifiedConfig] AWS Secrets loaded successfully', {
        hasDatabase: !!secretsConfig.database.url,
        hasRedis: !!secretsConfig.redis.host,
        hasStripe: !!secretsConfig.stripe.privateKey,
        hasSecurity: !!secretsConfig.security.jwtSecret,
        hasEmail: !!secretsConfig.services.email.auth.user,
        hasGovernment: !!secretsConfig.govtUsername
      });
      
      return secretsConfig;
    } catch (error) {
      logger.error('[UnifiedConfig] Failed to load AWS Secrets', { error: error.message });
      throw error;
    }
  }

  /**
   * Merge multiple configuration sources
   * @private
   */
  _mergeConfigurations(...configs) {
    return configs.reduce((merged, config) => {
      return this._deepMerge(merged, config);
    }, {});
  }

  /**
   * Deep merge configuration objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate configuration has required values
   * @private
   */
  _validateConfiguration(config) {
    const required = {
      'app.port': config.app?.port,
      'database.url': config.database?.url,
      'stripe.privateKey': config.stripe?.privateKey,
      'security.jwtSecret': config.security?.jwtSecret
    };

    const missing = Object.entries(required)
      .filter(([_, value]) => !value || value === 'placeholder')
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Configuration validation failed. Missing required values: ${missing.join(', ')}`);
    }

    // Warn about default values in production
    if (config.env === 'production') {
      const warnings = [];
      if (config.security.jwtSecret === 'default-jwt-secret-change-in-production') {
        warnings.push('Using default JWT secret in production');
      }
      if (config.stripe.privateKey.includes('placeholder')) {
        warnings.push('Using placeholder Stripe key in production');
      }
      
      if (warnings.length > 0) {
        logger.warn('[UnifiedConfig] Production configuration warnings', { warnings });
      }
    }
  }

  /**
   * Load RDS SSL certificate from file
   * @private
   */
  _loadRDSCertificate() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Try environment variable path first
      if (process.env.RDS_CA_CERT_PATH) {
        const certPath = path.resolve(process.env.RDS_CA_CERT_PATH);
        logger.info('[UnifiedConfig] Loading RDS certificate from env path', { path: certPath });
        return fs.readFileSync(certPath, 'utf8');
      }
      
      // Fallback to default location
      const defaultPath = path.join(__dirname, '..', 'utils', 'rds-ca-bundle.pem');
      logger.info('[UnifiedConfig] Loading RDS certificate from default path', { path: defaultPath });
      return fs.readFileSync(defaultPath, 'utf8');
    } catch (error) {
      logger.error('[UnifiedConfig] Failed to load RDS certificate', { error: error.message });
      return null;
    }
  }

  /**
   * Check if configuration has secrets loaded
   * @private
   */
  _hasSecrets(config) {
    return !!(
      config.stripe?.privateKey && 
      !config.stripe.privateKey.includes('placeholder') &&
      config.security?.jwtSecret &&
      config.security.jwtSecret !== 'default-jwt-secret-change-in-production'
    );
  }

  /**
   * Synchronous initialization for development
   * @private
   */
  _initializeSync() {
    try {
      // Try to use dev-config if available
      const devConfig = require('./dev-config');
      
      // Map dev-config to unified-config structure
      this._config = {
        env: devConfig.env,
        app: {
          name: 'permisos-digitales',
          version: '1.0.0',
          port: devConfig.server.port,
          host: devConfig.server.host
        },
        frontendUrl: devConfig.frontendUrl,
        database: devConfig.database,
        redis: devConfig.redis,
        stripe: devConfig.stripe,
        security: devConfig.security,
        services: {
          email: {
            enabled: devConfig.email.enabled,
            provider: 'smtp',
            host: devConfig.email.host,
            port: devConfig.email.port,
            from: devConfig.email.from,
            auth: {
              user: devConfig.email.user,
              pass: devConfig.email.pass
            }
          },
          storage: devConfig.storage,
          notification: {
            enabled: true
          }
        },
        features: devConfig.features,
        // Add any missing properties from the environment
        session: devConfig.session,
        cors: devConfig.cors,
        // Government portal configuration
        govtLoginUrl: devConfig.govtLoginUrl,
        govtUsername: devConfig.govtUsername,
        govtPassword: devConfig.govtPassword
      };
      
      this._initialized = true;
      logger.debug('[UnifiedConfig] Development config loaded synchronously');
    } catch (error) {
      // Fallback to environment variables
      logger.warn('[UnifiedConfig] Could not load dev-config, using environment variables');
      const baseConfig = this._getBaseConfiguration();
      const envConfig = this._getEnvironmentConfiguration('development');
      this._config = this._mergeConfigurations(baseConfig, envConfig);
      this._initialized = true;
    }
  }

  /**
   * BACKWARD COMPATIBILITY: Synchronous config access
   * Services expect this interface: unifiedConfig.getSync()
   * 
   * @returns {Object} Configuration object
   * @throws {Error} If config not initialized
   */
  getSync() {
    if (!this._initialized) {
      const errorMsg = 'Configuration accessed before initialization. Services must wait for config to be ready.';
      logger.error('[UnifiedConfig] ' + errorMsg, {
        initialized: this._initialized,
        initializing: this._initializing,
        stack: new Error().stack
      });
      
      // In production, this is a fatal error
      if (process.env.NODE_ENV === 'production') {
        throw new Error(errorMsg + ' This is a fatal error in production.');
      } else {
        // In development, provide a warning and basic config
        logger.warn('[UnifiedConfig] Providing fallback config in development mode');
        return this._getBaseConfiguration();
      }
    }

    return this._config;
  }

  /**
   * Get configuration value by key path
   * @param {string} keyPath - Dot-separated key path (e.g., 'database.url')
   * @returns {*} Configuration value
   */
  get(keyPath) {
    const config = this.getSync();
    return keyPath.split('.').reduce((obj, key) => obj?.[key], config);
  }

  /**
   * Check if configuration is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Check if configuration is currently initializing
   * @returns {boolean} True if initializing
   */
  isInitializing() {
    return this._initializing;
  }

  /**
   * Get configuration health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      initialized: this._initialized,
      initializing: this._initializing,
      environment: this._config?.env || 'unknown',
      hasSecrets: this._config ? this._hasSecrets(this._config) : false,
      initTime: this._initialized ? Date.now() - this.startTime : null
    };
  }

  /**
   * SERVICE CONTAINER INTEGRATION
   * Provides config as a dependency injection factory
   * @returns {Function} Factory function for service container
   */
  asServiceFactory() {
    return () => {
      if (!this._initialized) {
        throw new Error('Config service accessed before initialization in service container');
      }
      return this._config;
    };
  }

  /**
   * Reset configuration (for testing only)
   * @private
   */
  _reset() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Config reset only allowed in test environment');
    }
    
    this._config = null;
    this._initialized = false;
    this._initializing = false;
    this._initPromise = null;
  }
}

// Singleton instance
const unifiedConfig = new UnifiedProductionConfig();

// Export singleton with backward-compatible interface
module.exports = {
  // Primary interfaces
  initialize: (options) => unifiedConfig.initialize(options),
  getSync: () => unifiedConfig.getSync(),
  get: (keyPath) => unifiedConfig.get(keyPath),
  
  // Status methods
  isInitialized: () => unifiedConfig.isInitialized(),
  isInitializing: () => unifiedConfig.isInitializing(),
  getHealthStatus: () => unifiedConfig.getHealthStatus(),
  
  // Service container integration
  asServiceFactory: () => unifiedConfig.asServiceFactory(),
  
  // Testing support
  _reset: () => unifiedConfig._reset(),
  
  // Direct access to singleton for advanced usage
  _instance: unifiedConfig
};
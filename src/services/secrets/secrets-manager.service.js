/**
 * AWS Secrets Manager Service
 * 
 * Production-ready secrets management with:
 * - Intelligent caching with TTL
 * - Automatic retries with exponential backoff
 * - Fallback to environment variables
 * - Health monitoring
 * - Detailed logging
 * - Performance optimization
 */

const AWS = require('aws-sdk');
const { logger } = require('../../utils/logger');
const crypto = require('crypto');

class SecretsManagerService {
  constructor() {
    // Initialize AWS Secrets Manager client
    this.client = new AWS.SecretsManager({
      region: process.env.AWS_REGION || 'us-east-1',
      maxRetries: 3,
      retryDelayOptions: {
        base: 100
      }
    });

    // Cache configuration
    this.cache = new Map();
    this.cacheConfig = {
      defaultTTL: 3600000, // 1 hour
      emergencyTTL: 86400000, // 24 hours (used when AWS is down)
      checkInterval: 300000 // 5 minutes
    };

    // Metrics tracking
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      awsErrors: 0,
      fallbacksUsed: 0,
      lastError: null,
      lastSuccessfulFetch: null
    };

    // Environment configuration
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
    
    // Secret name prefixes
    this.secretPrefix = `permisos/${this.environment}`;

    // Start cache cleanup interval
    this.startCacheCleanup();

    // Log initialization
    logger.info('[SecretsManager] Service initialized', {
      environment: this.environment,
      region: process.env.AWS_REGION || 'us-east-1',
      cacheEnabled: true
    });
  }

  /**
   * Get all secrets required for application startup
   * @returns {Promise<Object>} All application secrets
   */
  async loadAllSecrets() {
    logger.info('[SecretsManager] Loading all application secrets...');
    const startTime = Date.now();
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const timeout = 25000; // 25 seconds (less than PM2's 30 second listen_timeout)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Secrets loading timeout after 25 seconds')), timeout);
        });

        // Create the secrets loading promise
        const secretsPromise = Promise.all([
          this.getDatabaseCredentials(),
          this.getRedisCredentials(),
          this.getSecuritySecrets(),
          this.getStripeKeys(),
          this.getEmailCredentials(),
          this.getGovernmentPortalCredentials()
        ]).then(([database, redis, security, stripe, email, government]) => ({
          database,
          redis,
          security,
          stripe,
          email,
          government
        }));

        // Race between timeout and actual loading
        const result = await Promise.race([secretsPromise, timeoutPromise]);

        const loadTime = Date.now() - startTime;
        logger.info(`[SecretsManager] All secrets loaded successfully in ${loadTime}ms`);
        return result;

      } catch (error) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.error(`[SecretsManager] Failed to load secrets (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
          nextRetryIn: attempt < maxRetries ? delay : null
        });

        if (attempt < maxRetries) {
          logger.info(`[SecretsManager] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error('[SecretsManager] All retry attempts exhausted');
          throw error;
        }
      }
    }
  }

  /**
   * Get database credentials
   * @returns {Promise<Object>} Database configuration
   */
  async getDatabaseCredentials() {
    const secretName = `${this.secretPrefix}/database/credentials`;
    
    try {
      const secret = await this.getSecret(secretName);
      
      // Construct DATABASE_URL if needed
      if (!secret.url && secret.username && secret.password) {
        secret.url = `postgresql://${secret.username}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.database}`;
      }
      
      return secret;
    } catch (error) {
      // Fallback to environment variable
      if (process.env.DATABASE_URL) {
        logger.warn('[SecretsManager] Using DATABASE_URL from environment as fallback');
        this.metrics.fallbacksUsed++;
        
        // Parse DATABASE_URL
        const url = new URL(process.env.DATABASE_URL);
        return {
          host: url.hostname,
          port: parseInt(url.port || '5432'),
          database: url.pathname.slice(1),
          username: url.username,
          password: decodeURIComponent(url.password),
          url: process.env.DATABASE_URL
        };
      }
      throw error;
    }
  }

  /**
   * Get Redis credentials
   * @returns {Promise<Object>} Redis configuration
   */
  async getRedisCredentials() {
    const secretName = `${this.secretPrefix}/redis/credentials`;
    
    try {
      const credentials = await this.getSecret(secretName);
      
      // AWS ElastiCache uses self-signed certificates, so we need to disable strict verification
      if (credentials.tls && this.isProduction) {
        credentials.tls = {
          ...credentials.tls,
          rejectUnauthorized: false // ElastiCache requirement
        };
        logger.info('[SecretsManager] Adjusted Redis TLS for ElastiCache compatibility');
      }
      
      return credentials;
    } catch (error) {
      // Fallback to environment variables
      logger.warn('[SecretsManager] Using Redis config from environment as fallback');
      this.metrics.fallbacksUsed++;
      
      return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: this.isProduction ? {
          servername: process.env.REDIS_HOST,
          rejectUnauthorized: false // ElastiCache uses self-signed certificates
        } : undefined
      };
    }
  }

  /**
   * Get security secrets (session, JWT, internal API)
   * @returns {Promise<Object>} Security secrets
   */
  async getSecuritySecrets() {
    const secretName = `${this.secretPrefix}/security/secrets`;
    
    try {
      return await this.getSecret(secretName);
    } catch (error) {
      // Fallback to environment variables
      if (process.env.SESSION_SECRET) {
        logger.warn('[SecretsManager] Using security secrets from environment as fallback');
        this.metrics.fallbacksUsed++;
        
        return {
          sessionSecret: process.env.SESSION_SECRET,
          jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET,
          internalApiKey: process.env.INTERNAL_API_KEY
        };
      }
      throw error;
    }
  }

  /**
   * Get Stripe API keys
   * @returns {Promise<Object>} Stripe configuration
   */
  async getStripeKeys() {
    const secretName = `${this.secretPrefix}/stripe/api-keys`;
    
    try {
      return await this.getSecret(secretName);
    } catch (error) {
      // Fallback to environment variables
      if (process.env.STRIPE_PRIVATE_KEY) {
        logger.warn('[SecretsManager] Using Stripe keys from environment as fallback');
        this.metrics.fallbacksUsed++;
        
        return {
          publicKey: process.env.STRIPE_PUBLIC_KEY,
          privateKey: process.env.STRIPE_PRIVATE_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
        };
      }
      throw error;
    }
  }

  /**
   * Get email service credentials
   * @returns {Promise<Object>} Email configuration
   */
  async getEmailCredentials() {
    const secretName = `${this.secretPrefix}/email/credentials`;
    
    try {
      return await this.getSecret(secretName);
    } catch (error) {
      // Fallback to environment variables
      logger.warn('[SecretsManager] Using email config from environment as fallback');
      this.metrics.fallbacksUsed++;
      
      return {
        smtpUser: process.env.EMAIL_USER,
        smtpPassword: process.env.EMAIL_PASS,
        fromAddress: process.env.EMAIL_FROM || 'noreply@permisosdigitales.com.mx'
      };
    }
  }

  /**
   * Get government portal credentials
   * @returns {Promise<Object>} Government portal configuration
   */
  async getGovernmentPortalCredentials() {
    const secretName = `${this.secretPrefix}/government/portal`;
    
    try {
      return await this.getSecret(secretName);
    } catch (error) {
      // Fallback to environment variables
      if (process.env.GOVT_USERNAME) {
        logger.warn('[SecretsManager] Using government portal config from environment as fallback');
        this.metrics.fallbacksUsed++;
        
        return {
          username: process.env.GOVT_USERNAME,
          password: process.env.GOVT_PASSWORD,
          loginUrl: process.env.GOVT_SITE_LOGIN_URL
        };
      }
      throw error;
    }
  }

  /**
   * Get a secret from AWS Secrets Manager with caching
   * @param {string} secretName - The name/ARN of the secret
   * @returns {Promise<Object>} The secret value
   */
  async getSecret(secretName) {
    // Check cache first
    const cached = this.getFromCache(secretName);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    try {
      // Fetch from AWS
      logger.debug(`[SecretsManager] Fetching secret: ${secretName}`);
      
      const response = await this.client.getSecretValue({
        SecretId: secretName
      }).promise();

      let secretValue;
      
      // Parse the secret value
      if (response.SecretString) {
        secretValue = JSON.parse(response.SecretString);
      } else if (response.SecretBinary) {
        // Handle binary secrets if needed
        const buff = Buffer.from(response.SecretBinary, 'base64');
        secretValue = JSON.parse(buff.toString('utf-8'));
      }

      // Cache the secret
      this.setCache(secretName, secretValue);
      this.metrics.lastSuccessfulFetch = new Date();

      return secretValue;
    } catch (error) {
      this.metrics.awsErrors++;
      this.metrics.lastError = {
        timestamp: new Date(),
        error: error.message,
        secretName
      };

      logger.error(`[SecretsManager] Error fetching secret ${secretName}`, error);

      // Check if we have an expired cache entry we can use
      const expiredCache = this.getFromCache(secretName, true);
      if (expiredCache) {
        logger.warn(`[SecretsManager] Using expired cache for ${secretName} due to AWS error`);
        // Re-cache with emergency TTL
        this.setCache(secretName, expiredCache, this.cacheConfig.emergencyTTL);
        return expiredCache;
      }

      throw error;
    }
  }

  /**
   * Refresh a specific secret
   * @param {string} secretType - Type of secret to refresh
   */
  async refreshSecret(secretType) {
    logger.info(`[SecretsManager] Refreshing secret: ${secretType}`);
    
    const secretMap = {
      database: () => this.getDatabaseCredentials(),
      redis: () => this.getRedisCredentials(),
      security: () => this.getSecuritySecrets(),
      stripe: () => this.getStripeKeys(),
      email: () => this.getEmailCredentials(),
      government: () => this.getGovernmentPortalCredentials()
    };

    const refreshFunc = secretMap[secretType];
    if (!refreshFunc) {
      throw new Error(`Unknown secret type: ${secretType}`);
    }

    // Clear cache for this secret type
    const secretName = `${this.secretPrefix}/${secretType}`;
    for (const [key] of this.cache) {
      if (key.startsWith(secretName)) {
        this.cache.delete(key);
      }
    }

    // Fetch fresh secret
    return await refreshFunc();
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @param {boolean} includeExpired - Include expired entries
   * @returns {*} Cached value or null
   */
  getFromCache(key, includeExpired = false) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (!includeExpired && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  setCache(key, value, ttl = this.cacheConfig.defaultTTL) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now()
    });
  }

  /**
   * Start cache cleanup interval
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug(`[SecretsManager] Cleaned ${cleaned} expired cache entries`);
      }
    }, this.cacheConfig.checkInterval);
  }

  /**
   * Get service health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const now = Date.now();
    const lastFetchAge = this.metrics.lastSuccessfulFetch 
      ? now - this.metrics.lastSuccessfulFetch.getTime() 
      : null;

    return {
      status: this.metrics.lastError && lastFetchAge > 3600000 ? 'degraded' : 'healthy',
      cacheSize: this.cache.size,
      metrics: {
        ...this.metrics,
        cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
        lastFetchAge: lastFetchAge ? Math.round(lastFetchAge / 1000) : null
      }
    };
  }

  /**
   * Clear all cached secrets
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[SecretsManager] Cleared ${size} cached entries`);
  }

  /**
   * Generate a secure random secret
   * @param {number} length - Length of the secret
   * @returns {string} Random secret
   */
  static generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export singleton instance
module.exports = new SecretsManagerService();
/**
 * Tests for AWS Secrets Manager Service
 */

const AWS = require('aws-sdk');
const SecretsManagerService = require('../secrets-manager.service');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockGetSecretValue = jest.fn();
  const mockSecretsManager = jest.fn(() => ({
    getSecretValue: mockGetSecretValue
  }));
  
  return {
    SecretsManager: mockSecretsManager,
    mockGetSecretValue
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('SecretsManagerService', () => {
  let mockGetSecretValue;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear cache
    SecretsManagerService.clearCache();
    
    // Get mock function
    mockGetSecretValue = AWS.SecretsManager.mock.results[0].value.getSecretValue;
    
    // Reset metrics
    SecretsManagerService.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      awsErrors: 0,
      fallbacksUsed: 0,
      lastError: null,
      lastSuccessfulFetch: null
    };
  });

  describe('getSecret', () => {
    it('should fetch secret from AWS and cache it', async () => {
      const secretName = 'test/secret';
      const secretValue = { username: 'test', password: 'secret123' };
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(secretValue)
        })
      });

      const result = await SecretsManagerService.getSecret(secretName);
      
      expect(result).toEqual(secretValue);
      expect(mockGetSecretValue).toHaveBeenCalledWith({ SecretId: secretName });
      expect(SecretsManagerService.metrics.cacheMisses).toBe(1);
      expect(SecretsManagerService.metrics.cacheHits).toBe(0);
    });

    it('should return cached secret on subsequent calls', async () => {
      const secretName = 'test/secret';
      const secretValue = { username: 'test', password: 'secret123' };
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(secretValue)
        })
      });

      // First call - cache miss
      await SecretsManagerService.getSecret(secretName);
      
      // Second call - cache hit
      const result = await SecretsManagerService.getSecret(secretName);
      
      expect(result).toEqual(secretValue);
      expect(mockGetSecretValue).toHaveBeenCalledTimes(1); // Only called once
      expect(SecretsManagerService.metrics.cacheHits).toBe(1);
      expect(SecretsManagerService.metrics.cacheMisses).toBe(1);
    });

    it('should handle binary secrets', async () => {
      const secretName = 'test/binary-secret';
      const secretValue = { key: 'binary-value' };
      const binaryData = Buffer.from(JSON.stringify(secretValue)).toString('base64');
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretBinary: binaryData
        })
      });

      const result = await SecretsManagerService.getSecret(secretName);
      
      expect(result).toEqual(secretValue);
    });

    it('should use expired cache when AWS is unavailable', async () => {
      const secretName = 'test/secret';
      const secretValue = { username: 'test', password: 'secret123' };
      
      // First call succeeds
      mockGetSecretValue.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(secretValue)
        })
      });

      await SecretsManagerService.getSecret(secretName);
      
      // Manually expire the cache
      const cacheEntry = SecretsManagerService.cache.get(secretName);
      cacheEntry.expiresAt = Date.now() - 1000;
      
      // Second call fails
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('AWS is down'))
      });

      const result = await SecretsManagerService.getSecret(secretName);
      
      expect(result).toEqual(secretValue);
      expect(SecretsManagerService.metrics.awsErrors).toBe(1);
    });
  });

  describe('getDatabaseCredentials', () => {
    it('should fetch database credentials', async () => {
      const dbSecret = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'admin',
        password: 'password123'
      };
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(dbSecret)
        })
      });

      const result = await SecretsManagerService.getDatabaseCredentials();
      
      expect(result).toEqual(expect.objectContaining({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'admin',
        password: 'password123',
        url: 'postgresql://admin:password123@localhost:5432/test_db'
      }));
    });

    it('should fallback to DATABASE_URL env var', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Secret not found'))
      });

      const result = await SecretsManagerService.getDatabaseCredentials();
      
      expect(result).toEqual({
        host: 'host',
        port: 5432,
        database: 'db',
        username: 'user',
        password: 'pass',
        url: process.env.DATABASE_URL
      });
      
      expect(SecretsManagerService.metrics.fallbacksUsed).toBe(1);
      
      delete process.env.DATABASE_URL;
    });
  });

  describe('getStripeKeys', () => {
    it('should fetch Stripe API keys', async () => {
      const stripeSecret = {
        publicKey: 'pk_test_123',
        privateKey: 'sk_test_456',
        webhookSecret: 'whsec_789'
      };
      
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(stripeSecret)
        })
      });

      const result = await SecretsManagerService.getStripeKeys();
      
      expect(result).toEqual(stripeSecret);
    });
  });

  describe('refreshSecret', () => {
    it('should clear cache and fetch fresh secret', async () => {
      const dbSecret = {
        host: 'localhost',
        username: 'admin',
        password: 'old-password'
      };
      
      // Initial fetch
      mockGetSecretValue.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(dbSecret)
        })
      });

      await SecretsManagerService.getDatabaseCredentials();
      expect(SecretsManagerService.cache.size).toBe(1);
      
      // Update secret
      const newDbSecret = { ...dbSecret, password: 'new-password' };
      mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(newDbSecret)
        })
      });

      const result = await SecretsManagerService.refreshSecret('database');
      
      expect(result.password).toBe('new-password');
      expect(mockGetSecretValue).toHaveBeenCalledTimes(2);
    });

    it('should throw error for unknown secret type', async () => {
      await expect(
        SecretsManagerService.refreshSecret('unknown')
      ).rejects.toThrow('Unknown secret type: unknown');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const status = SecretsManagerService.getHealthStatus();
      
      expect(status).toEqual({
        status: 'healthy',
        cacheSize: 0,
        metrics: expect.objectContaining({
          cacheHits: 0,
          cacheMisses: 0,
          awsErrors: 0,
          cacheHitRate: 0
        })
      });
    });

    it('should return degraded status after errors', async () => {
      SecretsManagerService.metrics.lastError = {
        timestamp: new Date(),
        error: 'Test error'
      };
      SecretsManagerService.metrics.lastSuccessfulFetch = new Date(Date.now() - 7200000); // 2 hours ago
      
      const status = SecretsManagerService.getHealthStatus();
      
      expect(status.status).toBe('degraded');
    });
  });

  describe('generateSecret', () => {
    it('should generate random secret of specified length', () => {
      const secret1 = SecretsManagerService.constructor.generateSecret(32);
      const secret2 = SecretsManagerService.constructor.generateSecret(32);
      
      expect(secret1).toHaveLength(64); // Hex encoding doubles length
      expect(secret2).toHaveLength(64);
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('loadAllSecrets', () => {
    it('should load all secrets in parallel', async () => {
      const secrets = {
        database: { host: 'db-host' },
        redis: { host: 'redis-host' },
        security: { sessionSecret: 'secret' },
        stripe: { privateKey: 'sk_test' },
        email: { smtpUser: 'user' },
        government: { username: 'govt' }
      };

      let callCount = 0;
      mockGetSecretValue.mockImplementation(({ SecretId }) => {
        callCount++;
        const type = SecretId.split('/').pop();
        return {
          promise: jest.fn().mockResolvedValue({
            SecretString: JSON.stringify(secrets[type] || {})
          })
        };
      });

      const result = await SecretsManagerService.loadAllSecrets();
      
      expect(result).toEqual(expect.objectContaining({
        database: expect.any(Object),
        redis: expect.any(Object),
        security: expect.any(Object),
        stripe: expect.any(Object),
        email: expect.any(Object),
        government: expect.any(Object)
      }));
      
      // Should be called 6 times (one for each secret type)
      expect(callCount).toBe(6);
    });
  });
});
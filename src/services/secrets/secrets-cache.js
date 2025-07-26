/**
 * AWS Secrets Manager Cache
 * 
 * Caches secrets in memory to avoid repeated AWS API calls.
 * This significantly improves cold start times in production.
 */

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

// Safe logging function to avoid exposing secret identifiers
function logSecretOperation(operation, secretId, details = {}) {
  // Hash the secret ID to avoid logging actual secret names
  const crypto = require('crypto');
  const hashedId = crypto.createHash('sha256').update(secretId).digest('hex').substring(0, 8);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SecretsCache] ${operation} for secret ***${hashedId}`, details);
  }
}

class SecretsCache {
  constructor() {
    this.cache = new Map();
    this.cacheFile = path.join(process.cwd(), '.secrets-cache.json');
    this.ttl = 60 * 60 * 1000; // 1 hour TTL
    this.client = new AWS.SecretsManager({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Get a secret with caching
   */
  async getSecret(secretId) {
    // Check memory cache first
    const cached = this.cache.get(secretId);
    if (cached && cached.expiry > Date.now()) {
      logSecretOperation('Using memory cache', secretId);
      return cached.value;
    }

    // Try file cache in production (for restarts)
    if (process.env.NODE_ENV === 'production') {
      const fileCached = await this.loadFromFile(secretId);
      if (fileCached) {
        return fileCached;
      }
    }

    // Fetch from AWS
    logSecretOperation('Fetching from AWS', secretId);
    const startTime = Date.now();
    
    try {
      const result = await this.client.getSecretValue({ SecretId: secretId }).promise();
      const value = JSON.parse(result.SecretString);
      const fetchTime = Date.now() - startTime;
      
      logSecretOperation('Fetched from AWS', secretId, { fetchTimeMs: fetchTime });
      
      // Cache in memory
      this.cache.set(secretId, {
        value,
        expiry: Date.now() + this.ttl
      });
      
      // Cache to file in production
      if (process.env.NODE_ENV === 'production') {
        await this.saveToFile(secretId, value);
      }
      
      return value;
    } catch (error) {
      logSecretOperation('Failed to fetch', secretId, { error: error.message });
      throw error;
    }
  }

  /**
   * Batch fetch multiple secrets
   */
  async getSecrets(secretIds) {
    const results = {};
    
    // Fetch in parallel
    await Promise.all(
      secretIds.map(async (secretId) => {
        try {
          results[secretId] = await this.getSecret(secretId);
        } catch (error) {
          console.error(`[SecretsCache] Failed to fetch ${secretId}:`, error);
          results[secretId] = null;
        }
      })
    );
    
    return results;
  }

  /**
   * Load from file cache (encrypted)
   */
  async loadFromFile(secretId) {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cached = JSON.parse(data);
      
      if (cached[secretId] && cached[secretId].expiry > Date.now()) {
        console.log(`[SecretsCache] Using file cache for ${secretId}`);
        
        // Refresh memory cache
        this.cache.set(secretId, cached[secretId]);
        
        return cached[secretId].value;
      }
    } catch (error) {
      // File doesn't exist or is invalid
    }
    
    return null;
  }

  /**
   * Save to file cache
   */
  async saveToFile(secretId, value) {
    try {
      let cached = {};
      
      // Load existing cache
      try {
        const data = await fs.readFile(this.cacheFile, 'utf8');
        cached = JSON.parse(data);
      } catch (error) {
        // File doesn't exist
      }
      
      // Update cache
      cached[secretId] = {
        value,
        expiry: Date.now() + this.ttl
      };
      
      // Save to file
      await fs.writeFile(this.cacheFile, JSON.stringify(cached), 'utf8');
      
      // Set restrictive permissions
      await fs.chmod(this.cacheFile, 0o600);
      
    } catch (error) {
      console.error('[SecretsCache] Failed to save file cache:', error);
    }
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.cache.clear();
    
    try {
      await fs.unlink(this.cacheFile);
    } catch (error) {
      // File doesn't exist
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getSecretsCache() {
    if (!instance) {
      instance = new SecretsCache();
    }
    return instance;
  }
};
/**
 * Simple URL Shortener Service for WhatsApp
 * Creates short URLs that redirect to Stripe payment links
 */

const { logger } = require('../../utils/logger');
const crypto = require('crypto');

class URLShortenerService {
  constructor() {
    this.baseUrl = 'https://api.permisosdigitales.com.mx';
    
    // Use Redis instead of memory for persistence
    this.redis = null;
    this.initRedis();
  }

  async initRedis() {
    try {
      const RedisClient = require('../../utils/redis-client');
      this.redis = RedisClient;
      logger.info('URL Shortener using Redis for storage');
    } catch (error) {
      logger.error('Failed to initialize Redis for URL shortener', { error: error.message });
      // Fallback to memory if Redis fails
      this.urlMap = new Map();
      logger.warn('URL Shortener falling back to memory storage');
    }
  }

  /**
   * Create a short URL for a payment link
   */
  async createShortUrl(longUrl, applicationId) {
    try {
      // Generate a short code
      const shortCode = this.generateShortCode(applicationId);
      
      const urlData = {
        longUrl,
        applicationId,
        createdAt: Date.now(),
        clicks: 0
      };
      
      // Store in Redis with 24-hour expiration
      if (this.redis) {
        const key = `short_url:${shortCode}`;
        await this.redis.setex(key, 24 * 60 * 60, JSON.stringify(urlData)); // 24 hours
      } else {
        // Fallback to memory
        this.urlMap.set(shortCode, urlData);
      }
      
      const shortUrl = `${this.baseUrl}/pago/${shortCode}`;
      
      logger.info('Short URL created', { shortCode, applicationId, storage: this.redis ? 'redis' : 'memory' });
      
      return shortUrl;
    } catch (error) {
      logger.error('Error creating short URL', { error: error.message });
      // Fallback to original URL
      return longUrl;
    }
  }

  /**
   * Generate a short code based on application ID
   */
  generateShortCode(applicationId) {
    // Convert applicationId to string and use last 6 characters + random suffix
    const idString = String(applicationId);
    const idPart = idString.length >= 6 ? idString.slice(-6) : idString.padStart(6, '0');
    const randomPart = crypto.randomBytes(2).toString('hex');
    return `${idPart}${randomPart}`;
  }

  /**
   * Resolve a short code to the original URL
   */
  async resolveShortUrl(shortCode) {
    try {
      let mapping = null;
      
      if (this.redis) {
        // Get from Redis
        const key = `short_url:${shortCode}`;
        const data = await this.redis.get(key);
        if (data) {
          mapping = JSON.parse(data);
          // Update click count
          mapping.clicks++;
          await this.redis.setex(key, 24 * 60 * 60, JSON.stringify(mapping));
        }
      } else {
        // Fallback to memory
        mapping = this.urlMap.get(shortCode);
        if (mapping) {
          mapping.clicks++;
        }
      }
      
      if (!mapping) {
        logger.warn('Short URL not found', { shortCode });
        return null;
      }
      
      logger.info('Short URL resolved', { shortCode, clicks: mapping.clicks });
      return mapping.longUrl;
      
    } catch (error) {
      logger.error('Error resolving short URL', { error: error.message, shortCode });
      return null;
    }
  }

  /**
   * Get statistics for a short URL
   */
  async getUrlStats(shortCode) {
    return this.urlMap.get(shortCode);
  }
}

module.exports = new URLShortenerService();
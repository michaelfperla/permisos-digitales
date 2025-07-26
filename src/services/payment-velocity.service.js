const { logger } = require('../utils/logger');
const redisClient = require('../utils/redis-client');
const alertService = require('./alert.service');
// Configuration compatibility layer for dev/prod environments
function getConfig() {
  try {
    // Try unified config first (production)
    const unifiedConfig = require('../config/unified-config');
    if (unifiedConfig.isInitialized && unifiedConfig.isInitialized()) {
      return unifiedConfig.getSync();
    }
  } catch (error) {
    // Unified config not available or not initialized
  }
  
  try {
    // Fall back to dev config (development)
    return require('../config/dev-config');
  } catch (error) {
    // Neither config available
    logger.error('No configuration system available');
    throw new Error('Configuration system not available');
  }
}
// RACE CONDITION FIX: Don't load config at module level

class PaymentVelocityService {
  constructor() {
    this._config = null; // Lazy load config
    
    // Velocity check configuration - configurable via environment variables
    this.limits = {
      // User-based limits
      userHourly: parseInt(process.env.PAYMENT_VELOCITY_USER_HOURLY || '5'),              // Max payment attempts per hour per user
      userDaily: parseInt(process.env.PAYMENT_VELOCITY_USER_DAILY || '10'),               // Max payment attempts per day per user
      userMonthly: parseInt(process.env.PAYMENT_VELOCITY_USER_MONTHLY || '30'),           // Max payment attempts per month per user
      
      // IP-based limits
      ipHourly: parseInt(process.env.PAYMENT_VELOCITY_IP_HOURLY || '20'),                 // Max payment attempts per hour per IP
      ipDaily: parseInt(process.env.PAYMENT_VELOCITY_IP_DAILY || '50'),                   // Max payment attempts per day per IP
      
      // Card-based limits (for same card number)
      cardHourly: parseInt(process.env.PAYMENT_VELOCITY_CARD_HOURLY || '3'),              // Max attempts per hour per card
      cardDaily: parseInt(process.env.PAYMENT_VELOCITY_CARD_DAILY || '5'),                // Max attempts per day per card
      
      // Email-based limits
      emailHourly: parseInt(process.env.PAYMENT_VELOCITY_EMAIL_HOURLY || '5'),            // Max attempts per hour per email
      emailDaily: parseInt(process.env.PAYMENT_VELOCITY_EMAIL_DAILY || '10'),             // Max attempts per day per email
      
      // High-value transaction limits
      highValueThreshold: parseInt(process.env.PAYMENT_VELOCITY_HIGH_VALUE_THRESHOLD || '5000'),   // Transactions above this amount (MXN)
      highValueHourly: parseInt(process.env.PAYMENT_VELOCITY_HIGH_VALUE_HOURLY || '2'),            // Max high-value transactions per hour
      highValueDaily: parseInt(process.env.PAYMENT_VELOCITY_HIGH_VALUE_DAILY || '5')               // Max high-value transactions per day
    };
    
    // Suspicious patterns configuration
    this.suspiciousPatterns = {
      rapidFireThreshold: parseInt(process.env.PAYMENT_VELOCITY_RAPID_FIRE_THRESHOLD || '3'),     // Attempts in rapid fire window
      rapidFireWindow: parseInt(process.env.PAYMENT_VELOCITY_RAPID_FIRE_WINDOW || '60'),          // Rapid fire window in seconds
      multipleCardsThreshold: parseInt(process.env.PAYMENT_VELOCITY_MULTIPLE_CARDS_THRESHOLD || '5'),  // Multiple different cards threshold
      multipleCardsWindow: parseInt(process.env.PAYMENT_VELOCITY_MULTIPLE_CARDS_WINDOW || '3600')      // Multiple cards window in seconds
    };
    
    // Log current configuration on startup
    logger.info('Payment velocity service initialized with limits:', {
      userLimits: {
        hourly: this.limits.userHourly,
        daily: this.limits.userDaily,
        monthly: this.limits.userMonthly
      },
      ipLimits: {
        hourly: this.limits.ipHourly,
        daily: this.limits.ipDaily
      },
      cardLimits: {
        hourly: this.limits.cardHourly,
        daily: this.limits.cardDaily
      },
      highValueLimits: {
        threshold: this.limits.highValueThreshold,
        hourly: this.limits.highValueHourly,
        daily: this.limits.highValueDaily
      },
      suspiciousPatterns: this.suspiciousPatterns
    });
  }

  // RACE CONDITION FIX: Lazy config loading for future config integration
  _getConfig() {
    if (!this._config) {
      this._config = getConfig();
    }
    return this._config;
  }

  /**
   * Check payment velocity for potential fraud
   */
  async checkPaymentVelocity(paymentData) {
    const { userId, email, ipAddress, amount, cardLast4, cardFingerprint } = paymentData;
    const violations = [];
    
    try {
      // Check user-based velocity
      if (userId) {
        const userViolations = await this.checkUserVelocity(userId, amount);
        violations.push(...userViolations);
      }
      
      // Check IP-based velocity
      if (ipAddress) {
        const ipViolations = await this.checkIpVelocity(ipAddress);
        violations.push(...ipViolations);
      }
      
      // Check card-based velocity
      if (cardFingerprint) {
        const cardViolations = await this.checkCardVelocity(cardFingerprint);
        violations.push(...cardViolations);
      }
      
      // Check email-based velocity
      if (email) {
        const emailViolations = await this.checkEmailVelocity(email);
        violations.push(...emailViolations);
      }
      
      // Check for suspicious patterns
      const suspiciousPatterns = await this.checkSuspiciousPatterns(paymentData);
      violations.push(...suspiciousPatterns);
      
      // Log and alert if violations found
      if (violations.length > 0) {
        logger.warn('Payment velocity violations detected:', {
          userId,
          email,
          violations,
          amount
        });
        
        // Send alert for high-risk violations
        const highRiskViolations = violations.filter(v => v.severity === 'high');
        if (highRiskViolations.length > 0) {
          await this.sendFraudAlert(paymentData, highRiskViolations);
        }
      }
      
      return {
        allowed: violations.length === 0,
        violations,
        riskScore: this.calculateRiskScore(violations)
      };
      
    } catch (error) {
      logger.error('Error checking payment velocity:', error);
      // In case of error, allow payment but log for investigation
      return { allowed: true, violations: [], riskScore: 0 };
    }
  }

  /**
   * Check user-based velocity limits
   */
  async checkUserVelocity(userId, amount) {
    const violations = [];
    const now = Date.now();
    
    // Increment counters
    const hourlyKey = `velocity:user:${userId}:hourly`;
    const dailyKey = `velocity:user:${userId}:daily`;
    const monthlyKey = `velocity:user:${userId}:monthly`;
    
    const [hourlyCount, dailyCount, monthlyCount] = await Promise.all([
      redisClient.incr(hourlyKey),
      redisClient.incr(dailyKey),
      redisClient.incr(monthlyKey)
    ]);
    
    // Set expiration on first increment
    if (hourlyCount === 1) await redisClient.expire(hourlyKey, 3600);
    if (dailyCount === 1) await redisClient.expire(dailyKey, 86400);
    if (monthlyCount === 1) await redisClient.expire(monthlyKey, 2592000);
    
    // Check limits
    if (hourlyCount > this.limits.userHourly) {
      violations.push({
        type: 'user_hourly_limit',
        limit: this.limits.userHourly,
        current: hourlyCount,
        severity: 'medium'
      });
    }
    
    if (dailyCount > this.limits.userDaily) {
      violations.push({
        type: 'user_daily_limit',
        limit: this.limits.userDaily,
        current: dailyCount,
        severity: 'high'
      });
    }
    
    // Check high-value transactions
    if (amount >= this.limits.highValueThreshold) {
      const highValueHourlyKey = `velocity:user:${userId}:highvalue:hourly`;
      const highValueDailyKey = `velocity:user:${userId}:highvalue:daily`;
      
      const [hvHourly, hvDaily] = await Promise.all([
        redisClient.incr(highValueHourlyKey),
        redisClient.incr(highValueDailyKey)
      ]);
      
      if (hvHourly === 1) await redisClient.expire(highValueHourlyKey, 3600);
      if (hvDaily === 1) await redisClient.expire(highValueDailyKey, 86400);
      
      if (hvHourly > this.limits.highValueHourly) {
        violations.push({
          type: 'high_value_hourly_limit',
          limit: this.limits.highValueHourly,
          current: hvHourly,
          amount,
          severity: 'high'
        });
      }
    }
    
    return violations;
  }

  /**
   * Check IP-based velocity limits
   */
  async checkIpVelocity(ipAddress) {
    const violations = [];
    
    const hourlyKey = `velocity:ip:${ipAddress}:hourly`;
    const dailyKey = `velocity:ip:${ipAddress}:daily`;
    
    const [hourlyCount, dailyCount] = await Promise.all([
      redisClient.incr(hourlyKey),
      redisClient.incr(dailyKey)
    ]);
    
    if (hourlyCount === 1) await redisClient.expire(hourlyKey, 3600);
    if (dailyCount === 1) await redisClient.expire(dailyKey, 86400);
    
    if (hourlyCount > this.limits.ipHourly) {
      violations.push({
        type: 'ip_hourly_limit',
        limit: this.limits.ipHourly,
        current: hourlyCount,
        severity: 'medium'
      });
    }
    
    if (dailyCount > this.limits.ipDaily) {
      violations.push({
        type: 'ip_daily_limit',
        limit: this.limits.ipDaily,
        current: dailyCount,
        severity: 'high'
      });
    }
    
    return violations;
  }

  /**
   * Check card-based velocity limits
   */
  async checkCardVelocity(cardFingerprint) {
    const violations = [];
    
    const hourlyKey = `velocity:card:${cardFingerprint}:hourly`;
    const dailyKey = `velocity:card:${cardFingerprint}:daily`;
    
    const [hourlyCount, dailyCount] = await Promise.all([
      redisClient.incr(hourlyKey),
      redisClient.incr(dailyKey)
    ]);
    
    if (hourlyCount === 1) await redisClient.expire(hourlyKey, 3600);
    if (dailyCount === 1) await redisClient.expire(dailyKey, 86400);
    
    if (hourlyCount > this.limits.cardHourly) {
      violations.push({
        type: 'card_hourly_limit',
        limit: this.limits.cardHourly,
        current: hourlyCount,
        severity: 'high'
      });
    }
    
    if (dailyCount > this.limits.cardDaily) {
      violations.push({
        type: 'card_daily_limit',
        limit: this.limits.cardDaily,
        current: dailyCount,
        severity: 'high'
      });
    }
    
    return violations;
  }

  /**
   * Check email-based velocity limits
   */
  async checkEmailVelocity(email) {
    const violations = [];
    
    const hourlyKey = `velocity:email:${email}:hourly`;
    const dailyKey = `velocity:email:${email}:daily`;
    
    const [hourlyCount, dailyCount] = await Promise.all([
      redisClient.incr(hourlyKey),
      redisClient.incr(dailyKey)
    ]);
    
    if (hourlyCount === 1) await redisClient.expire(hourlyKey, 3600);
    if (dailyCount === 1) await redisClient.expire(dailyKey, 86400);
    
    if (hourlyCount > this.limits.emailHourly) {
      violations.push({
        type: 'email_hourly_limit',
        limit: this.limits.emailHourly,
        current: hourlyCount,
        severity: 'medium'
      });
    }
    
    return violations;
  }

  /**
   * Check for suspicious patterns
   */
  async checkSuspiciousPatterns(paymentData) {
    const { userId, cardFingerprint } = paymentData;
    const violations = [];
    
    if (!userId) return violations;
    
    // Check rapid-fire attempts
    const rapidFireKey = `velocity:rapidfire:${userId}`;
    const rapidFireCount = await redisClient.incr(rapidFireKey);
    
    if (rapidFireCount === 1) {
      await redisClient.expire(rapidFireKey, this.suspiciousPatterns.rapidFireWindow);
    }
    
    if (rapidFireCount >= this.suspiciousPatterns.rapidFireThreshold) {
      violations.push({
        type: 'rapid_fire_attempts',
        threshold: this.suspiciousPatterns.rapidFireThreshold,
        window: this.suspiciousPatterns.rapidFireWindow,
        current: rapidFireCount,
        severity: 'high'
      });
    }
    
    // Track multiple cards usage
    if (cardFingerprint) {
      const multiCardKey = `velocity:multicards:${userId}`;
      await redisClient.set(
        `${multiCardKey}:${cardFingerprint}`, 
        '1', 
        'EX', 
        this.suspiciousPatterns.multipleCardsWindow
      );
      
      // Count unique cards used
      // Note: keys() method might not be available in production Redis wrapper
      let cardCount = 0;
      try {
        // Use a counter instead of keys() for production safety
        const cardCountKey = `velocity:multicards:count:${userId}`;
        cardCount = await redisClient.incr(cardCountKey);
        if (cardCount === 1) {
          await redisClient.expire(cardCountKey, this.suspiciousPatterns.multipleCardsWindow);
        }
      } catch (error) {
        logger.warn('Error tracking multiple cards:', error);
        cardCount = 0;
      }
      
      if (cardCount >= this.suspiciousPatterns.multipleCardsThreshold) {
        violations.push({
          type: 'multiple_cards_used',
          threshold: this.suspiciousPatterns.multipleCardsThreshold,
          current: cardCount,
          severity: 'high'
        });
      }
    }
    
    return violations;
  }

  /**
   * Calculate risk score based on violations
   */
  calculateRiskScore(violations) {
    let score = 0;
    
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'low':
          score += 10;
          break;
        case 'medium':
          score += 25;
          break;
        case 'high':
          score += 50;
          break;
      }
    });
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Send fraud alert
   */
  async sendFraudAlert(paymentData, violations) {
    try {
      await alertService.sendAlert({
        title: 'Potential Payment Fraud Detected',
        message: `High-risk payment velocity violations detected for user ${paymentData.userId}`,
        severity: 'CRITICAL',
        details: {
          userId: paymentData.userId,
          email: paymentData.email,
          amount: paymentData.amount,
          violations,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending fraud alert:', error);
    }
  }

  /**
   * Reset velocity counters for a user (admin action)
   */
  async resetUserVelocity(userId) {
    const keys = [
      `velocity:user:${userId}:hourly`,
      `velocity:user:${userId}:daily`,
      `velocity:user:${userId}:monthly`,
      `velocity:user:${userId}:highvalue:hourly`,
      `velocity:user:${userId}:highvalue:daily`,
      `velocity:rapidfire:${userId}`
    ];
    
    try {
      await redisClient.del(...keys);
      logger.info(`Reset velocity counters for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error resetting velocity for user ${userId}:`, error);
      return false;
    }
  }
}

// Export the class
module.exports = PaymentVelocityService;
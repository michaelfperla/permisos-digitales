/**
 * Fraud Detection Utility
 * 
 * This utility provides basic fraud detection capabilities for payment processing.
 * It calculates a risk score based on various factors and can flag suspicious transactions.
 */
const { logger } = require('./enhanced-logger');

// Risk thresholds
const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
  VERY_HIGH: 90
};

// Risk factors and their weights
const RISK_FACTORS = {
  // IP address factors
  IP_MISMATCH: 20,
  IP_HIGH_RISK_COUNTRY: 30,
  IP_PROXY_VPN: 25,
  IP_TOR: 40,
  
  // Device factors
  DEVICE_FINGERPRINT_MISMATCH: 25,
  DEVICE_EMULATOR: 20,
  DEVICE_ROOTED: 15,
  
  // Behavioral factors
  MULTIPLE_CARDS_SAME_USER: 30,
  MULTIPLE_FAILED_ATTEMPTS: 25,
  UNUSUAL_TIME_OF_DAY: 10,
  UNUSUAL_AMOUNT: 15,
  RAPID_SUCCESSIVE_TRANSACTIONS: 35,
  
  // Card factors
  CARD_BIN_HIGH_RISK: 30,
  CARD_FOREIGN_COUNTRY: 20,
  
  // User factors
  NEW_USER: 15,
  SUSPICIOUS_EMAIL: 20,
  INCOMPLETE_PROFILE: 10
};

/**
 * Calculate risk score for a payment
 * @param {Object} paymentData - Payment data
 * @param {Object} userInfo - User information
 * @param {Object} deviceInfo - Device information
 * @param {Object} options - Additional options
 * @returns {Object} - Risk assessment result
 */
const calculateRiskScore = (paymentData, userInfo, deviceInfo = {}, options = {}) => {
  // Start with a base score of 0
  let riskScore = 0;
  const riskFactors = [];
  
  try {
    // Check for IP address factors
    if (deviceInfo.ip) {
      if (userInfo.lastIp && deviceInfo.ip !== userInfo.lastIp) {
        riskScore += RISK_FACTORS.IP_MISMATCH;
        riskFactors.push('IP_MISMATCH');
      }
      
      if (deviceInfo.ipCountry && isHighRiskCountry(deviceInfo.ipCountry)) {
        riskScore += RISK_FACTORS.IP_HIGH_RISK_COUNTRY;
        riskFactors.push('IP_HIGH_RISK_COUNTRY');
      }
      
      if (deviceInfo.isProxy || deviceInfo.isVpn) {
        riskScore += RISK_FACTORS.IP_PROXY_VPN;
        riskFactors.push('IP_PROXY_VPN');
      }
      
      if (deviceInfo.isTor) {
        riskScore += RISK_FACTORS.IP_TOR;
        riskFactors.push('IP_TOR');
      }
    }
    
    // Check for device factors
    if (deviceInfo.fingerprint) {
      if (userInfo.lastDeviceFingerprint && deviceInfo.fingerprint !== userInfo.lastDeviceFingerprint) {
        riskScore += RISK_FACTORS.DEVICE_FINGERPRINT_MISMATCH;
        riskFactors.push('DEVICE_FINGERPRINT_MISMATCH');
      }
      
      if (deviceInfo.isEmulator) {
        riskScore += RISK_FACTORS.DEVICE_EMULATOR;
        riskFactors.push('DEVICE_EMULATOR');
      }
      
      if (deviceInfo.isRooted) {
        riskScore += RISK_FACTORS.DEVICE_ROOTED;
        riskFactors.push('DEVICE_ROOTED');
      }
    }
    
    // Check for behavioral factors
    if (userInfo.cardCount && userInfo.cardCount > 3) {
      riskScore += RISK_FACTORS.MULTIPLE_CARDS_SAME_USER;
      riskFactors.push('MULTIPLE_CARDS_SAME_USER');
    }
    
    if (userInfo.failedAttempts && userInfo.failedAttempts > 2) {
      riskScore += RISK_FACTORS.MULTIPLE_FAILED_ATTEMPTS;
      riskFactors.push('MULTIPLE_FAILED_ATTEMPTS');
    }
    
    if (isUnusualTimeOfDay()) {
      riskScore += RISK_FACTORS.UNUSUAL_TIME_OF_DAY;
      riskFactors.push('UNUSUAL_TIME_OF_DAY');
    }
    
    if (isUnusualAmount(paymentData.amount)) {
      riskScore += RISK_FACTORS.UNUSUAL_AMOUNT;
      riskFactors.push('UNUSUAL_AMOUNT');
    }
    
    if (userInfo.lastTransactionTime && isRapidSuccessiveTransaction(userInfo.lastTransactionTime)) {
      riskScore += RISK_FACTORS.RAPID_SUCCESSIVE_TRANSACTIONS;
      riskFactors.push('RAPID_SUCCESSIVE_TRANSACTIONS');
    }
    
    // Check for card factors
    if (paymentData.cardBin) {
      if (isHighRiskBin(paymentData.cardBin)) {
        riskScore += RISK_FACTORS.CARD_BIN_HIGH_RISK;
        riskFactors.push('CARD_BIN_HIGH_RISK');
      }
      
      if (isForeignCard(paymentData.cardBin)) {
        riskScore += RISK_FACTORS.CARD_FOREIGN_COUNTRY;
        riskFactors.push('CARD_FOREIGN_COUNTRY');
      }
    }
    
    // Check for user factors
    if (userInfo.isNewUser) {
      riskScore += RISK_FACTORS.NEW_USER;
      riskFactors.push('NEW_USER');
    }
    
    if (isSuspiciousEmail(userInfo.email)) {
      riskScore += RISK_FACTORS.SUSPICIOUS_EMAIL;
      riskFactors.push('SUSPICIOUS_EMAIL');
    }
    
    if (isIncompleteProfile(userInfo)) {
      riskScore += RISK_FACTORS.INCOMPLETE_PROFILE;
      riskFactors.push('INCOMPLETE_PROFILE');
    }
    
    // Cap the risk score at 100
    riskScore = Math.min(riskScore, 100);
    
    // Determine risk level
    let riskLevel = 'LOW';
    if (riskScore >= RISK_THRESHOLDS.VERY_HIGH) {
      riskLevel = 'VERY_HIGH';
    } else if (riskScore >= RISK_THRESHOLDS.HIGH) {
      riskLevel = 'HIGH';
    } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
      riskLevel = 'MEDIUM';
    }
    
    // Log the risk assessment
    logger.debug('Fraud risk assessment:', {
      riskScore,
      riskLevel,
      riskFactors,
      userId: userInfo.id,
      paymentAmount: paymentData.amount
    });
    
    return {
      riskScore,
      riskLevel,
      riskFactors,
      flaggedForReview: riskScore >= RISK_THRESHOLDS.HIGH,
      blockTransaction: riskScore >= RISK_THRESHOLDS.VERY_HIGH
    };
  } catch (error) {
    logger.error('Error calculating risk score:', {
      error: error.message,
      userId: userInfo.id
    });
    
    // Default to medium risk in case of error
    return {
      riskScore: RISK_THRESHOLDS.MEDIUM,
      riskLevel: 'MEDIUM',
      riskFactors: ['ERROR_CALCULATING_RISK'],
      flaggedForReview: true,
      blockTransaction: false
    };
  }
};

/**
 * Check if a country is high risk
 * @param {string} countryCode - ISO country code
 * @returns {boolean} - Whether the country is high risk
 */
const isHighRiskCountry = (countryCode) => {
  // List of high-risk countries (example)
  const highRiskCountries = ['NG', 'RU', 'UA', 'BY', 'KP', 'IR', 'SY'];
  return highRiskCountries.includes(countryCode);
};

/**
 * Check if the current time is unusual for transactions
 * @returns {boolean} - Whether the time is unusual
 */
const isUnusualTimeOfDay = () => {
  const hour = new Date().getHours();
  // Consider 1 AM to 5 AM as unusual hours
  return hour >= 1 && hour <= 5;
};

/**
 * Check if an amount is unusual
 * @param {number} amount - Payment amount
 * @returns {boolean} - Whether the amount is unusual
 */
const isUnusualAmount = (amount) => {
  // Consider amounts over 5000 as unusual
  return amount > 5000;
};

/**
 * Check if this is a rapid successive transaction
 * @param {Date|string|number} lastTransactionTime - Time of the last transaction
 * @returns {boolean} - Whether this is a rapid successive transaction
 */
const isRapidSuccessiveTransaction = (lastTransactionTime) => {
  const lastTime = new Date(lastTransactionTime).getTime();
  const currentTime = Date.now();
  const timeDiff = currentTime - lastTime;
  
  // Consider transactions within 5 minutes as rapid successive
  return timeDiff < 5 * 60 * 1000;
};

/**
 * Check if a card BIN is high risk
 * @param {string} bin - Card BIN (first 6 digits)
 * @returns {boolean} - Whether the BIN is high risk
 */
const isHighRiskBin = (bin) => {
  // Example implementation - in a real system, this would check against a database of high-risk BINs
  return false;
};

/**
 * Check if a card is from a foreign country
 * @param {string} bin - Card BIN (first 6 digits)
 * @returns {boolean} - Whether the card is foreign
 */
const isForeignCard = (bin) => {
  // Example implementation - in a real system, this would check the BIN against a database
  // For now, assume all cards are domestic
  return false;
};

/**
 * Check if an email is suspicious
 * @param {string} email - Email address
 * @returns {boolean} - Whether the email is suspicious
 */
const isSuspiciousEmail = (email) => {
  if (!email) return false;
  
  // Check for disposable email domains
  const disposableDomains = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwawaymail.com'];
  const domain = email.split('@')[1];
  
  return disposableDomains.includes(domain);
};

/**
 * Check if a user profile is incomplete
 * @param {Object} userInfo - User information
 * @returns {boolean} - Whether the profile is incomplete
 */
const isIncompleteProfile = (userInfo) => {
  // Check for missing essential information
  return !userInfo.phone || !userInfo.address;
};

module.exports = {
  calculateRiskScore,
  RISK_THRESHOLDS
};

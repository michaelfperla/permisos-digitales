/**
 * Permit Expiration Utilities
 * Centralized functions for consistent permit expiration calculations
 */

const { PERMIT_VALIDITY_DAYS, MEXICO_TIMEZONE } = require('../config/permit-config');

/**
 * Convert date to Mexico timezone
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in Mexico timezone
 */
function convertToMexicoTimezone(date) {
  const dateObj = new Date(date);
  
  // Convert to Mexico timezone
  const mexicoDate = new Date(dateObj.toLocaleString("en-US", {
    timeZone: MEXICO_TIMEZONE
  }));
  
  return mexicoDate;
}

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with added days
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate permit expiration date based on expedition date
 * @param {Date|string} expeditionDate - The permit expedition date
 * @returns {string} Expiration date in YYYY-MM-DD format
 */
function calculateExpirationDate(expeditionDate) {
  if (!expeditionDate) {
    throw new Error('Expedition date is required for expiration calculation');
  }
  
  // Convert to Mexico timezone
  const mexicoExpeditionDate = convertToMexicoTimezone(expeditionDate);
  
  // Add validity days
  const expirationDate = addDays(mexicoExpeditionDate, PERMIT_VALIDITY_DAYS);
  
  // Return in YYYY-MM-DD format
  return expirationDate.toISOString().split('T')[0];
}

/**
 * Check if a permit is expired based on expedition date
 * @param {Date|string} expeditionDate - The permit expedition date
 * @returns {boolean} True if permit is expired
 */
function isPermitExpired(expeditionDate) {
  if (!expeditionDate) {
    return false; // Can't be expired without expedition date
  }
  
  const expirationDate = calculateExpirationDate(expeditionDate);
  const currentDate = convertToMexicoTimezone(new Date()).toISOString().split('T')[0];
  
  return currentDate > expirationDate;
}

/**
 * Get days remaining until permit expires
 * @param {Date|string} expeditionDate - The permit expedition date
 * @returns {number} Days remaining (negative if expired)
 */
function getDaysUntilExpiration(expeditionDate) {
  if (!expeditionDate) {
    return null;
  }
  
  const expirationDate = new Date(calculateExpirationDate(expeditionDate));
  const currentDate = convertToMexicoTimezone(new Date());
  
  const diffTime = expirationDate - currentDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Generate SQL for timezone-aware expiration calculation
 * @param {string} expeditionDateColumn - Name of the expedition date column
 * @returns {string} SQL expression for expiration date
 */
function getExpirationSQL(expeditionDateColumn = 'fecha_expedicion') {
  return `(${expeditionDateColumn} AT TIME ZONE '${MEXICO_TIMEZONE}' + INTERVAL '${PERMIT_VALIDITY_DAYS} days')::DATE`;
}

module.exports = {
  convertToMexicoTimezone,
  addDays,
  calculateExpirationDate,
  isPermitExpired,
  getDaysUntilExpiration,
  getExpirationSQL,
  PERMIT_VALIDITY_DAYS,
  MEXICO_TIMEZONE
};
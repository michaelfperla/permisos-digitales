/**
 * Business Day Permit Expiration Utilities
 * Handles permit expiration calculation based on business rules:
 * - 30 days from when permit status becomes PERMIT_READY
 * - If PERMIT_READY on Saturday/Sunday, calculate from previous Friday
 */

const { MEXICO_TIMEZONE } = require('../config/permit-config');

/**
 * Convert date to Mexico timezone
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in Mexico timezone
 */
function convertToMexicoTimezone(date) {
  const dateObj = new Date(date);
  
  // For weekend calculation, we only care about the date part in Mexico timezone
  // Get the Mexico date components directly to avoid timezone conversion issues
  const mexicoTime = new Date(dateObj.toLocaleString("en-US", {
    timeZone: MEXICO_TIMEZONE
  }));
  
  // Create a clean date object with just the Mexico date (no time component)
  return new Date(mexicoTime.getFullYear(), mexicoTime.getMonth(), mexicoTime.getDate());
}

/**
 * Get the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param {Date} date - Date to check
 * @returns {number} Day of week
 */
function getDayOfWeek(date) {
  return date.getDay();
}

/**
 * Check if date is weekend (Saturday or Sunday)
 * @param {Date} date - Date to check
 * @returns {boolean} True if weekend
 */
function isWeekend(date) {
  const dayOfWeek = getDayOfWeek(date);
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}

/**
 * Get previous Friday from a weekend date
 * @param {Date} date - Weekend date
 * @returns {Date} Previous Friday
 */
function getPreviousFriday(date) {
  const dayOfWeek = getDayOfWeek(date);
  let daysToSubtract;
  
  if (dayOfWeek === 0) { // Sunday
    daysToSubtract = 2; // Go back to Friday
  } else if (dayOfWeek === 6) { // Saturday
    daysToSubtract = 1; // Go back to Friday
  } else {
    // Not a weekend, return same date
    return new Date(date);
  }
  
  const friday = new Date(date);
  friday.setDate(date.getDate() - daysToSubtract);
  return friday;
}

/**
 * Calculate the base date for permit expiration
 * Business rule: Use PERMIT_READY date, but if it's weekend, use previous Friday
 * @param {Date|string} permitReadyDate - Date when permit became PERMIT_READY
 * @returns {Date} Base date for expiration calculation
 */
function getPermitExpirationBaseDate(permitReadyDate) {
  // Convert to Mexico timezone
  const mexicoDate = convertToMexicoTimezone(permitReadyDate);
  
  // If it's a weekend, use previous Friday
  if (isWeekend(mexicoDate)) {
    return getPreviousFriday(mexicoDate);
  }
  
  return mexicoDate;
}

/**
 * Calculate permit expiration date based on business rules
 * @param {Date|string} permitReadyDate - Date when permit became PERMIT_READY
 * @returns {string} Expiration date in YYYY-MM-DD format
 */
function calculatePermitExpirationDate(permitReadyDate) {
  if (!permitReadyDate) {
    throw new Error('Permit ready date is required for expiration calculation');
  }
  
  // Get the base date (accounting for weekend rule)
  const baseDate = getPermitExpirationBaseDate(permitReadyDate);
  
  // Add 30 days
  const expirationDate = new Date(baseDate);
  expirationDate.setDate(baseDate.getDate() + 30);
  
  // Return in YYYY-MM-DD format
  return expirationDate.toISOString().split('T')[0];
}

/**
 * Check if a permit is expired based on business rules
 * @param {Date|string} permitReadyDate - Date when permit became PERMIT_READY
 * @returns {boolean} True if permit is expired
 */
function isPermitExpiredByBusinessRules(permitReadyDate) {
  if (!permitReadyDate) {
    return false; // Can't be expired without permit ready date
  }
  
  const expirationDate = calculatePermitExpirationDate(permitReadyDate);
  const currentMexicoDate = convertToMexicoTimezone(new Date()).toISOString().split('T')[0];
  
  return currentMexicoDate > expirationDate;
}

/**
 * Get days remaining until permit expires based on business rules
 * @param {Date|string} permitReadyDate - Date when permit became PERMIT_READY
 * @returns {number} Days remaining (negative if expired)
 */
function getDaysUntilExpiration(permitReadyDate) {
  if (!permitReadyDate) {
    return null;
  }
  
  const expirationDate = new Date(calculatePermitExpirationDate(permitReadyDate));
  const currentMexicoDate = convertToMexicoTimezone(new Date());
  
  const diffTime = expirationDate - currentMexicoDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Format date for display in Mexico timezone
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateMexico(date) {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('es-MX', {
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

module.exports = {
  convertToMexicoTimezone,
  getDayOfWeek,
  isWeekend,
  getPreviousFriday,
  getPermitExpirationBaseDate,
  calculatePermitExpirationDate,
  isPermitExpiredByBusinessRules,
  getDaysUntilExpiration,
  formatDateMexico,
  MEXICO_TIMEZONE
};
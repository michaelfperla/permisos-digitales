/**
 * Utility functions for formatting data
 */

/**
 * Format a date to a localized string
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
function formatDate(date, options = {}) {
  // Ensure we have a Date object
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Default options for Mexican Spanish format
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City'
  };
  
  // Merge default options with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Format the date using Intl.DateTimeFormat
  return new Intl.DateTimeFormat('es-MX', mergedOptions).format(dateObj);
}

/**
 * Format a number as currency (MXN)
 * @param {number|string} amount - Amount to format
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, options = {}) {
  // Convert amount to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Default options for Mexican Peso
  const defaultOptions = {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  
  // Merge default options with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Format the amount using Intl.NumberFormat
  return new Intl.NumberFormat('es-MX', mergedOptions).format(numAmount);
}

module.exports = {
  formatDate,
  formatCurrency
};

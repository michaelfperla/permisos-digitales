/**
 * Central constants export file
 * Re-exports all constants from domain-specific modules
 */

// Import all constant modules
const applicationConstants = require('./application.constants');
const paymentConstants = require('./payment.constants');
const documentConstants = require('./document.constants');
const validationConstants = require('./validation.constants');

// Re-export everything from each module
module.exports = {
  // Application constants
  ...applicationConstants,
  
  // Payment constants
  ...paymentConstants,
  
  // Document constants
  ...documentConstants,
  
  // Validation constants
  ...validationConstants,
  
  // Legacy compatibility exports (to avoid breaking existing code)
  ...applicationConstants.ApplicationStatus, // Spread individual status constants
  DEFAULT_PERMIT_FEE: paymentConstants.PaymentFees.DEFAULT_PERMIT_FEE,
};
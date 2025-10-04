/**
 * Permit Configuration
 * Centralized configuration for permit-related constants
 */

module.exports = {
  // Permit validity period in days
  PERMIT_VALIDITY_DAYS: 30,
  
  // Mexico timezone for consistent date calculations
  MEXICO_TIMEZONE: 'America/Mexico_City',
  
  // Permit statuses
  STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING', 
    READY: 'READY',
    COMPLETED: 'COMPLETED',
    VENCIDO: 'VENCIDO',  // Standardized expiration status
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED'
  },
  
  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    EXPIRED: 'EXPIRED',  // Keep EXPIRED for payments only
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
  }
};
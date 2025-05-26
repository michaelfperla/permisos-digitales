/**
 * =============================================================================
 * Permisos Digitales - Consolidated Application Constants
 * =============================================================================
 *
 * This file serves as the single source of truth for all application constants.
 * It combines constants previously defined in separate files for improved maintainability.
 */

// Application status constants - streamlined model
const ApplicationStatus = {
  // Payment-related statuses
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',           // Generic waiting for payment (replaces PENDING_PAYMENT)
  AWAITING_OXXO_PAYMENT: 'AWAITING_OXXO_PAYMENT', // Specifically waiting for OXXO payment
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',       // Payment is being processed (card authorization)
  PAYMENT_FAILED: 'PAYMENT_FAILED',               // Payment attempt failed
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',           // Payment confirmed (trigger for Puppeteer)

  // Permit generation statuses
  GENERATING_PERMIT: 'GENERATING_PERMIT',         // Puppeteer is generating the permit
  ERROR_GENERATING_PERMIT: 'ERROR_GENERATING_PERMIT', // Error during permit generation
  PERMIT_READY: 'PERMIT_READY',                   // Permit is generated and ready for download

  // Final statuses
  COMPLETED: 'COMPLETED',                         // Process completed successfully
  CANCELLED: 'CANCELLED',                         // Application cancelled by user or admin
  EXPIRED: 'EXPIRED',                             // Permit has expired

  // Renewal statuses
  RENEWAL_PENDING: 'RENEWAL_PENDING',             // Original permit is eligible for renewal
  RENEWAL_APPROVED: 'RENEWAL_APPROVED',           // Renewal has been approved
  RENEWAL_REJECTED: 'RENEWAL_REJECTED'            // Renewal has been rejected
};

// Payment status constants
// [Refactor - Remove Manual Payment] Payment status constants related to manual payment verification. Obsolete.
const PaymentStatus = {
  PENDING: 'PENDING',
  // RECEIVED: 'RECEIVED', // Status when payment proof is received
  // VERIFIED: 'VERIFIED', // Status when payment proof is verified by admin
  // REJECTED: 'REJECTED'  // Status when payment proof is rejected by admin
};

// Document types
const DocumentType = {
  PERMIT: 'PERMIT',
  RECEIPT: 'RECEIPT',
  // [Refactor - Remove Manual Payment] Document type for payment proofs. Obsolete.
  // PAYMENT_PROOF: 'PAYMENT_PROOF'
};

// Payment constants
const DEFAULT_PERMIT_FEE = 197.00;

// Export all constants
module.exports = {
  ...ApplicationStatus, // Export all status constants directly
  ApplicationStatus,    // Also export as a grouped object
  PaymentStatus,
  DocumentType,
  DEFAULT_PERMIT_FEE
};

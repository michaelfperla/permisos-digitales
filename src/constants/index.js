/**
 * =============================================================================
 * Permisos Digitales - Consolidated Application Constants
 * =============================================================================
 *
 * This file serves as the single source of truth for all application constants.
 * It combines constants previously defined in separate files for improved maintainability.
 */

// Application status constants from both previous files
const ApplicationStatus = {
  // From root constants.js
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PROCESSING_PAYMENT: 'PROCESSING_PAYMENT', // Added for payment processing state
  PAYMENT_FAILED: 'PAYMENT_FAILED', // Added for failed payment state
  AWAITING_OXXO_PAYMENT: 'AWAITING_OXXO_PAYMENT', // New status for OXXO payment flow
  // [Refactor - Remove Manual Payment] Status related to manual payment proof submission. Obsolete.
  // PROOF_RECEIVED: 'PROOF_RECEIVED',
  // PROOF_RECEIVED_SCHEDULED: 'PROOF_RECEIVED_SCHEDULED',
  // PROOF_SUBMITTED: 'PROOF_SUBMITTED',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  PERMIT_READY: 'PERMIT_READY',
  PERMIT_DELIVERED: 'PERMIT_DELIVERED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  RENEWAL_PENDING: 'RENEWAL_PENDING',
  RENEWAL_APPROVED: 'RENEWAL_APPROVED',
  RENEWAL_REJECTED: 'RENEWAL_REJECTED',

  // Additional from application-status.js
  // [Refactor - Remove Manual Payment] Status related to manual payment proof rejection. Obsolete.
  // PROOF_REJECTED: 'PROOF_REJECTED',
  GENERATING_PERMIT: 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT: 'ERROR_GENERATING_PERMIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
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

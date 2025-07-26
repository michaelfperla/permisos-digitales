/**
 * Application Status Constants
 * Defines all possible states for permit applications
 */
const ApplicationStatus = Object.freeze({
  // Payment states
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  AWAITING_OXXO_PAYMENT: 'AWAITING_OXXO_PAYMENT',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',

  // Permit generation states
  GENERATING_PERMIT: 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT: 'ERROR_GENERATING_PERMIT',
  PERMIT_READY: 'PERMIT_READY',

  // Final states
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  VENCIDO: 'VENCIDO', // Permit expired after 30 days

  // Renewal states
  RENEWAL_PENDING: 'RENEWAL_PENDING',
  RENEWAL_APPROVED: 'RENEWAL_APPROVED',
  RENEWAL_REJECTED: 'RENEWAL_REJECTED',
});

/**
 * Application status groups for easier categorization
 */
const ApplicationStatusGroups = Object.freeze({
  PAYMENT_STATES: [
    ApplicationStatus.AWAITING_PAYMENT,
    ApplicationStatus.AWAITING_OXXO_PAYMENT,
    ApplicationStatus.PAYMENT_PROCESSING,
    ApplicationStatus.PAYMENT_FAILED,
    ApplicationStatus.PAYMENT_RECEIVED,
  ],
  
  PROCESSING_STATES: [
    ApplicationStatus.GENERATING_PERMIT,
    ApplicationStatus.ERROR_GENERATING_PERMIT,
  ],
  
  FINAL_STATES: [
    ApplicationStatus.PERMIT_READY,
    ApplicationStatus.COMPLETED,
    ApplicationStatus.CANCELLED,
    ApplicationStatus.EXPIRED,
    ApplicationStatus.VENCIDO,
  ],
  
  RENEWAL_STATES: [
    ApplicationStatus.RENEWAL_PENDING,
    ApplicationStatus.RENEWAL_APPROVED,
    ApplicationStatus.RENEWAL_REJECTED,
  ],
  
  SUCCESS_STATES: [
    ApplicationStatus.PERMIT_READY,
    ApplicationStatus.COMPLETED,
    ApplicationStatus.RENEWAL_APPROVED,
  ],
  
  ERROR_STATES: [
    ApplicationStatus.PAYMENT_FAILED,
    ApplicationStatus.ERROR_GENERATING_PERMIT,
    ApplicationStatus.CANCELLED,
    ApplicationStatus.EXPIRED,
    ApplicationStatus.VENCIDO,
    ApplicationStatus.RENEWAL_REJECTED,
  ],
});

/**
 * Application type constants
 */
const ApplicationType = Object.freeze({
  NEW: 'NEW',
  RENEWAL: 'RENEWAL',
  REPLACEMENT: 'REPLACEMENT',
});

/**
 * Helper functions for application status
 */
const ApplicationHelpers = {
  isPaymentState: (status) => ApplicationStatusGroups.PAYMENT_STATES.includes(status),
  isProcessingState: (status) => ApplicationStatusGroups.PROCESSING_STATES.includes(status),
  isFinalState: (status) => ApplicationStatusGroups.FINAL_STATES.includes(status),
  isRenewalState: (status) => ApplicationStatusGroups.RENEWAL_STATES.includes(status),
  isSuccessState: (status) => ApplicationStatusGroups.SUCCESS_STATES.includes(status),
  isErrorState: (status) => ApplicationStatusGroups.ERROR_STATES.includes(status),
  
  canRetryPayment: (status) => status === ApplicationStatus.PAYMENT_FAILED,
  canCancelApplication: (status) => !ApplicationStatusGroups.FINAL_STATES.includes(status),
  canRenew: (status) => status === ApplicationStatus.COMPLETED || status === ApplicationStatus.EXPIRED || status === ApplicationStatus.VENCIDO,
};

module.exports = {
  ApplicationStatus,
  ApplicationStatusGroups,
  ApplicationType,
  ApplicationHelpers,
};
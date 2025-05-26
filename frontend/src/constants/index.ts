/**
 * =============================================================================
 * Permisos Digitales - Frontend Constants
 * =============================================================================
 *
 * This file serves as the single source of truth for all frontend constants.
 */

// Payment constants
export const DEFAULT_PERMIT_FEE = 197.0;
export const DEFAULT_CURRENCY = 'MXN';

// Application status constants
export enum ApplicationStatus {
  // Payment-related statuses
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_OXXO_PAYMENT = 'AWAITING_OXXO_PAYMENT',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',

  // Permit generation statuses
  GENERATING_PERMIT = 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT = 'ERROR_GENERATING_PERMIT',
  PERMIT_READY = 'PERMIT_READY',

  // Final statuses
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',

  // Renewal statuses
  RENEWAL_PENDING = 'RENEWAL_PENDING',
  RENEWAL_APPROVED = 'RENEWAL_APPROVED',
  RENEWAL_REJECTED = 'RENEWAL_REJECTED',
}

// Payment method types
export enum PaymentMethodType {
  CARD = 'card',
  OXXO = 'oxxo',
}

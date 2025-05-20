/**
 * =============================================================================
 * Permisos Digitales - Frontend Constants
 * =============================================================================
 *
 * This file serves as the single source of truth for all frontend constants.
 */

// Payment constants
export const DEFAULT_PERMIT_FEE = 197.00;
export const DEFAULT_CURRENCY = 'MXN';

// Application status constants
export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  AWAITING_OXXO_PAYMENT = 'AWAITING_OXXO_PAYMENT',
  PERMIT_READY = 'PERMIT_READY',
  PERMIT_DELIVERED = 'PERMIT_DELIVERED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  RENEWAL_PENDING = 'RENEWAL_PENDING',
  RENEWAL_APPROVED = 'RENEWAL_APPROVED',
  RENEWAL_REJECTED = 'RENEWAL_REJECTED',
  GENERATING_PERMIT = 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT = 'ERROR_GENERATING_PERMIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Payment method types
export enum PaymentMethodType {
  CARD = 'card',
  OXXO = 'oxxo'
}

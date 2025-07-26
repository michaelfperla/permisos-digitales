/**
 * =============================================================================
 * Permisos Digitales - Frontend Constants
 * =============================================================================
 *
 * Central constants export file
 * Re-exports all constants from domain-specific modules
 */

// Import all constant modules
export * from './application.constants';
export * from './payment.constants';

// Legacy compatibility exports (to avoid breaking existing code)
export { ApplicationStatus } from './application.constants';
export { PaymentMethodType } from './payment.constants';
export { PaymentFees } from './payment.constants';

// Re-export specific values for backward compatibility
export const DEFAULT_PERMIT_FEE = 150.0;
export const DEFAULT_CURRENCY = 'MXN';

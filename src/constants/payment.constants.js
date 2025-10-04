/**
 * Payment Constants
 * All payment-related constants and configurations
 */

/**
 * Payment status constants
 */
const PaymentStatus = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  PARTIAL_REFUND: 'PARTIAL_REFUND',
});

/**
 * Payment method types
 */
const PaymentMethod = Object.freeze({
  CARD: 'card',
  OXXO: 'oxxo',
  BANK_TRANSFER: 'bank_transfer',
});

/**
 * Payment provider constants
 */
const PaymentProvider = Object.freeze({
  STRIPE: 'stripe',
  PAYPAL: 'paypal', // Future support
  MERCADO_PAGO: 'mercado_pago', // Future support
});

/**
 * Currency constants
 */
const Currency = Object.freeze({
  MXN: 'MXN',
  USD: 'USD', // Future support
});

/**
 * Payment fee configuration
 */
const PaymentFees = Object.freeze({
  DEFAULT_PERMIT_FEE: 99.00,
  RENEWAL_FEE: 99.00,
  REPLACEMENT_FEE: 75.00,
  LATE_RENEWAL_FEE: 200.00,
  
  // Discount percentages
  EARLY_RENEWAL_DISCOUNT: 0.10, // 10% discount
  BULK_DISCOUNT: 0.15, // 15% discount for multiple permits
});

/**
 * Payment validation rules
 */
const PaymentValidation = Object.freeze({
  MIN_AMOUNT: 1.00,
  MAX_AMOUNT: 10000.00,
  OXXO_MIN_AMOUNT: 10.00,
  OXXO_MAX_AMOUNT: 10000.00,
  CARD_MIN_AMOUNT: 1.00,
  CARD_MAX_AMOUNT: 999999.99,
});

/**
 * Payment timeout configuration (in milliseconds)
 */
const PaymentTimeouts = Object.freeze({
  OXXO_EXPIRATION: 72 * 60 * 60 * 1000, // 72 hours
  CARD_SESSION: 30 * 60 * 1000, // 30 minutes
  WEBHOOK_TIMEOUT: 30 * 1000, // 30 seconds
  PAYMENT_INTENT_EXPIRATION: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * Stripe-specific constants
 */
const StripeConstants = Object.freeze({
  // Event types we handle
  WEBHOOK_EVENTS: {
    PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
    PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
    PAYMENT_INTENT_CANCELLED: 'payment_intent.canceled',
    CHARGE_SUCCEEDED: 'charge.succeeded',
    CHARGE_FAILED: 'charge.failed',
    CHARGE_REFUNDED: 'charge.refunded',
  },
  
  // Error codes
  ERROR_CODES: {
    CARD_DECLINED: 'card_declined',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    EXPIRED_CARD: 'expired_card',
    INCORRECT_CVC: 'incorrect_cvc',
    PROCESSING_ERROR: 'processing_error',
  },
});

/**
 * Helper functions for payments
 */
const PaymentHelpers = {
  isSuccessful: (status) => status === PaymentStatus.SUCCEEDED,
  isPending: (status) => status === PaymentStatus.PENDING || status === PaymentStatus.PROCESSING,
  isFailed: (status) => status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED,
  isRefundable: (status) => status === PaymentStatus.SUCCEEDED,
  
  formatAmount: (amount, currency = Currency.MXN) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },
  
  calculateFee: (applicationType, options = {}) => {
    let baseFee = PaymentFees.DEFAULT_PERMIT_FEE;
    
    switch (applicationType) {
      case 'RENEWAL':
        baseFee = options.isLate ? PaymentFees.LATE_RENEWAL_FEE : PaymentFees.RENEWAL_FEE;
        break;
      case 'REPLACEMENT':
        baseFee = PaymentFees.REPLACEMENT_FEE;
        break;
    }
    
    // Apply discounts
    if (options.earlyRenewal) {
      baseFee *= (1 - PaymentFees.EARLY_RENEWAL_DISCOUNT);
    }
    if (options.bulkPurchase && options.quantity > 1) {
      baseFee *= (1 - PaymentFees.BULK_DISCOUNT);
    }
    
    return baseFee;
  },
};

module.exports = {
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
  Currency,
  PaymentFees,
  PaymentValidation,
  PaymentTimeouts,
  StripeConstants,
  PaymentHelpers,
};
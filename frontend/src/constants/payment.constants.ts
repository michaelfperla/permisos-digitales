/**
 * Payment Constants
 * TypeScript version for frontend
 */

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
}

export enum PaymentMethodType {
  CARD = 'card',
  OXXO = 'oxxo',
  BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal', // Future support
  MERCADO_PAGO = 'mercado_pago', // Future support
}

export enum Currency {
  MXN = 'MXN',
  USD = 'USD', // Future support
}

export const PaymentFees = {
  DEFAULT_PERMIT_FEE: 150.00,
  RENEWAL_FEE: 150.00,
  REPLACEMENT_FEE: 75.00,
  LATE_RENEWAL_FEE: 200.00,
  
  // Discount percentages
  EARLY_RENEWAL_DISCOUNT: 0.10, // 10% discount
  BULK_DISCOUNT: 0.15, // 15% discount for multiple permits
} as const;

export const PaymentValidation = {
  MIN_AMOUNT: 1.00,
  MAX_AMOUNT: 10000.00,
  OXXO_MIN_AMOUNT: 10.00,
  OXXO_MAX_AMOUNT: 10000.00,
  CARD_MIN_AMOUNT: 1.00,
  CARD_MAX_AMOUNT: 999999.99,
} as const;

export const PaymentTimeouts = {
  OXXO_EXPIRATION: 72 * 60 * 60 * 1000, // 72 hours
  CARD_SESSION: 30 * 60 * 1000, // 30 minutes
  WEBHOOK_TIMEOUT: 30 * 1000, // 30 seconds
  PAYMENT_INTENT_EXPIRATION: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Stripe-specific constants
export const StripeConstants = {
  WEBHOOK_EVENTS: {
    PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
    PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
    PAYMENT_INTENT_CANCELLED: 'payment_intent.canceled',
    CHARGE_SUCCEEDED: 'charge.succeeded',
    CHARGE_FAILED: 'charge.failed',
    CHARGE_REFUNDED: 'charge.refunded',
  },
  
  ERROR_CODES: {
    CARD_DECLINED: 'card_declined',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    EXPIRED_CARD: 'expired_card',
    INCORRECT_CVC: 'incorrect_cvc',
    PROCESSING_ERROR: 'processing_error',
  },
} as const;

// Payment method display configuration
export const PaymentMethodDisplay: Record<PaymentMethodType, { label: string; icon: string; description: string }> = {
  [PaymentMethodType.CARD]: {
    label: 'Tarjeta de Crédito/Débito',
    icon: 'credit-card',
    description: 'Pago inmediato con tarjeta',
  },
  [PaymentMethodType.OXXO]: {
    label: 'OXXO',
    icon: 'store',
    description: 'Paga en efectivo en cualquier OXXO',
  },
  [PaymentMethodType.BANK_TRANSFER]: {
    label: 'Transferencia Bancaria',
    icon: 'building',
    description: 'Transferencia desde tu banco',
  },
};

// Helper functions with TypeScript
export const PaymentHelpers = {
  isSuccessful: (status: PaymentStatus): boolean => 
    status === PaymentStatus.SUCCEEDED,
    
  isPending: (status: PaymentStatus): boolean => 
    status === PaymentStatus.PENDING || status === PaymentStatus.PROCESSING,
    
  isFailed: (status: PaymentStatus): boolean => 
    status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED,
    
  isRefundable: (status: PaymentStatus): boolean => 
    status === PaymentStatus.SUCCEEDED,
  
  formatAmount: (amount: number, currency: Currency = Currency.MXN): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },
  
  calculateFee: (
    applicationType: 'NEW' | 'RENEWAL' | 'REPLACEMENT',
    options: {
      isLate?: boolean;
      earlyRenewal?: boolean;
      bulkPurchase?: boolean;
      quantity?: number;
    } = {}
  ): number => {
    let baseFee: number = PaymentFees.DEFAULT_PERMIT_FEE;
    
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
    if (options.bulkPurchase && options.quantity && options.quantity > 1) {
      baseFee *= (1 - PaymentFees.BULK_DISCOUNT);
    }
    
    return Math.round(baseFee * 100) / 100; // Round to 2 decimal places
  },
  
  getOxxoExpirationDate: (createdAt: Date = new Date()): Date => {
    const expirationDate = new Date(createdAt);
    expirationDate.setTime(expirationDate.getTime() + PaymentTimeouts.OXXO_EXPIRATION);
    return expirationDate;
  },
  
  isOxxoVoucherExpired: (createdAt: Date): boolean => {
    const now = new Date();
    const expirationDate = PaymentHelpers.getOxxoExpirationDate(createdAt);
    return now > expirationDate;
  },
} as const;

// Payment error messages
export const PaymentErrorMessages: Record<string, string> = {
  [StripeConstants.ERROR_CODES.CARD_DECLINED]: 'Tu tarjeta fue rechazada. Por favor intenta con otra tarjeta.',
  [StripeConstants.ERROR_CODES.INSUFFICIENT_FUNDS]: 'Fondos insuficientes. Por favor verifica tu saldo.',
  [StripeConstants.ERROR_CODES.EXPIRED_CARD]: 'Tu tarjeta ha expirado. Por favor usa una tarjeta válida.',
  [StripeConstants.ERROR_CODES.INCORRECT_CVC]: 'El código de seguridad es incorrecto. Por favor verifica.',
  [StripeConstants.ERROR_CODES.PROCESSING_ERROR]: 'Error al procesar el pago. Por favor intenta nuevamente.',
  'generic': 'Ocurrió un error al procesar tu pago. Por favor intenta nuevamente.',
};
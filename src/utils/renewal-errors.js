// src/utils/renewal-errors.js
const { logger } = require('./logger');

class RenewalError extends Error {
  constructor(message, code, userMessage) {
    super(message);
    this.name = 'RenewalError';
    this.code = code;
    this.userMessage = userMessage;
    this.isOperational = true;
  }
}

class RenewalValidationError extends RenewalError {
  constructor(field, value, userMessage) {
    super(`Validation failed for field: ${field}`, 'RENEWAL_VALIDATION_ERROR', userMessage);
    this.name = 'RenewalValidationError';
    this.field = field;
    this.value = value;
  }
}

class RenewalPaymentError extends RenewalError {
  constructor(message, stripeError = null, userMessage) {
    super(message, 'RENEWAL_PAYMENT_ERROR', userMessage);
    this.name = 'RenewalPaymentError';
    this.stripeError = stripeError;
  }
}

class RenewalDatabaseError extends RenewalError {
  constructor(message, originalError = null, userMessage) {
    super(message, 'RENEWAL_DATABASE_ERROR', userMessage);
    this.name = 'RenewalDatabaseError';
    this.originalError = originalError;
  }
}

class RenewalRateLimitError extends RenewalError {
  constructor(userMessage) {
    super('Rate limit exceeded for renewal attempts', 'RENEWAL_RATE_LIMIT_ERROR', userMessage);
    this.name = 'RenewalRateLimitError';
  }
}

class RenewalEligibilityError extends RenewalError {
  constructor(reason, userMessage) {
    super(`Renewal not eligible: ${reason}`, 'RENEWAL_ELIGIBILITY_ERROR', userMessage);
    this.name = 'RenewalEligibilityError';
    this.reason = reason;
  }
}

// User-friendly error messages in Spanish
const ERROR_MESSAGES = {
  RATE_LIMIT_EXCEEDED: 'Has alcanzado el límite de intentos de renovación. Por favor, espera 1 hora antes de intentar nuevamente.',
  
  ELIGIBILITY_EXPIRED: 'Tu permiso ha expirado hace más de 30 días y ya no se puede renovar. Debes solicitar un permiso nuevo.',
  
  ELIGIBILITY_TOO_EARLY: 'Aún no puedes renovar tu permiso. Solo se puede renovar 7 días antes del vencimiento.',
  
  ELIGIBILITY_ALREADY_RENEWED: 'Este permiso ya ha sido renovado. Cada permiso solo se puede renovar una vez.',
  
  ELIGIBILITY_INVALID_STATUS: 'Tu permiso actual no está en un estado válido para renovación. Contacta soporte si necesitas ayuda.',
  
  PAYMENT_SESSION_FAILED: 'No pudimos crear la sesión de pago. Por favor, inténtalo nuevamente en unos minutos.',
  
  PAYMENT_PROCESSING_ERROR: 'Ocurrió un error al procesar el pago. Tu tarjeta no fue cobrada. Inténtalo nuevamente.',
  
  DATABASE_CONNECTION_ERROR: 'Tenemos problemas técnicos temporales. Por favor, inténtalo nuevamente en unos minutos.',
  
  DATABASE_TRANSACTION_ERROR: 'No pudimos completar la renovación debido a un error técnico. Inténtalo nuevamente.',
  
  VALIDATION_PHONE_INVALID: 'El número de teléfono no es válido. Debe ser un número mexicano de 10 dígitos.',
  
  VALIDATION_EMAIL_INVALID: 'El correo electrónico no es válido. Revisa el formato (ejemplo: usuario@correo.com).',
  
  VALIDATION_CURP_INVALID: 'La CURP no es válida. Debe tener 18 caracteres (ejemplo: ABCD123456HDFGHI01).',
  
  VALIDATION_GENERAL: 'Algunos datos no son válidos. Por favor, revisa la información e inténtalo nuevamente.',
  
  SYSTEM_UNAVAILABLE: 'El sistema no está disponible temporalmente. Por favor, inténtalo más tarde.',
  
  UNEXPECTED_ERROR: 'Ocurrió un error inesperado. Por favor, inténtalo nuevamente o contacta soporte.'
};

// Helper function to get user-friendly error message
function getUserFriendlyMessage(error) {
  if (error instanceof RenewalError && error.userMessage) {
    return error.userMessage;
  }
  
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  
  // Handle specific error patterns
  if (error.message) {
    if (error.message.includes('rate limit')) {
      return ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
    }
    
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return ERROR_MESSAGES.DATABASE_CONNECTION_ERROR;
    }
    
    if (error.message.includes('stripe') || error.message.includes('payment')) {
      return ERROR_MESSAGES.PAYMENT_PROCESSING_ERROR;
    }
  }
  
  return ERROR_MESSAGES.UNEXPECTED_ERROR;
}

// Helper function to create appropriate error based on context
function createRenewalError(context, originalError, additionalInfo = {}) {
  logger.error(`Renewal error in ${context}:`, {
    error: originalError.message,
    stack: originalError.stack,
    context,
    ...additionalInfo
  });
  
  switch (context) {
    case 'eligibility_check':
      if (originalError.message.includes('expired')) {
        return new RenewalEligibilityError(
          'expired', 
          ERROR_MESSAGES.ELIGIBILITY_EXPIRED
        );
      }
      if (originalError.message.includes('too early')) {
        return new RenewalEligibilityError(
          'too_early', 
          ERROR_MESSAGES.ELIGIBILITY_TOO_EARLY
        );
      }
      if (originalError.message.includes('already renewed')) {
        return new RenewalEligibilityError(
          'already_renewed', 
          ERROR_MESSAGES.ELIGIBILITY_ALREADY_RENEWED
        );
      }
      return new RenewalEligibilityError(
        'invalid_status', 
        ERROR_MESSAGES.ELIGIBILITY_INVALID_STATUS
      );
      
    case 'rate_limit':
      return new RenewalRateLimitError(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
      
    case 'payment_session':
      return new RenewalPaymentError(
        'Failed to create payment session',
        originalError,
        ERROR_MESSAGES.PAYMENT_SESSION_FAILED
      );
      
    case 'database_transaction':
      return new RenewalDatabaseError(
        'Database transaction failed',
        originalError,
        ERROR_MESSAGES.DATABASE_TRANSACTION_ERROR
      );
      
    case 'database_connection':
      return new RenewalDatabaseError(
        'Database connection failed',
        originalError,
        ERROR_MESSAGES.DATABASE_CONNECTION_ERROR
      );
      
    case 'validation':
      const field = additionalInfo.field;
      if (field === 'phone') {
        return new RenewalValidationError(
          field, 
          additionalInfo.value, 
          ERROR_MESSAGES.VALIDATION_PHONE_INVALID
        );
      }
      if (field === 'email') {
        return new RenewalValidationError(
          field, 
          additionalInfo.value, 
          ERROR_MESSAGES.VALIDATION_EMAIL_INVALID
        );
      }
      if (field === 'curp') {
        return new RenewalValidationError(
          field, 
          additionalInfo.value, 
          ERROR_MESSAGES.VALIDATION_CURP_INVALID
        );
      }
      return new RenewalValidationError(
        field, 
        additionalInfo.value, 
        ERROR_MESSAGES.VALIDATION_GENERAL
      );
      
    default:
      return new RenewalError(
        originalError.message,
        'UNEXPECTED_ERROR',
        ERROR_MESSAGES.UNEXPECTED_ERROR
      );
  }
}

// Retry logic for transient failures
async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on user errors or non-transient errors
      if (error instanceof RenewalValidationError || 
          error instanceof RenewalEligibilityError ||
          error instanceof RenewalRateLimitError) {
        throw error;
      }
      
      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, {
        error: error.message,
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

module.exports = {
  RenewalError,
  RenewalValidationError,
  RenewalPaymentError,
  RenewalDatabaseError,
  RenewalRateLimitError,
  RenewalEligibilityError,
  ERROR_MESSAGES,
  getUserFriendlyMessage,
  createRenewalError,
  withRetry
};
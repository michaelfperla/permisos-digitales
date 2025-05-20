/**
 * Conekta Error Mapper
 * Maps Conekta error codes to user-friendly messages in Spanish
 */
const { logger } = require('./enhanced-logger');

/**
 * Map Conekta error codes to user-friendly messages in Spanish
 * @param {Error} error - The error object from Conekta
 * @returns {Object} - Formatted error object with code, message, and details
 */
const mapConektaErrorToUserMessage = (error) => {
  // Default error information
  let errorCode = 'payment_error';
  let errorMessage = 'Ocurrió un error al procesar el pago. Por favor, intenta de nuevo.';
  let errorDetails = [];

  try {
    // Extract error code from different possible locations
    if (error.code) {
      errorCode = error.code;
    } else if (error.details && error.details.length > 0 && error.details[0].code) {
      errorCode = error.details[0].code;
    } else if (error.response && error.response.data && error.response.data.details && 
               error.response.data.details.length > 0 && error.response.data.details[0].code) {
      errorCode = error.response.data.details[0].code;
    } else if (error.httpCode === 402 || error.http_code === 402) {
      errorCode = 'card_declined';
    }

    // Extract error details
    if (error.details && error.details.length > 0) {
      errorDetails = error.details;
    } else if (error.response && error.response.data && error.response.data.details) {
      errorDetails = error.response.data.details;
    }

    // Map error codes to user-friendly messages
    const errorMessages = {
      // Card validation errors
      'card_declined': 'Tu tarjeta fue rechazada. Por favor, verifica los datos o utiliza otra tarjeta.',
      'insufficient_funds': 'Tu tarjeta no tiene fondos suficientes. Por favor, utiliza otra tarjeta.',
      'expired_card': 'Tu tarjeta ha expirado. Por favor, utiliza otra tarjeta.',
      'invalid_cvc': 'El código de seguridad (CVC) es inválido. Por favor, verifica e intenta de nuevo.',
      'invalid_number': 'El número de tarjeta es inválido. Por favor, verifica e intenta de nuevo.',
      'invalid_expiry_date': 'La fecha de expiración es inválida. Por favor, verifica e intenta de nuevo.',
      'invalid_card': 'Los datos de la tarjeta son inválidos. Por favor, verifica e intenta de nuevo.',
      'processor_declined': 'El banco rechazó la transacción. Por favor, contacta a tu banco o utiliza otra tarjeta.',
      'suspected_fraud': 'La transacción fue rechazada por sospecha de fraude. Por favor, contacta a tu banco.',
      'card_declined_by_anti_fraud': 'La transacción fue rechazada por nuestro sistema de seguridad. Por favor, contacta a soporte.',
      
      // Customer errors
      'invalid_email': 'El correo electrónico proporcionado no es válido. Por favor, verifica e intenta de nuevo.',
      'invalid_phone': 'El número de teléfono proporcionado no es válido. Por favor, verifica e intenta de nuevo.',
      'customer_not_found': 'No se encontró el cliente. Por favor, intenta de nuevo o contacta a soporte.',
      
      // Processing errors
      'processing_error': 'Ocurrió un error al procesar el pago. Por favor, intenta de nuevo más tarde.',
      'duplicate_transaction': 'Esta transacción parece ser un duplicado de una transacción reciente.',
      'resource_not_found': 'No se encontró el recurso solicitado. Por favor, contacta a soporte.',
      'resource_already_exists': 'El recurso ya existe. Por favor, intenta con otro.',
      
      // API errors
      'parameter_validation_error': 'Uno o más parámetros son inválidos. Por favor, verifica e intenta de nuevo.',
      'authentication_error': 'Error de autenticación. Por favor, contacta a soporte.',
      'invalid_api_key': 'La clave API es inválida. Por favor, contacta a soporte.',
      'rate_limit_exceeded': 'Se ha excedido el límite de solicitudes. Por favor, intenta de nuevo más tarde.',
      
      // OXXO specific errors
      'cash_payment_expired': 'El pago en OXXO ha expirado. Por favor, genera una nueva referencia.',
      'invalid_reference': 'La referencia de pago es inválida. Por favor, genera una nueva referencia.',
      
      // Generic errors
      'server_error': 'Error en el servidor de pagos. Por favor, intenta de nuevo más tarde.',
      'timeout_error': 'La operación ha tardado demasiado tiempo. Por favor, intenta de nuevo.',
      'connection_error': 'Error de conexión con el servidor de pagos. Por favor, verifica tu conexión e intenta de nuevo.',
      'unknown_error': 'Error desconocido. Por favor, contacta a soporte.'
    };

    // Get the user-friendly message based on the error code
    if (errorMessages[errorCode]) {
      errorMessage = errorMessages[errorCode];
    } else if (error.message) {
      // Use the original error message if available and no mapping exists
      errorMessage = error.message;
      
      // Check for common error message patterns and map them
      if (error.message.includes('card was declined') || 
          error.message.includes('tarjeta fue declinada') || 
          error.message.includes('The card was declined')) {
        errorCode = 'card_declined';
        errorMessage = errorMessages.card_declined;
      } else if (error.message.includes('expired')) {
        errorCode = 'expired_card';
        errorMessage = errorMessages.expired_card;
      } else if (error.message.includes('insufficient funds')) {
        errorCode = 'insufficient_funds';
        errorMessage = errorMessages.insufficient_funds;
      } else if (error.message.includes('invalid card')) {
        errorCode = 'invalid_card';
        errorMessage = errorMessages.invalid_card;
      } else if (error.message.includes('invalid number')) {
        errorCode = 'invalid_number';
        errorMessage = errorMessages.invalid_number;
      } else if (error.message.includes('invalid cvc')) {
        errorCode = 'invalid_cvc';
        errorMessage = errorMessages.invalid_cvc;
      }
    }

    // Log the error mapping for debugging
    logger.debug('Mapped Conekta error:', {
      originalError: {
        message: error.message,
        code: error.code,
        httpCode: error.httpCode || error.http_code
      },
      mappedError: {
        code: errorCode,
        message: errorMessage
      }
    });

    // Return the formatted error
    return {
      code: errorCode,
      message: errorMessage,
      details: errorDetails,
      originalError: error.message
    };
  } catch (mappingError) {
    // If there's an error during mapping, log it and return a generic error
    logger.error('Error mapping Conekta error:', mappingError);
    return {
      code: 'error_mapping_failed',
      message: 'Ocurrió un error al procesar el pago. Por favor, intenta de nuevo.',
      details: [],
      originalError: error.message
    };
  }
};

module.exports = {
  mapConektaErrorToUserMessage
};

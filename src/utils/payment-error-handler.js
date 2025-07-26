// src/utils/payment-error-handler.js
const { logger } = require('./logger');
const ApiResponse = require('./api-response');

/**
 * Enhanced error handling specifically for payment operations
 */
class PaymentErrorHandler {
  /**
   * Handle Stripe-specific errors with user-friendly messages
   */
  static handleStripeError(error, req, res) {
    const errorInfo = {
      type: error.type,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      userId: req.user?.id,
      applicationId: req.params?.applicationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log the error with context
    logger.error('Stripe payment error:', errorInfo);

    // Map Stripe errors to user-friendly Spanish messages
    const userMessage = this.mapStripeErrorToUserMessage(error);
    
    // Determine HTTP status code
    const statusCode = this.getStatusCodeForStripeError(error);

    // Send alert for critical errors
    if (this.isCriticalStripeError(error)) {
      this.sendCriticalErrorAlert(errorInfo);
    }

    return ApiResponse.error(res, userMessage, statusCode);
  }

  /**
   * Handle payment processing errors
   */
  static handlePaymentProcessingError(error, req, res, context = {}) {
    const errorInfo = {
      error: error.message,
      stack: error.stack,
      context,
      userId: req.user?.id,
      applicationId: req.params?.applicationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    logger.error('Payment processing error:', errorInfo);

    // Check if it's a known recoverable error
    if (this.isRecoverableError(error)) {
      return ApiResponse.error(res, 
        'Error temporal en el procesamiento del pago. Por favor, intente nuevamente.',
        500
      );
    }

    // Generic payment error
    return ApiResponse.error(res, 
      'Error al procesar el pago. Por favor, contacte soporte si el problema persiste.',
      500
    );
  }

  /**
   * Handle webhook processing errors
   */
  static handleWebhookError(error, req, eventId = null) {
    const errorInfo = {
      error: error.message,
      stack: error.stack,
      eventId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      webhookSignature: !!req.headers['stripe-signature']
    };

    logger.error('Webhook processing error:', errorInfo);

    // Send alert for webhook failures
    this.sendWebhookErrorAlert(errorInfo);

    return {
      success: false,
      error: error.message,
      eventId
    };
  }

  /**
   * Map Stripe error codes to user-friendly Spanish messages
   */
  static mapStripeErrorToUserMessage(error) {
    const errorMessages = {
      // Card errors
      'card_declined': 'Su tarjeta fue rechazada. Por favor, verifique los datos o intente con otra tarjeta.',
      'insufficient_funds': 'Fondos insuficientes en su tarjeta. Por favor, intente con otra tarjeta.',
      'expired_card': 'Su tarjeta ha expirado. Por favor, verifique la fecha de vencimiento.',
      'incorrect_cvc': 'El código de seguridad (CVC) es incorrecto. Por favor, verifíquelo.',
      'invalid_number': 'El número de tarjeta es inválido. Por favor, verifíquelo.',
      'invalid_expiry_month': 'El mes de vencimiento es inválido.',
      'invalid_expiry_year': 'El año de vencimiento es inválido.',
      'processing_error': 'Error al procesar el pago. Por favor, intente nuevamente.',
      'generic_decline': 'Su tarjeta fue rechazada. Por favor, contacte a su banco.',

      // API errors
      'api_connection_error': 'Error de conexión con el sistema de pagos. Por favor, intente más tarde.',
      'api_error': 'Error del sistema de pagos. Por favor, intente más tarde.',
      'authentication_error': 'Error de autenticación en el sistema de pagos.',
      'rate_limit_error': 'Demasiadas solicitudes. Por favor, espere un momento e intente nuevamente.',

      // Other errors
      'invalid_request_error': 'Error en la solicitud de pago. Por favor, verifique los datos.',
      'idempotency_error': 'Solicitud duplicada detectada. Por favor, espere antes de intentar nuevamente.',
      'invalid_request': 'Solicitud de pago inválida.',
      'customer_not_found': 'Cliente no encontrado en el sistema de pagos.',
      'payment_intent_not_found': 'Intención de pago no encontrada.',

      // OXXO specific
      'oxxo_payment_expired': 'El pago OXXO ha expirado. Por favor, genere una nueva referencia.',
      'oxxo_payment_invalid': 'Referencia OXXO inválida.',

    };

    return errorMessages[error.code] || 
           errorMessages[error.type] || 
           'Error al procesar el pago. Por favor, intente nuevamente o contacte soporte.';
  }

  /**
   * Get appropriate HTTP status code for Stripe error
   */
  static getStatusCodeForStripeError(error) {
    const statusCodes = {
      'card_declined': 402,
      'insufficient_funds': 402,
      'expired_card': 402,
      'incorrect_cvc': 400,
      'invalid_number': 400,
      'invalid_expiry_month': 400,
      'invalid_expiry_year': 400,
      'processing_error': 502,
      'api_connection_error': 503,
      'api_error': 502,
      'authentication_error': 401,
      'rate_limit_error': 429,
      'invalid_request_error': 400,
      'idempotency_error': 409
    };

    return statusCodes[error.code] || statusCodes[error.type] || 500;
  }

  /**
   * Determine if a Stripe error is critical and needs immediate attention
   */
  static isCriticalStripeError(error) {
    const criticalErrors = [
      'authentication_error',
      'api_error',
      'api_connection_error'
    ];

    return criticalErrors.includes(error.code) || criticalErrors.includes(error.type);
  }

  /**
   * Check if an error is recoverable (temporary issue)
   */
  static isRecoverableError(error) {
    const recoverablePatterns = [
      /connection/i,
      /timeout/i,
      /temporary/i,
      /rate.*limit/i,
      /service.*unavailable/i,
      /try.*again/i
    ];

    const errorMessage = error.message || '';
    return recoverablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Send alert for critical payment errors
   */
  static async sendCriticalErrorAlert(errorInfo) {
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Critical Payment System Error',
        message: `Critical Stripe error: ${errorInfo.code || errorInfo.type}`,
        severity: 'CRITICAL',
        details: errorInfo
      });
    } catch (alertError) {
      logger.error('Failed to send critical error alert:', alertError);
    }
  }

  /**
   * Send alert for webhook errors
   */
  static async sendWebhookErrorAlert(errorInfo) {
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Webhook Processing Error',
        message: `Failed to process webhook: ${errorInfo.eventId || 'unknown'}`,
        severity: 'HIGH',
        details: errorInfo
      });
    } catch (alertError) {
      logger.error('Failed to send webhook error alert:', alertError);
    }
  }

  /**
   * Create structured error response for payment failures
   */
  static createPaymentErrorResponse(error, context = {}) {
    return {
      success: false,
      error: {
        type: 'payment_error',
        code: error.code || 'unknown',
        message: this.mapStripeErrorToUserMessage(error),
        timestamp: new Date().toISOString(),
        requestId: error.requestId || null,
        context
      }
    };
  }

  /**
   * Log payment success with context
   */
  static logPaymentSuccess(req, paymentResult, context = {}) {
    logger.info('Payment processed successfully:', {
      paymentIntentId: paymentResult.paymentIntentId,
      orderId: paymentResult.orderId,
      amount: paymentResult.amount,
      currency: paymentResult.currency || 'MXN',
      paymentMethod: paymentResult.paymentMethod,
      userId: req.user?.id,
      applicationId: req.params?.applicationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      context
    });
  }
}

module.exports = PaymentErrorHandler;
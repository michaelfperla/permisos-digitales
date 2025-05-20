// src/controllers/oxxo-payment.controller.js
const { logger } = require('../utils/enhanced-logger');
const paymentService = require('../services/payment.service');
const { ApplicationStatus } = require('../constants');

/**
 * Controller for handling OXXO payments
 */
class OxxoPaymentController {
  /**
   * Create an OXXO payment reference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createOxxoPayment(req, res) {
    try {
      const { customerId, amount, description, referenceId } = req.body;

      // Validate required fields
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'El ID del cliente es requerido'
        });
      }

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'El monto es requerido'
        });
      }

      if (!referenceId) {
        return res.status(400).json({
          success: false,
          message: 'El ID de referencia es requerido'
        });
      }

      // Generate a unique idempotency key
      const idempotencyKey = `oxxo-${referenceId}-${Date.now()}`;

      // Process OXXO payment
      const paymentResult = await paymentService.processOxxoPayment({
        customerId,
        amount,
        currency: 'MXN',
        description: description || 'Permiso de Circulación',
        referenceId,
        idempotencyKey
      }, {
        expirationDays: 2 // OXXO reference expires in 2 days
      });

      // Check if payment was successful
      if (!paymentResult.success) {
        logger.error('Error creating OXXO payment:', paymentResult);
        return res.status(400).json({
          success: false,
          message: paymentResult.failureMessage || 'Error al generar referencia para pago en OXXO'
        });
      }

      // Log payment event with safe data
      try {
        const paymentRepository = require('../repositories/payment.repository');

        // Ensure we have a valid order ID
        const safeOrderId = paymentResult.orderId ||
                           `oxxo-order-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        // Extract application ID from referenceId (e.g., APP-123 -> 123)
        const applicationId = referenceId.replace('APP-', '');

        // Log the payment event
        await paymentRepository.logPaymentEvent({
          applicationId: applicationId,
          orderId: safeOrderId,
          eventType: 'oxxo.payment.created',
          eventData: {
            status: paymentResult.status || 'pending_payment',
            paymentMethod: 'oxxo_cash',
            amount: paymentResult.amount || 197.00,
            currency: paymentResult.currency || 'MXN',
            oxxoReference: paymentResult.oxxoReference || 'PENDING',
            expiresAt: paymentResult.expiresAt || Math.floor(Date.now() / 1000) + (48 * 60 * 60),
            timestamp: new Date().toISOString()
          }
        });

        logger.info(`Logged OXXO payment event for application ${applicationId} with order ID ${safeOrderId}`);
      } catch (logError) {
        // Don't fail the request if logging fails
        logger.error('Error logging OXXO payment event:', logError);
      }

      // Update application status to AWAITING_OXXO_PAYMENT
      try {
        // Extract application ID from referenceId (e.g., APP-123 -> 123)
        const applicationId = referenceId.replace('APP-', '');

        // Update application status and store OXXO reference
        const paymentRepository = require('../repositories/payment.repository');
        await paymentRepository.updatePaymentOrder(
          applicationId,
          paymentResult.orderId,
          ApplicationStatus.AWAITING_OXXO_PAYMENT,
          { oxxoReference: paymentResult.oxxoReference }
        );

        logger.info(`Updated application ${applicationId} status to AWAITING_OXXO_PAYMENT`);
      } catch (updateError) {
        // Don't fail the request if status update fails
        logger.error('Error updating application status:', updateError);
      }

      // Return success response with standardized OXXO payment details
      // Use a flat structure without nested data.data to ensure consistency
      return res.status(200).json({
        success: true,
        message: 'Referencia OXXO generada exitosamente',
        orderId: paymentResult.orderId,
        status: paymentResult.status || 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: paymentResult.oxxoReference,
        expiresAt: paymentResult.expiresAt,
        barcodeUrl: paymentResult.barcodeUrl,
        amount: paymentResult.amount,
        currency: paymentResult.currency || 'MXN',
        expiresAtFormatted: new Date(paymentResult.expiresAt * 1000).toLocaleString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    } catch (error) {
      // Enhanced error logging with more context
      logger.error('Error in createOxxoPayment controller:', {
        error: error.message,
        stack: error.stack,
        context: {
          customerId: req.body.customerId,
          referenceId: req.body.referenceId,
          amount: req.body.amount
        },
        conektaErrorCode: error.details?.code || error.code || 'unknown'
      });

      // Return a generic user-friendly error message
      // Don't expose sensitive Conekta error details to the client
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la solicitud de pago OXXO. Por favor intente de nuevo más tarde.'
      });
    }
  }

  /**
   * Get OXXO payment receipt
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getOxxoReceipt(req, res) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la orden es requerido'
        });
      }

      // Get payment status from Conekta
      const paymentStatus = await paymentService.checkPaymentStatus(orderId);

      // Check if it's an OXXO payment
      if (paymentStatus.paymentMethod !== 'oxxo_cash') {
        return res.status(400).json({
          success: false,
          message: 'La orden no corresponde a un pago OXXO'
        });
      }

      // Extract OXXO payment details
      const oxxoDetails = {
        reference: paymentStatus.paymentDetails.reference,
        barcodeUrl: paymentStatus.paymentDetails.barcodeUrl,
        amount: paymentStatus.amount,
        currency: paymentStatus.currency,
        expiresAt: paymentStatus.paymentDetails.expiresAt,
        expiresAtFormatted: new Date(paymentStatus.paymentDetails.expiresAt * 1000).toLocaleString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // Render the OXXO receipt template
      return res.render('oxxo-receipt', {
        title: 'Ficha de Pago OXXO',
        oxxo: oxxoDetails
      });
    } catch (error) {
      // Enhanced error logging with more context
      logger.error('Error in getOxxoReceipt controller:', {
        error: error.message,
        stack: error.stack,
        context: {
          orderId: req.params.orderId
        },
        conektaErrorCode: error.details?.code || error.code || 'unknown'
      });

      // Return a generic user-friendly error message
      return res.status(500).json({
        success: false,
        message: 'Error al obtener la ficha de pago OXXO. Por favor intente de nuevo más tarde.'
      });
    }
  }
}

module.exports = new OxxoPaymentController();

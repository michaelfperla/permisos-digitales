// src/routes/payment-callback.js
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/enhanced-logger');
const conektaConfig = require('../config/conekta');
const { ApplicationStatus } = require('../constants');
const paymentRepository = require('../repositories/payment.repository');

/**
 * Payment callback route for handling 3DS redirects
 * This endpoint is called by Conekta after 3DS authentication
 */
router.get('/callback', async (req, res) => {
  try {
    const { payment_status, order_id, state } = req.query;

    logger.info('Received 3DS callback:', {
      payment_status,
      order_id,
      statePresent: !!state,
      query: req.query
    });

    if (!order_id) {
      logger.error('Missing order_id in 3DS callback');
      return res.redirect('/payment/error?message=missing_order_id');
    }

    // Get the order details from Conekta
    const conekta = conektaConfig.getInstance();
    let order;

    try {
      order = await conekta.getOrder(order_id);
    } catch (orderError) {
      logger.error('Error fetching order from Conekta:', {
        error: orderError.message,
        order_id
      });
      return res.redirect('/payment/error?message=order_fetch_error');
    }

    if (!order) {
      logger.error('Order not found in 3DS callback:', { order_id });
      return res.redirect('/payment/error?message=order_not_found');
    }

    logger.info('Order details from 3DS callback:', {
      order_id: order.id,
      payment_status: order.payment_status,
      amount: order.amount / 100,
      metadata: order.metadata || {}
    });

    // Extract application ID from order metadata
    const applicationId = order.metadata && order.metadata.application_id
      ? order.metadata.application_id
      : null;

    // Find the application by order ID if application_id is not in metadata
    let application;
    if (!applicationId) {
      try {
        application = await paymentRepository.findByOrderId(order_id);
        if (!application) {
          logger.error('Application not found for order ID:', { order_id });
          return res.redirect('/payment/error?message=application_not_found');
        }
      } catch (findError) {
        logger.error('Error finding application by order ID:', {
          error: findError.message,
          order_id
        });
        return res.redirect('/payment/error?message=application_lookup_error');
      }
    } else {
      // If we have the application ID from metadata, verify it exists
      try {
        // Use a generic method to get application by ID
        // This is a placeholder - you may need to implement this method
        application = await paymentRepository.findById(applicationId);
        if (!application) {
          logger.error('Application not found by ID from metadata:', { applicationId });
          return res.redirect('/payment/error?message=application_not_found');
        }
      } catch (findError) {
        logger.error('Error finding application by ID from metadata:', {
          error: findError.message,
          applicationId
        });
        return res.redirect('/payment/error?message=application_lookup_error');
      }
    }

    // Validate state parameter if present
    if (state) {
      try {
        const storedState = await paymentRepository.getPaymentState(application.id);

        if (!storedState) {
          logger.warn('No stored state found for application:', {
            applicationId: application.id,
            receivedState: state.substring(0, 8) // Log only prefix for security
          });
          // Continue processing but log the warning
        } else if (state !== storedState) {
          logger.error('Invalid state parameter in 3DS callback:', {
            applicationId: application.id,
            receivedStatePrefix: state.substring(0, 8),
            storedStatePrefix: storedState.substring(0, 8)
          });
          return res.redirect(`/payment/error?message=invalid_state&id=${application.id}`);
        } else {
          // State is valid, invalidate it to prevent reuse
          await paymentRepository.invalidatePaymentState(application.id, state);
          logger.debug('State parameter validated and invalidated:', {
            applicationId: application.id
          });
        }
      } catch (stateError) {
        logger.error('Error validating state parameter:', {
          error: stateError.message,
          applicationId: application.id
        });
        // Continue processing but log the error
      }
    } else {
      logger.warn('No state parameter in 3DS callback:', {
        applicationId: application.id,
        order_id
      });
      // Continue processing but log the warning
    }

    // Determine the application status based on the payment status
    let applicationStatus = ApplicationStatus.PENDING_PAYMENT;

    if (payment_status === 'paid' || order.payment_status === 'paid') {
      applicationStatus = ApplicationStatus.PAYMENT_RECEIVED;
    } else if (payment_status === 'declined' || order.payment_status === 'declined') {
      applicationStatus = ApplicationStatus.PAYMENT_DECLINED;
    }

    // Update the application status in the database
    try {
      await paymentRepository.updatePaymentStatus(
        application.id,
        applicationStatus,
        {
          payment_status: payment_status || order.payment_status,
          order_id: order_id,
          updated_via: '3ds_callback'
        }
      );

      logger.info(`Updated application ${application.id} status to ${applicationStatus}`);

      // Log the payment event
      await paymentRepository.logPaymentEvent({
        applicationId: application.id,
        orderId: order_id,
        eventType: '3ds.callback',
        eventData: {
          payment_status: payment_status || order.payment_status,
          order_status: order.payment_status,
          callback_timestamp: new Date().toISOString()
        }
      });

      logger.debug('Logged 3DS callback payment event');
    } catch (updateError) {
      logger.error('Error updating application status:', {
        error: updateError.message,
        applicationId: application.id,
        status: applicationStatus
      });
      // Continue to redirect even if update fails
    }

    // Redirect to the appropriate page based on the payment status
    if (applicationStatus === ApplicationStatus.PAYMENT_RECEIVED) {
      return res.redirect(`/payment/success?id=${application.id}`);
    } else {
      // Include specific error message based on payment status
      let errorMessage = 'payment_declined';
      if (order.payment_status === 'declined') {
        errorMessage = 'card_declined';
      } else if (order.payment_status === 'expired') {
        errorMessage = 'payment_expired';
      } else if (order.payment_status === 'canceled') {
        errorMessage = 'payment_canceled';
      }

      return res.redirect(`/payment/error?id=${application.id}&message=${errorMessage}`);
    }
  } catch (error) {
    // Enhanced error logging with more context
    logger.error('Error processing 3DS callback:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    // Determine error type for better user feedback
    let errorMessage = 'processing_error';
    if (error.message.includes('not found')) {
      errorMessage = 'resource_not_found';
    } else if (error.message.includes('authentication')) {
      errorMessage = 'authentication_failed';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'request_timeout';
    }

    return res.redirect(`/payment/error?message=${errorMessage}`);
  }
});

/**
 * Payment success page
 */
router.get('/success', (req, res) => {
  res.render('payment-success', {
    title: 'Pago Exitoso',
    message: 'Tu pago ha sido procesado exitosamente.'
  });
});

/**
 * Payment failure page
 */
router.get('/failure', (req, res) => {
  res.render('payment-failure', {
    title: 'Pago Fallido',
    message: 'Lo sentimos, tu pago no pudo ser procesado. Por favor, intenta nuevamente.'
  });
});

module.exports = router;

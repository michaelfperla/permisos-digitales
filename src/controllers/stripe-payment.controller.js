// src/controllers/stripe-payment.controller.js
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');
const StripePaymentService = require('../services/stripe-payment.service');
const ApiResponse = require('../utils/api-response');
const { handleControllerError } = require('../utils/error-helpers');

const DEFAULT_PERMIT_FEE = 150; // $150 MXN

// Initialize the Stripe payment service
const stripePaymentService = new StripePaymentService();

/**
 * Create payment order for Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createPaymentOrder = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;

    // Get application repository from middleware
    const applicationRepository = req.applicationRepository;
    const userRepository = req.userRepository;

    // Fetch the application
    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Solicitud no encontrada.' });
    }

    // Verify ownership
    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    const user = await userRepository.findById(userId);
    const customerData = {
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone || ''
    };

    const customer = await stripePaymentService.createCustomer(customerData);

    const paymentData = {
      applicationId: application.id,
      customerId: customer.id,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`
    };

    ApiResponse.success(res, null, {
      applicationId: application.id,
      customerId: customer.id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      description: paymentData.description,
      referenceId: paymentData.referenceId
    });
  } catch (error) {
    logger.error('Error creating payment order:', error);
    ApiResponse.serverError(res, null, {
      message: 'Error al crear la orden de pago'
    });
  }
};

/**
 * Process card payment with Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const processCardPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, paymentMethodId, device_session_id } = req.body;
    const userId = req.user.id;

    // Get repositories from middleware
    const applicationRepository = req.applicationRepository;
    const paymentRepository = req.paymentRepository;

    // Fetch the application
    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Solicitud no encontrada.' });
    }

    // Verify ownership
    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      applicationId: application.id,
      paymentMethodId: paymentMethodId,
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await stripePaymentService.createChargeWithToken(paymentData);

    if (paymentResult.success) {
      await paymentRepository.updatePaymentOrder(
        application.id,
        paymentResult.paymentIntentId,
        paymentResult.paymentStatus
      );
    } else {
      return ApiResponse.badRequest(res, null, {
        success: false,
        message: paymentResult.failureMessage || 'Error al procesar el pago'
      });
    }

    ApiResponse.success(res, null, {
      success: paymentResult.success,
      paymentIntentId: paymentResult.paymentIntentId,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod,
      clientSecret: paymentResult.clientSecret
    });
  } catch (error) {
    logger.error('Error processing card payment:', error);
    ApiResponse.serverError(res, null, {
      message: 'Error al procesar el pago con tarjeta'
    });
  }
};

/**
 * Process OXXO payment with Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const processOxxoPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, device_session_id } = req.body;
    const userId = req.user.id;

    // Get repositories from middleware
    const applicationRepository = req.applicationRepository;
    const paymentRepository = req.paymentRepository;

    // Fetch the application
    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Solicitud no encontrada.' });
    }

    // Verify ownership
    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    // Process OXXO payment
    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      applicationId: application.id,
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await stripePaymentService.processOxxoPayment(paymentData);

    await paymentRepository.updatePaymentOrder(
      application.id,
      paymentResult.paymentIntentId,
      paymentResult.paymentStatus
    );

    ApiResponse.success(res, null, {
      success: paymentResult.success,
      paymentIntentId: paymentResult.paymentIntentId,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod,
      clientSecret: paymentResult.clientSecret,
      oxxoReference: paymentResult.oxxoReference,
      expiresAt: paymentResult.expiresAt
    });
  } catch (error) {
    logger.error('Error processing OXXO payment:', error);
    ApiResponse.serverError(res, null, {
      message: 'Error al procesar el pago OXXO'
    });
  }
};

/**
 * Process SPEI bank transfer payment with Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const processSpeiPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, device_session_id } = req.body;
    const userId = req.user.id;

    // Get repositories from middleware
    const applicationRepository = req.applicationRepository;
    const paymentRepository = req.paymentRepository;

    // Fetch the application
    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Solicitud no encontrada.' });
    }

    // Verify ownership
    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      applicationId: application.id,
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await stripePaymentService.processBankTransferPayment(paymentData);

    await paymentRepository.updatePaymentOrder(
      application.id,
      paymentResult.paymentIntentId,
      paymentResult.paymentStatus
    );

    ApiResponse.success(res, null, {
      success: paymentResult.success,
      paymentIntentId: paymentResult.paymentIntentId,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod,
      clientSecret: paymentResult.clientSecret,
      speiReference: paymentResult.speiReference,
      expiresAt: paymentResult.expiresAt
    });
  } catch (error) {
    logger.error('Error processing SPEI payment:', error);
    ApiResponse.serverError(res, null, {
      message: 'Error al procesar el pago SPEI'
    });
  }
};

/**
 * Check payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;

    // Get repositories from middleware
    const applicationRepository = req.applicationRepository;
    const paymentRepository = req.paymentRepository;

    // Fetch the application
    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Solicitud no encontrada.' });
    }

    // Verify ownership
    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    // Get payment information
    const paymentInfo = await paymentRepository.getPaymentByApplicationId(applicationId);

    ApiResponse.success(res, null, {
      applicationId: application.id,
      status: application.status,
      paymentStatus: paymentInfo?.status || 'pending',
      paymentMethod: paymentInfo?.payment_method || null,
      orderId: paymentInfo?.order_id || null,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN'
    });
  } catch (error) {
    logger.error('Error checking payment status:', error);
    ApiResponse.serverError(res, null, {
      message: 'Error al verificar el estado del pago'
    });
  }
};

/**
 * Handle Stripe webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const handleWebhook = async (req, res) => {
  try {
    const config = require('../config');
    const stripe = require('stripe')(config.stripePrivateKey);

    // Get the signature from the header
    const sig = req.headers['stripe-signature'];
    const webhookSecret = config.stripeWebhookSecret;

    if (!webhookSecret) {
      logger.error('Stripe webhook secret is not configured');
      return ApiResponse.serverError(res, null, {
        message: 'Webhook secret not configured'
      });
    }

    let event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed:', err.message);
      return ApiResponse.badRequest(res, null, {
        message: 'Invalid signature'
      });
    }

    logger.info(`Received Stripe webhook: ${event.type}`);

    // Immediately acknowledge receipt of the webhook with 200 OK
    ApiResponse.success(res, null, {
      received: true,
      event_type: event.type,
      event_id: event.id
    });

    // Process the webhook event asynchronously
    setImmediate(async () => {
      try {
        await processWebhookEvent(event);
      } catch (processingError) {
        logger.error(`Error during asynchronous processing of webhook event ${event.type}:`, {
          error: processingError,
          eventId: event.id
        });
      }
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    // Still return 200 OK to prevent Stripe from retrying
    ApiResponse.success(res, null, { received: true, error: error.message });
  }
};

/**
 * Process Stripe webhook event
 * @param {Object} event - Stripe webhook event
 * @returns {Promise<void>}
 */
const processWebhookEvent = async (event) => {
  const { ApplicationStatus } = require('../constants');
  const PaymentRepository = require('../repositories/payment.repository');
  const ApplicationRepository = require('../repositories/application.repository');

  const paymentRepository = new PaymentRepository();
  const applicationRepository = new ApplicationRepository();

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object, paymentRepository, applicationRepository);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object, paymentRepository, applicationRepository);
      break;
    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event.data.object, paymentRepository, applicationRepository);
      break;
    case 'payment_intent.requires_action':
      await handlePaymentIntentRequiresAction(event.data.object, paymentRepository, applicationRepository);
      break;
    default:
      logger.info(`Unhandled webhook event type: ${event.type}`);
  }
};

/**
 * Handle successful payment intent
 */
const handlePaymentIntentSucceeded = async (paymentIntent, paymentRepository, applicationRepository) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;

    if (applicationId) {
      // Update payment status to PAYMENT_RECEIVED (this updates both payment and application status)
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_RECEIVED
      );

      // Also update application status to PAYMENT_RECEIVED (required for Puppeteer)
      await applicationRepository.update(applicationId, { status: ApplicationStatus.PAYMENT_RECEIVED });

      logger.info(`Payment confirmed for application ${applicationId}, payment intent ${paymentIntent.id}`);

      // Trigger Puppeteer PDF generation asynchronously
      setImmediate(async () => {
        try {
          const puppeteerService = require('../services/puppeteer.service');
          logger.info(`Starting Puppeteer job for application ${applicationId} after Stripe payment success...`);
          await puppeteerService.generatePermit(applicationId);
          logger.info(`Puppeteer job completed for application ${applicationId}`);
        } catch (puppeteerError) {
          logger.error(`Error triggering Puppeteer job for application ${applicationId}:`, puppeteerError);
        }
      });
    }
  } catch (error) {
    logger.error('Error handling payment_intent.succeeded:', error);
  }
};

/**
 * Handle failed payment intent
 */
const handlePaymentIntentFailed = async (paymentIntent, paymentRepository, applicationRepository) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;

    if (applicationId) {
      // Update payment status
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_FAILED
      );

      // Update application status
      await applicationRepository.update(applicationId, { status: ApplicationStatus.PAYMENT_FAILED });

      logger.info(`Payment failed for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.payment_failed:', error);
  }
};

/**
 * Handle canceled payment intent
 */
const handlePaymentIntentCanceled = async (paymentIntent, paymentRepository, applicationRepository) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;

    if (applicationId) {
      // Update payment status
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_FAILED
      );

      logger.info(`Payment canceled for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.canceled:', error);
  }
};

/**
 * Handle payment intent that requires action
 */
const handlePaymentIntentRequiresAction = async (paymentIntent, paymentRepository, applicationRepository) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;

    if (applicationId) {
      // Update payment status to processing
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_PROCESSING
      );

      logger.info(`Payment requires action for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.requires_action:', error);
  }
};

module.exports = {
  createPaymentOrder,
  processCardPayment,
  processOxxoPayment,
  processSpeiPayment,
  checkPaymentStatus,
  handleWebhook
};

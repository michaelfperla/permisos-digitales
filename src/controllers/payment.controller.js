const { logger } = require('../utils/enhanced-logger');
const { handleControllerError } = require('../utils/error-helpers');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants/index');
const { paymentRepository, applicationRepository } = require('../repositories');
const { paymentService } = require('../services');
const ApiResponse = require('../utils/api-response');
const config = require('../config');

const createPaymentOrder = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.session.userId;

    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'You do not have permission to access this application' });
    }

    if (application.status !== ApplicationStatus.PENDING_PAYMENT) {
      return ApiResponse.badRequest(res, null, {
        message: 'Application is not in a valid state for payment',
        currentStatus: application.status
      });
    }

    const user = await req.userRepository.findById(userId);
    const customerData = {
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone || ''
    };

    const customer = await paymentService.createCustomer(customerData);

    const paymentData = {
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
    handleControllerError(error, req, res, 'Error creating payment order');
  }
};

const processCardPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { token, customerId, device_session_id } = req.body;
    const userId = req.session.userId;

    if (!token || !customerId) {
      return ApiResponse.badRequest(res, null, { message: 'Missing required fields: token, customerId' });
    }

    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'You do not have permission to access this application' });
    }

    const user = await req.userRepository.findById(userId);

    const paymentData = {
      token,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone || '',
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await paymentService.createChargeWithToken(paymentData);

    if (paymentResult.success) {
      await paymentRepository.updatePaymentOrder(
        application.id,
        paymentResult.orderId,
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
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod
    });
  } catch (error) {
    handleControllerError(error, req, res, 'Error processing card payment');
  }
};

const processBankTransferPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId } = req.body;
    const userId = req.session.userId;

    if (!customerId) {
      return ApiResponse.badRequest(res, null, { message: 'Missing required field: customerId' });
    }

    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'You do not have permission to access this application' });
    }

    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`
    };

    const paymentResult = await paymentService.processBankTransferPayment(paymentData);

    await paymentRepository.updatePaymentOrder(
      application.id,
      paymentResult.orderId,
      paymentResult.paymentStatus
    );

    ApiResponse.success(res, null, {
      success: paymentResult.success,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod,
      speiReference: paymentResult.speiReference,
      expiresAt: paymentResult.expiresAt
    });
  } catch (error) {
    handleControllerError(error, req, res, 'Error processing bank transfer payment');
  }
};

/**
 * Process an OXXO cash payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const processOxxoPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, device_session_id } = req.body;
    const userId = req.session.userId;

    // Validate required fields
    if (!customerId) {
      return ApiResponse.badRequest(res, null, { message: 'Missing required field: customerId' });
    }

    // Validate application exists and belongs to user
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'You do not have permission to access this application' });
    }

    // Process OXXO payment
    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await paymentService.processOxxoPayment(paymentData);

    // If payment reference was successfully created, update application with OXXO reference
    if (paymentResult.success) {
      await paymentRepository.updatePaymentOrder(
        application.id,
        paymentResult.orderId,
        paymentResult.paymentStatus,
        { oxxoReference: paymentResult.oxxoReference }
      );

      // Log payment event with safe data
      await paymentRepository.logPaymentEvent({
        applicationId: application.id,
        orderId: paymentResult.orderId,
        eventType: 'oxxo.payment.created',
        eventData: {
          status: paymentResult.status || 'pending_payment',
          paymentMethod: 'oxxo_cash',
          amount: paymentResult.amount || 197.00,
          currency: paymentResult.currency || 'MXN',
          oxxoReference: paymentResult.oxxoReference,
          expiresAt: paymentResult.expiresAt,
          timestamp: new Date().toISOString()
        }
      });

      // Return payment result with OXXO reference
      ApiResponse.success(res, null, {
        success: paymentResult.success,
        orderId: paymentResult.orderId,
        status: paymentResult.status,
        paymentMethod: paymentResult.paymentMethod,
        oxxoReference: paymentResult.oxxoReference,
        expiresAt: paymentResult.expiresAt,
        barcodeUrl: paymentResult.barcodeUrl
      });
    } else {
      // If payment reference creation failed, return error response
      return ApiResponse.badRequest(res, null, {
        success: false,
        message: paymentResult.failureMessage || 'Error al generar referencia OXXO'
      });
    }
  } catch (error) {
    handleControllerError(error, req, res, 'Error processing OXXO payment');
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
    const userId = req.session.userId;

    // Validate application exists and belongs to user
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'You do not have permission to access this application' });
    }

    // Check if application has a payment order
    if (!application.payment_processor_order_id) {
      return ApiResponse.badRequest(res, null, { message: 'No payment order found for this application' });
    }

    // Check payment status
    const paymentStatus = await paymentService.checkPaymentStatus(application.payment_processor_order_id);

    // Update application status if needed
    if (paymentStatus.applicationStatus !== application.status) {
      await paymentRepository.updatePaymentStatus(
        application.id,
        paymentStatus.applicationStatus
      );
    }

    // Return payment status
    ApiResponse.success(res, null, paymentStatus);
  } catch (error) {
    handleControllerError(error, req, res, 'Error checking payment status');
  }
};

/**
 * Handle Conekta webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const handleWebhook = async (req, res) => {
  try {
    // 1. Validate the Conekta-Signature header
    const signature = req.headers['conekta-signature'];

    if (!signature) {
      logger.warn('Missing Conekta-Signature header in webhook request');
      return ApiResponse.badRequest(res, null, {
        message: 'Missing Conekta-Signature header'
      });
    }

    // Check if the signature format looks valid
    // Conekta signatures should contain 't=' (timestamp) and 'v1=' (signature) components
    if (!signature.includes('t=') || !signature.includes('v1=')) {
      logger.warn(`Invalid Conekta-Signature format: ${signature}`);
      return ApiResponse.badRequest(res, null, {
        message: 'Invalid Conekta-Signature format'
      });
    }

    // 2. Validate the webhook secret from config
    const webhookSecret = config.conektaWebhookSecret;

    // Check if the webhook secret exists and is not empty
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim() === '') {
      logger.error('Conekta webhook secret is not properly configured');
      return ApiResponse.serverError(res, null, {
        message: 'Webhook secret not properly configured'
      });
    }

    // Check if the webhook secret has a reasonable length (at least 10 characters)
    if (webhookSecret.length < 10) {
      logger.error('Conekta webhook secret appears to be too short or invalid');
      return ApiResponse.serverError(res, null, {
        message: 'Webhook secret configuration is invalid'
      });
    }

    // Get the raw body as a string
    const rawBody = req.body.toString('utf8');

    // 3. Extract and validate the timestamp from the signature
    const signatureParts = signature.split(',');
    const timestampComponent = signatureParts.find(part => part.trim().startsWith('t='));

    if (!timestampComponent) {
      logger.warn('Could not find timestamp component in Conekta-Signature');
      return ApiResponse.badRequest(res, null, {
        message: 'Invalid signature format: missing timestamp component'
      });
    }

    const timestamp = parseInt(timestampComponent.split('=')[1], 10);

    // Validate the timestamp is a valid number
    if (isNaN(timestamp)) {
      logger.warn(`Invalid timestamp in Conekta-Signature: ${timestampComponent}`);
      return ApiResponse.badRequest(res, null, {
        message: 'Invalid signature format: timestamp is not a valid number'
      });
    }

    // Check if the timestamp is within an acceptable range (5 minutes)
    // This prevents replay attacks where an attacker captures a valid webhook and replays it later
    const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000; // 5 minutes in milliseconds
    const currentTime = Date.now();
    const timestampTime = timestamp * 1000; // Convert to milliseconds

    if (Math.abs(currentTime - timestampTime) > MAX_TIMESTAMP_DIFF) {
      logger.warn('Webhook timestamp is too old or from the future', {
        webhookTimestamp: new Date(timestampTime).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
        diffSeconds: Math.abs(currentTime - timestampTime) / 1000
      });

      return ApiResponse.badRequest(res, null, {
        message: 'Invalid webhook: timestamp is too old or from the future'
      });
    }

    // 4. Verify the webhook signature
    // Note: Conekta's Node.js SDK doesn't have a built-in method for webhook verification
    // So we need to implement it manually using the signature and secret
    let isSignatureValid = false;

    try {
      // Conekta uses HMAC-SHA256 for signature verification
      const crypto = require('crypto');

      // Calculate the expected signature
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('hex');

      // Extract the actual signature value (v1=...)
      const signatureComponent = signatureParts.find(part => part.trim().startsWith('v1='));

      if (!signatureComponent) {
        logger.warn('Could not find v1 component in Conekta-Signature');
        return ApiResponse.badRequest(res, null, {
          message: 'Invalid signature format: missing v1 component'
        });
      }

      const receivedSignature = signatureComponent.split('=')[1];

      // Validate that the received signature is a valid hex string
      if (!/^[0-9a-f]+$/i.test(receivedSignature)) {
        logger.warn(`Received signature is not a valid hex string: ${receivedSignature}`);
        return ApiResponse.badRequest(res, null, {
          message: 'Invalid signature format: not a valid hex string'
        });
      }

      // Ensure both signatures have the same length before comparison
      if (expectedSignature.length !== receivedSignature.length) {
        logger.warn('Signature length mismatch');
        return ApiResponse.badRequest(res, null, {
          message: 'Invalid signature: length mismatch'
        });
      }

      // Use timing-safe comparison to prevent timing attacks
      isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (verificationError) {
      logger.error('Error verifying webhook signature:', verificationError);
      return ApiResponse.badRequest(res, null, {
        message: 'Signature verification error'
      });
    }

    if (!isSignatureValid) {
      logger.warn('Invalid Conekta webhook signature');
      return ApiResponse.badRequest(res, null, {
        message: 'Invalid webhook signature'
      });
    }

    // 5. Parse the JSON body and check for duplicate events
    const event = JSON.parse(rawBody);

    // Check if this event has a unique ID
    if (!event.id) {
      logger.warn('Webhook event is missing ID', { eventType: event.type });
      // Continue processing as this is not critical
    } else {
      logger.debug('Processing webhook event with ID:', event.id);
    }

    logger.info(`Received verified Conekta webhook: ${event.type}`);

    // 6. Immediately acknowledge receipt of the webhook with 200 OK
    // This ensures Conekta gets a quick response regardless of how long processing takes
    ApiResponse.success(res, null, {
      received: true,
      event_type: event.type,
      event_id: event.id || 'unknown'
    });

    // 7. Process the event asynchronously after sending the response
    // This ensures the webhook handler returns quickly even if event processing takes time
    setImmediate(async () => {
      try {
        logger.info(`Processing webhook event ${event.type} asynchronously`, {
          eventId: event.id || 'unknown',
          timestamp: new Date(timestampTime).toISOString()
        });

        // Check for duplicate events before processing
        // If no event ID, process anyway (shouldn't happen with Conekta)
        if (!event.id) {
          logger.warn('Webhook event is missing ID', { eventType: event.type });
          // Continue processing as this is not critical
        } else {
          // Try to record this event - returns false if it's a duplicate
          const isNewEvent = await paymentRepository.tryRecordEvent(event.id, event.type);

          // Skip processing if it's a duplicate event
          if (!isNewEvent) {
            logger.info(`Skipping duplicate webhook event: ${event.id} (${event.type})`);
            return; // Exit early, no further processing needed
          }
        }

        // Process different event types
        switch (event.type) {
        case 'order.paid':
          await handleOrderPaid(event.data);
          break;
        case 'order.expired':
          await handleOrderExpired(event.data);
          break;
        case 'order.canceled':
          await handleOrderCanceled(event.data);
          break;
        case 'charge.created':
          await handleChargeCreated(event.data);
          break;
        case 'charge.paid':
          await handleChargePaid(event.data);
          break;
        case 'charge.failed':
          await handleChargeFailed(event.data);
          break;
        default:
          logger.debug(`Unhandled webhook event type: ${event.type}`);
        }

        logger.info(`Completed asynchronous processing of webhook event ${event.type}`, {
          eventId: event.id || 'unknown'
        });
      } catch (processingError) {
        logger.error(`Error during asynchronous processing of webhook event ${event.type}:`, {
          error: processingError,
          eventId: event.id || 'unknown'
        });
      }
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    // Still return 200 OK to prevent Conekta from retrying
    // This is important because we don't want Conekta to keep retrying if there's an error in our processing
    ApiResponse.success(res, null, { received: true, error: error.message });
  }
};

/**
 * Process a successful payment
 * @param {string} orderId - Conekta order ID
 * @param {string} eventType - Event type (e.g., 'order.paid', 'charge.paid')
 * @param {Object} data - Event data
 * @param {string|null} paymentMethod - Payment method type (if available)
 * @returns {Promise<void>}
 * @private
 */
const _processSuccessfulPayment = async (orderId, eventType, data, paymentMethod = null) => {
  // Find application by order ID
  const application = await paymentRepository.findByOrderId(orderId);
  if (!application) {
    logger.warn(`No application found for order ID: ${orderId}`);
    return;
  }

  // Update application status to PAYMENT_RECEIVED regardless of previous status
  await paymentRepository.updatePaymentStatus(
    application.id,
    ApplicationStatus.PAYMENT_RECEIVED
  );

  // Log payment event
  await paymentRepository.logPaymentEvent({
    applicationId: application.id,
    orderId,
    eventType,
    eventData: data
  });

  logger.info(`Payment received for application ${application.id}, order ${orderId}`);

  // Check if this was an OXXO payment (either by status or payment method)
  const isOxxoPayment =
    application.status === ApplicationStatus.AWAITING_OXXO_PAYMENT ||
    paymentMethod === 'oxxo_cash';

  // If this was an OXXO payment, trigger permit generation
  if (isOxxoPayment) {
    logger.info(`OXXO payment completed for application ${application.id}, scheduling permit generation`);

    // Trigger Puppeteer Asynchronously using setImmediate to ensure it runs after the current event loop
    // This ensures the webhook response is sent before the potentially long-running Puppeteer job starts
    setImmediate(async () => {
      try {
        // Lazy-load the puppeteer service to avoid potential circular dependencies
        const puppeteerService = require('../services/puppeteer.service');

        // Log the start of the permit generation process
        logger.info(`Starting Puppeteer job for application ${application.id}...`);

        // Execute the permit generation process
        await puppeteerService.generatePermit(application.id);

        // Log successful completion
        logger.info(`Puppeteer job completed successfully for application ${application.id}`);
      } catch (puppeteerError) {
        // Log any errors that occur during the permit generation process
        logger.error(`Error during Puppeteer job for application ${application.id}:`, puppeteerError);

        // Note: We intentionally don't rethrow the error since this is running asynchronously
        // and there's no caller waiting for the result
      }
    });
  }
};

/**
 * Handle order.paid event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleOrderPaid = async (data) => {
  try {
    const orderId = data.object.id;
    await _processSuccessfulPayment(orderId, 'order.paid', data);
  } catch (error) {
    // Enhanced error logging with more context for OXXO payments
    logger.error(`Error handling order.paid event for order ${data.object.id}:`, {
      error: error.message,
      stack: error.stack,
      context: {
        orderId: data.object.id,
        eventType: 'order.paid',
        paymentMethod: data.object.charges?.data?.[0]?.payment_method?.type || 'unknown'
      }
    });
  }
};

/**
 * Handle order.expired event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleOrderExpired = async (data) => {
  try {
    const orderId = data.object.id;

    // Find application by order ID
    const application = await paymentRepository.findByOrderId(orderId);
    if (!application) {
      logger.warn(`No application found for order ID: ${orderId}`);
      return;
    }

    // Determine the new status based on the current status
    let newStatus = ApplicationStatus.PENDING_PAYMENT;

    // If this was an OXXO payment that expired, set status to PENDING_PAYMENT
    if (application.status === ApplicationStatus.AWAITING_OXXO_PAYMENT) {
      newStatus = ApplicationStatus.PENDING_PAYMENT;
      logger.info(`OXXO payment expired for application ${application.id}, setting status to PENDING_PAYMENT`);
    }

    // Update application status
    await paymentRepository.updatePaymentStatus(
      application.id,
      newStatus
    );

    // Log payment event
    await paymentRepository.logPaymentEvent({
      applicationId: application.id,
      orderId,
      eventType: 'order.expired',
      eventData: data
    });

    logger.info(`Payment expired for application ${application.id}, order ${orderId}`);
  } catch (error) {
    // Enhanced error logging with more context for OXXO payment expiration
    logger.error(`Error handling order.expired event for order ${data.object.id}:`, {
      error: error.message,
      stack: error.stack,
      context: {
        orderId: data.object.id,
        eventType: 'order.expired',
        paymentMethod: data.object.charges?.data?.[0]?.payment_method?.type || 'unknown'
      }
    });
  }
};

/**
 * Handle order.canceled event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleOrderCanceled = async (data) => {
  try {
    const orderId = data.object.id;

    // Find application by order ID
    const application = await paymentRepository.findByOrderId(orderId);
    if (!application) {
      logger.warn(`No application found for order ID: ${orderId}`);
      return;
    }

    // Update application status
    await paymentRepository.updatePaymentStatus(
      application.id,
      ApplicationStatus.PENDING_PAYMENT
    );

    // Log payment event
    await paymentRepository.logPaymentEvent({
      applicationId: application.id,
      orderId,
      eventType: 'order.canceled',
      eventData: data
    });

    logger.info(`Payment canceled for application ${application.id}, order ${orderId}`);
  } catch (error) {
    logger.error(`Error handling order.canceled event for order ${data.object.id}:`, error);
  }
};

/**
 * Handle charge.created event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleChargeCreated = async (data) => {
  try {
    const orderId = data.object.order_id;

    // Find application by order ID
    const application = await paymentRepository.findByOrderId(orderId);
    if (!application) {
      logger.warn(`No application found for order ID: ${orderId}`);
      return;
    }

    // Log payment event
    await paymentRepository.logPaymentEvent({
      applicationId: application.id,
      orderId,
      eventType: 'charge.created',
      eventData: data
    });

    logger.info(`Charge created for application ${application.id}, order ${orderId}`);
  } catch (error) {
    logger.error(`Error handling charge.created event for order ${data.object.order_id}:`, error);
  }
};

/**
 * Handle charge.paid event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleChargePaid = async (data) => {
  try {
    const orderId = data.object.order_id;
    const paymentMethod = data.object.payment_method?.type;
    await _processSuccessfulPayment(orderId, 'charge.paid', data, paymentMethod);
  } catch (error) {
    // Enhanced error logging with more context for OXXO payments
    logger.error(`Error handling charge.paid event for order ${data.object.order_id}:`, {
      error: error.message,
      stack: error.stack,
      context: {
        orderId: data.object.order_id,
        chargeId: data.object.id,
        eventType: 'charge.paid',
        paymentMethod: data.object.payment_method?.type || 'unknown'
      }
    });
  }
};

/**
 * Handle charge.failed event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
const handleChargeFailed = async (data) => {
  try {
    const orderId = data.object.order_id;

    // Find application by order ID
    const application = await paymentRepository.findByOrderId(orderId);
    if (!application) {
      logger.warn(`No application found for order ID: ${orderId}`);
      return;
    }

    // Log payment event
    await paymentRepository.logPaymentEvent({
      applicationId: application.id,
      orderId,
      eventType: 'charge.failed',
      eventData: data
    });

    logger.info(`Charge failed for application ${application.id}, order ${orderId}`);
  } catch (error) {
    logger.error(`Error handling charge.failed event for order ${data.object.order_id}:`, error);
  }
};

module.exports = {
  createPaymentOrder,
  processCardPayment,
  processBankTransferPayment,
  processOxxoPayment,
  checkPaymentStatus,
  handleWebhook,
  // Export webhook event handlers for internal use
  handleOrderPaid,
  handleOrderExpired,
  handleOrderCanceled,
  handleChargeCreated,
  handleChargePaid,
  handleChargeFailed,
  // Export private helper for testing purposes
  _processSuccessfulPayment
};

// src/controllers/stripe-payment.controller.js
const { logger } = require('../utils/logger');
const { ApplicationStatus } = require('../constants');
const ApiResponse = require('../utils/api-response');
const PaymentErrorHandler = require('../utils/payment-error-handler');
const { validateApplicationId, validateUserId } = require('../utils/validation-helpers');
const { applicationRepository, paymentRepository, userRepository } = require('../repositories');
const webhookRetryService = require('../services/webhook-retry.service');
const metricsCollector = require('../monitoring/metrics-collector');

const DEFAULT_PERMIT_FEE = 150;

const stripePaymentService = require('../services/stripe-payment.service');
const paymentRecoveryService = require('../services/payment-recovery.service');
const alertService = require('../services/alert.service');
// Import service container singleton
const { getService } = require('../core/service-container-singleton');
const whatsappNotificationService = require('../services/whatsapp-notification.service');

// Helper to get PDF queue service
const getPdfQueueService = () => {
  try {
    // Try service container first
    const service = getService('pdfQueue');
    if (service) {
      return service;
    }
  } catch (error) {
    logger.warn('Service container not available for pdfQueue, using factory directly:', error.message);
  }
  
  try {
    // Fallback to PDF queue factory
    const pdfQueueFactory = require('../services/pdf-queue-factory.service');
    return pdfQueueFactory.getInstance();
  } catch (error) {
    logger.error('PDF Queue service not available:', error.message);
    return null; // Allow payment to proceed without PDF generation
  }
};

const createPaymentOrder = async (req, res) => {
  try {
    // Validate application ID
    const appIdValidation = validateApplicationId(req.params.applicationId);
    if (!appIdValidation.isValid) {
      return ApiResponse.badRequest(res, {
        message: 'ID de aplicación inválido',
        error: appIdValidation.error
      });
    }

    // Validate user session (consistent with other controllers)
    const userIdValidation = validateUserId(req.session?.userId);
    if (!userIdValidation.isValid) {
      return ApiResponse.unauthorized(res, 'Contexto de usuario inválido');
    }

    const applicationId = appIdValidation.value;
    const userId = userIdValidation.value;

    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
    }

    // Validate application is in correct status for payment
    if (application.status !== ApplicationStatus.AWAITING_PAYMENT) {
      return ApiResponse.badRequest(res, {
        message: 'La solicitud no está en un estado válido para el pago.',
        currentStatus: application.status
      });
    }

    const user = await userRepository.findById(userId);
    const customerData = {
      name: `${user.first_name} ${user.last_name}`,
      email: user.account_email || user.email || null, // Handle both field names, allow null
      phone: user.whatsapp_phone || user.phone || ''
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

    // Set payment initiated timestamp and extend expiration without changing status
    // Status should remain AWAITING_PAYMENT until actual payment processing begins
    await applicationRepository.update(applicationId, {
      payment_initiated_at: new Date(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // Extend to 48 hours for payment processing
    });
    
    logger.info('Payment order created successfully', {
      applicationId: application.id,
      userId,
      amount: paymentData.amount,
      vehicleInfo: `${application.marca} ${application.linea} ${application.ano_modelo}`,
      businessImpact: 'revenue_opportunity',
      paymentFlow: 'stripe_card'
    });

    ApiResponse.success(res, {
      applicationId: application.id,
      customerId: customer.id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      description: paymentData.description,
      referenceId: paymentData.referenceId
    });
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'createPaymentOrder',
      applicationId: req.params.applicationId,
      businessImpact: 'revenue_loss',
      userExperience: 'critical',
      errorCode: 'PAYMENT_ORDER_FAILED'
    });
  }
};

const processCardPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, paymentMethodId, device_session_id } = req.body;
    const userId = req.user.id;

    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
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
      return ApiResponse.badRequest(res, {
        success: false,
        message: paymentResult.failureMessage || 'Error al procesar el pago'
      });
    }

    // Log successful payment
    PaymentErrorHandler.logPaymentSuccess(req, paymentResult, {
      operation: 'processCardPayment'
    });

    ApiResponse.success(res, {
      success: paymentResult.success,
      paymentIntentId: paymentResult.paymentIntentId,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod,
      clientSecret: paymentResult.clientSecret
    });
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'processCardPayment',
      applicationId: req.params.applicationId,
      paymentMethod: 'card'
    });
  }
};

const processOxxoPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId, device_session_id } = req.body;
    const userId = req.user.id;

    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
    }

    const paymentData = {
      customerId,
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${application.marca} ${application.linea} ${application.ano_modelo}`,
      referenceId: `APP-${application.id}`,
      applicationId: application.id,
      device_session_id: device_session_id || undefined,
      email: req.user.email,
      name: application.nombre_completo || req.user.first_name || 'Cliente OXXO',
      userId: userId
    };

    const paymentResult = await stripePaymentService.processOxxoPayment(paymentData);

    // Use atomic transaction for all database operations
    const { withTransaction } = require('../utils/db-transaction');
    await withTransaction(async (client) => {
      // Update payment order with OXXO status and set payment initiated timestamp
      await paymentRepository.updatePaymentOrder(
        application.id,
        paymentResult.paymentIntentId,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        null,
        client
      );

      // Update application with payment initiation timestamp and OXXO expiration (48 hours)
      await applicationRepository.update(application.id, {
        payment_initiated_at: new Date(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours for OXXO payment
      }, client);

      // Store OXXO payment details in payment_events table
      if (paymentResult.success && paymentResult.oxxoReference) {
        await paymentRepository.createPaymentEvent(
          application.id,
          'oxxo.payment.created',
          {
            oxxoReference: paymentResult.oxxoReference,
            hostedVoucherUrl: paymentResult.hostedVoucherUrl,
            expiresAt: paymentResult.expiresAt,
            amount: paymentResult.amount,
            paymentIntentId: paymentResult.paymentIntentId,
            timestamp: new Date().toISOString()
          },
          paymentResult.paymentIntentId,
          client
        );
      }
    });

    // Log successful OXXO payment creation
    PaymentErrorHandler.logPaymentSuccess(req, paymentResult, {
      operation: 'processOxxoPayment',
      paymentMethod: 'oxxo'
    });

    return ApiResponse.success(res, {
        success: paymentResult.success,
        paymentIntentId: paymentResult.paymentIntentId,
        orderId: paymentResult.orderId,
        status: paymentResult.status,
        paymentMethod: paymentResult.paymentMethod,
        clientSecret: paymentResult.clientSecret,
        oxxoReference: paymentResult.oxxoReference,
        expiresAt: paymentResult.expiresAt,
        amount: paymentResult.amount,
        hostedVoucherUrl: paymentResult.hostedVoucherUrl,
        barcodeUrl: paymentResult.barcodeUrl || paymentResult.hostedVoucherUrl // Include barcodeUrl
    });
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'processOxxoPayment',
      applicationId: req.params.applicationId,
      paymentMethod: 'oxxo'
    });
  }
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { applicationId, paymentIntentId } = req.params;
    const userId = req.user.id;

    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
    }

    const paymentInfo = await paymentRepository.getPaymentByApplicationId(applicationId);

    let stripePaymentDetails = null;
    if (paymentIntentId) {
      try {
        stripePaymentDetails = await stripePaymentService.retrievePaymentIntent(paymentIntentId);
      } catch (error) {
        logger.warn(`Could not retrieve Stripe payment intent ${paymentIntentId}:`, error.message);
      }
    }

    ApiResponse.success(res, {
      applicationId: application.id,
      status: application.status,
      applicationStatus: application.status, // Add this field that frontend expects
      paymentStatus: paymentInfo?.status || 'pending',
      paymentMethod: paymentInfo?.payment_method || null,
      orderId: paymentInfo?.order_id || null,
      paymentId: paymentInfo?.order_id || null, // Add this field too
      amount: application.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      stripeStatus: stripePaymentDetails?.status || null,
      lastError: stripePaymentDetails?.last_payment_error?.message || null,
      success: true,
      createdAt: application.created_at,
      updatedAt: application.updated_at
    });
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'checkPaymentStatus',
      applicationId: req.params.applicationId
    });
  }
};

const handleWebhook = async (req, res) => {
  let event; // Declare event in function scope
  try {
    logger.info('[WEBHOOK] Received webhook request', {
      hasBody: !!req.body,
      bodyType: typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      bodyLength: req.body ? req.body.length : 0,
      hasSignature: !!req.headers['stripe-signature'],
      contentType: req.headers['content-type']
    });

    // 1. Verify webhook signature - req.body should be a Buffer from express.raw()
    const payload = req.body;
    logger.info('[WEBHOOK] Using payload for verification', {
      payloadType: typeof payload,
      payloadIsBuffer: Buffer.isBuffer(payload),
      payloadLength: payload ? payload.length : 0
    });
    event = stripePaymentService.constructWebhookEvent(payload, req.headers['stripe-signature']);
    
    // Parse the body for our use
    if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString());
      } catch (e) {
        logger.error('Failed to parse webhook body:', e);
      }
    }
    
    logger.info(`[WEBHOOK] Event verified: ${event.type}`, { 
      eventId: event.id,
      eventType: event.type,
      hasData: !!event.data,
      dataObject: event.data?.object?.id
    });

    // 2. Check if webhook already processed (idempotency)
    const existingEvent = await paymentRepository.findWebhookEvent(event.id);
    if (existingEvent) {
      logger.info(`Webhook ${event.id} already processed, skipping`, {
        eventId: event.id,
        eventType: event.type,
        processedAt: existingEvent.processed_at
      });
      return ApiResponse.success(res, { received: true, processed: false, reason: 'already_processed' });
    }

    // 3. Record webhook event BEFORE processing
    await paymentRepository.createWebhookEvent(event.id, event.type, event);

    // 4. Respond immediately to Stripe (webhook must respond within 20 seconds)
    ApiResponse.success(res, { received: true });

    // 5. Process webhook asynchronously
    setImmediate(async () => {
      const { withTransaction } = require('../utils/db-transaction');
      
      logger.info(`[WEBHOOK] Starting async processing for ${event.type}`, {
        eventId: event.id
      });
      
      try {
        // Process webhook within transaction
        await withTransaction(async (client) => {
          logger.info(`[WEBHOOK] Processing event within transaction`, {
            eventId: event.id,
            eventType: event.type
          });
          
          await processWebhookEvent(event, client);
          
          // Mark as successfully processed within same transaction
          await paymentRepository.updateWebhookEventStatus(event.id, 'processed', null, client);
        });
        
        logger.info(`[WEBHOOK] Successfully processed ${event.type}`, {
          eventId: event.id,
          eventType: event.type
        });
      } catch (processingError) {
        // Mark as failed (outside transaction since main processing failed)
        try {
          await paymentRepository.updateWebhookEventStatus(event.id, 'failed', processingError.message);
        } catch (updateError) {
          logger.error('Failed to update webhook status to failed:', updateError);
        }
        
        logger.error(`Error during asynchronous processing of webhook event ${event.type}:`, {
          error: processingError.message,
          stack: processingError.stack,
          eventId: event.id
        });

        // Schedule retry for failed webhook
        try {
          // Get retry count from database
          const webhookEvent = await paymentRepository.findWebhookEvent(event.id);
          const retryCount = webhookEvent?.retry_count || 0;
          
          // Schedule retry with the webhook retry service
          webhookRetryService.scheduleRetry(
            event.id,
            retryCount,
            async (eventData, client) => {
              await processWebhookEvent(eventData, client);
            },
            event
          );
          
          logger.info(`Scheduled retry for webhook ${event.id} (attempt ${retryCount + 1})`);
        } catch (retryError) {
          logger.error('Failed to schedule webhook retry:', retryError);
          
          // Send alert for permanently failed webhook
          try {
            await alertService.sendAlert({
              title: 'Webhook Processing Failed - No Retry Possible',
              message: `Failed to process webhook ${event.type} and could not schedule retry`,
              severity: 'CRITICAL',
              details: {
                eventId: event.id,
                eventType: event.type,
                error: processingError.message,
                retryError: retryError.message
              }
            });
          } catch (alertError) {
            logger.error('Failed to send webhook failure alert:', alertError);
          }
        }
      }
    });
  } catch (error) {
    // Handle webhook errors with the specialized handler
    // Note: event may not be defined if webhook signature verification failed
    const eventId = typeof event !== 'undefined' ? event?.id : undefined;
    const errorResult = PaymentErrorHandler.handleWebhookError(error, req, eventId);
    
    // For webhooks, we still need to return a response to Stripe
    // Return 400 for signature errors, 200 for processing errors (to prevent retries)
    if (error.message && (error.message.includes('signature') || error.message.includes('STRIPE_WEBHOOK_SECRET'))) {
      return ApiResponse.badRequest(res, 'Invalid webhook signature');
    }
    
    // Return 200 to acknowledge receipt even if processing failed
    // This prevents Stripe from retrying the webhook unnecessarily
    return ApiResponse.success(res, { received: true, error: errorResult.error });
  }
};

const processWebhookEvent = async (event, client = null) => {
  logger.info(`[WEBHOOK] processWebhookEvent called for ${event.type}`);
  
  switch (event.type) {
    case 'payment_intent.created':
      logger.info('[WEBHOOK] Payment intent created, tracking for monitoring');
      await handlePaymentIntentCreated(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_intent.succeeded':
      logger.info('[WEBHOOK] Handling payment_intent.succeeded');
      await handlePaymentIntentSucceeded(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_intent.requires_action':
      await handlePaymentIntentRequiresAction(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_intent.requires_capture':
      logger.info('[WEBHOOK] Handling payment_intent.requires_capture');
      await handlePaymentIntentRequiresCapture(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'charge.succeeded':
      logger.info('[WEBHOOK] Handling charge.succeeded');
      await handleChargeSucceeded(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'charge.failed':
      logger.info('[WEBHOOK] Handling charge.failed');
      await handleChargeFailed(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'charge.updated':
      logger.info('[WEBHOOK] Handling charge.updated (OXXO confirmations)');
      await handleChargeUpdated(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'checkout.session.completed':
      logger.info('[WEBHOOK] Handling checkout.session.completed');
      await handleCheckoutSessionCompleted(event.data.object, paymentRepository, applicationRepository, client);
      break;
    case 'payment_method.attached':
      logger.info('[WEBHOOK] Payment method attached to customer');
      await handlePaymentMethodAttached(event.data.object, paymentRepository, client);
      break;
    case 'payment_method.detached':
      logger.info('[WEBHOOK] Payment method detached from customer');
      await handlePaymentMethodDetached(event.data.object, paymentRepository, client);
      break;
    default:
      logger.info(`Unhandled webhook event type: ${event.type}`);
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    logger.info('[WEBHOOK] Handling payment_intent.succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    });
    
    const applicationIdString = paymentIntent.metadata?.application_id;
    const applicationId = applicationIdString ? parseInt(applicationIdString, 10) : null;
    
    if (!applicationId || isNaN(applicationId)) {
      logger.error('[WEBHOOK] No valid application_id in payment metadata', {
        metadata: paymentIntent.metadata,
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    logger.info('[WEBHOOK] Processing payment for application', { 
      applicationId,
      paymentIntentId: paymentIntent.id 
    });
    
    // Get queue service instance BEFORE processing
    let pdfQueueService;
    try {
      pdfQueueService = getPdfQueueService();
      logger.info('[WEBHOOK] PDF queue service loaded successfully');
    } catch (queueInitError) {
      logger.error('[WEBHOOK] CRITICAL: Failed to initialize queue service', {
        error: queueInitError.message,
        stack: queueInitError.stack
      });
      throw new Error('Queue service initialization failed - cannot process payment');
    }
    
    try {
      // IDEMPOTENCY CHECK: First get application without lock to check status
      const checkQuery = 'SELECT id, status, payment_processor_order_id FROM permit_applications WHERE id = $1';
      const { rows: checkRows } = await client.query(checkQuery, [applicationId]);
      const currentApp = checkRows[0];
      
      if (!currentApp) {
        logger.error('[WEBHOOK] Application not found', { applicationId });
        return;
      }
      
      // Check if already processed
      if (currentApp.status === ApplicationStatus.PAYMENT_RECEIVED || 
          currentApp.status === ApplicationStatus.GENERATING_PERMIT ||
          currentApp.status === ApplicationStatus.PERMIT_GENERATED ||
          currentApp.status === ApplicationStatus.PERMIT_READY) {
        logger.info('[WEBHOOK] Payment already processed, skipping', {
          applicationId,
          currentStatus: currentApp.status,
          paymentIntentId: paymentIntent.id
        });
        return; // Idempotent - already processed
      }
      
      // Validate state transition
      if (currentApp.status !== ApplicationStatus.AWAITING_PAYMENT && 
          currentApp.status !== ApplicationStatus.AWAITING_OXXO_PAYMENT) {
        logger.error('[WEBHOOK] Invalid state transition', {
          applicationId,
          currentStatus: currentApp.status,
          expectedStatus: ApplicationStatus.AWAITING_PAYMENT
        });
        throw new Error(`Invalid state transition from ${currentApp.status} to PAYMENT_RECEIVED`);
      }
      
      // Now lock the row for update
      const lockQuery = 'SELECT id FROM permit_applications WHERE id = $1 FOR UPDATE NOWAIT';
      try {
        await client.query(lockQuery, [applicationId]);
      } catch (lockError) {
        if (lockError.code === '55P03') {
          logger.warn('[WEBHOOK] Application locked by another transaction, will retry', { applicationId });
          throw new Error('Application is currently being processed');
        }
        throw lockError;
      }
      
      // Step 1: Update application status FIRST (within transaction)
      logger.info('[WEBHOOK] Step 1: Updating application status to PAYMENT_RECEIVED');
      await applicationRepository.update(
        applicationId, 
        { 
          status: ApplicationStatus.PAYMENT_RECEIVED,
          payment_processor_order_id: paymentIntent.id
        }, 
        client
      );
      
      // Step 2: Update payment order status
      logger.info('[WEBHOOK] Step 2: Updating payment order status');
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_RECEIVED,
        null,
        client
      );
      
      // Step 3: Create payment event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment.succeeded',
        {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method?.type || 'unknown',
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
      
      // Track metrics
      const paymentMethod = paymentIntent.payment_method?.type || 'card';
      const amountInPesos = paymentIntent.amount / 100;
      metricsCollector.recordPaymentAttempt(paymentMethod, true, amountInPesos);
      
    } catch (error) {
      logger.error('[WEBHOOK] Failed to update payment status', {
        applicationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
    
    // ARCHITECTURAL FIX: Defer PDF generation to avoid webhook timeout
    // The webhook has already updated the payment status to PAYMENT_RECEIVED
    // PDF generation will be handled by a separate process/worker
    logger.info('[WEBHOOK] Payment status updated successfully. PDF generation will be handled asynchronously.', {
      applicationId,
      paymentIntentId: paymentIntent.id,
      newStatus: ApplicationStatus.PAYMENT_RECEIVED
    });
    
    // Skip event creation to avoid additional database timeout
    // The PDF processor will find this application by checking for PAYMENT_RECEIVED status
    logger.info('[WEBHOOK] Application ready for PDF processor pickup', {
      applicationId,
      status: ApplicationStatus.PAYMENT_RECEIVED
    });

    // Send WhatsApp credentials if this is a WhatsApp payment
    await handleWhatsAppCredentialDeliveryFromPaymentIntent(paymentIntent, applicationId, client);
    
  } catch (error) {
    logger.error('[WEBHOOK] Error in payment processing', {
      applicationId,
      paymentIntentId: paymentIntent.id,
      error: error.message,
      stack: error.stack
    });
    throw error; // Re-throw to trigger transaction rollback
  }
};

const handlePaymentIntentFailed = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;
    if (applicationId) {
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_FAILED,
        null,
        client
      );
      await applicationRepository.update(applicationId, { status: ApplicationStatus.PAYMENT_FAILED }, client);
      
      // Create payment failure event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment.failed',
        {
          paymentIntentId: paymentIntent.id,
          failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
      
      // Track payment failure metric
      const paymentMethod = paymentIntent.payment_method?.type || 'card';
      const amountInPesos = paymentIntent.amount / 100; // Convert from cents to pesos
      metricsCollector.recordPaymentAttempt(paymentMethod, false, amountInPesos);
      
      logger.info(`Payment failed for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.payment_failed:', error);
    throw error;
  }
};

const handlePaymentIntentCanceled = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;
    if (applicationId) {
      await paymentRepository.updatePaymentOrder(
        applicationId,
        paymentIntent.id,
        ApplicationStatus.PAYMENT_FAILED,
        null,
        client
      );
      
      // Create payment canceled event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment.canceled',
        {
          paymentIntentId: paymentIntent.id,
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
      
      logger.info(`Payment canceled for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.canceled:', error);
    throw error;
  }
};

const handlePaymentIntentRequiresAction = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;
    if (applicationId) {
      // Check if this is an OXXO payment by looking at the next action type
      const isOxxoPayment = paymentIntent.next_action?.type === 'oxxo_display_details';
      
      // For OXXO payments, don't override the status if it's already set to AWAITING_OXXO_PAYMENT
      if (isOxxoPayment) {
        // Check current application status
        const application = await applicationRepository.findById(applicationId);
        if (application && application.status === ApplicationStatus.AWAITING_OXXO_PAYMENT) {
          logger.info(`Skipping status update for OXXO payment - application ${applicationId} already has AWAITING_OXXO_PAYMENT status`);
        } else {
          // Set to AWAITING_OXXO_PAYMENT for OXXO payments that don't already have the right status
          await paymentRepository.updatePaymentOrder(
            applicationId,
            paymentIntent.id,
            ApplicationStatus.AWAITING_OXXO_PAYMENT,
            null,
            client
          );
          logger.info(`Set OXXO payment status to AWAITING_OXXO_PAYMENT for application ${applicationId}`);
        }
      } else {
        // For non-OXXO payments, use PAYMENT_PROCESSING as before
        await paymentRepository.updatePaymentOrder(
          applicationId,
          paymentIntent.id,
          ApplicationStatus.PAYMENT_PROCESSING,
          null,
          client
        );
      }
      
      // Create payment requires action event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment.requires_action',
        {
          paymentIntentId: paymentIntent.id,
          nextAction: paymentIntent.next_action?.type || 'unknown',
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
      
      logger.info(`Payment requires action for application ${applicationId}, payment intent ${paymentIntent.id}`);
    }
  } catch (error) {
    logger.error('Error handling payment_intent.requires_action:', error);
    throw error;
  }
};

const handlePaymentIntentCreated = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;
    if (applicationId) {
      // Track payment intent creation for monitoring
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment_intent.created',
        {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentMethodTypes: paymentIntent.payment_method_types,
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
      
      logger.info(`Payment intent created for application ${applicationId}`, {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount
      });
    }
  } catch (error) {
    logger.error('Error handling payment_intent.created:', error);
    throw error;
  }
};

const handlePaymentIntentRequiresCapture = async (paymentIntent, paymentRepository, applicationRepository, client = null) => {
  try {
    const applicationId = paymentIntent.metadata?.application_id;
    if (applicationId) {
      // Attempt automatic recovery for requires_capture state
      logger.info(`Payment requires capture for application ${applicationId}, attempting recovery`);
      
      // Use payment recovery service to handle capture
      const result = await paymentRecoveryService.attemptPaymentRecovery(
        applicationId,
        paymentIntent.id,
        { message: 'Webhook: payment_intent.requires_capture' }
      );
      
      if (!result.success) {
        // Send alert for manual intervention
        await alertService.sendAlert({
          title: 'Payment Requires Manual Capture',
          message: `Payment ${paymentIntent.id} requires capture for application ${applicationId}`,
          severity: 'HIGH',
          details: {
            applicationId,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            recoveryResult: result
          }
        });
      }
      
      // Log event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'payment.requires_capture',
        {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          recoveryAttempted: true,
          recoveryResult: result,
          timestamp: new Date().toISOString()
        },
        paymentIntent.id,
        client
      );
    }
  } catch (error) {
    logger.error('Error handling payment_intent.requires_capture:', error);
    throw error;
  }
};

const handleChargeUpdated = async (charge, paymentRepository, applicationRepository, client = null) => {
  try {
    // This is particularly important for OXXO payments
    const paymentIntentId = charge.payment_intent;
    const paymentMethod = charge.payment_method_details?.type;
    
    logger.info(`Charge updated for payment intent ${paymentIntentId}`, {
      chargeId: charge.id,
      status: charge.status,
      paymentMethod,
      paid: charge.paid
    });
    
    // If charge is successful and it's an OXXO payment, update application
    if (charge.paid && charge.status === 'succeeded' && paymentMethod === 'oxxo') {
      
      // Find application by payment intent
      const application = await paymentRepository.findByOrderId(paymentIntentId);
      
      if (application) {
        const applicationId = application.id;
        
        // Check if we haven't already processed this as succeeded
        if (application.status !== ApplicationStatus.PAYMENT_RECEIVED) {
          logger.info(`OXXO payment confirmed via charge.updated for application ${applicationId}`);
          
          // Update payment status
          await paymentRepository.updatePaymentOrder(
            applicationId,
            paymentIntentId,
            ApplicationStatus.PAYMENT_RECEIVED,
            null,
            client
          );
          
          // Update application status
          await applicationRepository.update(applicationId, { 
            status: ApplicationStatus.PAYMENT_RECEIVED 
          }, client);
          
          // Queue PDF generation
          setImmediate(async () => {
            try {
              const pdfQueueService = getPdfQueueService();
              
              const job = await pdfQueueService.addJob({
                applicationId: applicationId,
                userId: application.user_id,
                priority: 1
              });
              
              logger.info(`Application ${applicationId} queued for PDF generation after OXXO confirmation`, {
                jobId: job.id
              });
            } catch (queueError) {
              logger.error(`Error queueing PDF for application ${applicationId}:`, queueError);
            }
          });
        }
        
        // Log charge update event
        await paymentRepository.createPaymentEvent(
          applicationId,
          'charge.updated',
          {
            chargeId: charge.id,
            paymentIntentId,
            status: charge.status,
            paid: charge.paid,
            paymentMethod,
            amount: charge.amount,
            timestamp: new Date().toISOString()
          },
          paymentIntentId,
          client
        );
      }
    }
  } catch (error) {
    logger.error('Error handling charge.updated:', error);
    throw error;
  }
};

const handleChargeSucceeded = async (charge, paymentRepository, applicationRepository, client = null) => {
  try {
    const paymentIntentId = charge.payment_intent;
    const paymentMethod = charge.payment_method_details?.type;
    
    logger.info(`Charge succeeded for payment intent ${paymentIntentId}`, {
      chargeId: charge.id,
      status: charge.status,
      paymentMethod,
      paid: charge.paid,
      amount: charge.amount
    });
    
    // Find application by payment intent
    const application = await paymentRepository.findByOrderId(paymentIntentId);
    
    if (!application) {
      logger.error(`No application found for payment intent ${paymentIntentId}`, {
        chargeId: charge.id
      });
      return;
    }
    
    const applicationId = application.id;
    
    // Check if we haven't already processed this payment
    if (application.status === ApplicationStatus.PAYMENT_RECEIVED || 
        application.status === ApplicationStatus.GENERATING_PERMIT ||
        application.status === ApplicationStatus.PERMIT_GENERATED ||
        application.status === ApplicationStatus.PERMIT_READY) {
      logger.info(`Payment already processed for application ${applicationId}, skipping`, {
        currentStatus: application.status
      });
      return;
    }
    
    logger.info(`Processing charge.succeeded for application ${applicationId}`, {
      paymentMethod,
      previousStatus: application.status
    });
    
    // Update payment status
    await paymentRepository.updatePaymentOrder(
      applicationId,
      paymentIntentId,
      ApplicationStatus.PAYMENT_RECEIVED,
      null,
      client
    );
    
    // Update application status
    await applicationRepository.update(applicationId, { 
      status: ApplicationStatus.PAYMENT_RECEIVED,
      payment_processor_order_id: paymentIntentId
    }, client);
    
    // Log charge succeeded event
    await paymentRepository.createPaymentEvent(
      applicationId,
      'charge.succeeded',
      {
        chargeId: charge.id,
        paymentIntentId,
        status: charge.status,
        paid: charge.paid,
        paymentMethod,
        amount: charge.amount,
        currency: charge.currency,
        timestamp: new Date().toISOString()
      },
      paymentIntentId,
      client
    );
    
    // Track metrics
    const amountInPesos = charge.amount / 100;
    metricsCollector.recordPaymentAttempt(paymentMethod, true, amountInPesos);
    
    // Queue PDF generation asynchronously (outside transaction)
    setImmediate(async () => {
      try {
        logger.info(`Queueing PDF generation for application ${applicationId} after charge.succeeded`);
        const pdfQueueService = getPdfQueueService();
        
        if (!pdfQueueService) {
          logger.error('PDF Queue service not available');
          return;
        }
        
        const job = await pdfQueueService.addJob({
          applicationId: applicationId,
          userId: application.user_id,
          priority: 1,
          metadata: {
            source: 'charge.succeeded',
            paymentMethod,
            chargeId: charge.id
          }
        });
        
        logger.info(`Application ${applicationId} queued for PDF generation`, {
          jobId: job.id,
          source: 'charge.succeeded'
        });
      } catch (queueError) {
        logger.error(`Error queueing PDF for application ${applicationId}:`, {
          error: queueError.message,
          stack: queueError.stack
        });
      }
    });
    
  } catch (error) {
    logger.error('Error handling charge.succeeded:', {
      error: error.message,
      stack: error.stack,
      chargeId: charge.id
    });
    throw error;
  }
};

const handleChargeFailed = async (charge, paymentRepository, applicationRepository, client = null) => {
  try {
    const paymentIntentId = charge.payment_intent;
    const paymentMethod = charge.payment_method_details?.type;
    const failureCode = charge.failure_code;
    const failureMessage = charge.failure_message;
    
    logger.info(`Charge failed for payment intent ${paymentIntentId}`, {
      chargeId: charge.id,
      status: charge.status,
      paymentMethod,
      failureCode,
      failureMessage,
      amount: charge.amount
    });
    
    // Find application by payment intent
    const application = await paymentRepository.findByOrderId(paymentIntentId);
    
    if (!application) {
      logger.error(`No application found for payment intent ${paymentIntentId}`, {
        chargeId: charge.id
      });
      return;
    }
    
    const applicationId = application.id;
    
    logger.info(`Processing charge.failed for application ${applicationId}`, {
      paymentMethod,
      failureCode,
      currentStatus: application.status
    });
    
    // Update payment status to failed
    await paymentRepository.updatePaymentOrder(
      applicationId,
      paymentIntentId,
      ApplicationStatus.PAYMENT_FAILED,
      failureMessage,
      client
    );
    
    // Update application status back to awaiting payment
    await applicationRepository.update(applicationId, { 
      status: ApplicationStatus.AWAITING_PAYMENT,
      payment_error: failureMessage
    }, client);
    
    // Log charge failed event
    await paymentRepository.createPaymentEvent(
      applicationId,
      'charge.failed',
      {
        chargeId: charge.id,
        paymentIntentId,
        status: charge.status,
        paymentMethod,
        amount: charge.amount,
        currency: charge.currency,
        failureCode,
        failureMessage,
        timestamp: new Date().toISOString()
      },
      paymentIntentId,
      client
    );
    
    // Track metrics
    const amountInPesos = charge.amount / 100;
    metricsCollector.recordPaymentAttempt(paymentMethod, false, amountInPesos);
    
    // Send alert for payment failures
    try {
      await alertService.sendAlert({
        title: 'Payment Failed',
        message: `Payment failed for application ${applicationId}: ${failureMessage}`,
        severity: 'WARNING',
        details: {
          applicationId,
          chargeId: charge.id,
          paymentIntentId,
          failureCode,
          failureMessage,
          paymentMethod,
          amount: amountInPesos
        }
      });
    } catch (alertError) {
      logger.error('Failed to send payment failure alert:', alertError);
    }
    
  } catch (error) {
    logger.error('Error handling charge.failed:', {
      error: error.message,
      stack: error.stack,
      chargeId: charge.id
    });
    throw error;
  }
};

const handleCheckoutSessionCompleted = async (session, paymentRepository, applicationRepository, client = null) => {
  try {
    logger.info('[WEBHOOK] Processing checkout.session.completed', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
      paymentIntentId: session.payment_intent,
      source: session.metadata?.source,
      whatsappFlow: session.metadata?.source === 'whatsapp'
    });
    
    // Extract application ID from session metadata
    const applicationIdString = session.metadata?.application_id;
    const applicationId = applicationIdString ? parseInt(applicationIdString, 10) : null;
    
    if (!applicationId || isNaN(applicationId)) {
      logger.error('[WEBHOOK] No valid application_id in checkout session metadata', {
        metadata: session.metadata,
        sessionId: session.id
      });
      return;
    }
    
    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      logger.warn('[WEBHOOK] Checkout session completed but payment not successful', {
        applicationId,
        sessionId: session.id,
        paymentStatus: session.payment_status
      });
      return;
    }
    
    logger.info('[WEBHOOK] Processing payment for application from checkout session', { 
      applicationId,
      sessionId: session.id,
      paymentIntentId: session.payment_intent 
    });
    
    // IDEMPOTENCY CHECK: First get application without lock to check status
    const checkQuery = 'SELECT id, status, payment_processor_order_id FROM permit_applications WHERE id = $1';
    const { rows: checkRows } = await client.query(checkQuery, [applicationId]);
    const currentApp = checkRows[0];
    
    if (!currentApp) {
      logger.error('[WEBHOOK] Application not found', { applicationId });
      return;
    }
    
    // Check if already processed
    if (currentApp.status === ApplicationStatus.PAYMENT_RECEIVED || 
        currentApp.status === ApplicationStatus.GENERATING_PERMIT ||
        currentApp.status === ApplicationStatus.PERMIT_GENERATED ||
        currentApp.status === ApplicationStatus.PERMIT_READY) {
      logger.info('[WEBHOOK] Payment already processed, skipping', {
        applicationId,
        currentStatus: currentApp.status,
        sessionId: session.id
      });
      return; // Idempotent - already processed
    }
    
    // Validate state transition
    if (currentApp.status !== ApplicationStatus.AWAITING_PAYMENT && 
        currentApp.status !== ApplicationStatus.AWAITING_OXXO_PAYMENT) {
      logger.error('[WEBHOOK] Invalid state transition', {
        applicationId,
        currentStatus: currentApp.status,
        expectedStatus: ApplicationStatus.AWAITING_PAYMENT
      });
      throw new Error(`Invalid state transition from ${currentApp.status} to PAYMENT_RECEIVED`);
    }
    
    // Now lock the row for update
    const lockQuery = 'SELECT id FROM permit_applications WHERE id = $1 FOR UPDATE NOWAIT';
    try {
      await client.query(lockQuery, [applicationId]);
    } catch (lockError) {
      if (lockError.code === '55P03') {
        logger.warn('[WEBHOOK] Application locked by another transaction, will retry', { applicationId });
        throw new Error('Application is currently being processed');
      }
      throw lockError;
    }
    
    // Step 1: Update application status to PAYMENT_RECEIVED
    logger.info('[WEBHOOK] Step 1: Updating application status to PAYMENT_RECEIVED');
    await applicationRepository.update(
      applicationId, 
      { 
        status: ApplicationStatus.PAYMENT_RECEIVED,
        payment_processor_order_id: session.payment_intent
      }, 
      client
    );
    
    // Step 2: Update payment order status
    logger.info('[WEBHOOK] Step 2: Updating payment order status');
    await paymentRepository.updatePaymentOrder(
      applicationId,
      session.payment_intent,
      ApplicationStatus.PAYMENT_RECEIVED,
      null,
      client
    );
    
    // Step 3: Create payment event
    await paymentRepository.createPaymentEvent(
      applicationId,
      'checkout.session.completed',
      {
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        amount: session.amount_total,
        currency: session.currency,
        paymentMethod: session.payment_method_types?.join(',') || 'unknown',
        source: session.metadata?.source || 'unknown',
        timestamp: new Date().toISOString()
      },
      session.payment_intent,
      client
    );
    
    // Track metrics
    const paymentMethod = session.payment_method_types?.[0] || 'card';
    const amountInPesos = session.amount_total / 100;
    metricsCollector.recordPaymentAttempt(paymentMethod, true, amountInPesos);
    
    // Log successful processing
    logger.info('[WEBHOOK] Checkout session payment processed successfully', {
      applicationId,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      newStatus: ApplicationStatus.PAYMENT_RECEIVED,
      source: session.metadata?.source,
      isWhatsAppPayment: session.metadata?.source === 'whatsapp'
    });

    // The PDF Generation Processor will automatically pick up this application
    // since it now has PAYMENT_RECEIVED status
    logger.info('[WEBHOOK] Application ready for PDF processor pickup', {
      applicationId,
      status: ApplicationStatus.PAYMENT_RECEIVED,
      source: session.metadata?.source,
      isWhatsAppPayment: session.metadata?.source === 'whatsapp',
      processorInterval: process.env.PDF_PROCESSOR_INTERVAL || '5000ms'
    });

    // Send WhatsApp credentials if this is a WhatsApp payment
    await handleWhatsAppCredentialDelivery(session, applicationId, client);
    
  } catch (error) {
    logger.error('[WEBHOOK] Error processing checkout.session.completed', {
      sessionId: session.id,
      error: error.message,
      stack: error.stack
    });
    throw error; // Re-throw to trigger transaction rollback
  }
};

const handlePaymentMethodAttached = async (paymentMethod, paymentRepository, client = null) => {
  try {
    logger.info(`Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`, {
      type: paymentMethod.type,
      created: paymentMethod.created
    });
    
    // Log for audit purposes
    // In the future, this could be used to implement saved payment methods
  } catch (error) {
    logger.error('Error handling payment_method.attached:', error);
    throw error;
  }
};

const handlePaymentMethodDetached = async (paymentMethod, paymentRepository, client = null) => {
  try {
    logger.info(`Payment method ${paymentMethod.id} detached from customer`, {
      type: paymentMethod.type
    });
    
    // Log for audit purposes
    // In the future, this could trigger cleanup of saved payment methods
  } catch (error) {
    logger.error('Error handling payment_method.detached:', error);
    throw error;
  }
};

/**
 * Handle WhatsApp credential delivery after successful payment
 */
const handleWhatsAppCredentialDelivery = async (session, applicationId, client = null) => {
  try {
    // Check if this is a WhatsApp payment
    const source = session.metadata?.source;
    const phoneNumber = session.metadata?.phone_number;
    
    if (source !== 'whatsapp' || !phoneNumber) {
      logger.debug('[WEBHOOK] Not a WhatsApp payment, skipping credential delivery', {
        applicationId,
        source,
        hasPhone: !!phoneNumber
      });
      return;
    }

    logger.info('[WEBHOOK] Processing WhatsApp credential delivery', {
      applicationId,
      phoneNumber
    });

    // Get application and user details
    const appQuery = `
      SELECT pa.*, u.id as user_id, u.first_name, u.last_name, u.account_email, 
             u.whatsapp_phone, u.source, u.created_at as user_created_at
      FROM permit_applications pa 
      JOIN users u ON pa.user_id = u.id 
      WHERE pa.id = $1
    `;
    
    const { rows: appRows } = await (client || require('../db')).query(appQuery, [applicationId]);
    
    if (!appRows.length) {
      logger.error('[WEBHOOK] Application or user not found for credential delivery', {
        applicationId
      });
      return;
    }

    const application = appRows[0];
    const user = {
      id: application.user_id,
      firstName: application.first_name,
      lastName: application.last_name,
      email: application.account_email,
      whatsappPhone: application.whatsapp_phone,
      source: application.source,
      userCreatedAt: application.user_created_at
    };

    // Check if this is a new WhatsApp user (first payment)
    // More reliable than time-based detection
    const permitCountQuery = `
      SELECT COUNT(*) as permit_count 
      FROM permit_applications 
      WHERE user_id = $1 
      AND status IN ('PERMIT_READY', 'PERMIT_GENERATED', 'PAYMENT_RECEIVED')
    `;
    const { rows: countRows } = await (client || require('../db')).query(permitCountQuery, [user.id]);
    const permitCount = parseInt(countRows[0].permit_count) || 0;
    
    // User is considered "new" if they're from WhatsApp AND have zero completed permits
    // This current payment will be their first
    const isNewUser = user.source === 'whatsapp' && permitCount === 0;

    logger.info('[WEBHOOK] User status analysis', {
      applicationId,
      userId: user.id,
      source: user.source,
      permitCount,
      isNewUser,
      phoneNumber
    });

    if (!isNewUser) {
      logger.info('[WEBHOOK] Existing user or non-WhatsApp user, sending payment success notification only', {
        applicationId,
        userId: user.id,
        source: user.source,
        permitCount,
        phoneNumber
      });
      
      // Send payment success notification
      await whatsappNotificationService.sendPaymentSuccess(
        phoneNumber,
        user.firstName,
        applicationId,
        true // hasPortalAccess
      );
      return;
    }

    // For new users, we need to get their temporary password
    const userAccountService = require('../services/whatsapp/user-account.service');
    const passwordCache = require('../services/whatsapp/password-cache.service');
    
    // Try to retrieve the stored temporary password from Redis first
    let temporaryPassword = null;
    
    try {
      // First attempt: Get password from Redis cache
      temporaryPassword = await passwordCache.getTemporaryPassword(user.id);
      
      if (temporaryPassword) {
        logger.info('[WEBHOOK] Retrieved cached password for WhatsApp user', {
          userId: user.id,
          phoneNumber
        });
        
        // Clear password from cache after successful retrieval (optional for security)
        await passwordCache.clearTemporaryPassword(user.id);
        
      } else {
        // Fallback: Generate new password if not found in cache
        logger.warn('[WEBHOOK] No cached password found, generating new one', {
          userId: user.id,
          phoneNumber
        });
        
        const words = ['Solar', 'Luna', 'Cielo', 'Mar', 'Monte', 'Rio', 'Viento', 'Fuego', 'Tierra', 'Agua'];
        const word1 = words[Math.floor(Math.random() * words.length)];
        const word2 = words[Math.floor(Math.random() * words.length)];
        const num1 = Math.floor(Math.random() * 900) + 100;
        const num2 = Math.floor(Math.random() * 900) + 100;
        temporaryPassword = `${word1}-${num1}-${word2}-${num2}`;
        
        // Update user's password with the new one
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        
        const updateQuery = 'UPDATE users SET password_hash = $1 WHERE id = $2';
        await (client || require('../db')).query(updateQuery, [passwordHash, user.id]);
        
        logger.info('[WEBHOOK] Generated and stored new password for WhatsApp user', {
          userId: user.id,
          phoneNumber
        });
      }
      
    } catch (passwordError) {
      logger.error('[WEBHOOK] Error generating password for WhatsApp user', {
        error: passwordError.message,
        userId: user.id,
        phoneNumber
      });
      
      // Still send payment success notification even if password fails
      await whatsappNotificationService.sendPaymentSuccess(
        phoneNumber,
        user.firstName,
        applicationId,
        false // hasPortalAccess - false since no password
      );
      return;
    }

    // Send portal credentials via WhatsApp with retry logic
    const userDetails = {
      firstName: user.firstName,
      email: user.email || application.delivery_email,
      whatsappPhone: user.whatsappPhone
    };

    let whatsappDeliverySuccess = false;
    let retries = 3;
    
    while (retries > 0 && !whatsappDeliverySuccess) {
      try {
        await whatsappNotificationService.sendPortalCredentials(
          phoneNumber,
          userDetails,
          temporaryPassword
        );
        
        whatsappDeliverySuccess = true;
        logger.info('[WEBHOOK] WhatsApp credentials delivered successfully', {
          userId: user.id,
          phoneNumber,
          attemptsUsed: 4 - retries
        });
        
        // Track successful delivery metrics
        try {
          const metricsCollector = require('../monitoring/metrics-collector');
          metricsCollector.recordEvent('whatsapp_credentials_sent', {
            userId: user.id,
            hasEmail: !!userDetails.email,
            isNewUser: true,
            attemptsUsed: 4 - retries
          });
        } catch (metricsError) {
          logger.debug('[WEBHOOK] Error recording metrics (non-critical)', {
            error: metricsError.message
          });
        }
        
        break; // Success - exit retry loop
        
      } catch (whatsappError) {
        retries--;
        logger.warn('[WEBHOOK] WhatsApp credentials delivery failed', {
          error: whatsappError.message,
          userId: user.id,
          phoneNumber,
          retriesLeft: retries
        });
        
        if (retries === 0) {
          // All retries exhausted - log critical error
          logger.error('[WEBHOOK] Failed to send WhatsApp credentials after all attempts', {
            error: whatsappError.message,
            stack: whatsappError.stack,
            userId: user.id,
            phoneNumber,
            totalAttempts: 3
          });
          
          // Don't fail the entire webhook - email fallback will be attempted
          break;
          
        } else {
          // Wait before retry (exponential backoff)
          const waitTime = (4 - retries) * 2000; // 2s, 4s wait times
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Send email backup (always send if have email, critical if WhatsApp failed)
    if (userDetails.email) {
      try {
        // Add temporaryPassword to user object for email service
        const userWithPassword = { ...user, temporaryPassword };
        await userAccountService.sendPortalAccessEmail(userWithPassword, userDetails.email);
        
        const emailLogLevel = whatsappDeliverySuccess ? 'info' : 'warn';
        logger[emailLogLevel]('[WEBHOOK] Portal access email sent', {
          userId: user.id,
          email: userDetails.email,
          isBackupAfterWhatsAppFailure: !whatsappDeliverySuccess
        });
        
        // Track email delivery metrics
        try {
          const metricsCollector = require('../monitoring/metrics-collector');
          metricsCollector.recordEvent('email_credentials_sent', {
            userId: user.id,
            isBackupAfterWhatsAppFailure: !whatsappDeliverySuccess,
            whatsappSuccess: whatsappDeliverySuccess
          });
        } catch (metricsError) {
          logger.debug('[WEBHOOK] Error recording email metrics (non-critical)', {
            error: metricsError.message
          });
        }
        
      } catch (emailError) {
        const emailLogLevel = whatsappDeliverySuccess ? 'error' : 'critical';
        logger[emailLogLevel === 'critical' ? 'error' : emailLogLevel]('[WEBHOOK] Error sending portal access email', {
          error: emailError.message,
          userId: user.id,
          email: userDetails.email,
          isCritical: !whatsappDeliverySuccess
        });
        
        // If both WhatsApp and email failed, this is critical
        if (!whatsappDeliverySuccess) {
          logger.error('[WEBHOOK] CRITICAL: Both WhatsApp and email credential delivery failed', {
            userId: user.id,
            phoneNumber,
            email: userDetails.email,
            applicationId
          });
        }
      }
    } else if (!whatsappDeliverySuccess) {
      // No email available and WhatsApp failed - critical situation
      logger.error('[WEBHOOK] CRITICAL: WhatsApp delivery failed and no email available for backup', {
        userId: user.id,
        phoneNumber,
        applicationId
      });
    }

    logger.info('[WEBHOOK] WhatsApp credential delivery process completed', {
      applicationId,
      userId: user.id,
      phoneNumber,
      hasEmail: !!userDetails.email,
      whatsappDeliverySuccess,
      emailDeliveryAttempted: !!userDetails.email,
      overallSuccess: whatsappDeliverySuccess || (userDetails.email ? true : false) // Success if either method worked
    });

  } catch (error) {
    logger.error('[WEBHOOK] Error in WhatsApp credential delivery', {
      error: error.message,
      stack: error.stack,
      applicationId,
      sessionId: session.id
    });
    // Don't throw - this shouldn't fail the payment processing
  }
};

/**
 * Handle WhatsApp credential delivery from payment intent (alternative flow)
 */
const handleWhatsAppCredentialDeliveryFromPaymentIntent = async (paymentIntent, applicationId, client = null) => {
  try {
    // Check if this is a WhatsApp payment
    const source = paymentIntent.metadata?.source;
    const phoneNumber = paymentIntent.metadata?.phone_number;
    
    if (source !== 'whatsapp' || !phoneNumber) {
      logger.debug('[WEBHOOK] Not a WhatsApp payment intent, skipping credential delivery', {
        applicationId,
        source,
        hasPhone: !!phoneNumber
      });
      return;
    }

    // Create a session-like object for reusing the existing handler
    const sessionLike = {
      id: paymentIntent.id,
      metadata: paymentIntent.metadata,
      payment_intent: paymentIntent.id
    };

    // Reuse the existing handler
    await handleWhatsAppCredentialDelivery(sessionLike, applicationId, client);

  } catch (error) {
    logger.error('[WEBHOOK] Error in WhatsApp credential delivery from payment intent', {
      error: error.message,
      stack: error.stack,
      applicationId,
      paymentIntentId: paymentIntent.id
    });
    // Don't throw - this shouldn't fail the payment processing
  }
};

const createPaymentIntent = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { customerId } = req.body;
    const userId = req.user.id;
    if (!applicationId || !customerId) return ApiResponse.badRequest(res, 'ID de aplicación y ID de cliente son requeridos.');
    const application = await applicationRepository.findById(applicationId);
    if (!application) return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    if (application.user_id !== userId) return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
    
    // Check for existing payment intent before creating a new one
    const existingPayment = await paymentRepository.getPaymentByApplicationId(applicationId);
    if (existingPayment?.order_id && existingPayment.status === ApplicationStatus.PAYMENT_PROCESSING) {
      try {
        // Verify the existing payment intent is still valid
        const existingIntent = await stripePaymentService.retrievePaymentIntent(existingPayment.order_id);
        if (existingIntent && (existingIntent.status === 'requires_payment_method' || existingIntent.status === 'requires_action')) {
          logger.info(`Returning existing payment intent ${existingIntent.id} for application ${applicationId}`);
          const responseBody = { 
            success: true, 
            clientSecret: existingIntent.client_secret, 
            paymentIntentId: existingIntent.id, 
            customerId: customerId, 
            amount: existingIntent.amount / 100, // Convert from cents
            currency: 'MXN', 
            status: existingIntent.status 
          };
          return ApiResponse.success(res, responseBody);
        }
      } catch (error) {
        logger.warn(`Could not retrieve existing payment intent ${existingPayment.order_id}, creating new one:`, error.message);
      }
    }
    
    // Get user email and IP address for velocity checks
    const user = await userRepository.findById(userId);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '0.0.0.0';
    
    // Create new payment intent only if no valid existing one found
    const paymentData = { 
      customerId, 
      amount: application.importe || DEFAULT_PERMIT_FEE, 
      description: `Permiso de Circulación para ${application.marca} ${application.linea}`, 
      referenceId: `APP-${application.id}`, 
      applicationId: application.id,
      userId,
      email: user?.email,
      ipAddress
    };
    const paymentIntent = await stripePaymentService.createPaymentIntentForCard(paymentData);
    logger.debug('Received Payment Intent from Stripe:', { id: paymentIntent.id, status: paymentIntent.status, hasClientSecret: !!paymentIntent.client_secret });
    // Store payment intent ID without changing application status
    await paymentRepository.updatePaymentOrder(application.id, paymentIntent.id, ApplicationStatus.AWAITING_PAYMENT);
    const responseBody = { success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, customerId: customerId, amount: paymentData.amount, currency: 'MXN', status: paymentIntent.status };
    logger.info('Successfully created payment intent. Sending response to client:', responseBody);
    return ApiResponse.success(res, responseBody);
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'createPaymentIntent',
      applicationId: req.params.applicationId
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { paymentIntentId, paymentMethod } = req.body;
    const userId = req.user.id;
    
    if (!applicationId || !paymentIntentId || paymentMethod !== 'card') {
      return ApiResponse.badRequest(res, 'ID de aplicación, ID de intención de pago y método de pago son requeridos.');
    }
    
    const application = await applicationRepository.findById(applicationId);
    if (!application) return ApiResponse.notFound(res, 'Solicitud no encontrada.');
    if (application.user_id !== userId) return ApiResponse.forbidden(res, 'No tienes permiso para acceder a esta solicitud.');
    
    // Verify with Stripe that payment succeeded
    const paymentIntent = await stripePaymentService.retrievePaymentIntent(paymentIntentId);
    
    logger.info('Payment confirmation check', {
      applicationId,
      paymentIntentId,
      stripeStatus: paymentIntent.status,
      currentAppStatus: application.status
    });
    
    // Return current payment status from Stripe without modifying database
    // The webhook is the single source of truth for state changes
    if (paymentIntent.status === 'succeeded') {
      // Check if webhook has already processed this payment
      const currentStatus = await applicationRepository.getApplicationStatus(applicationId);
      
      if (currentStatus === ApplicationStatus.PAYMENT_RECEIVED || 
          currentStatus === ApplicationStatus.GENERATING_PERMIT ||
          currentStatus === ApplicationStatus.PERMIT_GENERATED) {
        return ApiResponse.success(res, { 
          success: true, 
          paymentIntentId, 
          status: currentStatus, 
          applicationId: application.id, 
          message: 'Pago confirmado exitosamente.',
          processed: true 
        });
      } else {
        // Payment succeeded in Stripe but webhook hasn't processed yet
        logger.info('Payment succeeded but webhook pending', { applicationId, paymentIntentId });
        return ApiResponse.success(res, { 
          success: true, 
          paymentIntentId, 
          status: 'processing', 
          applicationId: application.id, 
          message: 'Pago recibido, procesando solicitud...',
          processed: false 
        });
      }
    } else if (paymentIntent.status === 'processing') {
      return ApiResponse.success(res, { 
        success: false, 
        paymentIntentId, 
        status: 'processing', 
        applicationId: application.id, 
        message: 'El pago está siendo procesado.' 
      });
    } else {
      return ApiResponse.badRequest(res, 'El pago no ha sido completado exitosamente.');
    }
  } catch (error) {
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'confirmPayment',
      applicationId: req.params.applicationId,
      paymentIntentId: req.body.paymentIntentId
    });
  }
};

module.exports = {
  createPaymentOrder,
  processCardPayment,
  processOxxoPayment,
  checkPaymentStatus,
  handleWebhook,
  createPaymentIntent,
  confirmPayment
};
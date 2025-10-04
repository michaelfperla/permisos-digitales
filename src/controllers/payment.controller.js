const { logger } = require('../utils/logger');
const PaymentErrorHandler = require('../utils/payment-error-handler');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants/index');
const { paymentRepository, applicationRepository } = require('../repositories');
const { stripePaymentService } = require('../services');
const ApiResponse = require('../utils/api-response');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

const createPaymentOrder = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.session.userId;

    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    if (application.status !== ApplicationStatus.PENDING_PAYMENT) {
      return ApiResponse.badRequest(res, null, {
        message: 'La solicitud no está en un estado válido para el pago.',
        currentStatus: application.status
      });
    }

    const user = await req.userRepository.findById(userId);
    const customerData = {
      name: `${user.first_name} ${user.last_name}`,
      email: user.account_email || user.email || null, // Handle both field names, allow null
      phone: user.whatsapp_phone || user.phone || ''
    };

    const customer = await stripePaymentService.createCustomer(customerData);

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
    // Check if it's a Stripe error
    if (error.type && error.type.includes('Stripe')) {
      return PaymentErrorHandler.handleStripeError(error, req, res);
    }
    
    // Handle general payment processing errors
    return PaymentErrorHandler.handlePaymentProcessingError(error, req, res, {
      operation: 'createPaymentOrder',
      applicationId: req.params.applicationId
    });
  }
};

const processCardPayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { token, customerId, device_session_id } = req.body;
    const userId = req.session.userId;

    if (!token || !customerId) {
      return ApiResponse.badRequest(res, null, { message: 'Faltan campos requeridos.' });
    }

    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
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

    const paymentResult = await stripePaymentService.processCardPayment(paymentData);

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

    // Log successful payment
    PaymentErrorHandler.logPaymentSuccess(req, paymentResult, {
      operation: 'processCardPayment'
    });

    ApiResponse.success(res, null, {
      success: paymentResult.success,
      orderId: paymentResult.orderId,
      status: paymentResult.status,
      paymentMethod: paymentResult.paymentMethod
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
      return ApiResponse.badRequest(res, null, { message: 'Faltan campos requeridos.' });
    }

    // Validate application exists and belongs to user
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, null, { message: 'Application not found' });
    }

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
      device_session_id: device_session_id || undefined
    };

    const paymentResult = await stripePaymentService.processOxxoPayment(paymentData);

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
          amount: paymentResult.amount || 99.00,
          currency: paymentResult.currency || 'MXN',
          oxxoReference: paymentResult.oxxoReference,
          expiresAt: paymentResult.expiresAt,
          timestamp: new Date().toISOString()
        }
      });

      // Log successful OXXO payment creation
      PaymentErrorHandler.logPaymentSuccess(req, paymentResult, {
        operation: 'processOxxoPayment',
        paymentMethod: 'oxxo'
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
        return ApiResponse.error(res, 'Solicitud no encontrada.', 404);
    }

    if (application.user_id !== userId) {
      return ApiResponse.forbidden(res, null, { message: 'No tienes permiso para acceder a esta solicitud.' });
    }

    // Check if application has a payment order
    if (!application.payment_processor_order_id) {
      return ApiResponse.badRequest(res, null, { message: 'No se encontró una orden de pago para esta solicitud.' });
    }

    // Check payment status
    const paymentStatus = await stripePaymentService.checkPaymentStatus(application.payment_processor_order_id);

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

















module.exports = {
  createPaymentOrder,
  processCardPayment,
  processOxxoPayment,
  checkPaymentStatus
};

const db = require('../db');
const { logger } = require('../utils/logger');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants');
const { applicationRepository, paymentRepository, userRepository } = require('../repositories');
const stripePaymentService = require('./stripe-payment.service');
const notificationService = require('./notification-compatibility');

exports.getExpiringPermits = async (userId, daysThreshold = 30) => {
  try {
    // Validate and sanitize input to prevent SQL injection
    const safeDaysThreshold = parseInt(daysThreshold);
    if (isNaN(safeDaysThreshold) || safeDaysThreshold < 0 || safeDaysThreshold > 365) {
      throw new Error('Invalid daysThreshold parameter');
    }
    
    logger.debug(`Looking for permits expiring within ${safeDaysThreshold} days for user ${userId}`);

    // Use applicationRepository method instead of direct SQL query
    const expiringPermits = await applicationRepository.getExpiringPermits(userId, safeDaysThreshold);
    
    logger.debug(`Found ${expiringPermits.length} expiring permits for user ${userId}`);
    return expiringPermits;
  } catch (error) {
    logger.error('Error in getExpiringPermits service:', error);
    throw error;
  }
};

exports.createApplicationWithOxxo = async (formData, userId) => {
  try {
    logger.info(`Creating application with OXXO payment for user ${userId}`);

    // Sanitize color field to replace slashes with 'y'
    let sanitizedColor = formData.color;
    if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
      sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
    }

    const applicationData = {
      user_id: userId,
      nombre_completo: formData.nombre_completo,
      curp_rfc: formData.curp_rfc,
      domicilio: formData.domicilio,
      marca: formData.marca,
      linea: formData.linea,
      color: sanitizedColor,
      numero_serie: formData.numero_serie,
      numero_motor: formData.numero_motor,
      ano_modelo: formData.ano_modelo,
      status: ApplicationStatus.AWAITING_OXXO_PAYMENT,
      importe: DEFAULT_PERMIT_FEE
    };

    const newApplication = await applicationRepository.create(applicationData);
    logger.info(`New application created with ID: ${newApplication.id} for user ${userId} with OXXO payment pending`);

    // Use userRepository instead of direct SQL query
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.error(`User ${userId} not found in database`);
      throw new Error('User not found');
    }

    const userEmail = user.email;
    const userName = `${user.first_name} ${user.last_name}`;

    // Fix: Use stripePaymentService instead of undefined paymentService
    const customer = await stripePaymentService.createCustomer({
      name: formData.nombre_completo || userName,
      email: userEmail,
      phone: formData.phone || ''
    });

    const paymentData = {
      customerId: customer.id,
      amount: newApplication.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${formData.marca} ${formData.linea} ${formData.ano_modelo}`,
      referenceId: `APP-${newApplication.id}`
    };

    const paymentResult = await stripePaymentService.processOxxoPayment(paymentData);

    await paymentRepository.updatePaymentOrder(
      newApplication.id,
      paymentResult.orderId,
      ApplicationStatus.AWAITING_OXXO_PAYMENT,
      { oxxoReference: paymentResult.oxxoReference }
    );

    await paymentRepository.logPaymentEvent({
      applicationId: newApplication.id,
      orderId: paymentResult.orderId,
      eventType: 'oxxo.payment.created',
      eventData: {
        status: paymentResult.status || 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: paymentResult.amount || 150.00,
        currency: paymentResult.currency || 'MXN',
        oxxoReference: paymentResult.oxxoReference,
        expiresAt: paymentResult.expiresAt,
        timestamp: new Date().toISOString()
      }
    });

    return {
      application: newApplication,
      payment: paymentResult
    };
  } catch (error) {
    logger.error('Error creating application with OXXO payment:', error);
    throw error;
  }
};

exports.notifyExpiringOxxoPayments = async (hoursUntilExpiration = 24) => {
  try {
    logger.info(`Starting notification process for OXXO payments expiring within ${hoursUntilExpiration} hours`);

    const expiringPayments = await paymentRepository.getExpiringOxxoPayments(hoursUntilExpiration);

    if (expiringPayments.length === 0) {
      logger.info('No expiring OXXO payments found');
      return {
        success: true,
        notified: 0,
        failed: 0,
        total: 0,
        message: 'No expiring OXXO payments found'
      };
    }

    const results = {
      success: true,
      notified: 0,
      failed: 0,
      total: expiringPayments.length,
      applications: []
    };

    for (const payment of expiringPayments) {
      try {
        const notificationSent = await notificationService.sendOxxoExpirationReminder(payment);

        if (notificationSent) {
          results.notified++;
          results.applications.push({
            applicationId: payment.application_id,
            status: 'notified',
            email: payment.user_email,
            expiresAt: payment.expires_at_date
          });
        } else {
          results.failed++;
          results.applications.push({
            applicationId: payment.application_id,
            status: 'failed',
            email: payment.user_email,
            expiresAt: payment.expires_at_date
          });
        }

        await paymentRepository.logPaymentEvent({
          applicationId: payment.application_id,
          orderId: payment.order_id,
          eventType: 'oxxo.expiration.notification',
          eventData: {
            notificationSent,
            expiresAt: payment.expires_at,
            oxxoReference: payment.oxxo_reference,
            timestamp: new Date().toISOString()
          }
        });
      } catch (notificationError) {
        logger.error(`Error sending notification for application ${payment.application_id}:`, {
          error: notificationError.message,
          applicationId: payment.application_id,
          userEmail: payment.user_email
        });

        results.failed++;
        results.applications.push({
          applicationId: payment.application_id,
          status: 'error',
          email: payment.user_email,
          expiresAt: payment.expires_at_date,
          error: notificationError.message
        });
      }
    }

    results.success = results.failed === 0;
    results.message = `Processed ${results.total} expiring OXXO payments: ${results.notified} notified, ${results.failed} failed`;
    logger.info(results.message);

    return results;
  } catch (error) {
    logger.error('Error notifying expiring OXXO payments:', {
      error: error.message,
      hoursUntilExpiration
    });

    return {
      success: false,
      notified: 0,
      failed: 0,
      total: 0,
      message: `Error: ${error.message}`,
      error: error.message
    };
  }
};

/**
 * Notify users about expiring permits
 * @param {number} daysUntilExpiration - Days until permit expiration (default: 5)
 * @returns {Promise<Object>} - Notification results
 */
exports.notifyExpiringPermits = async (daysUntilExpiration = 5) => {
  try {
    // Validate and sanitize input to prevent SQL injection
    const safeDaysUntilExpiration = parseInt(daysUntilExpiration);
    if (isNaN(safeDaysUntilExpiration) || safeDaysUntilExpiration < 0 || safeDaysUntilExpiration > 365) {
      throw new Error('Invalid daysUntilExpiration parameter');
    }
    
    logger.info(`Starting notification process for permits expiring within ${safeDaysUntilExpiration} days`);

    // Use applicationRepository method instead of direct SQL query
    const expiringPermits = await applicationRepository.getExpiringPermitsWithUserInfo(safeDaysUntilExpiration);

    if (expiringPermits.length === 0) {
      logger.info('No expiring permits found');
      return {
        success: true,
        notified: 0,
        failed: 0,
        total: 0,
        message: 'No expiring permits found'
      };
    }

    const results = {
      success: true,
      notified: 0,
      failed: 0,
      total: expiringPermits.length,
      permits: []
    };

    for (const permit of expiringPermits) {
      try {
        const notificationSent = await notificationService.sendPermitExpirationReminder(permit);

        if (notificationSent) {
          results.notified++;
          results.permits.push({
            applicationId: permit.application_id,
            status: 'notified',
            email: permit.user_email,
            folio: permit.folio,
            expirationDate: permit.fecha_vencimiento,
            daysRemaining: permit.days_remaining
          });
        } else {
          results.failed++;
          results.permits.push({
            applicationId: permit.application_id,
            status: 'failed',
            email: permit.user_email,
            folio: permit.folio,
            expirationDate: permit.fecha_vencimiento,
            daysRemaining: permit.days_remaining
          });
        }

        // Log the notification attempt
        logger.info(`Permit expiration notification ${notificationSent ? 'sent' : 'failed'} for application ${permit.application_id}`, {
          applicationId: permit.application_id,
          userEmail: permit.user_email,
          folio: permit.folio,
          daysRemaining: permit.days_remaining,
          expirationDate: permit.fecha_vencimiento
        });

      } catch (notificationError) {
        logger.error(`Error sending permit expiration notification for application ${permit.application_id}:`, {
          error: notificationError.message,
          applicationId: permit.application_id,
          userEmail: permit.user_email,
          folio: permit.folio
        });

        results.failed++;
        results.permits.push({
          applicationId: permit.application_id,
          status: 'error',
          email: permit.user_email,
          folio: permit.folio,
          expirationDate: permit.fecha_vencimiento,
          daysRemaining: permit.days_remaining,
          error: notificationError.message
        });
      }
    }

    results.success = results.failed === 0;
    results.message = `Processed ${results.total} expiring permits: ${results.notified} notified, ${results.failed} failed`;
    logger.info(results.message);

    return results;
  } catch (error) {
    logger.error('Error notifying expiring permits:', {
      error: error.message,
      daysUntilExpiration
    });

    return {
      success: false,
      notified: 0,
      failed: 0,
      total: 0,
      message: `Error: ${error.message}`,
      error: error.message
    };
  }
};

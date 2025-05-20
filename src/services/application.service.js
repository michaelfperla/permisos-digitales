// src/services/application.service.js
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants');
const { applicationRepository, paymentRepository } = require('../repositories');
const paymentService = require('./payment.service');
const puppeteerService = require('./puppeteer.service');
const notificationService = require('./notification.service');

/**
 * Get permits that are expiring soon for a specific user
 *
 * @param {number} userId - The user's ID
 * @param {number} daysThreshold - Number of days to consider a permit as "expiring soon"
 * @returns {Promise<Array>} - Array of permits that will expire within the threshold
 */
exports.getExpiringPermits = async (userId, daysThreshold = 30) => {
  try {
    logger.debug(`Looking for permits expiring within ${daysThreshold} days for user ${userId}`);

    const query = `
            SELECT id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento,
                (fecha_vencimiento - CURRENT_DATE) AS days_remaining
            FROM permit_applications
            WHERE user_id = $1
              AND status = 'PERMIT_READY'
              AND fecha_vencimiento IS NOT NULL
              AND fecha_vencimiento > CURRENT_DATE
              AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '${daysThreshold} days')
            ORDER BY fecha_vencimiento ASC;
        `;

    const { rows } = await db.query(query, [userId]);
    logger.debug(`Found ${rows.length} expiring permits for user ${userId}`);
    return rows;
  } catch (error) {
    logger.error('Error in getExpiringPermits service:', error);
    throw error;
  }
};

/**
 * Create an application with OXXO payment
 *
 * @param {Object} formData - Application form data
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Created application and OXXO payment details
 */
exports.createApplicationWithOxxo = async (formData, userId) => {
  try {
    logger.info(`Creating application with OXXO payment for user ${userId}`);

    // Create application with AWAITING_OXXO_PAYMENT status
    const applicationData = {
      user_id: userId,
      nombre_completo: formData.nombre_completo,
      curp_rfc: formData.curp_rfc,
      domicilio: formData.domicilio,
      marca: formData.marca,
      linea: formData.linea,
      color: formData.color,
      numero_serie: formData.numero_serie,
      numero_motor: formData.numero_motor,
      ano_modelo: formData.ano_modelo,
      status: ApplicationStatus.AWAITING_OXXO_PAYMENT,
      importe: DEFAULT_PERMIT_FEE // Default amount
    };

    // Create the application
    const newApplication = await applicationRepository.create(applicationData);
    logger.info(`New application created with ID: ${newApplication.id} for user ${userId} with OXXO payment pending`);

    // Get user email for payment processing
    const { rows: userRows } = await db.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (userRows.length === 0) {
      logger.error(`User ${userId} not found in database`);
      throw new Error('User not found');
    }

    const user = userRows[0];
    const userEmail = user.email;
    const userName = `${user.first_name} ${user.last_name}`;

    // Create customer in payment provider
    const customer = await paymentService.createCustomer({
      name: formData.nombre_completo || userName,
      email: userEmail,
      phone: formData.phone || ''
    });

    // Prepare payment data
    const paymentData = {
      customerId: customer.id,
      amount: newApplication.importe || DEFAULT_PERMIT_FEE,
      currency: 'MXN',
      description: `Permiso de Circulación - ${formData.marca} ${formData.linea} ${formData.ano_modelo}`,
      referenceId: `APP-${newApplication.id}`
    };

    // Create OXXO order
    const paymentResult = await paymentService.processOxxoPayment(paymentData);

    // Update application with payment information and OXXO reference
    await paymentRepository.updatePaymentOrder(
      newApplication.id,
      paymentResult.orderId,
      ApplicationStatus.AWAITING_OXXO_PAYMENT,
      { oxxoReference: paymentResult.oxxoReference }
    );

    // Log payment event with safe data
    await paymentRepository.logPaymentEvent({
      applicationId: newApplication.id,
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

    return {
      application: newApplication,
      payment: paymentResult
    };
  } catch (error) {
    logger.error('Error creating application with OXXO payment:', error);
    throw error;
  }
};

/**
 * Notify users about OXXO payments that are about to expire
 *
 * @param {number} hoursUntilExpiration - Hours until expiration to look for (default: 24)
 * @returns {Promise<Object>} - Results of the notification process
 */
exports.notifyExpiringOxxoPayments = async (hoursUntilExpiration = 24) => {
  try {
    logger.info(`Starting notification process for OXXO payments expiring within ${hoursUntilExpiration} hours`);

    // Get expiring OXXO payments
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

    // Track notification results
    const results = {
      success: true,
      notified: 0,
      failed: 0,
      total: expiringPayments.length,
      applications: []
    };

    // Send notifications for each expiring payment
    for (const payment of expiringPayments) {
      try {
        // Send notification
        const notificationSent = await notificationService.sendOxxoExpirationReminder(payment);

        // Track result
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

        // Log payment event
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
        // Log error but continue with other notifications
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

    // Update overall success flag
    results.success = results.failed === 0;

    // Add summary message
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

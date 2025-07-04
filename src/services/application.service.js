const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants');
const { applicationRepository, paymentRepository } = require('../repositories');
const stripePaymentService = require('./stripe-payment.service');
const notificationService = require('./notification.service');

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

exports.createApplicationWithOxxo = async (formData, userId) => {
  try {
    logger.info(`Creating application with OXXO payment for user ${userId}`);

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
      importe: DEFAULT_PERMIT_FEE
    };

    const newApplication = await applicationRepository.create(applicationData);
    logger.info(`New application created with ID: ${newApplication.id} for user ${userId} with OXXO payment pending`);

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

    const customer = await paymentService.createCustomer({
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

    const paymentResult = await paymentService.processOxxoPayment(paymentData);

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
    logger.info(`Starting notification process for permits expiring within ${daysUntilExpiration} days`);

    // Query for expiring permits with user information
    const query = `
      SELECT
        pa.id as application_id,
        pa.folio,
        pa.marca,
        pa.linea,
        pa.ano_modelo,
        pa.fecha_vencimiento,
        (pa.fecha_vencimiento - CURRENT_DATE) AS days_remaining,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.status = 'PERMIT_READY'
        AND pa.fecha_vencimiento IS NOT NULL
        AND pa.fecha_vencimiento > CURRENT_DATE
        AND pa.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '${daysUntilExpiration} days')
      ORDER BY pa.fecha_vencimiento ASC
    `;

    const { rows: expiringPermits } = await db.query(query);

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

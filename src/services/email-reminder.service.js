const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');
const { emailService } = require('./email.service');
const { ApplicationStatus } = require('../constants');
const { reminderRepository } = require('../repositories');

/**
 * Email reminder service for expiring applications
 */
class EmailReminderService {
  constructor() {
    this.templateCache = new Map();
  }

  /**
   * Load and cache email template
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.html`);
      const template = await fs.readFile(templatePath, 'utf8');
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      logger.error(`Failed to load email template ${templateName}:`, error);
      throw new Error(`Email template ${templateName} not found`);
    }
  }

  /**
   * Replace template variables with actual values
   */
  replaceTemplateVariables(template, variables) {
    let result = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = variables[key] || '';
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }

  /**
   * Format time remaining for email display
   */
  formatTimeRemaining(expiresAt) {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diff = expiration.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expirado';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} hora${hours !== 1 ? 's' : ''} y ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Get status text in Spanish
   */
  getStatusText(status) {
    const statusMap = {
      'AWAITING_PAYMENT': 'Pendiente de pago',
      'AWAITING_OXXO_PAYMENT': 'Pendiente de pago OXXO',
      'PAYMENT_PROCESSING': 'Procesando pago'
    };
    return statusMap[status] || status;
  }

  /**
   * Check if reminder has already been sent
   */
  async hasReminderBeenSent(applicationId, reminderType) {
    try {
      return await reminderRepository.hasReminderBeenSent(applicationId, reminderType);
    } catch (error) {
      logger.error(`Error checking reminder status for application ${applicationId}:`, error);
      return false; // In case of error, allow sending to be safe
    }
  }

  /**
   * Record that a reminder was sent
   */
  async recordReminderSent(applicationId, userId, reminderType, emailAddress, expiresAt) {
    try {
      const result = await reminderRepository.updateReminderSent(applicationId, reminderType);
      
      logger.info(`Recorded ${reminderType} reminder for application ${applicationId}`, {
        reminderId: result.id,
        userId,
        emailAddress
      });
      
      return result.id;
    } catch (error) {
      logger.error(`Failed to record reminder for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Send expiration warning email (4 hours before expiry)
   */
  async sendExpirationWarning(application, user) {
    try {
      const reminderType = 'expiration_warning';
      
      // Check if already sent
      if (await this.hasReminderBeenSent(application.id, reminderType)) {
        logger.debug(`Expiration warning already sent for application ${application.id}`);
        return { success: true, alreadySent: true };
      }

      const template = await this.loadTemplate('expiration-warning');
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const variables = {
        userName: application.nombre_completo,
        vehicleDetails: `${application.marca} ${application.linea} ${application.ano_modelo}`,
        applicantName: application.nombre_completo,
        amount: application.importe || 99,
        statusText: this.getStatusText(application.status),
        timeRemaining: this.formatTimeRemaining(application.expires_at),
        expirationDate: new Date(application.expires_at).toLocaleString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        createdDate: new Date(application.created_at).toLocaleDateString('es-MX'),
        resumePaymentUrl: `${baseUrl}/payment/${application.id}`,
        dashboardUrl: `${baseUrl}/dashboard`
      };

      const emailContent = this.replaceTemplateVariables(template, variables);

      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject: '⚠️ Recordatorio: Complete su solicitud de permiso',
        html: emailContent
      });

      if (emailResult.success) {
        await this.recordReminderSent(
          application.id,
          user.id,
          reminderType,
          user.email,
          application.expires_at
        );

        logger.info(`Expiration warning sent for application ${application.id}`, {
          userId: user.id,
          email: user.email,
          expiresAt: application.expires_at
        });

        return { success: true, sent: true };
      } else {
        logger.error(`Failed to send expiration warning for application ${application.id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      logger.error(`Error sending expiration warning for application ${application.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send final warning email (1 hour before expiry)
   */
  async sendFinalWarning(application, user) {
    try {
      const reminderType = 'final_warning';
      
      // Check if already sent
      if (await this.hasReminderBeenSent(application.id, reminderType)) {
        logger.debug(`Final warning already sent for application ${application.id}`);
        return { success: true, alreadySent: true };
      }

      const template = await this.loadTemplate('final-warning');
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const variables = {
        userName: application.nombre_completo,
        vehicleDetails: `${application.marca} ${application.linea} ${application.ano_modelo}`,
        applicantName: application.nombre_completo,
        amount: application.importe || 99,
        statusText: this.getStatusText(application.status),
        timeRemaining: this.formatTimeRemaining(application.expires_at),
        expirationDate: new Date(application.expires_at).toLocaleString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        resumePaymentUrl: `${baseUrl}/payment/${application.id}`,
        dashboardUrl: `${baseUrl}/dashboard`
      };

      const emailContent = this.replaceTemplateVariables(template, variables);

      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject: '🚨 URGENTE: Su solicitud expira en menos de 2 horas',
        html: emailContent
      });

      if (emailResult.success) {
        await this.recordReminderSent(
          application.id,
          user.id,
          reminderType,
          user.email,
          application.expires_at
        );

        logger.info(`Final warning sent for application ${application.id}`, {
          userId: user.id,
          email: user.email,
          expiresAt: application.expires_at
        });

        return { success: true, sent: true };
      } else {
        logger.error(`Failed to send final warning for application ${application.id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      logger.error(`Error sending final warning for application ${application.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send permit expiration notification (3 days before)
   */
  async sendPermitExpirationNotification(permit, user) {
    try {
      const db = require('../db');

      // Check if already sent
      const existing = await db.query(`
        SELECT id FROM permit_expiration_notifications
        WHERE application_id = $1 AND notification_type = 'three_day_warning'
      `, [permit.id]);

      if (existing.rows.length > 0) {
        logger.debug(`3-day expiration notification already sent for permit ${permit.id}`);
        return { success: true, alreadySent: true };
      }

      const expirationDate = new Date(permit.fecha_vencimiento).toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const subject = '⚠️ Tu permiso vence en 3 días';
      const html = `
        <h2>Tu Permiso Provisional Vence Pronto</h2>
        <p>Hola ${permit.nombre_completo},</p>
        <p>Te informamos que tu permiso provisional vence en <strong>3 días</strong>.</p>

        <h3>Información de tu permiso:</h3>
        <ul>
          <li><strong>Folio:</strong> ${permit.folio}</li>
          <li><strong>Vehículo:</strong> ${permit.marca} ${permit.linea} ${permit.ano_modelo}</li>
          <li><strong>Fecha de vencimiento:</strong> ${expirationDate}</li>
        </ul>

        <p><strong>¿Necesitas renovar tu permiso?</strong></p>
        <p>Puedes renovarlo fácilmente por WhatsApp escribiendo "renovar" al 664-163-3345.</p>
        <p>Costo: $99 MXN | Tiempo: 30 segundos</p>

        <p>Saludos,<br>Equipo de Permisos Digitales</p>
      `;

      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject,
        html
      });

      if (emailResult.success) {
        await db.query(`
          INSERT INTO permit_expiration_notifications (application_id, notification_type, sent_at)
          VALUES ($1, 'three_day_warning', NOW())
        `, [permit.id]);

        logger.info(`3-day expiration notification sent for permit ${permit.id}`, {
          email: user.email
        });
      }

      return emailResult;
    } catch (error) {
      logger.error(`Error sending 3-day expiration notification for permit ${permit.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send permit expiration notification (day of expiry)
   */
  async sendPermitExpiryDayNotification(permit, user) {
    try {
      const db = require('../db');

      // Check if already sent
      const existing = await db.query(`
        SELECT id FROM permit_expiration_notifications
        WHERE application_id = $1 AND notification_type = 'expiry_day'
      `, [permit.id]);

      if (existing.rows.length > 0) {
        logger.debug(`Expiry day notification already sent for permit ${permit.id}`);
        return { success: true, alreadySent: true };
      }

      const expirationDate = new Date(permit.fecha_vencimiento).toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const subject = '🚨 Tu permiso vence HOY';
      const html = `
        <h2 style="color: #d32f2f;">¡Tu Permiso Vence HOY!</h2>
        <p>Hola ${permit.nombre_completo},</p>
        <p>Tu permiso provisional <strong>vence HOY</strong>.</p>

        <h3>Información de tu permiso:</h3>
        <ul>
          <li><strong>Folio:</strong> ${permit.folio}</li>
          <li><strong>Vehículo:</strong> ${permit.marca} ${permit.linea} ${permit.ano_modelo}</li>
          <li><strong>Vence:</strong> ${expirationDate} (HOY)</li>
        </ul>

        <p><strong>🔴 ¡Renueva ahora!</strong></p>
        <p>Escribe "renovar" al WhatsApp 664-163-3345</p>
        <p>Costo: $99 MXN | Válido hasta: Medianoche</p>

        <p>Saludos,<br>Equipo de Permisos Digitales</p>
      `;

      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject,
        html
      });

      if (emailResult.success) {
        await db.query(`
          INSERT INTO permit_expiration_notifications (application_id, notification_type, sent_at)
          VALUES ($1, 'expiry_day', NOW())
        `, [permit.id]);

        logger.info(`Expiry day notification sent for permit ${permit.id}`, {
          email: user.email
        });
      }

      return emailResult;
    } catch (error) {
      logger.error(`Error sending expiry day notification for permit ${permit.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process active permit expiration notifications
   */
  async processPermitExpirationNotifications() {
    try {
      logger.info('Processing active permit expiration notifications');
      const db = require('../db');

      const results = {
        threeDayWarnings: 0,
        expiryDayWarnings: 0,
        errors: 0
      };

      // Get permits expiring in 3 days
      const threeDayPermits = await db.query(`
        SELECT a.*, u.email, u.id as user_id
        FROM permit_applications a
        JOIN users u ON a.user_id = u.id
        WHERE a.status IN ('PERMIT_READY', 'ACTIVE')
        AND a.fecha_vencimiento::date = CURRENT_DATE + INTERVAL '3 days'
        AND u.email IS NOT NULL
      `);

      for (const permit of threeDayPermits.rows) {
        try {
          const result = await this.sendPermitExpirationNotification(permit, permit);
          if (result.success && !result.alreadySent) {
            results.threeDayWarnings++;
          }
        } catch (error) {
          logger.error(`Error sending 3-day notification for permit ${permit.id}:`, error);
          results.errors++;
        }
      }

      // Get permits expiring today
      const expiryDayPermits = await db.query(`
        SELECT a.*, u.email, u.id as user_id
        FROM permit_applications a
        JOIN users u ON a.user_id = u.id
        WHERE a.status IN ('PERMIT_READY', 'ACTIVE')
        AND a.fecha_vencimiento::date = CURRENT_DATE
        AND u.email IS NOT NULL
      `);

      for (const permit of expiryDayPermits.rows) {
        try {
          const result = await this.sendPermitExpiryDayNotification(permit, permit);
          if (result.success && !result.alreadySent) {
            results.expiryDayWarnings++;
          }
        } catch (error) {
          logger.error(`Error sending expiry day notification for permit ${permit.id}:`, error);
          results.errors++;
        }
      }

      logger.info('Active permit expiration notifications completed', results);
      return results;
    } catch (error) {
      logger.error('Error processing active permit expiration notifications:', error);
      throw error;
    }
  }

  /**
   * Process all pending reminders (legacy - for unpaid applications)
   */
  async processExpirationReminders() {
    try {
      logger.info('Processing expiration reminders');

      const results = {
        expirationWarnings: 0,
        finalWarnings: 0,
        errors: 0,
        total: 0
      };

      // Get applications needing reminders using repository
      const applicationsNeedingReminders = await reminderRepository.getApplicationsNeedingReminders();

      // Process expiration warnings
      for (const row of applicationsNeedingReminders.expiration_warnings) {
        try {
          const result = await this.sendExpirationWarning(row, row);
          if (result.success && result.sent) {
            results.expirationWarnings++;
          }
          results.total++;
        } catch (error) {
          logger.error(`Error processing expiration warning for application ${row.id}:`, error);
          results.errors++;
        }
      }

      // Process final warnings
      for (const row of applicationsNeedingReminders.final_warnings) {
        try {
          const result = await this.sendFinalWarning(row, row);
          if (result.success && result.sent) {
            results.finalWarnings++;
          }
          results.total++;
        } catch (error) {
          logger.error(`Error processing final warning for application ${row.id}:`, error);
          results.errors++;
        }
      }

      logger.info('Expiration reminders processing completed', {
        results,
        expirationWarningCandidates: applicationsNeedingReminders.expiration_warnings.length,
        finalWarningCandidates: applicationsNeedingReminders.final_warnings.length
      });

      return results;
    } catch (error) {
      logger.error('Error processing expiration reminders:', error);
      throw error;
    }
  }
}

module.exports = EmailReminderService;
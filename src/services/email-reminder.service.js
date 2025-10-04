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
   * Process all pending reminders
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
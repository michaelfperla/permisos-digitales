const { logger } = require('../utils/logger');
const emailReminderService = require('../services/email-reminder.service');
const applicationCleanupJob = require('../jobs/application-cleanup.job');
const ApiResponse = require('../utils/api-response');
const { reminderRepository } = require('../repositories');

/**
 * Admin controller for managing email reminders and cleanup
 */
class AdminRemindersController {
  /**
   * Manually trigger email reminders
   */
  async triggerEmailReminders(req, res) {
    try {
      logger.info('Manual email reminder trigger requested by admin');
      
      const results = await emailReminderService.processExpirationReminders();
      
      return ApiResponse.success(res, {
        message: 'Email reminders processed successfully',
        results
      });
    } catch (error) {
      logger.error('Error in manual email reminder trigger:', error);
      return ApiResponse.error(res, 'Failed to process email reminders', 500);
    }
  }

  /**
   * Manually trigger application cleanup
   */
  async triggerCleanup(req, res) {
    try {
      logger.info('Manual application cleanup trigger requested by admin');
      
      const results = await applicationCleanupJob.execute();
      
      return ApiResponse.success(res, {
        message: 'Application cleanup executed successfully',
        results
      });
    } catch (error) {
      logger.error('Error in manual cleanup trigger:', error);
      return ApiResponse.error(res, 'Failed to execute cleanup', 500);
    }
  }

  /**
   * Get cleanup statistics without executing
   */
  async getCleanupStats(req, res) {
    try {
      const stats = await applicationCleanupJob.getCleanupStats();
      
      return ApiResponse.success(res, {
        message: 'Cleanup statistics retrieved successfully',
        stats
      });
    } catch (error) {
      logger.error('Error getting cleanup stats:', error);
      return ApiResponse.error(res, 'Failed to get cleanup statistics', 500);
    }
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(req, res) {
    try {
      const stats = await reminderRepository.getReminderStats(7);
      
      return ApiResponse.success(res, {
        message: 'Reminder statistics retrieved successfully',
        stats
      });
    } catch (error) {
      logger.error('Error getting reminder stats:', error);
      return ApiResponse.error(res, 'Failed to get reminder statistics', 500);
    }
  }

  /**
   * Test email reminder for specific application
   */
  async testEmailReminder(req, res) {
    try {
      const { applicationId, reminderType } = req.body;
      
      if (!applicationId || !reminderType) {
        return ApiResponse.badRequest(res, 'Application ID and reminder type are required');
      }
      
      if (!['expiration_warning', 'final_warning'].includes(reminderType)) {
        return ApiResponse.badRequest(res, 'Invalid reminder type');
      }
      
      // Get application and user data using repository
      const application = await reminderRepository.executeQuery(`
        SELECT pa.*, u.email, u.first_name, u.last_name
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.id = $1
      `, [applicationId]);
      
      if (application.rows.length === 0) {
        return ApiResponse.notFound(res, 'Application not found');
      }
      
      const app = application.rows[0];
      
      // Send test email
      let emailResult;
      if (reminderType === 'expiration_warning') {
        emailResult = await emailReminderService.sendExpirationWarning(app, app);
      } else {
        emailResult = await emailReminderService.sendFinalWarning(app, app);
      }
      
      return ApiResponse.success(res, {
        message: `Test ${reminderType} email sent successfully`,
        result: emailResult,
        application: {
          id: app.id,
          vehicle: `${app.marca} ${app.linea} ${app.ano_modelo}`,
          email: app.email,
          expires_at: app.expires_at
        }
      });
    } catch (error) {
      logger.error('Error sending test email reminder:', error);
      return ApiResponse.error(res, 'Failed to send test email reminder', 500);
    }
  }
}

module.exports = new AdminRemindersController();
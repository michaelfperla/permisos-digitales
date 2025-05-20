/**
 * =============================================================================
 * Permisos Digitales - Scheduled Verification Job
 * =============================================================================
 *
 * Daily job that checks for applications with PROOF_RECEIVED_SCHEDULED status
 * and moves them to PROOF_SUBMITTED when their verification date is today.
 */

const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');

/**
 * Determines if a date is a business day (Monday-Friday)
 * @param {Date} date - The date to check
 * @returns {boolean} - True if the date is a business day
 */
function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Gets the latest business day on or before the given date
 * @param {Date} date - The target date
 * @returns {Date} - The latest business day
 */
function getLatestBusinessDay(date) {
  const result = new Date(date);

  // Keep going back one day until we find a business day
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

/**
 * Processes applications that need to be moved to PROOF_SUBMITTED status
 */
async function processScheduledApplications() {
  logger.info('Starting scheduled verification job');

  try {
    // Get current date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Format today as YYYY-MM-DD for SQL
    const todayFormatted = today.toISOString().split('T')[0];

    // Query for scheduled applications
    const { rows } = await db.query(
      `SELECT id, desired_start_date
             FROM permit_applications
             WHERE status = $1 AND desired_start_date IS NOT NULL`,
      [ApplicationStatus.PROOF_RECEIVED_SCHEDULED]
    );

    logger.info(`Found ${rows.length} scheduled applications to process`);

    // Process each application
    for (const app of rows) {
      try {
        // Parse the desired start date
        const desiredStartDate = new Date(app.desired_start_date);

        // Calculate the verification date (latest business day on or before desired start date)
        const verificationDate = getLatestBusinessDay(desiredStartDate);

        // Format verification date as YYYY-MM-DD for comparison
        const verificationDateFormatted = verificationDate.toISOString().split('T')[0];

        // Check if verification date is today
        if (verificationDateFormatted === todayFormatted) {
          logger.info(`Application ${app.id} is ready for verification today (desired start: ${app.desired_start_date})`);

          // Update application status to PROOF_SUBMITTED
          const { rowCount } = await db.query(
            `UPDATE permit_applications
                         SET status = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
            [ApplicationStatus.PROOF_SUBMITTED, app.id]
          );

          if (rowCount > 0) {
            logger.info(`Successfully updated application ${app.id} to ${ApplicationStatus.PROOF_SUBMITTED} status`);
          } else {
            logger.warn(`Failed to update application ${app.id} status`);
          }
        } else {
          logger.debug(`Application ${app.id} is not ready for verification yet (verification date: ${verificationDateFormatted}, today: ${todayFormatted})`);
        }
      } catch (appError) {
        logger.error(`Error processing application ${app.id}:`, appError);
        // Continue with next application
      }
    }

    logger.info('Scheduled verification job completed');
  } catch (error) {
    logger.error('Error in scheduled verification job:', error);
  }
}

module.exports = {
  processScheduledApplications
};

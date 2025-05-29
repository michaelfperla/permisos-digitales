const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');

function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getLatestBusinessDay(date) {
  const result = new Date(date);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

async function processScheduledApplications() {
  logger.info('Starting scheduled verification job');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayFormatted = today.toISOString().split('T')[0];

    const { rows } = await db.query(
      `SELECT id, desired_start_date
             FROM permit_applications
             WHERE status = $1 AND desired_start_date IS NOT NULL`,
      [ApplicationStatus.PROOF_RECEIVED_SCHEDULED]
    );

    logger.info(`Found ${rows.length} scheduled applications to process`);

    for (const app of rows) {
      try {
        const desiredStartDate = new Date(app.desired_start_date);
        const verificationDate = getLatestBusinessDay(desiredStartDate);
        const verificationDateFormatted = verificationDate.toISOString().split('T')[0];

        if (verificationDateFormatted === todayFormatted) {
          logger.info(`Application ${app.id} is ready for verification today (desired start: ${app.desired_start_date})`);

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

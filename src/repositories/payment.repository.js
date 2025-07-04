const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');
const BaseRepository = require('./base.repository');
const { withTransaction } = require('../utils/db-transaction');

class PaymentRepository extends BaseRepository {
  constructor() {
    super('permit_applications');
  }

  async updatePaymentOrder(applicationId, orderId, status = ApplicationStatus.PENDING_PAYMENT, paymentData = null, client = null) {
    try {
      let query;
      let params;

      if (paymentData && paymentData.oxxoReference) {
        query = `
          UPDATE permit_applications
          SET payment_processor_order_id = $1,
              status = $2,
              payment_reference = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `;
        params = [orderId, status, paymentData.oxxoReference, applicationId];
        logger.info(`Updating application ${applicationId} with OXXO reference: ${paymentData.oxxoReference}`);
      } else {
        query = `
          UPDATE permit_applications
          SET payment_processor_order_id = $1,
              status = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `;
        params = [orderId, status, applicationId];
      }

      const dbClient = client || db;
      const { rows } = await dbClient.query(query, params);

      if (rows.length === 0) {
        throw new Error(`Application with ID ${applicationId} not found`);
      }

      return rows[0];
    } catch (error) {
      logger.error(`Error updating payment order for application ${applicationId}:`, {
        error: error.message,
        applicationId,
        orderId,
        status,
        hasPaymentData: !!paymentData
      });
      throw error;
    }
  }

  async updatePaymentStatus(applicationId, status, paymentData = {}, client = null) {
    try {
      const query = `
        UPDATE permit_applications
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const dbClient = client || db;
      const { rows } = await dbClient.query(query, [status, applicationId]);

      if (rows.length === 0) {
        throw new Error(`Application with ID ${applicationId} not found`);
      }

      return rows[0];
    } catch (error) {
      logger.error(`Error updating payment status for application ${applicationId}:`, {
        error: error.message,
        applicationId,
        status,
        paymentData: JSON.stringify(paymentData)
      });
      throw error;
    }
  }

  async findByOrderId(orderId) {
    try {
      const query = `
        SELECT * FROM permit_applications
        WHERE payment_processor_order_id = $1
      `;

      const { rows } = await db.query(query, [orderId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding application by order ID ${orderId}:`, error);
      throw error;
    }
  }

  async findById(applicationId) {
    try {
      const query = `
        SELECT * FROM permit_applications
        WHERE id = $1
      `;

      const { rows } = await db.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding application by ID ${applicationId}:`, error);
      throw error;
    }
  }

  async getPendingPayments(limit = 10, offset = 0) {
    try {
      const query = `
        SELECT pa.id, pa.status, pa.created_at, pa.updated_at,
               pa.payment_processor_order_id, pa.nombre_completo as applicant_name,
               pa.marca, pa.linea, pa.ano_modelo, pa.importe as amount,
               u.email as applicant_email, pa.curp_rfc
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.status = $1
        ORDER BY pa.updated_at DESC
        LIMIT $2 OFFSET $3
      `;

      const { rows } = await db.query(query, [ApplicationStatus.PENDING_PAYMENT, limit, offset]);
      return rows;
    } catch (error) {
      logger.error('Error getting pending payments:', error);
      throw error;
    }
  }

  async countPendingPayments() {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM permit_applications
        WHERE status = $1
      `;

      const { rows } = await db.query(query, [ApplicationStatus.PENDING_PAYMENT]);
      return parseInt(rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting pending payments:', error);
      throw error;
    }
  }

  async logPaymentEvent(eventData, client = null) {
    try {
      const { applicationId, orderId, eventType, eventData: data } = eventData;

      const safeData = data || { empty: true };
      const safeOrderId = orderId || `temp-order-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      const query = `
        INSERT INTO payment_events
        (application_id, order_id, event_type, event_data, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const dbClient = client || db;
      const { rows } = await dbClient.query(query, [
        applicationId,
        safeOrderId,
        eventType,
        JSON.stringify(safeData)
      ]);

      return rows[0];
    } catch (error) {
      logger.error('Error logging payment event:', {
        error: error.message,
        eventType: eventData.eventType,
        applicationId: eventData.applicationId,
        orderId: eventData.orderId
      });
      throw error;
    }
  }

  async processPaymentWithTransaction(applicationId, paymentData, paymentProcessor) {
    return withTransaction(async (client) => {
      try {
        await this.updatePaymentStatus(
          applicationId,
          ApplicationStatus.PROCESSING_PAYMENT,
          {},
          client
        );

        const paymentResult = await paymentProcessor(paymentData);

        await this.updatePaymentOrder(
          applicationId,
          paymentResult.orderId,
          paymentResult.paymentStatus,
          client
        );

        await this.logPaymentEvent({
          applicationId,
          orderId: paymentResult.orderId,
          eventType: 'payment.processed',
          eventData: {
            status: paymentResult.status || 'pending',
            paymentMethod: paymentResult.paymentMethod || 'unknown',
            amount: paymentResult.amount || 0,
            currency: paymentResult.currency || 'MXN',
            timestamp: new Date().toISOString()
          }
        }, client);

        return paymentResult;
      } catch (error) {
        logger.error('Error processing payment with transaction:', {
          error: error.message,
          applicationId
        });

        throw error;
      }
    });
  }

  /**
   * Check if a webhook event has already been processed
   * @param {string} eventId - Webhook event ID
   * @returns {Promise<boolean>} - Whether the event has been processed
   */
  async isEventProcessed(eventId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM webhook_events
        WHERE event_id = $1
      `;

      const { rows } = await db.query(query, [eventId]);
      return parseInt(rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error checking if webhook event is processed:', {
        error: error.message,
        eventId
      });
      // Default to false to allow processing in case of error
      return false;
    }
  }

  /**
   * Mark a webhook event as processed
   * @param {string} eventId - Webhook event ID
   * @param {string} eventType - Webhook event type
   * @param {Object} client - Database client (optional, for transactions)
   * @returns {Promise<Object>} - Created log entry
   */
  async markEventAsProcessed(eventId, eventType, client = null) {
    try {
      const query = `
        INSERT INTO webhook_events
        (event_id, event_type, processed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      // Use the provided client or the default db connection
      const dbClient = client || db;
      const { rows } = await dbClient.query(query, [eventId, eventType]);

      return rows[0];
    } catch (error) {
      logger.error('Error marking webhook event as processed:', {
        error: error.message,
        eventId,
        eventType
      });
      throw error;
    }
  }

  /**
   * Try to record a webhook event, returning whether it's a new event
   * @param {string} eventId - Webhook event ID
   * @param {string} eventType - Webhook event type
   * @param {Object} client - Database client (optional, for transactions)
   * @returns {Promise<boolean>} - True if event was recorded (new), false if duplicate
   */
  async tryRecordEvent(eventId, eventType, client = null) {
    try {
      // Skip if no event ID (shouldn't happen with Stripe)
      if (!eventId) {
        logger.warn('Attempted to record webhook event with no ID');
        return true; // Process it anyway
      }

      const query = `
        INSERT INTO webhook_events
        (event_id, event_type, processed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING id
      `;

      // Use the provided client or the default db connection
      const dbClient = client || db;
      const { rows } = await dbClient.query(query, [eventId, eventType]);

      // If we got a row back, the insert succeeded (new event)
      // If no row, it was a duplicate (ON CONFLICT prevented insert)
      const isNewEvent = rows.length > 0;

      if (!isNewEvent) {
        logger.info(`Duplicate webhook event detected: ${eventId} (${eventType})`);
      } else {
        logger.debug(`Recorded new webhook event: ${eventId} (${eventType})`);
      }

      return isNewEvent;
    } catch (error) {
      logger.error('Error recording webhook event:', {
        error: error.message,
        eventId,
        eventType
      });
      // Default to true to allow processing in case of error
      // This is safer than potentially missing events
      return true;
    }
  }

  /**
   * Store a payment state parameter for CSRF protection
   * @param {number} applicationId - Application ID
   * @param {string} stateParam - State parameter for CSRF protection
   * @param {Object} client - Database client (optional, for transactions)
   * @returns {Promise<Object>} - Created state entry
   */
  async storePaymentState(applicationId, stateParam, client = null) {
    try {
      // Create a payment state entry with expiration (30 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const query = `
        INSERT INTO payment_states
        (application_id, state_param, expires_at, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      // Use the provided client or the default db connection
      const dbClient = client || db;
      const { rows } = await dbClient.query(query, [
        applicationId,
        stateParam,
        expiresAt
      ]);

      logger.debug(`Stored payment state for application ${applicationId}`);
      return rows[0];
    } catch (error) {
      logger.error(`Error storing payment state for application ${applicationId}:`, {
        error: error.message,
        applicationId
      });
      throw error;
    }
  }

  /**
   * Get payment state parameter for CSRF protection
   * @param {number} applicationId - Application ID
   * @returns {Promise<string|null>} - State parameter or null if not found or expired
   */
  async getPaymentState(applicationId) {
    try {
      // Get the most recent non-expired state parameter
      const query = `
        SELECT state_param
        FROM payment_states
        WHERE application_id = $1
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const { rows } = await db.query(query, [applicationId]);

      if (rows.length === 0) {
        logger.warn(`No valid payment state found for application ${applicationId}`);
        return null;
      }

      return rows[0].state_param;
    } catch (error) {
      logger.error(`Error getting payment state for application ${applicationId}:`, {
        error: error.message,
        applicationId
      });
      return null;
    }
  }

  /**
   * Invalidate payment state parameter after use
   * @param {number} applicationId - Application ID
   * @param {string} stateParam - State parameter to invalidate
   * @returns {Promise<boolean>} - Whether the state was invalidated
   */
  async invalidatePaymentState(applicationId, stateParam) {
    try {
      const query = `
        UPDATE payment_states
        SET used = true,
            used_at = CURRENT_TIMESTAMP
        WHERE application_id = $1
        AND state_param = $2
        AND used = false
        RETURNING id
      `;

      const { rows } = await db.query(query, [applicationId, stateParam]);

      const invalidated = rows.length > 0;
      if (invalidated) {
        logger.debug(`Invalidated payment state for application ${applicationId}`);
      } else {
        logger.warn(`Failed to invalidate payment state for application ${applicationId}`);
      }

      return invalidated;
    } catch (error) {
      logger.error(`Error invalidating payment state for application ${applicationId}:`, {
        error: error.message,
        applicationId
      });
      return false;
    }
  }

  /**
   * Get OXXO payments that are expiring soon
   * @param {number} hoursUntilExpiration - Hours until expiration to look for
   * @returns {Promise<Array>} - Array of expiring OXXO payments with application and user details
   */
  async getExpiringOxxoPayments(hoursUntilExpiration = 24) {
    try {
      logger.debug(`Looking for OXXO payments expiring within ${hoursUntilExpiration} hours`);

      // Calculate the timestamp range for expiring payments
      // Current time + hoursUntilExpiration = expiration threshold
      const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
      const expirationThreshold = currentTimestamp + (hoursUntilExpiration * 60 * 60); // Add hours in seconds

      // Query to find applications with OXXO payments that are:
      // 1. In AWAITING_OXXO_PAYMENT status
      // 2. Have payment events with expiresAt within the threshold
      const query = `
        WITH latest_oxxo_events AS (
          SELECT
            pe.application_id,
            pe.order_id,
            pe.event_data->>'oxxoReference' as oxxo_reference,
            (pe.event_data->>'expiresAt')::numeric as expires_at,
            ROW_NUMBER() OVER (PARTITION BY pe.application_id ORDER BY pe.created_at DESC) as rn
          FROM payment_events pe
          WHERE pe.event_type = 'oxxo.payment.created'
          AND (pe.event_data->>'expiresAt')::numeric IS NOT NULL
        )
        SELECT
          pa.id as application_id,
          pa.user_id,
          pa.nombre_completo,
          pa.marca,
          pa.linea,
          pa.ano_modelo,
          pa.importe as amount,
          u.email as user_email,
          u.first_name,
          u.last_name,
          u.phone,
          le.order_id,
          le.oxxo_reference,
          le.expires_at,
          to_timestamp(le.expires_at) as expires_at_date
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        JOIN latest_oxxo_events le ON pa.id = le.application_id AND le.rn = 1
        WHERE pa.status = $1
        AND le.expires_at > $2
        AND le.expires_at <= $3
        ORDER BY le.expires_at ASC
      `;

      const { rows } = await db.query(query, [
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        currentTimestamp,
        expirationThreshold
      ]);

      logger.info(`Found ${rows.length} OXXO payments expiring within ${hoursUntilExpiration} hours`);
      return rows;
    } catch (error) {
      logger.error('Error getting expiring OXXO payments:', {
        error: error.message,
        hoursUntilExpiration
      });
      throw error;
    }
  }
}

// Create and export a singleton instance
const paymentRepository = new PaymentRepository();
module.exports = paymentRepository;

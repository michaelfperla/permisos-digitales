/**
 * Application Repository
 * Handles database operations for permit applications
 */
const BaseRepository = require('./base.repository');
const db = require('../db');
const { withTransaction } = require('../db/transaction');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');
const { NotFoundError, DatabaseError } = require('../utils/errors');

class ApplicationRepository extends BaseRepository {
  constructor() {
    super('permit_applications');
  }

  /**
   * Find applications by user ID
   * @param {number} userId - User ID
   * @param {Object} options - Additional options (limit, offset, orderBy)
   * @returns {Promise<Array>} - Array of applications
   */
  async findByUserId(userId, options = {}) {
    const orderBy = options.orderBy || 'created_at DESC';
    return this.findAll({ user_id: userId }, { ...options, orderBy });
  }

  /**
   * Find applications by status
   * @param {string} status - Application status
   * @param {Object} options - Additional options (limit, offset, orderBy)
   * @returns {Promise<Array>} - Array of applications
   */
  async findByStatus(status, options = {}) {
    const orderBy = options.orderBy || 'created_at ASC';
    return this.findAll({ status }, { ...options, orderBy });
  }

  /**
   * Find applications pending payment verification
   * @param {Object} options - Additional options (limit, offset)
   * @returns {Promise<Array>} - Array of applications
   *
   * [Refactor - Remove Manual Payment] Repository method to find applications with submitted
   * payment proofs pending verification. Obsolete with third-party payment provider.
   */
  /*
  async findPendingVerifications(options = {}) {
    return this.findByStatus(ApplicationStatus.PROOF_SUBMITTED, options);
  }
  */

  /**
   * Find applications pending payment verification with pagination
   * @param {Object} pagination - Pagination options (page, limit)
   * @returns {Promise<{applications: Array, total: number, page: number, limit: number, totalPages: number}>} - Paginated applications
   *
   * [Refactor - Remove Manual Payment] Repository method to find and paginate applications with submitted
   * payment proofs pending verification. Obsolete with third-party payment provider.
   */
  /*
  async findPendingVerificationsWithPagination(pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build queries
    const countQuery = `
      SELECT COUNT(*)
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.status = $1
    `;

    const query = `
      SELECT pa.id, pa.status, pa.created_at, pa.payment_proof_uploaded_at,
             pa.payment_reference, pa.nombre_completo as applicant_name, pa.marca, pa.linea, pa.ano_modelo,
             u.email as applicant_email, pa.curp_rfc, pa.importe as amount
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.status = $1
      ORDER BY pa.payment_proof_uploaded_at ASC
      LIMIT $2 OFFSET $3
    `;

    try {
      // Get total count
      const countResult = await db.query(countQuery, [ApplicationStatus.PROOF_SUBMITTED]);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated applications
      const { rows } = await db.query(query, [ApplicationStatus.PROOF_SUBMITTED, limit, offset]);

      // Format the data to match frontend expectations
      const formattedRows = rows.map(row => ({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        payment_proof_uploaded_at: row.payment_proof_uploaded_at,
        payment_reference: row.payment_reference,
        applicant_name: row.applicant_name,
        applicant_email: row.applicant_email,
        amount: row.amount || 197.00, // Default amount if not set
        marca: row.marca,
        linea: row.linea,
        ano_modelo: row.ano_modelo,
        curp_rfc: row.curp_rfc
      }));

      return {
        applications: formattedRows,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error in findPendingVerificationsWithPagination:', error);
      throw error;
    }
  }
  */

  /**
   * Find applications with expiring permits
   * @param {number} userId - User ID
   * @param {number} daysThreshold - Days threshold for expiration
   * @returns {Promise<Array>} - Array of applications with expiring permits
   */
  async findExpiringPermits(userId, daysThreshold = 30) {
    const query = `
      SELECT id, status, folio, marca, linea, ano_modelo,
             fecha_expedicion, fecha_vencimiento, created_at
      FROM permit_applications
      WHERE user_id = $1
        AND status IN ($2, $3)
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '${daysThreshold} days'
        AND fecha_vencimiento >= CURRENT_DATE
      ORDER BY fecha_vencimiento ASC
    `;

    try {
      const { rows } = await db.query(query, [
        userId,
        ApplicationStatus.PERMIT_READY,
        ApplicationStatus.COMPLETED
      ]);
      return rows;
    } catch (error) {
      logger.error('Error in findExpiringPermits:', error);
      throw error;
    }
  }

  /**
   * Submit payment proof for an application
   * @param {number} applicationId - Application ID
   * @param {number} userId - User ID
   * @param {string} paymentProofPath - Path to payment proof file
   * @param {string} paymentReference - Payment reference
   * @param {Date|null} desiredStartDate - Desired start date
   * @returns {Promise<Object>} - Updated application
   *
   * [Refactor - Remove Manual Payment] Repository method to update application status after manual proof submission.
   * Obsolete with third-party payment provider.
   */
  /*
  async submitPaymentProof(applicationId, userId, paymentProofPath, paymentReference = null, desiredStartDate = null) {
    // Determine the new status based on whether there's a desired start date
    const newStatus = desiredStartDate
      ? ApplicationStatus.PROOF_RECEIVED_SCHEDULED
      : ApplicationStatus.PROOF_SUBMITTED;

    let query;
    let params;

    if (desiredStartDate) {
      query = `
        UPDATE permit_applications
        SET status = $1,
            payment_proof_path = $2,
            payment_proof_uploaded_at = CURRENT_TIMESTAMP,
            payment_reference = $3,
            desired_start_date = $4,
            updated_at = CURRENT_TIMESTAMP,
            payment_rejection_reason = NULL
        WHERE id = $5 AND user_id = $6
        RETURNING *
      `;
      params = [newStatus, paymentProofPath, paymentReference, desiredStartDate, applicationId, userId];
    } else {
      query = `
        UPDATE permit_applications
        SET status = $1,
            payment_proof_path = $2,
            payment_proof_uploaded_at = CURRENT_TIMESTAMP,
            payment_reference = $3,
            updated_at = CURRENT_TIMESTAMP,
            payment_rejection_reason = NULL
        WHERE id = $4 AND user_id = $5
        RETURNING *
      `;
      params = [newStatus, paymentProofPath, paymentReference, applicationId, userId];
    }

    try {
      const { rows } = await db.query(query, params);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in submitPaymentProof:', error);
      throw error;
    }
  }
  */

  /**
   * Verify payment for an application
   * @param {number} applicationId - Application ID
   * @param {number} adminId - Admin user ID
   * @param {string} notes - Verification notes
   * @returns {Promise<Object>} - Updated application
   *
   * [Refactor - Remove Manual Payment] Repository method to approve a payment proof.
   * Obsolete with third-party payment provider.
   */
  /*
  async verifyPayment(applicationId, adminId, notes = null) {
    try {
      // Use transaction to ensure both operations succeed or fail together
      return await withTransaction(async (client) => {
        // 1. Update application status
        const updateQuery = `
          UPDATE permit_applications
          SET status = $1,
              payment_verified_by = $2,
              payment_verified_at = CURRENT_TIMESTAMP,
              payment_notes = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `;

        const { rows } = await client.query(updateQuery, [
          ApplicationStatus.PAYMENT_RECEIVED,
          adminId,
          notes,
          applicationId
        ]);

        if (rows.length === 0) {
          throw new NotFoundError(`Application with ID ${applicationId} not found`);
        }

        // 2. Log the verification action
        const logQuery = `
          INSERT INTO payment_verification_log
          (application_id, verified_by, action, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;

        await client.query(logQuery, [
          applicationId,
          adminId,
          'verify',
          notes
        ]);

        logger.info(`Payment verified for application ${applicationId} by admin ${adminId}`);
        return rows[0];
      }, { context: `verifyPayment:${applicationId}` });
    } catch (error) {
      logger.error(`Error in verifyPayment for application ${applicationId}:`, error);
      throw error;
    }
  }
  */

  /**
   * Reject payment proof for an application
   * @param {number} applicationId - Application ID
   * @param {number} adminId - Admin user ID
   * @param {string} rejectionReason - Rejection reason
   * @returns {Promise<Object>} - Updated application
   *
   * [Refactor - Remove Manual Payment] Repository method to reject a payment proof.
   * Obsolete with third-party payment provider.
   */
  /*
  async rejectPayment(applicationId, adminId, rejectionReason) {
    try {
      // Use transaction to ensure both operations succeed or fail together
      return await withTransaction(async (client) => {
        // 1. Update application status
        const updateQuery = `
          UPDATE permit_applications
          SET status = $1,
              payment_verified_by = $2,
              payment_verified_at = CURRENT_TIMESTAMP,
              payment_rejection_reason = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `;

        const { rows } = await client.query(updateQuery, [
          ApplicationStatus.PROOF_REJECTED,
          adminId,
          rejectionReason,
          applicationId
        ]);

        if (rows.length === 0) {
          throw new NotFoundError(`Application with ID ${applicationId} not found`);
        }

        // 2. Log the rejection action
        const logQuery = `
          INSERT INTO payment_verification_log
          (application_id, verified_by, action, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;

        await client.query(logQuery, [
          applicationId,
          adminId,
          'reject',
          rejectionReason
        ]);

        logger.info(`Payment rejected for application ${applicationId} by admin ${adminId}: ${rejectionReason}`);
        return rows[0];
      }, { context: `rejectPayment:${applicationId}` });
    } catch (error) {
      logger.error(`Error in rejectPayment for application ${applicationId}:`, error);
      throw error;
    }
  }
  */

  /**
   * Update application status
   * @param {number} applicationId - Application ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated application
   */
  async updateStatus(applicationId, status) {
    const query = `
      UPDATE permit_applications
      SET status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    try {
      const { rows } = await db.query(query, [status, applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in updateStatus:', error);
      throw error;
    }
  }

  /**
   * Update permit file paths
   * @param {number} applicationId - Application ID
   * @param {Object} filePaths - Object with file paths
   * @returns {Promise<Object>} - Updated application
   */
  async updatePermitFiles(applicationId, filePaths) {
    const { permitPath, reciboPath, certificadoPath } = filePaths;

    const query = `
      UPDATE permit_applications
      SET permit_file_path = $1,
          recibo_file_path = $2,
          certificado_file_path = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    try {
      const { rows } = await db.query(query, [
        permitPath,
        reciboPath,
        certificadoPath,
        applicationId
      ]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in updatePermitFiles:', error);
      throw error;
    }
  }

  /**
   * Get verification history
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Additional options (limit, offset)
   * @returns {Promise<Array>} - Array of verification records
   */
  async getVerificationHistory(filters = {}, options = {}) {
    const { startDate, endDate, verifiedBy, action } = filters;
    const { limit = 100, offset = 0 } = options;

    const params = [];
    const whereClauses = [];

    if (startDate) {
      params.push(startDate);
      whereClauses.push(`pvl.created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      whereClauses.push(`pvl.created_at <= $${params.length}`);
    }

    if (verifiedBy) {
      params.push(verifiedBy);
      whereClauses.push(`pvl.verified_by = $${params.length}`);
    }

    if (action) {
      params.push(action);
      whereClauses.push(`pvl.action = $${params.length}`);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    params.push(limit, offset);

    const query = `
      SELECT pvl.*,
             pa.folio, pa.marca, pa.linea, pa.color, pa.numero_serie,
             u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name
      FROM payment_verification_log pvl
      JOIN permit_applications pa ON pvl.application_id = pa.id
      JOIN users u ON pvl.verified_by = u.id
      ${whereClause}
      ORDER BY pvl.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    try {
      const { rows } = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error('Error in getVerificationHistory:', error);
      throw error;
    }
  }

  /**
   * Log payment verification action
   * @param {number} applicationId - Application ID
   * @param {number} adminId - Admin user ID
   * @param {string} action - Action type (verify, reject)
   * @param {string} notes - Action notes
   * @returns {Promise<Object>} - Created log entry
   *
   * [Refactor - Remove Manual Payment] Repository method to log payment verification actions.
   * Obsolete with third-party payment provider.
   */
  /*
  async logVerificationAction(applicationId, adminId, action, notes = null) {
    const query = `
      INSERT INTO payment_verification_log
      (application_id, verified_by, action, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const { rows } = await db.query(query, [
        applicationId,
        adminId,
        action,
        notes
      ]);
      return rows[0];
    } catch (error) {
      logger.error('Error in logVerificationAction:', error);
      throw error;
    }
  }
  */

  /**
   * Find applications with pagination and filtering
   * @param {Object} filters - Filter criteria (status, startDate, endDate, searchTerm)
   * @param {Object} pagination - Pagination options (page, limit)
   * @returns {Promise<{applications: Array, total: number, page: number, limit: number, totalPages: number}>} - Paginated applications
   */
  async findApplicationsWithPagination(filters = {}, pagination = {}) {
    const { status, startDate, endDate, searchTerm } = filters;
    const { page = 1, limit = 10 } = pagination;

    const offset = (page - 1) * limit;
    const params = [];

    // Build base query
    let countQuery = `
      SELECT COUNT(*)
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE 1=1
    `;

    let query = `
      SELECT pa.id, pa.status, pa.created_at, pa.payment_proof_uploaded_at,
             pa.payment_verified_at,
             pa.payment_reference, pa.nombre_completo, pa.marca, pa.linea, pa.ano_modelo,
             u.email as user_email
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE 1=1
    `;

    // Add filters if provided
    if (status) {
      params.push(status);
      query += ` AND pa.status = $${params.length}`;
      countQuery += ` AND pa.status = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND pa.created_at >= $${params.length}::date`;
      countQuery += ` AND pa.created_at >= $${params.length}::date`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND pa.created_at <= ($${params.length}::date + interval '1 day')`;
      countQuery += ` AND pa.created_at <= ($${params.length}::date + interval '1 day')`;
    }

    if (searchTerm) {
      const searchParam = `%${searchTerm}%`;
      params.push(searchParam);
      const searchCondition = ` AND (
        pa.nombre_completo ILIKE $${params.length} OR
        pa.marca ILIKE $${params.length} OR
        pa.linea ILIKE $${params.length} OR
        pa.curp_rfc ILIKE $${params.length} OR
        CAST(pa.id AS TEXT) = '${searchTerm}'
      )`;
      query += searchCondition;
      countQuery += searchCondition;
    }

    // Add order by
    query += ' ORDER BY pa.created_at DESC';

    // Add pagination
    const queryParams = [...params];
    queryParams.push(limit);
    queryParams.push(offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    try {
      // Get total count
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated applications
      const { rows } = await db.query(query, queryParams);

      return {
        applications: rows,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error in findApplicationsWithPagination:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} - Dashboard statistics
   */
  async getDashboardStats() {
    try {
      // Get status counts
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM permit_applications
        GROUP BY status
      `;
      const statusResults = await db.query(statusQuery);

      // Get today's verifications
      const todayQuery = `
        SELECT
          SUM(CASE WHEN action = 'verify' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN action = 'reject' THEN 1 ELSE 0 END) as rejected
        FROM payment_verification_log
        WHERE created_at >= CURRENT_DATE
      `;
      const todayResults = await db.query(todayQuery);

      // Get pending verifications count
      const pendingQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications
        WHERE status = $1
      `;
      const pendingResults = await db.query(pendingQuery, [ApplicationStatus.PROOF_SUBMITTED]);

      return {
        statusCounts: statusResults.rows,
        todayVerifications: {
          approved: parseInt(todayResults.rows[0]?.approved || 0),
          rejected: parseInt(todayResults.rows[0]?.rejected || 0)
        },
        pendingVerifications: parseInt(pendingResults.rows[0]?.count || 0)
      };
    } catch (error) {
      logger.error('Error in getDashboardStats:', error);
      throw error;
    }
  }
}

module.exports = new ApplicationRepository();


const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');

class ApplicationRepository extends BaseRepository {
  constructor() {
    super('permit_applications', 'id');
  }

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
      SELECT pa.id, pa.status, pa.created_at,
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
   * Find applications by user ID
   * @param {number} userId - User ID to find applications for
   * @returns {Promise<Array>} - Array of applications for the user
   */
  async findByUserId(userId) {
    try {
      const query = `
        SELECT
          id,
          status,
          nombre_completo,
          marca,
          linea,
          ano_modelo,
          color,
          numero_serie,
          numero_motor,
          curp_rfc,
          domicilio,
          importe,
          folio,
          fecha_vencimiento,
          created_at,
          updated_at,
          permit_file_path,
          recibo_file_path,
          certificado_file_path,
          placas_file_path
        FROM permit_applications
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const { rows } = await db.query(query, [userId]);
      logger.debug(`Found ${rows.length} applications for user ${userId}`);

      return rows;
    } catch (error) {
      logger.error(`Error in findByUserId for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Find expiring permits for a user
   * @param {number} userId - User ID to find expiring permits for
   * @returns {Promise<Array>} - Array of expiring permits for the user
   */
  async findExpiringPermits(userId) {
    try {
      // Find permits that are expiring within 30 days
      const query = `
        SELECT
          id,
          status,
          nombre_completo,
          marca,
          linea,
          ano_modelo,
          fecha_vencimiento,
          created_at
        FROM permit_applications
        WHERE user_id = $1
          AND status = 'PERMIT_READY'
          AND fecha_vencimiento IS NOT NULL
          AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')
          AND fecha_vencimiento >= CURRENT_DATE
        ORDER BY fecha_vencimiento ASC
      `;

      const { rows } = await db.query(query, [userId]);
      logger.debug(`Found ${rows.length} expiring permits for user ${userId}`);

      return rows;
    } catch (error) {
      logger.error(`Error in findExpiringPermits for user ${userId}:`, error);
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

      // Get pending verifications count - using AWAITING_OXXO_PAYMENT status
      const pendingQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications
        WHERE status = $1
      `;
      const pendingResults = await db.query(pendingQuery, [ApplicationStatus.AWAITING_OXXO_PAYMENT]);

      return {
        statusCounts: statusResults.rows,
        todayVerifications: {
          approved: 0,
          rejected: 0
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

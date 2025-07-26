
const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/logger');
const { ApplicationStatus } = require('../constants');
const PaymentStateMachine = require('../services/payment-state-machine.service');
const paymentStateMachine = new PaymentStateMachine();

class ApplicationRepository extends BaseRepository {
  constructor() {
    super('permit_applications', 'id');
  }

  async findApplicationsWithPagination(filters = {}, pagination = {}) {
    const { status, startDate, endDate, searchTerm } = filters;
    const { page = 1, limit = 10 } = pagination;

    const offset = (page - 1) * limit;
    const params = [];

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
      // Add exact searchTerm for ID comparison
      params.push(searchTerm);
      const searchCondition = ` AND (
        pa.nombre_completo ILIKE $${params.length - 1} OR
        pa.marca ILIKE $${params.length - 1} OR
        pa.linea ILIKE $${params.length - 1} OR
        pa.curp_rfc ILIKE $${params.length - 1} OR
        CAST(pa.id AS TEXT) = $${params.length}
      )`;
      query += searchCondition;
      countQuery += searchCondition;
    }

    query += ' ORDER BY pa.created_at DESC';

    const queryParams = [...params];
    queryParams.push(limit);
    queryParams.push(offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    try {
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

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
          fecha_expedicion,
          created_at,
          updated_at,
          permit_file_path,
          certificado_file_path,
          placas_file_path,
          recomendaciones_file_path
        FROM permit_applications
        WHERE user_id = $1
          AND (
            -- Show permits that have been paid and are active or expired
            status IN ('PERMIT_READY', 'COMPLETED', 'VENCIDO')
            OR
            -- Show permits that are currently in payment process (not yet expired)
            (status IN ('AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING', 'PAYMENT_RECEIVED', 'GENERATING_PERMIT')
             AND (expires_at IS NULL OR expires_at > NOW()))
          )
        ORDER BY created_at DESC
      `;

      const { rows } = await db.query(query, [userId]);
      logger.debug(`Found ${rows.length} filtered applications for user ${userId} (excluding old unpaid permits)`);

      return rows;
    } catch (error) {
      logger.error(`Error in findByUserId for user ${userId}:`, error);
      throw error;
    }
  }

  async findExpiringPermits(userId) {
    try {
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

  async findPendingPaymentByUserId(userId) {
    try {
      const query = `
        SELECT
          id,
          status,
          nombre_completo,
          marca,
          linea,
          ano_modelo,
          importe,
          created_at,
          expires_at,
          payment_initiated_at
        FROM permit_applications
        WHERE user_id = $1
          AND status IN ('AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING')
          AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const { rows } = await db.query(query, [userId]);
      logger.debug(`Found ${rows.length} pending applications for user ${userId}`);

      return rows;
    } catch (error) {
      logger.error(`Error in findPendingPaymentByUserId for user ${userId}:`, error);
      throw error;
    }
  }

  async getDashboardStats() {
    try {
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM permit_applications
        GROUP BY status
      `;
      const statusResults = await db.query(statusQuery);

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

  /**
   * Get queue status for an application
   * @param {number} applicationId 
   * @returns {Promise<Object>} Queue status information
   */
  async getQueueStatus(applicationId) {
    try {
      const query = `
        SELECT 
          queue_status,
          queue_position,
          queue_entered_at,
          queue_started_at,
          queue_completed_at,
          queue_duration_ms,
          queue_error
        FROM permit_applications
        WHERE id = $1
      `;
      
      const result = await db.query(query, [applicationId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Get applications currently in queue
   * @returns {Promise<Array>} Applications in queue
   */
  async getQueuedApplications() {
    try {
      const query = `
        SELECT 
          id,
          queue_status,
          queue_position,
          queue_entered_at,
          queue_started_at
        FROM permit_applications
        WHERE queue_status IN ('queued', 'processing')
        ORDER BY queue_position ASC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting queued applications:', error);
      throw error;
    }
  }

  /**
   * Get failed applications that need admin attention
   * @returns {Promise<Array>} Failed applications with error details
   */
  async getFailedApplications() {
    try {
      const query = `
        SELECT 
          pa.id,
          pa.user_id,
          CONCAT(u.first_name, ' ', u.last_name) as user_name,
          u.email as user_email,
          u.phone as user_phone,
          pa.puppeteer_error_at as error_time,
          pa.puppeteer_error_message as error_message,
          pa.puppeteer_screenshot_path as screenshot_path,
          pa.marca,
          pa.linea,
          pa.ano_modelo,
          pa.color,
          pa.numero_serie,
          pa.numero_motor,
          pa.nombre_completo,
          pa.curp_rfc,
          pa.domicilio,
          pa.importe,
          pa.admin_resolution_notes as admin_notes,
          pa.resolved_at,
          pa.resolved_by_admin,
          CASE 
            WHEN pa.puppeteer_error_message LIKE '%timeout%' THEN 'TIMEOUT'
            WHEN pa.puppeteer_error_message LIKE '%login%' OR pa.puppeteer_error_message LIKE '%auth%' THEN 'AUTH_FAILURE'
            WHEN pa.puppeteer_error_message LIKE '%portal%' OR pa.puppeteer_error_message LIKE '%elemento no encontrado%' THEN 'PORTAL_CHANGED'
            ELSE 'UNKNOWN'
          END as error_category,
          CASE 
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours' THEN 'CRITICAL'
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '24 hours' THEN 'HIGH'
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '12 hours' THEN 'MEDIUM'
            ELSE 'LOW'
          END as severity,
          CASE 
            WHEN pa.puppeteer_error_message LIKE '%timeout%' THEN 'El portal está lento. Intente nuevamente más tarde.'
            WHEN pa.puppeteer_error_message LIKE '%login%' THEN 'Credenciales incorrectas. Verifique configuración.'
            WHEN pa.puppeteer_error_message LIKE '%elemento no encontrado%' THEN 'El portal ha cambiado. Actualice el código.'
            ELSE 'Error desconocido. Revise manualmente.'
          END as suggestion,
          true as admin_review_required
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.status = $1
          AND pa.puppeteer_error_at IS NOT NULL
        ORDER BY 
          CASE 
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours' THEN 1
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '24 hours' THEN 2
            WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '12 hours' THEN 3
            ELSE 4
          END,
          pa.puppeteer_error_at DESC
      `;
      
      const result = await db.query(query, [ApplicationStatus.ERROR_GENERATING_PERMIT]);
      
      // Transform the data for frontend consumption
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        userPhone: row.user_phone,
        errorTime: row.error_time,
        errorMessage: row.error_message,
        screenshotPath: row.screenshot_path,
        applicationData: {
          marca: row.marca,
          linea: row.linea,
          ano_modelo: row.ano_modelo,
          color: row.color,
          numero_serie: row.numero_serie,
          numero_motor: row.numero_motor,
          nombre_completo: row.nombre_completo,
          curp_rfc: row.curp_rfc,
          domicilio: row.domicilio,
          importe: row.importe
        },
        errorCategory: row.error_category,
        severity: row.severity,
        suggestion: row.suggestion,
        adminReviewRequired: row.admin_review_required,
        resolvedAt: row.resolved_at,
        resolvedByAdmin: row.resolved_by_admin,
        adminNotes: row.admin_notes
      }));
    } catch (error) {
      logger.error('Error getting failed applications:', error);
      throw error;
    }
  }

  /**
   * Mark application as resolved by admin
   * @param {number} applicationId - Application ID
   * @param {Object} resolutionData - Resolution data
   * @returns {Promise<void>}
   */
  async markAsResolved(applicationId, resolutionData) {
    try {
      const { resolvedByAdmin, adminNotes, resolvedAt } = resolutionData;
      
      const query = `
        UPDATE permit_applications
        SET 
          admin_resolution_notes = $1,
          resolved_by_admin = $2,
          resolved_at = $3,
          updated_at = NOW()
        WHERE id = $4
      `;
      
      await db.query(query, [adminNotes, resolvedByAdmin, resolvedAt, applicationId]);
      
      logger.info(`Application ${applicationId} marked as resolved by admin ${resolvedByAdmin}`);
    } catch (error) {
      logger.error(`Error marking application ${applicationId} as resolved:`, error);
      throw error;
    }
  }

  /**
   * Update application with manual PDF uploads
   * @param {number} applicationId - Application ID
   * @param {Object} updateData - Update data including file paths
   * @returns {Promise<void>}
   */
  async updateApplication(applicationId, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 0;

      // Build dynamic update query
      Object.entries(updateData).forEach(([key, value]) => {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
      });

      // Always update the updated_at timestamp
      paramCount++;
      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add the application ID as the last parameter
      paramCount++;
      values.push(applicationId);

      const query = `
        UPDATE permit_applications
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
      `;

      await db.query(query, values);
      
      logger.info(`Application ${applicationId} updated with fields: ${Object.keys(updateData).join(', ')}`);
    } catch (error) {
      logger.error(`Error updating application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Find application with OXXO payment details
   * @param {number} applicationId - Application ID
   * @returns {Promise<Object|null>} Application with OXXO payment info
   */
  async findApplicationWithOxxoDetails(applicationId) {
    try {
      const query = `
        SELECT
          app.*,
          p.event_data ->> 'oxxoReference' AS oxxo_reference,
          p.event_data ->> 'hostedVoucherUrl' AS hosted_voucher_url,
          p.event_data ->> 'expiresAt' AS oxxo_expires_at
        FROM permit_applications app
        LEFT JOIN payment_events p ON app.id = p.application_id 
          AND p.event_type = 'oxxo.payment.created'
          AND app.payment_processor_order_id = p.order_id
        WHERE app.id = $1
        ORDER BY p.created_at DESC
        LIMIT 1
      `;
      
      const { rows } = await db.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding application with OXXO details for ID ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Find application for download with file paths
   * @param {number} applicationId - Application ID
   * @returns {Promise<Object|null>} Application with file paths
   */
  async findApplicationForDownload(applicationId) {
    try {
      const query = `
        SELECT user_id, status, permit_file_path, certificado_file_path, placas_file_path, recomendaciones_file_path, fecha_expedicion, fecha_vencimiento, nombre_completo, folio
        FROM permit_applications
        WHERE id = $1
      `;

      const { rows } = await db.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding application for download ID ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update a single file path for an application
   * @param {number} applicationId - Application ID
   * @param {string} column - Column name (e.g., 'recomendaciones_file_path')
   * @param {string} filePath - File path to set
   * @returns {Promise<boolean>} Success status
   */
  async updateFilePathOnly(applicationId, column, filePath) {
    try {
      // Validate column name to prevent SQL injection
      const allowedColumns = ['permit_file_path', 'certificado_file_path', 'placas_file_path', 'recomendaciones_file_path'];
      if (!allowedColumns.includes(column)) {
        throw new Error(`Invalid column name: ${column}`);
      }

      const query = `
        UPDATE permit_applications
        SET ${column} = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const { rows } = await db.query(query, [filePath, applicationId]);
      const success = rows.length > 0;

      if (success) {
        logger.info(`Updated ${column} for application ${applicationId}: ${filePath}`);
      } else {
        logger.warn(`Failed to update ${column} for application ${applicationId} - application not found`);
      }

      return success;
    } catch (error) {
      logger.error(`Error updating ${column} for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update application status
   * @param {number} applicationId - Application ID
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success indicator
   */
  async updateApplicationStatus(applicationId, status) {
    try {
      const query = `
        UPDATE permit_applications 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `;
      
      const { rowCount } = await db.query(query, [status, applicationId]);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating application status for ID ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update application with state validation
   * @param {number} id - Application ID
   * @param {Object} data - Data to update
   * @param {Object} client - Database client (for transactions)
   * @returns {Promise<Object|null>} Updated application
   */
  async update(id, data, client = null) {
    try {
      // If status is being updated, validate the transition
      if (data.status && !data.skip_state_validation) {
        const dbClient = client || db;
        
        // Get current application state WITHOUT lock if we're already in a transaction
        const query = client 
          ? 'SELECT id, status, payment_processor_order_id FROM permit_applications WHERE id = $1'
          : 'SELECT id, status, payment_processor_order_id FROM permit_applications WHERE id = $1 FOR UPDATE';
        
        const { rows } = await dbClient.query(query, [id]);
        const currentApp = rows[0];
        
        if (!currentApp) {
          throw new Error(`Application ${id} not found`);
        }
        
        // Validate state transition
        const validation = paymentStateMachine.validateTransition(currentApp, data.status);
        if (!validation.isValid) {
          logger.error('Invalid state transition attempted', {
            applicationId: id,
            currentState: currentApp.status,
            requestedState: data.status,
            error: validation.error,
            validTransitions: validation.validTransitions
          });
          throw new Error(validation.error);
        }
        
        // Log the transition
        paymentStateMachine.logTransition(id, currentApp.status, data.status, {
          userId: data.updated_by || 'system',
          source: data.transition_source || 'unknown'
        });
      }
      
      // Call parent update method
      return super.update(id, data, client);
    } catch (error) {
      logger.error(`Error updating application ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find application with specific fields
   * @param {number} applicationId - Application ID
   * @param {Array<string>} fields - Fields to retrieve
   * @returns {Promise<Object|null>} Application with requested fields
   */
  async findApplicationWithFields(applicationId, fields = []) {
    try {
      // Whitelist of allowed field names to prevent SQL injection
      const allowedFields = [
        'id', 'user_id', 'status', 'queue_status', 'queue_position', 'queue_error',
        'nombre_completo', 'curp_rfc', 'domicilio', 'marca', 'linea',
        'ano_modelo', 'color', 'numero_serie', 'numero_motor', 'importe',
        'folio', 'fecha_expedicion', 'fecha_vencimiento', 'permit_file_path',
        'certificado_file_path', 'placas_file_path', 'created_at', 'updated_at',
        'payment_reference', 'payment_processor_order_id', 'queue_entered_at',
        'queue_started_at', 'queue_completed_at', 'queue_duration_ms'
      ];
      
      // Validate and filter fields
      let fieldList = '*';
      if (fields.length > 0) {
        const validFields = fields.filter(field => allowedFields.includes(field));
        if (validFields.length === 0) {
          throw new Error('No valid fields specified');
        }
        fieldList = validFields.join(', ');
      }
      
      const query = `
        SELECT ${fieldList}
        FROM permit_applications
        WHERE id = $1
      `;
      
      const { rows } = await db.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding application with fields for ID ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Create renewal application from existing application
   * @param {Object} renewalData - Data for the renewal application
   * @returns {Promise<Object>} Created application
   */
  async createRenewalApplication(renewalData) {
    try {
      const {
        user_id,
        nombre_completo,
        curp_rfc,
        domicilio,
        marca,
        linea,
        color,
        numero_serie,
        numero_motor,
        ano_modelo,
        renewed_from_id,
        renewal_count,
        status
      } = renewalData;

      const query = `
        INSERT INTO permit_applications (
          user_id, nombre_completo, curp_rfc, domicilio,
          marca, linea, color, numero_serie, numero_motor,
          ano_modelo, renewed_from_id, renewal_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, status, created_at
      `;

      const params = [
        user_id, nombre_completo, curp_rfc, domicilio,
        marca, linea, color, numero_serie, numero_motor,
        ano_modelo, renewed_from_id, renewal_count, status
      ];

      const { rows } = await db.query(query, params);
      logger.info(`Created renewal application ID ${rows[0].id} from original ID ${renewed_from_id}`);
      return rows[0];
    } catch (error) {
      logger.error('Error creating renewal application:', error);
      throw error;
    }
  }

  /**
   * Update queue status for an application
   * @param {number} applicationId - Application ID
   * @param {Object} queueData - Queue status data
   * @returns {Promise<boolean>} Success indicator
   */
  async updateQueueStatus(applicationId, queueData) {
    try {
      const {
        status,
        queue_status,
        queue_position,
        queue_entered_at,
        queue_started_at,
        queue_completed_at,
        queue_duration_ms,
        queue_job_id
      } = queueData;

      const fields = [];
      const values = [];
      let paramCount = 0;

      // Build dynamic update based on provided fields
      if (status !== undefined) {
        paramCount++;
        fields.push(`status = $${paramCount}`);
        values.push(status);
      }
      if (queue_status !== undefined) {
        paramCount++;
        fields.push(`queue_status = $${paramCount}`);
        values.push(queue_status);
      }
      if (queue_position !== undefined) {
        paramCount++;
        fields.push(`queue_position = $${paramCount}`);
        values.push(queue_position);
      }
      if (queue_entered_at !== undefined) {
        paramCount++;
        fields.push(`queue_entered_at = $${paramCount}`);
        values.push(queue_entered_at);
      }
      if (queue_started_at !== undefined) {
        paramCount++;
        fields.push(`queue_started_at = $${paramCount}`);
        values.push(queue_started_at);
      }
      if (queue_completed_at !== undefined) {
        paramCount++;
        fields.push(`queue_completed_at = $${paramCount}`);
        values.push(queue_completed_at);
      }
      if (queue_duration_ms !== undefined) {
        paramCount++;
        fields.push(`queue_duration_ms = $${paramCount}`);
        values.push(queue_duration_ms);
      }
      if (queue_job_id !== undefined) {
        paramCount++;
        fields.push(`queue_job_id = $${paramCount}`);
        values.push(queue_job_id);
      }

      // Always update timestamp
      paramCount++;
      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add application ID
      paramCount++;
      values.push(applicationId);

      const query = `
        UPDATE permit_applications 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
      `;

      const { rowCount } = await db.query(query, values);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating queue status for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update queue error status
   * @param {number} applicationId - Application ID
   * @param {Object} errorData - Error information
   * @returns {Promise<boolean>} Success indicator
   */
  async updateQueueError(applicationId, errorData) {
    try {
      const { queue_error, queue_status = 'failed' } = errorData;

      const query = `
        UPDATE permit_applications 
        SET queue_status = $1,
            queue_error = $2,
            updated_at = NOW()
        WHERE id = $3
      `;

      const { rowCount } = await db.query(query, [queue_status, queue_error, applicationId]);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating queue error for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update application when permit is successfully generated
   * @param {number} applicationId - Application ID
   * @param {Object} permitData - Permit generation data
   * @returns {Promise<boolean>} Success indicator
   */
  async updatePermitGenerated(applicationId, permitData) {
    try {
      const {
        permit_file_path,
        certificado_file_path,
        placas_file_path,
        recomendaciones_file_path,
        folio,
        fecha_expedicion,
        fecha_vencimiento,
        status = 'PERMIT_READY'
      } = permitData;

      const fields = [`status = $1`];
      const values = [status];
      let paramCount = 1;

      if (permit_file_path) {
        paramCount++;
        fields.push(`permit_file_path = $${paramCount}`);
        values.push(permit_file_path);
      }
      if (certificado_file_path) {
        paramCount++;
        fields.push(`certificado_file_path = $${paramCount}`);
        values.push(certificado_file_path);
      }
      if (placas_file_path) {
        paramCount++;
        fields.push(`placas_file_path = $${paramCount}`);
        values.push(placas_file_path);
      }
      if (recomendaciones_file_path) {
        paramCount++;
        fields.push(`recomendaciones_file_path = $${paramCount}`);
        values.push(recomendaciones_file_path);
      }
      if (folio) {
        paramCount++;
        fields.push(`folio = $${paramCount}`);
        values.push(folio);
      }
      if (fecha_expedicion) {
        paramCount++;
        fields.push(`fecha_expedicion = $${paramCount}`);
        values.push(fecha_expedicion);
      }
      if (fecha_vencimiento) {
        paramCount++;
        fields.push(`fecha_vencimiento = $${paramCount}`);
        values.push(fecha_vencimiento);
      }

      // Add queue completion fields
      paramCount++;
      fields.push(`queue_status = $${paramCount}`);
      values.push('completed');

      paramCount++;
      fields.push(`queue_completed_at = $${paramCount}`);
      values.push(new Date());

      paramCount++;
      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      paramCount++;
      values.push(applicationId);

      const query = `
        UPDATE permit_applications 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
      `;

      const { rowCount } = await db.query(query, values);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating permit generated for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get application queue status
   * @param {number} applicationId - Application ID
   * @returns {Promise<Object|null>} Application queue status
   */
  async getApplicationQueueStatus(applicationId) {
    try {
      const query = `
        SELECT status, queue_status, queue_position, queue_error
        FROM permit_applications 
        WHERE id = $1
      `;
      
      const { rows } = await db.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error getting queue status for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get application status only
   * @param {number} applicationId - Application ID
   * @returns {Promise<string|null>} Application status
   */
  async getApplicationStatus(applicationId) {
    try {
      const query = 'SELECT status FROM permit_applications WHERE id = $1';
      const { rows } = await db.query(query, [applicationId]);
      return rows[0]?.status || null;
    } catch (error) {
      logger.error(`Error getting application status for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get application with row lock to prevent concurrent updates
   * @param {number} applicationId - Application ID
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Application data
   */
  async getApplicationWithLock(applicationId, client = null) {
    try {
      const dbClient = client || db;
      const query = `
        SELECT id, status, payment_processor_order_id, user_id, folio
        FROM permit_applications 
        WHERE id = $1 
        FOR UPDATE NOWAIT
      `;
      
      const { rows } = await dbClient.query(query, [applicationId]);
      return rows[0] || null;
    } catch (error) {
      // Handle lock not available error
      if (error.code === '55P03') {
        logger.warn(`Application ${applicationId} is locked by another transaction`);
        throw new Error('Application is currently being processed by another request');
      }
      logger.error(`Error getting application with lock for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update Puppeteer error information
   * @param {number} applicationId - Application ID
   * @param {Object} errorDetails - Puppeteer error details
   * @returns {Promise<boolean>} Success indicator
   */
  async updatePuppeteerError(applicationId, errorDetails) {
    try {
      const {
        error_message,
        error_at = new Date(),
        screenshot_path,
        status = 'ERROR_GENERATING_PERMIT'
      } = errorDetails;

      const query = `
        UPDATE permit_applications 
        SET status = $1,
            puppeteer_error_message = $2,
            puppeteer_error_at = $3,
            puppeteer_screenshot_path = $4,
            queue_status = 'failed',
            updated_at = NOW()
        WHERE id = $5
      `;

      const { rowCount } = await db.query(query, [
        status,
        error_message,
        error_at,
        screenshot_path,
        applicationId
      ]);
      
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating Puppeteer error for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update Puppeteer status for automation tracking
   * @param {number} applicationId - Application ID
   * @param {string} status - Puppeteer processing status
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success indicator
   */
  async updatePuppeteerStatus(applicationId, status, metadata = {}) {
    try {
      const fields = ['status = $2', 'updated_at = NOW()'];
      const values = [applicationId, status];
      let paramCount = 2;

      // Add metadata fields if provided
      if (metadata.queue_status) {
        paramCount++;
        fields.push(`queue_status = $${paramCount}`);
        values.push(metadata.queue_status);
      }

      if (metadata.queue_position !== undefined) {
        paramCount++;
        fields.push(`queue_position = $${paramCount}`);
        values.push(metadata.queue_position);
      }

      if (metadata.queue_entered_at) {
        paramCount++;
        fields.push(`queue_entered_at = $${paramCount}`);
        values.push(metadata.queue_entered_at);
      }

      if (metadata.queue_started_at) {
        paramCount++;
        fields.push(`queue_started_at = $${paramCount}`);
        values.push(metadata.queue_started_at);
      }

      if (metadata.queue_completed_at) {
        paramCount++;
        fields.push(`queue_completed_at = $${paramCount}`);
        values.push(metadata.queue_completed_at);
      }

      if (metadata.queue_duration_ms !== undefined) {
        paramCount++;
        fields.push(`queue_duration_ms = $${paramCount}`);
        values.push(metadata.queue_duration_ms);
      }

      const query = `
        UPDATE permit_applications 
        SET ${fields.join(', ')}
        WHERE id = $1
      `;

      const { rowCount } = await db.query(query, values);
      logger.debug(`Updated Puppeteer status for application ${applicationId}: ${status}`);
      
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating Puppeteer status for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Save Puppeteer screenshot for debugging
   * @param {number} applicationId - Application ID
   * @param {string} screenshotPath - Path to screenshot file
   * @param {string} errorMessage - Associated error message
   * @returns {Promise<boolean>} Success indicator
   */
  async savePuppeteerScreenshot(applicationId, screenshotPath, errorMessage = null) {
    try {
      const query = `
        UPDATE permit_applications 
        SET puppeteer_screenshot_path = $2,
            puppeteer_error_message = COALESCE($3, puppeteer_error_message),
            puppeteer_error_at = COALESCE(puppeteer_error_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
      `;

      const { rowCount } = await db.query(query, [
        applicationId,
        screenshotPath,
        errorMessage
      ]);

      logger.info(`Saved screenshot for application ${applicationId}: ${screenshotPath}`);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error saving screenshot for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get application data for permit generation with required fields
   * @param {number} applicationId - Application ID
   * @returns {Promise<Object|null>} Application data for generation
   */
  async getApplicationForGeneration(applicationId) {
    try {
      const query = `
        SELECT 
          pa.id, pa.user_id, pa.status, pa.queue_status,
          pa.nombre_completo, pa.curp_rfc, pa.domicilio,
          pa.marca, pa.linea, pa.ano_modelo, pa.color,
          pa.numero_serie, pa.numero_motor, pa.importe,
          pa.payment_reference, pa.payment_processor_order_id,
          pa.created_at, pa.updated_at,
          u.email as user_email,
          u.first_name,
          u.last_name,
          u.whatsapp_phone
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.id = $1
      `;

      const { rows } = await db.query(query, [applicationId]);
      
      if (rows.length === 0) {
        logger.warn(`Application ${applicationId} not found for generation`);
        return null;
      }

      logger.debug(`Retrieved application data for generation: ${applicationId}`);
      return rows[0];
    } catch (error) {
      logger.error(`Error getting application for generation ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update generation progress tracking
   * @param {number} applicationId - Application ID
   * @param {string} step - Current processing step
   * @param {string} status - Step status (started, completed, failed)
   * @returns {Promise<boolean>} Success indicator
   */
  async updateGenerationProgress(applicationId, step, status) {
    try {
      const timestamp = new Date();
      let updateFields = [];
      let params = [applicationId];
      let paramCount = 1;

      // Map step names to database fields
      const stepMappings = {
        'browser_launch': 'queue_started_at',
        'login': null, // No specific field for login step
        'form_fill': null, // No specific field for form fill step
        'form_submit': null, // No specific field for form submit step
        'pdf_download': null, // No specific field for PDF download step
        'completion': 'queue_completed_at'
      };

      // Update specific timestamp fields based on step
      if (stepMappings[step] && status === 'completed') {
        paramCount++;
        updateFields.push(`${stepMappings[step]} = $${paramCount}`);
        params.push(timestamp);
      }

      // Always update the general updated_at timestamp
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(timestamp);

      // Update queue status based on step and status
      if (step === 'browser_launch' && status === 'started') {
        paramCount++;
        updateFields.push(`queue_status = $${paramCount}`);
        params.push('processing');
      } else if (step === 'completion' && status === 'completed') {
        paramCount++;
        updateFields.push(`queue_status = $${paramCount}`);
        params.push('completed');
      } else if (status === 'failed') {
        paramCount++;
        updateFields.push(`queue_status = $${paramCount}`);
        params.push('failed');
      }

      const query = `
        UPDATE permit_applications 
        SET ${updateFields.join(', ')}
        WHERE id = $1
      `;

      const { rowCount } = await db.query(query, params);
      
      logger.debug(`Updated generation progress for application ${applicationId}: ${step} - ${status}`);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error updating generation progress for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get permits expiring within specified threshold for a user
   * @param {number} userId - User ID
   * @param {number} daysThreshold - Number of days before expiration to look for
   * @returns {Promise<Array>} Array of expiring permits
   */
  async getExpiringPermits(userId, daysThreshold = 30) {
    try {
      // Validate input parameters
      const safeUserId = parseInt(userId);
      const safeDaysThreshold = parseInt(daysThreshold);
      
      if (isNaN(safeUserId) || safeUserId <= 0) {
        throw new Error('Invalid userId parameter');
      }
      if (isNaN(safeDaysThreshold) || safeDaysThreshold < 0 || safeDaysThreshold > 365) {
        throw new Error('Invalid daysThreshold parameter');
      }

      const query = `
        SELECT 
          id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento,
          (fecha_vencimiento - CURRENT_DATE) AS days_remaining
        FROM permit_applications
        WHERE user_id = $1
          AND status = 'PERMIT_READY'
          AND fecha_vencimiento IS NOT NULL
          AND fecha_vencimiento > CURRENT_DATE
          AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 day' * $2)
        ORDER BY fecha_vencimiento ASC
      `;

      const { rows } = await db.query(query, [safeUserId, safeDaysThreshold]);
      logger.debug(`Found ${rows.length} expiring permits for user ${safeUserId} within ${safeDaysThreshold} days`);
      return rows;
    } catch (error) {
      logger.error(`Error getting expiring permits for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get permits expiring within specified threshold with user information
   * @param {number} daysUntilExpiration - Days until permit expiration
   * @returns {Promise<Array>} Array of expiring permits with user details
   */
  async getExpiringPermitsWithUserInfo(daysUntilExpiration = 5) {
    try {
      // Validate input parameter
      const safeDaysUntilExpiration = parseInt(daysUntilExpiration);
      if (isNaN(safeDaysUntilExpiration) || safeDaysUntilExpiration < 0 || safeDaysUntilExpiration > 365) {
        throw new Error('Invalid daysUntilExpiration parameter');
      }

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
          AND pa.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 day' * $1)
        ORDER BY pa.fecha_vencimiento ASC
      `;

      const { rows } = await db.query(query, [safeDaysUntilExpiration]);
      logger.debug(`Found ${rows.length} expiring permits within ${safeDaysUntilExpiration} days`);
      return rows;
    } catch (error) {
      logger.error(`Error getting expiring permits with user info:`, error);
      throw error;
    }
  }

  /**
   * Find applications that have payment received but need PDF generation
   * @param {number} limit - Maximum number of applications to return
   * @returns {Promise<Array>} Array of applications pending PDF generation
   */
  async findPendingPdfGeneration(limit = 10) {
    try {
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      
      const query = `
        SELECT 
          id,
          user_id,
          payment_processor_order_id,
          status,
          queue_status,
          created_at,
          updated_at
        FROM permit_applications
        WHERE status = $1
          AND (queue_status IS NULL OR queue_status IN ('failed', 'error'))
          AND payment_processor_order_id IS NOT NULL
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY updated_at ASC, created_at ASC
        LIMIT $2
      `;

      const { rows } = await db.query(query, [ApplicationStatus.PAYMENT_RECEIVED, safeLimit]);
      
      logger.debug(`Found ${rows.length} applications pending PDF generation`);
      return rows;
    } catch (error) {
      logger.error('Error finding pending PDF generation applications:', error);
      throw error;
    }
  }

  /**
   * Delete an application and all related data
   * This will cascade delete all related records
   * @param {number} applicationId - The application ID to delete
   * @param {object} options - Options for deletion
   * @returns {Promise<object>} Deletion result
   */
  async deleteApplication(applicationId, options = {}) {
    const client = await db.dbPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Log the deletion for audit purposes
      logger.info('Deleting application and related data', { 
        applicationId,
        deletedBy: options.deletedBy || 'system',
        reason: options.reason || 'admin_requested'
      });

      // Delete in order of dependencies
      // 1. Delete payment recovery attempts
      const recoveryResult = await client.query(
        'DELETE FROM payment_recovery_attempts WHERE application_id = $1 RETURNING id',
        [applicationId]
      );
      
      // 2. Delete payment events
      const eventsResult = await client.query(
        'DELETE FROM payment_events WHERE application_id = $1 RETURNING id',
        [applicationId]
      );
      
      // 3. Delete email reminders
      const remindersResult = await client.query(
        'DELETE FROM email_reminders WHERE application_id = $1 RETURNING id',
        [applicationId]
      );
      
      // 4. Update any renewals that reference this application
      await client.query(
        'UPDATE permit_applications SET renewed_from_id = NULL WHERE renewed_from_id = $1',
        [applicationId]
      );
      
      // 5. Finally, delete the application itself
      const appResult = await client.query(
        'DELETE FROM permit_applications WHERE id = $1 RETURNING *',
        [applicationId]
      );
      
      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      await client.query('COMMIT');
      
      const deletedApplication = appResult.rows[0];
      
      logger.info('Application deleted successfully', {
        applicationId,
        deletedRecords: {
          recoveryAttempts: recoveryResult.rowCount,
          paymentEvents: eventsResult.rowCount,
          emailReminders: remindersResult.rowCount,
          application: 1
        }
      });
      
      return {
        success: true,
        deletedApplication,
        deletedCounts: {
          recoveryAttempts: recoveryResult.rowCount,
          paymentEvents: eventsResult.rowCount,
          emailReminders: remindersResult.rowCount
        }
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting application:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk delete multiple applications
   * @param {number[]} applicationIds - Array of application IDs to delete
   * @param {object} options - Options for deletion
   * @returns {Promise<object>} Bulk deletion result
   */
  async bulkDeleteApplications(applicationIds, options = {}) {
    const results = {
      successful: [],
      failed: [],
      totalDeleted: 0
    };
    
    for (const applicationId of applicationIds) {
      try {
        const result = await this.deleteApplication(applicationId, options);
        results.successful.push(applicationId);
        results.totalDeleted++;
      } catch (error) {
        logger.error(`Failed to delete application ${applicationId}:`, error);
        results.failed.push({
          applicationId,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new ApplicationRepository();

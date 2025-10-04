// Admin controller functions will be added here

const ApiResponse = require('../utils/api-response');
const { logger } = require('../utils/logger');
const applicationRepository = require('../repositories/application.repository');

// Will be injected by dependency container
let auditService = null;
const setAuditService = (service) => {
  auditService = service;
};
exports.setAuditService = setAuditService;

/**
 * Get dashboard statistics for admin panel
 */
exports.getDashboardStats = async (req, res) => {
  try {
    logger.info('Admin dashboard stats requested');
    
    const db = require('../db');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 1. User Statistics
    const userStatsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_login_at >= $1 THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_users_today,
        COUNT(CASE WHEN created_at >= $3 THEN 1 END) as new_users_this_week,
        COUNT(CASE WHEN created_at >= $4 THEN 1 END) as new_users_this_month,
        COUNT(CASE WHEN account_type = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN account_type = 'client' THEN 1 END) as client_users,
        COUNT(CASE WHEN is_admin_portal = true THEN 1 END) as admin_portal_users
      FROM users
    `;
    const userStatsResult = await db.query(userStatsQuery, [
      thirtyDaysAgo,
      today,
      thisWeekStart,
      thisMonthStart
    ]);
    const userStats = userStatsResult.rows[0];

    // 2. Application Statistics
    const applicationStatsQuery = `
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 END) as pending_payment,
        COUNT(CASE WHEN status = 'PAYMENT_RECEIVED' THEN 1 END) as payment_received,
        COUNT(CASE WHEN status = 'GENERATING_PERMIT' THEN 1 END) as generating_permit,
        COUNT(CASE WHEN status = 'PERMIT_READY' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'ERROR_GENERATING_PERMIT' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'PAYMENT_EXPIRED' THEN 1 END) as expired,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as applications_today,
        COUNT(CASE WHEN created_at >= $2 THEN 1 END) as applications_this_week,
        COUNT(CASE WHEN created_at >= $3 THEN 1 END) as applications_this_month
      FROM permit_applications
    `;
    const applicationStatsResult = await db.query(applicationStatsQuery, [
      today,
      thisWeekStart,
      thisMonthStart
    ]);
    const applicationStats = applicationStatsResult.rows[0];

    // 3. Financial Statistics - now using real payment amounts
    const financialStatsQuery = `
      SELECT 
        COALESCE(SUM(pe.amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN pe.created_at >= $1 THEN pe.amount END), 0) as revenue_today,
        COALESCE(SUM(CASE WHEN pe.created_at >= $2 THEN pe.amount END), 0) as revenue_this_week,
        COALESCE(SUM(CASE WHEN pe.created_at >= $3 THEN pe.amount END), 0) as revenue_this_month,
        COALESCE(AVG(pe.amount), 0) as average_application_value,
        COALESCE(SUM(CASE WHEN pe.event_data->>'payment_method_details' LIKE '%card%' THEN pe.amount END), 0) as credit_card_payments,
        COALESCE(SUM(CASE WHEN pe.event_type = 'oxxo.payment_received' THEN pe.amount END), 0) as oxxo_payments
      FROM payment_events pe
      WHERE pe.amount IS NOT NULL
        AND pe.event_type IN ('payment.confirmed', 'charge.succeeded', 'payment_intent.succeeded', 'oxxo.payment_received')
    `;
    const financialStatsResult = await db.query(financialStatsQuery, [
      today,
      thisWeekStart,
      thisMonthStart
    ]);
    const financialStats = financialStatsResult.rows[0];

    // 4. System Health Statistics
    // Failed permits from failed_permits table
    const failedPermitsQuery = `
      SELECT 
        COUNT(*) as total_failed_permits,
        0 as pending_resolution,
        0 as resolved_failures
      FROM permit_applications WHERE status = 'ERROR_GENERATING_PERMIT'
    `;
    const failedPermitsResult = await db.query(failedPermitsQuery);
    const failedPermitsStats = failedPermitsResult.rows[0];

    // Email delivery statistics - placeholder since email_notifications table doesn't exist
    const emailStats = {
      total_emails: 0,
      sent_emails: 0,
      failed_emails: 0,
      bounced_emails: 0
    };

    // PDF generation statistics - placeholder since pdf_generation_queue table doesn't exist
    const pdfStats = {
      total_pdf_jobs: 0,
      completed_pdfs: 0,
      failed_pdfs: 0,
      processing_pdfs: 0,
      pending_pdfs: 0
    };

    // Active sessions count
    const activeSessionsQuery = `
      SELECT COUNT(*) as active_sessions
      FROM sessions
      WHERE expire > NOW()
    `;
    const activeSessionsResult = await db.query(activeSessionsQuery);
    const activeSessions = activeSessionsResult.rows[0].active_sessions;

    // Recent activity (last 10 events)
    const recentActivityQuery = `
      SELECT 
        'application_created' as event_type,
        pa.id as entity_id,
        pa.created_at,
        u.account_email as user_email,
        u.first_name,
        u.last_name,
        pa.status
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      ORDER BY pa.created_at DESC
      LIMIT 10
    `;
    const recentActivityResult = await db.query(recentActivityQuery);
    const recentActivity = recentActivityResult.rows;

    // Calculate percentages and rates
    const totalApplications = parseInt(applicationStats.total_applications) || 1; // Avoid division by zero
    const failureRate = totalApplications > 0 
      ? ((parseInt(failedPermitsStats.total_failed_permits) / totalApplications) * 100).toFixed(2)
      : 0;

    const totalEmails = parseInt(emailStats.total_emails) || 1;
    const emailDeliveryRate = totalEmails > 0
      ? ((parseInt(emailStats.sent_emails) / totalEmails) * 100).toFixed(2)
      : 0;

    const totalPdfJobs = parseInt(pdfStats.total_pdf_jobs) || 1;
    const pdfSuccessRate = totalPdfJobs > 0
      ? ((parseInt(pdfStats.completed_pdfs) / totalPdfJobs) * 100).toFixed(2)
      : 0;

    // Get actual status counts from database for statusCounts array
    const statusCountsQuery = `
      SELECT status, COUNT(*) as count 
      FROM permit_applications 
      GROUP BY status 
      ORDER BY count DESC
    `;
    const statusCountsResult = await db.query(statusCountsQuery);
    const statusCounts = statusCountsResult.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count)
    }));

    // Compile all statistics
    const stats = {
      // Frontend compatibility fields
      statusCounts,
      oxxoPaymentsPending: statusCounts.find(s => s.status === 'AWAITING_OXXO_PAYMENT')?.count || 0,
      todayPermits: parseInt(applicationStats.applications_today),
      pendingVerifications: 0, // Placeholder
      
      // Detailed breakdown
      users: {
        total: parseInt(userStats.total_users),
        active: parseInt(userStats.active_users),
        newToday: parseInt(userStats.new_users_today),
        newThisWeek: parseInt(userStats.new_users_this_week),
        newThisMonth: parseInt(userStats.new_users_this_month),
        byType: {
          admin: parseInt(userStats.admin_users),
          client: parseInt(userStats.client_users),
          adminPortal: parseInt(userStats.admin_portal_users)
        }
      },
      applications: {
        total: parseInt(applicationStats.total_applications),
        byStatus: {
          pendingPayment: parseInt(applicationStats.pending_payment),
          paymentReceived: parseInt(applicationStats.payment_received),
          generatingPermit: parseInt(applicationStats.generating_permit),
          completed: parseInt(applicationStats.completed),
          failed: parseInt(applicationStats.failed),
          expired: parseInt(applicationStats.expired)
        },
        newToday: parseInt(applicationStats.applications_today),
        newThisWeek: parseInt(applicationStats.applications_this_week),
        newThisMonth: parseInt(applicationStats.applications_this_month)
      },
      financial: {
        totalRevenue: parseFloat(financialStats.total_revenue),
        revenueToday: parseFloat(financialStats.revenue_today),
        revenueThisWeek: parseFloat(financialStats.revenue_this_week),
        revenueThisMonth: parseFloat(financialStats.revenue_this_month),
        averageApplicationValue: parseFloat(financialStats.average_application_value),
        paymentMethods: {
          creditCard: parseInt(financialStats.credit_card_payments),
          oxxo: parseInt(financialStats.oxxo_payments)
        }
      },
      systemHealth: {
        failedPermits: {
          total: parseInt(failedPermitsStats.total_failed_permits),
          pending: parseInt(failedPermitsStats.pending_resolution),
          resolved: parseInt(failedPermitsStats.resolved_failures),
          failureRate: parseFloat(failureRate)
        },
        emailDelivery: {
          total: parseInt(emailStats.total_emails),
          sent: parseInt(emailStats.sent_emails),
          failed: parseInt(emailStats.failed_emails),
          bounced: parseInt(emailStats.bounced_emails),
          deliveryRate: parseFloat(emailDeliveryRate)
        },
        pdfGeneration: {
          total: parseInt(pdfStats.total_pdf_jobs),
          completed: parseInt(pdfStats.completed_pdfs),
          failed: parseInt(pdfStats.failed_pdfs),
          processing: parseInt(pdfStats.processing_pdfs),
          pending: parseInt(pdfStats.pending_pdfs),
          successRate: parseFloat(pdfSuccessRate)
        },
        activeSessions: parseInt(activeSessions)
      },
      recentActivity: recentActivity.map(activity => ({
        type: activity.event_type,
        entityId: activity.entity_id,
        timestamp: activity.created_at,
        user: {
          email: activity.user_email,
          name: `${activity.first_name} ${activity.last_name}`
        },
        status: activity.status
      })),
      generatedAt: now.toISOString()
    };
    
    logger.info('Dashboard stats retrieved successfully', {
      totalUsers: stats.users.total,
      totalApplications: stats.applications.total,
      totalRevenue: stats.financial.totalRevenue
    });
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        req.session.userId,
        'view',
        'dashboard_stats',
        null,
        null,
        req
      );
    }
    
    return ApiResponse.success(res, stats);
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    return ApiResponse.error(res, 'Error al obtener estadísticas del dashboard', 500);
  }
};

/**
 * Get all applications with filtering and pagination
 */
exports.getAllApplications = async (req, res) => {
  try {
    const adminId = req.session.userId;
    logger.info(`Admin ${adminId} requesting all applications with filters:`, req.query);
    
    // Extract query parameters
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    // Validate pagination parameters
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100); // Max 100 records per page
    const offset = (pageNum - 1) * limitNum;
    
    // Build query
    const params = [];
    let countQuery = `
      SELECT COUNT(DISTINCT pa.id)
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN payment_events pe ON pa.id = pe.application_id
      WHERE 1=1
    `;
    
    let query = `
      SELECT DISTINCT
        pa.id,
        pa.user_id,
        pa.status,
        pa.created_at,
        pa.updated_at,
        pa.payment_reference,
        pa.payment_processor_order_id,
        pa.nombre_completo,
        pa.curp_rfc,
        pa.marca,
        pa.linea,
        pa.ano_modelo,
        pa.color,
        pa.numero_serie,
        pa.numero_motor,
        pa.domicilio,
        pa.importe,
        pa.renewed_from_id,
        pa.renewal_count,
        u.account_email as user_email,
        u.phone as user_phone,
        CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
        u.account_type as user_account_type,
        u.created_at as user_created_at,
        (
          SELECT COUNT(*) 
          FROM permit_applications 
          WHERE user_id = pa.user_id
        ) as user_total_applications,
        (
          SELECT pe2.event_type 
          FROM payment_events pe2 
          WHERE pe2.application_id = pa.id 
          ORDER BY pe2.created_at DESC 
          LIMIT 1
        ) as last_payment_event,
        (
          SELECT pe3.created_at 
          FROM payment_events pe3 
          WHERE pe3.application_id = pa.id 
          ORDER BY pe3.created_at DESC 
          LIMIT 1
        ) as last_payment_event_date
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN payment_events pe ON pa.id = pe.application_id
      WHERE 1=1
    `;
    
    // Apply filters
    if (status) {
      params.push(status);
      query += ` AND pa.status = $${params.length}`;
      countQuery += ` AND pa.status = $${params.length}`;
    }
    
    // Payment status filter based on application status
    if (paymentStatus) {
      const paymentStatuses = {
        'pending': ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING'],
        'completed': ['PAYMENT_RECEIVED', 'GENERATING_PERMIT', 'PERMIT_READY', 'COMPLETED'],
        'failed': ['PAYMENT_FAILED']
      };
      
      if (paymentStatuses[paymentStatus]) {
        params.push(paymentStatuses[paymentStatus]);
        query += ` AND pa.status = ANY($${params.length}::text[])`;
        countQuery += ` AND pa.status = ANY($${params.length}::text[])`;
      }
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
    
    if (search) {
      const searchParam = `%${search}%`;
      params.push(searchParam);
      params.push(search); // For exact ID match
      const searchCondition = ` AND (
        pa.nombre_completo ILIKE $${params.length - 1} OR
        pa.curp_rfc ILIKE $${params.length - 1} OR
        pa.numero_serie ILIKE $${params.length - 1} OR
        u.account_email ILIKE $${params.length - 1} OR
        u.phone ILIKE $${params.length - 1} OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length - 1} OR
        CAST(pa.id AS TEXT) = $${params.length}
      )`;
      query += searchCondition;
      countQuery += searchCondition;
    }
    
    // Validate and apply sorting
    const allowedSortFields = ['created_at', 'updated_at', 'status', 'id'];
    const sortField = allowedSortFields.includes(sortBy) ? `pa.${sortBy}` : 'pa.created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;
    
    // Add pagination
    const queryParams = [...params];
    queryParams.push(limitNum);
    queryParams.push(offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    
    // Execute queries
    const db = require('../db');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);
    const { rows } = await db.query(query, queryParams);
    
    // Transform data for frontend - flat structure expected by frontend
    const applications = rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      payment_reference: row.payment_reference,
      payment_processor_order_id: row.payment_processor_order_id,
      
      // Personal info - flat structure
      nombre_completo: row.nombre_completo,
      applicant_name: row.nombre_completo, // Frontend expects this field
      curp_rfc: row.curp_rfc,
      domicilio: row.domicilio,
      
      // Vehicle info - flat structure
      marca: row.marca,
      linea: row.linea,
      ano_modelo: row.ano_modelo,
      color: row.color,
      numero_serie: row.numero_serie,
      numero_motor: row.numero_motor,
      placas: null, // Field doesn't exist in DB
      
      // Payment info
      importe: row.importe,
      
      // User information - flat structure
      user_email: row.user_email,
      user_phone: row.user_phone,
      user_full_name: row.user_full_name,
      user_account_type: row.user_account_type,
      user_created_at: row.user_created_at,
      user_total_applications: row.user_total_applications,
      
      // Payment event info
      last_payment_event: row.last_payment_event,
      last_payment_event_date: row.last_payment_event_date,
      
      // Renewal information
      renewed_from_id: row.renewed_from_id,
      renewal_count: row.renewal_count,
      is_renewal: !!row.renewed_from_id
    }));
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        req.session.userId,
        'view',
        'applications_list',
        null,
        { page, limit: limitNum, total },
        req
      );
    }
    
    return ApiResponse.success(res, {
      applications,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error getting application details:', error);
    return ApiResponse.error(res, 'Error al obtener detalles de la aplicación', 500);
  }
};

/**
 * Retry PDF generation using Puppeteer
 * TODO: Implement retry logic
 */
exports.retryPuppeteer = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    
    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de aplicación inválido');
    }
    
    logger.info(`Admin retrying Puppeteer for application ${applicationId}`);
    
    // Stub implementation
    return ApiResponse.success(res, {
      message: 'Retry iniciado',
      applicationId,
      status: 'pending'
    });
  } catch (error) {
    logger.error('Error retrying Puppeteer:', error);
    return ApiResponse.error(res, 'Error al reintentar generación de PDF', 500);
  }
};

/**
 * Mark an application as resolved
 * TODO: Implement resolution logic
 */
exports.markApplicationResolved = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    
    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de aplicación inválido');
    }
    
    logger.info(`Admin marking application ${applicationId} as resolved`);
    
    // Stub implementation
    return ApiResponse.success(res, {
      message: 'Aplicación marcada como resuelta',
      applicationId
    });
  } catch (error) {
    logger.error('Error marking application as resolved:', error);
    return ApiResponse.error(res, 'Error al marcar aplicación como resuelta', 500);
  }
};

/**
 * Upload manual PDFs for an application
 * TODO: Implement file upload and storage logic
 */
exports.uploadManualPDFs = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    
    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de aplicación inválido');
    }
    
    logger.info(`Admin uploading PDFs for application ${applicationId}`);
    
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return ApiResponse.badRequest(res, 'No se proporcionaron archivos');
    }
    
    // Stub implementation
    return ApiResponse.success(res, {
      message: 'PDFs cargados exitosamente',
      applicationId,
      filesUploaded: req.files.length
    });
  } catch (error) {
    logger.error('Error uploading manual PDFs:', error);
    return ApiResponse.error(res, 'Error al cargar PDFs', 500);
  }
};

/**
 * Manually trigger PDF generation for an application
 */
exports.triggerPdfGeneration = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const applicationId = parseInt(req.params.id, 10);

    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de aplicación inválido');
    }

    logger.info(`Admin ${adminId} manually triggering PDF generation for application ${applicationId}`);

    // Check if application exists
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return ApiResponse.notFound(res, 'Aplicación no encontrada');
    }

    // Validate application status
    const validStatuses = ['PAYMENT_RECEIVED', 'ERROR_GENERATING_PERMIT', 'GENERATING_PERMIT'];
    if (!validStatuses.includes(application.status)) {
      return ApiResponse.badRequest(res, 
        `Estado inválido para generar PDF. Estado actual: ${application.status}. ` +
        `Estados válidos: ${validStatuses.join(', ')}`
      );
    }

    // Check if PDF already exists
    if (null) {
      return ApiResponse.badRequest(res, 'El permiso ya fue generado');
    }

    // Update status to GENERATING_PERMIT
    await applicationRepository.updateApplicationStatus(applicationId, 'GENERATING_PERMIT');

    // Queue the permit generation job using the service
    const { getInstance } = require('../services/pdf-queue-factory.service');
    const pdfQueueService = getInstance();
    
    // Add to queue with metadata
    const jobData = {
      applicationId,
      userId: application.user_id,
      triggeredBy: 'admin',
      adminId: adminId,
      originalStatus: application.status
    };
    
    await pdfQueueService.addJob(jobData);

    logger.info(`PDF generation queued for application ${applicationId} by admin ${adminId}`);

    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'update',
        'application',
        applicationId,
        {
          action: 'trigger_pdf_generation',
          previousStatus: application.status,
          newStatus: 'GENERATING_PERMIT'
        },
        req
      );
    }

    return ApiResponse.success(res, {
      message: 'Generación de PDF agregada a la cola',
      applicationId,
      status: 'queued',
      triggeredBy: 'admin'
    });

  } catch (error) {
    logger.error('Error triggering PDF generation:', error);
    return ApiResponse.error(res, 'Error al iniciar generación de PDF', 500);
  }
};

/**
 * Update application status with validation and notifications
 */
exports.updateApplicationStatus = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    const adminId = req.session.userId;
    const { status, reason, notify = true } = req.body;
    
    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de aplicación inválido');
    }
    
    if (!status) {
      return ApiResponse.badRequest(res, 'Estado es requerido');
    }
    
    logger.info(`Admin ${adminId} updating status for application ${applicationId} to ${status}`);
    
    // Validate the new status
    const { ApplicationStatus, ApplicationHelpers } = require('../constants/application.constants');
    const validStatuses = Object.values(ApplicationStatus);
    
    if (!validStatuses.includes(status)) {
      return ApiResponse.badRequest(res, `Estado inválido: ${status}`);
    }
    
    const db = require('../db');
    const client = await db.dbPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current application state with lock
      const currentAppQuery = `
        SELECT 
          pa.*,
          u.account_email as user_email,
          u.first_name as user_first_name,
          u.last_name as user_last_name,
          u.phone as user_phone
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.id = $1
        FOR UPDATE
      `;
      
      const currentAppResult = await client.query(currentAppQuery, [applicationId]);
      
      if (currentAppResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return ApiResponse.notFound(res, 'Aplicación no encontrada');
      }
      
      const currentApp = currentAppResult.rows[0];
      const previousStatus = currentApp.status;
      
      // Check if status change is allowed
      if (previousStatus === status) {
        await client.query('ROLLBACK');
        return ApiResponse.badRequest(res, 'La aplicación ya tiene este estado');
      }
      
      // Some status transitions may not be allowed
      const restrictedTransitions = {
        'COMPLETED': ['CANCELLED', 'EXPIRED'], // Can't cancel or expire completed permits
        'CANCELLED': [], // Can't change cancelled applications
        'EXPIRED': ['CANCELLED'], // Can't cancel expired permits
        'VENCIDO': ['CANCELLED'] // Can't cancel vencido permits
      };
      
      if (restrictedTransitions[previousStatus] && restrictedTransitions[previousStatus].includes(status)) {
        await client.query('ROLLBACK');
        return ApiResponse.badRequest(res, `No se puede cambiar de ${previousStatus} a ${status}`);
      }
      
      // Update the status
      const updateQuery = `
        UPDATE permit_applications
        SET 
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [
        status,
        applicationId
      ]);
      
      // Create a system payment event for tracking
      const eventQuery = `
        INSERT INTO payment_events (
          application_id,
          order_id,
          event_type,
          event_data,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await client.query(eventQuery, [
        applicationId,
        currentApp.payment_processor_order_id || 'ADMIN_ACTION',
        'admin.status.updated',
        JSON.stringify({
          previousStatus,
          newStatus: status,
          adminId,
          reason: reason || 'Manual status update',
          timestamp: new Date().toISOString()
        })
      ]);
      
      await client.query('COMMIT');
      
      // Trigger PDF generation if status changed to PAYMENT_RECEIVED
      if (status === 'PAYMENT_RECEIVED' && previousStatus !== 'PAYMENT_RECEIVED') {
        try {
          const { getInstance } = require('../services/pdf-queue-factory.service');
          const pdfQueueService = getInstance();
          
          if (pdfQueueService) {
            await pdfQueueService.addJob({
              applicationId,
              userId: currentApp.user_id,
              triggeredBy: 'admin_status_change',
              adminId,
              originalStatus: previousStatus
            });
            
            logger.info(`PDF generation queued for application ${applicationId} due to admin status change to PAYMENT_RECEIVED`);
          } else {
            logger.warn('PDF Queue service not available, PDF generation will be picked up by processor job');
          }
        } catch (pdfError) {
          // Don't fail the status update if PDF queueing fails
          // The PDF processor job will pick it up based on PAYMENT_RECEIVED status
          logger.error('Error queueing PDF generation:', pdfError);
        }
      }
      
      // Send notifications if requested
      if (notify && currentApp.user_email) {
        try {
          const notificationService = require('../services/notification.service');
          
          // Determine notification type based on status change
          let notificationType = 'status_update';
          let emailTemplate = 'status-update';
          
          if (status === 'PERMIT_READY') {
            notificationType = 'permit_ready';
            emailTemplate = 'permit-ready';
          } else if (status === 'PAYMENT_FAILED') {
            notificationType = 'payment_failed';
            emailTemplate = 'payment-failed';
          } else if (status === 'CANCELLED') {
            notificationType = 'application_cancelled';
            emailTemplate = 'application-cancelled';
          }
          
          await notificationService.sendNotification({
            type: notificationType,
            recipientEmail: currentApp.user_email,
            recipientPhone: currentApp.user_phone,
            data: {
              applicationId,
              previousStatus,
              newStatus: status,
              userName: `${currentApp.user_first_name} ${currentApp.user_last_name}`,
              vehicleInfo: `${currentApp.marca} ${currentApp.linea} ${currentApp.ano_modelo}`,
              reason: reason || 'Actualización administrativa',
              adminAction: true
            },
            emailTemplate
          });
          
          logger.info(`Notification sent for status update on application ${applicationId}`);
        } catch (notificationError) {
          // Don't fail the request if notification fails
          logger.error('Error sending notification:', notificationError);
        }
      }
      
      return ApiResponse.success(res, {
        message: 'Estado actualizado exitosamente',
        applicationId,
        previousStatus,
        newStatus: status,
        notificationSent: notify
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error updating application status:', error);
    return ApiResponse.error(res, 'Error al actualizar estado de la aplicación', 500);
  }
};

/**
 * Export applications to CSV with filters
 */
exports.getFailedApplications = async (req, res) => {
  try {
    logger.info('Getting failed applications (stub implementation)');
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        req.session.userId,
        'view',
        'failed_applications',
        null,
        null,
        req
      );
    }
    
    // Return empty results for now
    return ApiResponse.success(res, {
      applications: [],
      total: 0
    });
  } catch (error) {
    logger.error('Error getting failed applications:', error);
    return ApiResponse.error(res, 'Error al obtener aplicaciones fallidas', 500);
  }
};

exports.getApplicationDetails = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    
    // Get application from database
    const db = require('../db');
    const applicationQuery = `
      SELECT 
        pa.*,
        u.account_email as user_email,
        u.phone as user_phone,
        CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
        u.account_type as user_account_type,
        u.created_at as user_created_at
      FROM permit_applications pa
      LEFT JOIN users u ON pa.user_id = u.id
      WHERE pa.id = $1
    `;
    
    const applicationResult = await db.query(applicationQuery, [applicationId]);
    
    if (applicationResult.rows.length === 0) {
      return ApiResponse.notFound(res, 'Aplicación no encontrada');
    }
    
    const application = applicationResult.rows[0];
    
    // Get payment events history
    const paymentEventsQuery = `
      SELECT * FROM payment_events 
      WHERE application_id = $1
      ORDER BY created_at DESC
    `;
    const paymentResult = await db.query(paymentEventsQuery, [applicationId]);

    // Get PDF generation attempts
    const pdfAttemptsQuery = `
      SELECT * FROM pdf_queue_jobs 
      WHERE application_id = $1
      ORDER BY created_at DESC
    `;
    const pdfResult = await db.query(pdfAttemptsQuery, [applicationId]).catch((error) => {
      logger.debug('PDF queue table not found, skipping PDF attempts', { error: error.message });
      return { rows: [] };
    });

    // Get payment recovery attempts  
    const recoveryQuery = `
      SELECT * FROM payment_recovery_attempts
      WHERE application_id = $1
      ORDER BY created_at DESC
    `;
    const recoveryResult = await db.query(recoveryQuery, [applicationId]).catch(() => ({ rows: [] }));

    // Get email reminders
    const remindersQuery = `
      SELECT * FROM email_reminders
      WHERE application_id = $1
      ORDER BY created_at DESC
    `;
    const remindersResult = await db.query(remindersQuery, [applicationId]).catch(() => ({ rows: [] }));

    // Build standardized response format for frontend compatibility
    const response = {
      id: application.id,
      user_id: application.user_id,
      status: application.status,
      created_at: application.created_at,
      updated_at: application.updated_at,
      payment_reference: application.payment_reference,
      payment_processor_order_id: application.payment_processor_order_id,
      nombre_completo: application.nombre_completo,
      curp_rfc: application.curp_rfc,
      domicilio: application.domicilio,
      marca: application.marca,
      linea: application.linea,
      ano_modelo: application.ano_modelo,
      color: application.color,
      numero_serie: application.numero_serie,
      numero_motor: application.numero_motor,
      folio: application.folio,
      fecha_expedicion: application.fecha_expedicion,
      fecha_vencimiento: application.fecha_vencimiento,
      permit_file_path: application.permit_file_path,
      certificado_file_path: application.certificado_file_path,
      placas_file_path: application.placas_file_path,
      recomendaciones_file_path: application.recomendaciones_file_path,
      amount: application.amount,
      applicant_email: application.user_email,
      
      // Additional data for admin functionality
      processing: {
        queueStatus: null, // Will be populated from PDF queue status
        queuePosition: null,
        queueError: null,
        lastPdfAttempt: pdfResult.rows[0] || null,
        pdfAttemptCount: pdfResult.rows.length
      },
      
      paymentHistory: paymentResult.rows,
      pdfGenerationHistory: pdfResult.rows,
      paymentRecoveryAttempts: recoveryResult.rows,
      emailReminders: remindersResult.rows,
      
      user: {
        email: application.user_email,
        phone: application.user_phone,
        fullName: application.user_full_name,
        accountType: application.user_account_type,
        createdAt: application.user_created_at
      }
    };
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        req.session.userId,
        'view',
        'application',
        applicationId,
        null,
        req
      );
    }
    
    return ApiResponse.success(res, response);
  } catch (error) {
    logger.error('Error getting application details:', error);
    return ApiResponse.error(res, 'Error al obtener detalles de la aplicación', 500);
  }
};

/**
 * Download permit file
 */
exports.downloadPermit = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const adminId = req.session.userId;
    
    logger.info(`Admin ${adminId} requesting permit download for application ${applicationId}`);
    
    // Get application from database
    const db = require('../db');
    const applicationQuery = `
      SELECT permit_file_path, folio, nombre_completo, status
      FROM permit_applications 
      WHERE id = $1
    `;
    
    const result = await db.query(applicationQuery, [applicationId]);
    
    if (result.rows.length === 0) {
      return ApiResponse.notFound(res, 'Aplicación no encontrada');
    }
    
    const application = result.rows[0];
    
    if (!application.permit_file_path) {
      return ApiResponse.badRequest(res, 'El permiso aún no ha sido generado');
    }
    
    // Check if permit file exists
    const fs = require('fs');
    const path = require('path');
    
    let filePath = application.permit_file_path;
    
    // Handle both absolute and relative paths
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    
    if (!fs.existsSync(filePath)) {
      logger.error(`Permit file not found: ${filePath}`);
      return ApiResponse.notFound(res, 'Archivo de permiso no encontrado');
    }
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'download',
        'permit',
        applicationId,
        {
          fileName: path.basename(filePath),
          folio: application.folio
        },
        req
      );
    }
    
    // Set appropriate headers
    // Use the original filename from the file path if available, otherwise use folio
    const originalFileName = path.basename(filePath);
    const fileName = originalFileName.includes('_') && originalFileName.endsWith('.pdf') 
      ? originalFileName 
      : `Permiso_${application.folio || applicationId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      logger.error('Error streaming permit file:', error);
      if (!res.headersSent) {
        return ApiResponse.error(res, 'Error al descargar el archivo', 500);
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('Error downloading permit:', error);
    return ApiResponse.error(res, 'Error al descargar el permiso', 500);
  }
};

/**
 * Download recommendations file
 */
exports.downloadRecommendations = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const adminId = req.session.userId;
    
    logger.info(`Admin ${adminId} requesting recommendations download for application ${applicationId}`);
    
    // Get application from database
    const db = require('../db');
    const applicationQuery = `
      SELECT recomendaciones_file_path, folio, nombre_completo, status
      FROM permit_applications 
      WHERE id = $1
    `;
    
    const result = await db.query(applicationQuery, [applicationId]);
    
    if (result.rows.length === 0) {
      return ApiResponse.notFound(res, 'Aplicación no encontrada');
    }
    
    const application = result.rows[0];
    
    if (!application.recomendaciones_file_path) {
      return ApiResponse.badRequest(res, 'Las recomendaciones aún no han sido generadas');
    }
    
    // Check if file exists
    const fs = require('fs');
    const path = require('path');
    
    let filePath = application.recomendaciones_file_path;
    
    // Handle both absolute and relative paths
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    
    if (!fs.existsSync(filePath)) {
      logger.error(`Recommendations file not found: ${filePath}`);
      return ApiResponse.notFound(res, 'Archivo de recomendaciones no encontrado');
    }
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'download',
        'recommendations',
        applicationId,
        {
          fileName: path.basename(filePath),
          folio: application.folio
        },
        req
      );
    }
    
    // Set appropriate headers
    // Use the original filename from the file path if available, otherwise use folio
    const originalFileName = path.basename(filePath);
    const fileName = originalFileName.includes('_') && originalFileName.endsWith('.pdf') 
      ? originalFileName 
      : `Recomendaciones_${application.folio || applicationId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      logger.error('Error streaming recommendations file:', error);
      if (!res.headersSent) {
        return ApiResponse.error(res, 'Error al descargar el archivo', 500);
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('Error downloading recommendations:', error);
    return ApiResponse.error(res, 'Error al descargar las recomendaciones', 500);
  }
};

exports.exportApplications = async (req, res) => {
  try {
    const adminId = req.session.userId;
    logger.info(`Admin ${adminId} exporting applications with filters:`, req.query);
    
    // Extract same filters as getAllApplications
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      format = 'csv'
    } = req.query;
    
    // Build query (similar to getAllApplications but without pagination)
    const params = [];
    let query = `
      SELECT 
        pa.id,
        pa.status,
        pa.created_at,
        pa.updated_at,
        pa.payment_reference,
        pa.payment_processor_order_id,
        pa.nombre_completo,
        pa.curp_rfc,
        pa.domicilio,
        pa.marca,
        pa.linea,
        pa.ano_modelo,
        pa.color,
        pa.numero_serie,
        pa.numero_motor,
        pa.renewed_from_id,
        pa.renewal_count,
        u.account_email as user_email,
        u.phone as user_phone,
        CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
        u.account_type as user_account_type,
        u.created_at as user_created_at,
        (
          SELECT pe.event_type 
          FROM payment_events pe 
          WHERE pe.application_id = pa.id 
          ORDER BY pe.created_at DESC 
          LIMIT 1
        ) as last_payment_event,
        (
          SELECT pe.created_at 
          FROM payment_events pe 
          WHERE pe.application_id = pa.id 
          ORDER BY pe.created_at DESC 
          LIMIT 1
        ) as last_payment_event_date
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE 1=1
    `;
    
    // Apply same filters as getAllApplications
    if (status) {
      params.push(status);
      query += ` AND pa.status = $${params.length}`;
    }
    
    if (paymentStatus) {
      const paymentStatuses = {
        'pending': ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING'],
        'completed': ['PAYMENT_RECEIVED', 'GENERATING_PERMIT', 'PERMIT_READY', 'COMPLETED'],
        'failed': ['PAYMENT_FAILED']
      };
      
      if (paymentStatuses[paymentStatus]) {
        params.push(paymentStatuses[paymentStatus]);
        query += ` AND pa.status = ANY($${params.length}::text[])`;
      }
    }
    
    if (startDate) {
      params.push(startDate);
      query += ` AND pa.created_at >= $${params.length}::date`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND pa.created_at <= ($${params.length}::date + interval '1 day')`;
    }
    
    if (search) {
      const searchParam = `%${search}%`;
      params.push(searchParam);
      params.push(search);
      query += ` AND (
        pa.nombre_completo ILIKE $${params.length - 1} OR
        pa.curp_rfc ILIKE $${params.length - 1} OR
        pa.numero_serie ILIKE $${params.length - 1} OR
        u.account_email ILIKE $${params.length - 1} OR
        u.phone ILIKE $${params.length - 1} OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length - 1} OR
        CAST(pa.id AS TEXT) = $${params.length}
      )`;
    }
    
    query += ' ORDER BY pa.created_at DESC';
    
    // Execute query
    const db = require('../db');
    const { rows } = await db.query(query, params);
    
    if (format === 'csv') {
      // Create CSV content
      const csvHeaders = [
        'ID',
        'Estado',
        'Fecha Creación',
        'Fecha Actualización',
        'Referencia Pago',
        'ID Orden Pago',
        'Nombre Completo',
        'CURP/RFC',
        'Domicilio',
        'Marca',
        'Línea',
        'Año Modelo',
        'Color',
        'Número Serie',
        'Número Motor',
        'Placas',
        'Tipo Vehículo',
        'Importe',
        'Folio',
        'Fecha Expedición',
        'Fecha Vencimiento',
        'Estado Cola',
        'Error Puppeteer',
        'Fecha Error',
        'Es Renovación',
        'Número Renovación',
        'Email Usuario',
        'Teléfono Usuario',
        'Nombre Usuario',
        'Tipo Cuenta',
        'Fecha Registro Usuario',
        'Último Evento Pago',
        'Fecha Último Evento'
      ];
      
      // Helper function to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };
      
      // Build CSV rows
      const csvRows = rows.map(row => [
        row.id,
        row.status,
        row.created_at ? new Date(row.created_at).toLocaleString('es-MX') : '',
        row.updated_at ? new Date(row.updated_at).toLocaleString('es-MX') : '',
        row.payment_reference,
        row.payment_processor_order_id,
        row.nombre_completo,
        row.curp_rfc,
        row.domicilio,
        row.marca,
        row.linea,
        row.ano_modelo,
        row.color,
        row.numero_serie,
        row.numero_motor,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        row.renewed_from_id ? 'Sí' : 'No',
        row.renewal_count || 0,
        row.user_email,
        row.user_phone,
        row.user_full_name,
        row.user_account_type,
        row.user_created_at ? new Date(row.user_created_at).toLocaleString('es-MX') : '',
        row.last_payment_event,
        row.last_payment_event_date ? new Date(row.last_payment_event_date).toLocaleString('es-MX') : ''
      ].map(escapeCSV).join(','));
      
      // Combine headers and rows
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n');
      
      // Add UTF-8 BOM for proper Excel compatibility
      const bom = '\ufeff';
      const csvWithBom = bom + csvContent;
      
      // Set response headers
      const filename = `aplicaciones_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(csvWithBom);
    } else {
      // Return JSON format
      return ApiResponse.success(res, {
        count: rows.length,
        filters: {
          status,
          paymentStatus,
          startDate,
          endDate,
          search
        },
        data: rows
      });
    }
    
  } catch (error) {
    logger.error('Error exporting applications:', error);
    return ApiResponse.error(res, 'Error al exportar aplicaciones', 500);
  }
};

/**
 * Update application status
 * Allows admins to change the status of any permit application
 * NOTE: This is a duplicate - using the implementation at line 684 instead
 */
// Commented out duplicate implementation - see line 684 for active version
/*
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.session.userId;
    
    // Validate status
    const validStatuses = [
      'AWAITING_PAYMENT',
      'AWAITING_OXXO_PAYMENT', 
      'PAYMENT_PROCESSING',
      'PAYMENT_FAILED',
      'PAYMENT_RECEIVED',
      'GENERATING_PERMIT',
      'ERROR_GENERATING_PERMIT',
      'PERMIT_READY',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'VENCIDO',
      'RENEWAL_PENDING',
      'RENEWAL_APPROVED',
      'RENEWAL_REJECTED'
    ];
    
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, 'Estado no válido', 400);
    }
    
    const db = require('../db');
    
    // Check if application exists
    const appResult = await db.query(
      'SELECT id, status, user_id FROM permit_applications WHERE id = $1',
      [id]
    );
    
    if (appResult.rows.length === 0) {
      return ApiResponse.error(res, 'Aplicación no encontrada', 404);
    }
    
    const currentStatus = appResult.rows[0].status;
    const userId = appResult.rows[0].user_id;
    
    // Update the status
    await db.query(
      'UPDATE permit_applications SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    
    // Log the admin action for audit trail
    if (auditService) {
      await auditService.logAdminAction({
        adminId,
        action: 'UPDATE_APPLICATION_STATUS',
        resourceType: 'permit_application',
        resourceId: id,
        details: {
          previousStatus: currentStatus,
          newStatus: status,
          reason: reason || null
        }
      });
    }
    
    // Trigger PDF generation if status changed to PAYMENT_RECEIVED
    if (status === 'PAYMENT_RECEIVED' && currentStatus !== 'PAYMENT_RECEIVED') {
      try {
        const { getInstance } = require('../services/pdf-queue-factory.service');
        const pdfQueueService = getInstance();
        
        if (pdfQueueService) {
          await pdfQueueService.addJob({
            applicationId: parseInt(id, 10),
            userId: userId,
            triggeredBy: 'admin_status_change',
            adminId: adminId,
            originalStatus: currentStatus
          });
          
          logger.info(`PDF generation queued for application ${id} due to admin status change to PAYMENT_RECEIVED`);
        } else {
          logger.warn('PDF Queue service not available, PDF generation will be picked up by processor job');
        }
      } catch (pdfError) {
        // Don't fail the status update if PDF queueing fails
        logger.error('Error queueing PDF generation:', pdfError);
      }
    }
    
    // Get updated application details
    const updatedApp = await applicationRepository.getById(id);
    
    logger.info(`Admin ${adminId} changed application ${id} status from ${currentStatus} to ${status}`);
    
    return ApiResponse.success(res, {
      message: 'Estado actualizado exitosamente',
      application: updatedApp
    });
    
  } catch (error) {
    logger.error('Error updating application status:', error);
    return ApiResponse.error(res, 'Error al actualizar el estado de la aplicación', 500);
  }
};
*/
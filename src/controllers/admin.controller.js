// src/controllers/admin.controller.js
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const puppeteerService = require('../services/puppeteer.service');
const { ApplicationStatus } = require('../constants');
const ApiResponse = require('../utils/api-response');

// [Refactor - Remove Manual Payment] Function for listing applications pending manual verification. Obsolete.
/*
// Get all applications with PROOF_SUBMITTED status with pagination
exports.getPendingVerifications = async (req, res, next) => {
  const adminId = req.session.userId;
  const { page = 1, limit = 10 } = req.query;

  try {
    logger.info(`Admin ${adminId} requested pending verifications with pagination (page: ${page}, limit: ${limit})`);

    // Prepare pagination parameters
    const pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };

    // Use the repository method for paginated pending verifications
    const applicationRepository = require('../repositories/application.repository');
    const result = await applicationRepository.findPendingVerificationsWithPagination(pagination);

    // Log the results for debugging
    logger.debug(`getPendingVerifications found ${result.applications.length} results (page ${result.page} of ${result.totalPages}, total: ${result.total})`);

    // Return the applications and pagination metadata
    ApiResponse.success(res, {
      applications: result.applications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Error getting pending verifications:', error);
    // Return default data instead of error to make the UI more resilient
    ApiResponse.success(res, {
      applications: [],
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: 0,
        totalPages: 0
      }
    });
  }
};
*/

// Temporary replacement function for getPendingVerifications
exports.getPendingVerifications = async (req, res, next) => {
  const adminId = req.session.userId;
  const { page = 1, limit = 10 } = req.query;

  logger.info(`Admin ${adminId} requested pending verifications, but functionality is disabled`);

  // Return empty data
  ApiResponse.success(res, {
    applications: [],
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: 0,
      totalPages: 0
    }
  });
};

// [Refactor - Remove Manual Payment] Function for retrieving manual payment proof files. Obsolete.
/*
// Get payment proof file for an application
exports.getPaymentProof = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'ID de permiso no válido');
  }

  try {
    logger.info(`Admin ${adminId} requested payment proof for application ${applicationId}`);

    const { rows } = await db.query(
      `SELECT pa.payment_proof_path, pa.user_id, u.email as user_email
       FROM permit_applications pa
       JOIN users u ON pa.user_id = u.id
       WHERE pa.id = $1`,
      [applicationId]
    );

    if (rows.length === 0) {
      return ApiResponse.notFound(res, 'Permiso no encontrado');
    }

    if (!rows[0].payment_proof_path) {
      return ApiResponse.notFound(res, 'Comprobante no encontrado para este permiso');
    }

    // Log the access
    logger.info(`Admin ${adminId} accessing payment proof for application ${applicationId} from user ${rows[0].user_email}`);

    // Construct the full path to the payment proof file
    const proofFilePath = path.join(__dirname, '../../storage/payment_proofs', path.basename(rows[0].payment_proof_path));

    // Send the file
    res.sendFile(proofFilePath, (err) => {
      if (err) {
        logger.error(`Error sending payment proof file for application ${applicationId}:`, err);
        // Only send error if headers not already sent
        if (!res.headersSent) {
          ApiResponse.notFound(res, 'Error al acceder al archivo de comprobante');
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting payment proof for application ${applicationId}:`, error);
    next(error);
  }
};
*/

// Temporary replacement function for getPaymentProof
exports.getPaymentProof = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// [Refactor - Remove Manual Payment] Function for approving manual payment proof. Obsolete.
/*
// Verify payment for an application
exports.verifyPayment = async (req, res, next) => {
  const adminId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  const { notes } = req.body;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'ID de permiso no válido');
  }

  try {
    logger.info(`Admin ${adminId} is verifying payment for application ${applicationId}`);

    // Start a transaction
    await db.query('BEGIN');

    // Check if application exists and has the correct status
    const { rows: appRows } = await db.query(
      `SELECT status, user_id FROM permit_applications
       WHERE id = $1 AND status = 'PROOF_SUBMITTED'`,
      [applicationId]
    );

    if (appRows.length === 0) {
      await db.query('ROLLBACK');
      return ApiResponse.badRequest(res, 'Permiso no encontrado o no está en estado de comprobante enviado');
    }

    const userId = appRows[0].user_id;

    // Update application status
    const updateQuery = `
      UPDATE permit_applications
      SET status = 'PAYMENT_RECEIVED',
          payment_verified_by = $1,
          payment_verified_at = CURRENT_TIMESTAMP,
          payment_notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, status;
    `;

    const { rows: updated } = await db.query(updateQuery, [adminId, notes, applicationId]);

    // Log the verification
    await db.query(
      `INSERT INTO payment_verification_log
       (application_id, verified_by, action, notes)
       VALUES ($1, $2, 'approved', $3)`,
      [applicationId, adminId, notes]
    );

    // Commit transaction
    await db.query('COMMIT');

    logger.info(`Payment for application ${applicationId} verified successfully by admin ${adminId}`);

    // Trigger Puppeteer asynchronously
    setImmediate(async () => {
      try {
        logger.info(`Triggering Puppeteer job for verified application ${applicationId}`);
        await puppeteerService.generatePermit(applicationId);
      } catch (puppeteerError) {
        logger.error(`Error triggering Puppeteer for application ${applicationId}:`, puppeteerError);
      }
    });

    return ApiResponse.success(res, {
      applicationId: updated[0].id,
      status: updated[0].status
    }, 200, 'Pago verificado correctamente. Generación de permiso iniciada.');

  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(`Error verifying payment for application ${applicationId}:`, error);

    // Return a more user-friendly error message
    ApiResponse.error(res, 'Error al verificar el pago. Intenta de nuevo.', 500);
  }
};
*/

// Temporary replacement function for verifyPayment
exports.verifyPayment = async (req, res, next) => {
  const adminId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  logger.info(`Admin ${adminId} attempted to verify payment for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// [Refactor - Remove Manual Payment] Function for rejecting manual payment proof. Obsolete.
/*
// Reject payment proof for an application
exports.rejectPayment = async (req, res, next) => {
  const adminId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  const { reason, notes } = req.body;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'ID de permiso no válido');
  }

  if (!reason) {
    return ApiResponse.badRequest(res, 'Se requiere un motivo de rechazo');
  }

  // Combine reason and notes for the rejection reason
  const rejectionReason = notes ? `${reason}: ${notes}` : reason;

  try {
    logger.info(`Admin ${adminId} is rejecting payment for application ${applicationId}`);

    // Start a transaction
    await db.query('BEGIN');

    // Check if application exists and has the correct status
    const { rows: appRows } = await db.query(
      `SELECT status, user_id FROM permit_applications
       WHERE id = $1 AND status = 'PROOF_SUBMITTED'`,
      [applicationId]
    );

    if (appRows.length === 0) {
      await db.query('ROLLBACK');
      return ApiResponse.badRequest(res, 'Permiso no encontrado o no está en estado de comprobante enviado');
    }

    const userId = appRows[0].user_id;

    // Update application status
    const updateQuery = `
      UPDATE permit_applications
      SET status = 'PROOF_REJECTED',
          payment_rejection_reason = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, status;
    `;

    const { rows: updated } = await db.query(updateQuery, [rejectionReason, applicationId]);

    // Log the rejection
    await db.query(
      `INSERT INTO payment_verification_log
       (application_id, verified_by, action, notes)
       VALUES ($1, $2, 'rejected', $3)`,
      [applicationId, adminId, rejectionReason]
    );

    // Commit transaction
    await db.query('COMMIT');

    logger.info(`Payment for application ${applicationId} rejected by admin ${adminId}: ${rejectionReason}`);

    return ApiResponse.success(res, {
      applicationId: updated[0].id,
      status: updated[0].status,
      reason: reason,
      notes: notes
    }, 200, 'Pago rechazado correctamente. El cliente deberá enviar un nuevo comprobante.');

  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(`Error rejecting payment for application ${applicationId}:`, error);

    // Return a more user-friendly error message
    ApiResponse.error(res, 'Error al rechazar el pago. Intenta de nuevo.', 500);
  }
};
*/

// Temporary replacement function for rejectPayment
exports.rejectPayment = async (req, res, next) => {
  const adminId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  logger.info(`Admin ${adminId} attempted to reject payment for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// [Refactor - Remove Manual Payment] Function for retrieving manual payment verification history. Obsolete.
/*
// Get verification history
exports.getVerificationHistory = async (req, res, next) => {
  const adminId = req.session.userId;
  const { startDate, endDate, action, search, page = 1, limit = 10 } = req.query;

  try {
    logger.info(`Admin ${adminId} requested verification history with filters:`, req.query);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Base query for verification history
    let query = `
      SELECT pvl.id, pvl.application_id, pvl.action, pvl.notes, pvl.created_at,
             u.first_name, u.last_name, u.email as admin_email,
             pa.payment_reference, pa.nombre_completo as applicant_name
      FROM payment_verification_log pvl
      JOIN users u ON pvl.verified_by = u.id
      JOIN permit_applications pa ON pvl.application_id = pa.id
      WHERE 1=1
    `;

    // Count query for total records
    let countQuery = `
      SELECT COUNT(*) as total
      FROM payment_verification_log pvl
      JOIN users u ON pvl.verified_by = u.id
      JOIN permit_applications pa ON pvl.application_id = pa.id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];

    // Add filters if provided
    if (action) {
      params.push(action);
      countParams.push(action);
      query += ` AND pvl.action = $${params.length}`;
      countQuery += ` AND pvl.action = $${countParams.length}`;
    }

    if (startDate) {
      params.push(startDate);
      countParams.push(startDate);
      query += ` AND pvl.created_at >= $${params.length}::date`;
      countQuery += ` AND pvl.created_at >= $${countParams.length}::date`;
    }

    if (endDate) {
      params.push(endDate);
      countParams.push(endDate);
      query += ` AND pvl.created_at <= ($${params.length}::date + interval '1 day')`;
      countQuery += ` AND pvl.created_at <= ($${countParams.length}::date + interval '1 day')`;
    }

    if (search) {
      const searchParam = `%${search}%`;
      params.push(searchParam);
      countParams.push(searchParam);
      query += ` AND (
        pa.nombre_completo ILIKE $${params.length} OR
        u.email ILIKE $${params.length} OR
        CAST(pvl.application_id AS TEXT) = '${search}' OR
        u.first_name ILIKE $${params.length} OR
        u.last_name ILIKE $${params.length}
      )`;
      countQuery += ` AND (
        pa.nombre_completo ILIKE $${countParams.length} OR
        u.email ILIKE $${countParams.length} OR
        CAST(pvl.application_id AS TEXT) = '${search}' OR
        u.first_name ILIKE $${countParams.length} OR
        u.last_name ILIKE $${countParams.length}
      )`;
    }

    // Add order by, limit and offset
    query += ` ORDER BY pvl.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // Run both queries in parallel
    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Format the data to match frontend expectations
    const formattedRows = dataResult.rows.map(row => ({
      id: row.id,
      application_id: row.application_id,
      admin_id: row.verified_by,
      action: row.action === 'verify' ? 'approved' : (row.action === 'reject' ? 'rejected' : row.action),
      notes: row.notes,
      created_at: row.created_at,
      admin_name: `${row.first_name} ${row.last_name}`,
      admin_email: row.admin_email,
      payment_reference: row.payment_reference || 'N/A'
    }));

    logger.debug(`Found ${formattedRows.length} verification history records`);

    ApiResponse.success(res, {
      history: formattedRows,
      total
    });
  } catch (error) {
    logger.error('Error getting verification history:', error);
    // Return default data instead of error to make the UI more resilient
    ApiResponse.success(res, {
      history: [],
      total: 0
    });
  }
};
*/

// Temporary replacement function for getVerificationHistory
exports.getVerificationHistory = async (req, res, next) => {
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested verification history, but functionality is disabled`);

  // Return empty data
  ApiResponse.success(res, {
    history: [],
    total: 0
  });
};

// Get admin dashboard stats
exports.getDashboardStats = async (req, res, next) => {
  const adminId = req.session.userId;

  try {
    logger.info(`Admin ${adminId} requested dashboard stats`);

    // Get counts for different statuses
    const statusCountQuery = `
      SELECT status, COUNT(*) as count
      FROM permit_applications
      GROUP BY status
      ORDER BY status
    `;

    // Get today's verification counts
    const todayVerificationsQuery = `
      SELECT action, COUNT(*) as count
      FROM payment_verification_log
      WHERE created_at::date = CURRENT_DATE
      GROUP BY action
    `;

    // Get pending verifications count
    const pendingVerificationsQuery = `
      SELECT COUNT(*) as count
      FROM permit_applications
      WHERE status = 'PROOF_SUBMITTED'
    `;

    // Run all queries in parallel
    const [statusResults, todayResults, pendingResults] = await Promise.all([
      db.query(statusCountQuery),
      db.query(todayVerificationsQuery),
      db.query(pendingVerificationsQuery)
    ]);

    // Format today's verification counts
    const todayVerifications = {
      approved: 0,
      rejected: 0
    };

    todayResults.rows.forEach(row => {
      if (row.action === 'approved') {
        todayVerifications.approved = parseInt(row.count);
      } else if (row.action === 'rejected') {
        todayVerifications.rejected = parseInt(row.count);
      }
    });

    // Map database status values to frontend status values if needed
    const statusMap = {
      'PENDING_PAYMENT': 'PENDING',
      'PROOF_SUBMITTED': 'PROOF_SUBMITTED',
      'PAYMENT_RECEIVED': 'PAYMENT_VERIFIED',
      'PROOF_REJECTED': 'PAYMENT_REJECTED',
      'PERMIT_READY': 'PERMIT_GENERATED',
      'COMPLETED': 'COMPLETED',
      'CANCELLED': 'CANCELLED'
    };

    // Format status counts to match frontend expectations
    const formattedStatusCounts = statusResults.rows.map(row => ({
      status: statusMap[row.status] || row.status,
      count: parseInt(row.count)
    }));

    ApiResponse.success(res, {
      statusCounts: formattedStatusCounts,
      todayVerifications,
      pendingVerifications: parseInt(pendingResults.rows[0].count)
    });
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    // Return default data instead of error to make the UI more resilient
    ApiResponse.success(res, {
      statusCounts: [],
      todayVerifications: { approved: 0, rejected: 0 },
      pendingVerifications: 0
    });
  }
};

// Get application details for admin
exports.getApplicationDetails = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'ID de permiso no válido');
  }

  try {
    logger.info(`Admin ${adminId} requested details for application ${applicationId}`);

    // Get application details
    const { rows } = await db.query(
      `SELECT pa.*, u.email as applicant_email
       FROM permit_applications pa
       JOIN users u ON pa.user_id = u.id
       WHERE pa.id = $1`,
      [applicationId]
    );

    if (rows.length === 0) {
      return ApiResponse.notFound(res, 'Application not found');
    }

    // Get verification history for this application
    const { rows: historyRows } = await db.query(
      `SELECT vl.id, vl.verified_by, vl.action, vl.notes, vl.created_at,
              u.first_name, u.last_name, u.email
       FROM payment_verification_log vl
       JOIN users u ON vl.verified_by = u.id
       WHERE vl.application_id = $1
       ORDER BY vl.created_at DESC`,
      [applicationId]
    );

    // Map database status to frontend status
    const statusMap = {
      'PENDING_PAYMENT': 'PENDING',
      'PROOF_SUBMITTED': 'PROOF_SUBMITTED',
      'PAYMENT_RECEIVED': 'PAYMENT_VERIFIED',
      'PROOF_REJECTED': 'PAYMENT_REJECTED',
      'PERMIT_READY': 'PERMIT_GENERATED',
      'COMPLETED': 'COMPLETED',
      'CANCELLED': 'CANCELLED'
    };

    // Format the application data to match frontend expectations
    const application = {
      id: rows[0].id,
      status: statusMap[rows[0].status] || rows[0].status,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      applicant_name: rows[0].nombre_completo,
      applicant_email: rows[0].applicant_email,
      applicant_phone: rows[0].applicant_phone,
      amount: rows[0].importe || 1350.00, // Default amount if not set
      payment_reference: rows[0].payment_reference,
      payment_proof_uploaded_at: rows[0].payment_proof_uploaded_at,
      payment_verified_at: rows[0].payment_verified_at,
      payment_verified_by: rows[0].payment_verified_by,
      marca: rows[0].marca,
      linea: rows[0].linea,
      color: rows[0].color,
      ano_modelo: rows[0].ano_modelo,
      numero_serie: rows[0].numero_serie,
      numero_motor: rows[0].numero_motor,
      folio: rows[0].folio,
      curp_rfc: rows[0].curp_rfc,
      domicilio: rows[0].domicilio
    };

    // Format verification history
    const verificationHistory = historyRows.map(row => ({
      id: row.id,
      action: row.action,
      notes: row.notes,
      created_at: row.created_at,
      admin_name: `${row.first_name} ${row.last_name}`,
      admin_email: row.email
    }));

    return ApiResponse.success(res, application);
  } catch (error) {
    logger.error(`Error getting details for application ${applicationId}:`, error);
    // Return a default structure instead of error to make the UI more resilient
    ApiResponse.notFound(res, 'Application not found or error occurred', {
      id: applicationId,
      status: 'UNKNOWN'
    });
  }
};

// Get all applications with filtering and pagination
exports.getAllApplications = async (req, res, next) => {
  const adminId = req.session.userId;
  const { status, startDate, endDate, search, page = 1, limit = 10 } = req.query;

  try {
    logger.info(`Admin ${adminId} requested all applications with filters and pagination (page: ${page}, limit: ${limit})`);

    // Prepare filters and pagination parameters
    const filters = {
      status,
      startDate,
      endDate,
      searchTerm: search
    };

    const pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };

    // Use the repository method for paginated applications
    const applicationRepository = require('../repositories/application.repository');
    const result = await applicationRepository.findApplicationsWithPagination(filters, pagination);

    // Log the results for debugging
    logger.debug(`getAllApplications found ${result.applications.length} results (page ${result.page} of ${result.totalPages}, total: ${result.total})`);

    if (status) {
      logger.debug(`Filtered by status: ${status}, found ${result.total} total results`);
    }

    // Return the applications and pagination metadata
    ApiResponse.success(res, {
      applications: result.applications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Error getting all applications:', error);
    next(error);
  }
};

// [Refactor - Remove Manual Payment] Function for serving manual payment proof files. Obsolete.
/*
// Serve payment proof file
exports.servePaymentProofFile = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'Invalid application ID');
  }

  try {
    logger.info(`Admin ${adminId} requested payment proof file for application ${applicationId}`);

    // Get application details
    const { rows } = await db.query(
      `SELECT pa.id, pa.status, pa.payment_proof_path
       FROM permit_applications pa
       WHERE pa.id = $1`,
      [applicationId]
    );

    if (rows.length === 0) {
      return ApiResponse.notFound(res, 'Application not found');
    }

    const application = rows[0];

    if (!application.payment_proof_path) {
      return ApiResponse.notFound(res, 'Payment proof not found');
    }

    // Get the full path to the file
    // First check if it's a relative path
    let filePath;
    if (path.isAbsolute(application.payment_proof_path)) {
      filePath = application.payment_proof_path;
    } else {
      // If it's a relative path, resolve it relative to the storage directory
      const storageDir = path.join(__dirname, '../../storage');
      filePath = path.join(storageDir, application.payment_proof_path);
    }

    logger.debug(`Payment proof file path: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`Payment proof file not found at path: ${filePath}, serving placeholder image`);
      // Serve a placeholder image instead of returning an error
      const placeholderPath = path.join(__dirname, '../../public/assets/img/payment-proof-placeholder.svg');
      return res.sendFile(placeholderPath);
    }

    // Determine content type
    const fileExtension = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';

    if (['.jpg', '.jpeg'].includes(fileExtension)) {
      contentType = 'image/jpeg';
    } else if (fileExtension === '.png') {
      contentType = 'image/png';
    } else if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    }

    // Set content type and serve file
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    logger.error(`Error serving payment proof file for application ${applicationId}:`, error);
    next(error);
  }
};
*/

// Temporary replacement function for servePaymentProofFile
exports.servePaymentProofFile = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof file for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// [Refactor - Remove Manual Payment] Function for retrieving manual payment proof details. Obsolete.
/*
// Get payment proof details for an application
exports.getPaymentProofDetails = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  if (isNaN(applicationId)) {
    return ApiResponse.badRequest(res, 'Invalid application ID');
  }

  try {
    logger.info(`Admin ${adminId} requested payment proof details for application ${applicationId}`);

    // Get application details - use only columns that exist in the database
    const { rows } = await db.query(
      `SELECT pa.id, pa.status, pa.payment_proof_path, pa.payment_reference,
              pa.payment_proof_uploaded_at, pa.importe
       FROM permit_applications pa
       WHERE pa.id = $1`,
      [applicationId]
    );

    if (rows.length === 0) {
      return ApiResponse.notFound(res, 'Application not found');
    }

    const application = rows[0];

    if (!application.payment_proof_path) {
      return ApiResponse.notFound(res, 'Payment proof not found');
    }

    // Determine file type
    const fileExtension = path.extname(application.payment_proof_path).toLowerCase();
    let fileType;

    if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      fileType = `image/${fileExtension.substring(1)}`;
    } else if (fileExtension === '.pdf') {
      fileType = 'application/pdf';
    } else {
      fileType = 'application/octet-stream';
    }

    // Get file stats
    const filePath = application.payment_proof_path;
    let filesize = 0;
    let filename = path.basename(filePath);

    try {
      const stats = fs.statSync(filePath);
      filesize = stats.size;
    } catch (fsError) {
      logger.warn(`Could not get file stats for ${filePath}:`, fsError);
    }

    // Return payment proof details formatted for the frontend
    ApiResponse.success(res, {
      id: application.id,
      reference: application.payment_reference,
      amount: application.importe || 1350.00, // Use actual amount or default
      method: 'Transferencia Bancaria', // Default method
      uploaded_at: application.payment_proof_uploaded_at,
      filename: filename,
      filesize: filesize,
      mimetype: fileType,
      url: `/api/admin/applications/${applicationId}/payment-proof-file`
    });

    logger.debug(`Payment proof details sent for application ${applicationId}`);
  } catch (error) {
    logger.error(`Error getting payment proof details for application ${applicationId}:`, error);
    // Return a default structure instead of error to make the UI more resilient
    ApiResponse.success(res, {
      id: applicationId,
      filename: 'comprobante.jpg',
      filesize: 0,
      mimetype: 'image/jpeg',
      uploaded_at: new Date().toISOString()
    });
  }
};
*/

// Temporary replacement function for getPaymentProofDetails
exports.getPaymentProofDetails = async (req, res) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof details for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// src/controllers/admin-bulk.controller.js
const ApiResponse = require('../utils/api-response');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Will be injected by dependency container
let auditService = null;
let redisClient = null;
let emailService = null;
let notificationService = null;
let pdfQueueService = null;

const setDependencies = (dependencies = {}) => {
  auditService = dependencies.auditService || auditService;
  redisClient = dependencies.redisClient || redisClient;
  emailService = dependencies.emailService || emailService;
  notificationService = dependencies.notificationService || notificationService;
  pdfQueueService = dependencies.pdfQueueService || pdfQueueService;
};
exports.setDependencies = setDependencies;

// Constants
const BULK_OPERATION_LIMITS = {
  applications: 100,
  users: 500,
  cleanup: 1000
};

const OPERATION_TTL = 3600; // 1 hour in Redis

/**
 * Helper function to generate operation ID
 */
const generateOperationId = () => `bulk_op_${uuidv4()}`;

/**
 * Helper function to update operation progress in Redis
 */
const updateOperationProgress = async (operationId, progress) => {
  if (!redisClient) {
    const { getRedisClient } = require('../utils/redis-client');
    redisClient = await getRedisClient();
  }
  
  const key = `bulk_operation:${operationId}`;
  await redisClient.set(key, JSON.stringify(progress), 'EX', OPERATION_TTL);
};

/**
 * Helper function to get operation progress from Redis
 */
const getOperationProgress = async (operationId) => {
  if (!redisClient) {
    const { getRedisClient } = require('../utils/redis-client');
    redisClient = await getRedisClient();
  }
  
  const key = `bulk_operation:${operationId}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

/**
 * Bulk update application status
 */
exports.bulkUpdateApplicationStatus = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { applicationIds, status, reason, notify = false } = req.body;
    
    // Validation
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return ApiResponse.badRequest(res, 'Se requiere un array de IDs de aplicaciones');
    }
    
    if (applicationIds.length > BULK_OPERATION_LIMITS.applications) {
      return ApiResponse.badRequest(res, `Límite excedido. Máximo ${BULK_OPERATION_LIMITS.applications} aplicaciones por operación`);
    }
    
    if (!status) {
      return ApiResponse.badRequest(res, 'Estado es requerido');
    }
    
    // Validate status
    const { ApplicationStatus } = require('../constants/application.constants');
    const validStatuses = Object.values(ApplicationStatus);
    
    if (!validStatuses.includes(status)) {
      return ApiResponse.badRequest(res, `Estado inválido: ${status}`);
    }
    
    // Generate operation ID
    const operationId = generateOperationId();
    
    logger.info(`Admin ${adminId} initiating bulk status update for ${applicationIds.length} applications to ${status}`);
    
    // Initialize progress tracking
    const initialProgress = {
      operationId,
      type: 'bulk_status_update',
      status: 'processing',
      total: applicationIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      adminId,
      parameters: { status, reason, notify }
    };
    
    await updateOperationProgress(operationId, initialProgress);
    
    // Process in background
    setImmediate(async () => {
      const db = require('../db');
      const progress = { ...initialProgress };
      
      for (let i = 0; i < applicationIds.length; i++) {
        const applicationId = applicationIds[i];
        
        try {
          // Validate ID
          const appId = parseInt(applicationId, 10);
          if (isNaN(appId)) {
            throw new Error('ID de aplicación inválido');
          }
          
          // Update status in transaction
          const client = await db.dbPool.connect();
          try {
            await client.query('BEGIN');
            
            // Get current application
            const currentAppResult = await client.query(
              `SELECT pa.*, u.account_email as user_email, u.phone as user_phone
               FROM permit_applications pa
               JOIN users u ON pa.user_id = u.id
               WHERE pa.id = $1 FOR UPDATE`,
              [appId]
            );
            
            if (currentAppResult.rows.length === 0) {
              throw new Error('Aplicación no encontrada');
            }
            
            const currentApp = currentAppResult.rows[0];
            const previousStatus = currentApp.status;
            
            // Check if status change is allowed
            if (previousStatus === status) {
              throw new Error('La aplicación ya tiene este estado');
            }
            
            // Update the status
            await client.query(
              `UPDATE permit_applications 
               SET status = $1, updated_at = NOW() 
               WHERE id = $2`,
              [status, appId]
            );
            
            // Create audit event
            await client.query(
              `INSERT INTO payment_events (
                application_id, order_id, event_type, event_data, created_at
              ) VALUES ($1, $2, $3, $4, NOW())`,
              [
                appId,
                currentApp.payment_processor_order_id || 'ADMIN_BULK_ACTION',
                'admin.bulk.status.updated',
                JSON.stringify({
                  previousStatus,
                  newStatus: status,
                  adminId,
                  operationId,
                  reason: reason || 'Bulk status update',
                  timestamp: new Date().toISOString()
                })
              ]
            );
            
            await client.query('COMMIT');
            
            // Send notification if requested
            if (notify && currentApp.user_email && notificationService) {
              try {
                await notificationService.sendNotification({
                  type: 'status_update',
                  recipientEmail: currentApp.user_email,
                  recipientPhone: currentApp.user_phone,
                  data: {
                    applicationId: appId,
                    previousStatus,
                    newStatus: status,
                    reason: reason || 'Actualización administrativa'
                  }
                });
              } catch (notifyError) {
                logger.error(`Failed to send notification for app ${appId}:`, notifyError);
              }
            }
            
            progress.succeeded++;
            
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
          
        } catch (error) {
          logger.error(`Error updating application ${applicationId}:`, error);
          progress.failed++;
          progress.errors.push({
            applicationId,
            error: error.message
          });
        }
        
        progress.processed++;
        
        // Update progress every 10 items or at the end
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          await updateOperationProgress(operationId, progress);
        }
      }
      
      // Final update
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      await updateOperationProgress(operationId, progress);
      
      // Log audit action
      if (auditService) {
        await auditService.logAdminAction(
          adminId,
          'bulk_update',
          'applications',
          null,
          {
            operationId,
            totalProcessed: progress.processed,
            succeeded: progress.succeeded,
            failed: progress.failed,
            newStatus: status
          },
          null
        );
      }
      
      // Send completion notification to admin
      if (emailService) {
        try {
          const adminUser = await db.query('SELECT email FROM users WHERE id = $1', [adminId]);
          if (adminUser.rows.length > 0) {
            await emailService.sendEmail({
              to: adminUser.rows[0].email,
              subject: 'Operación masiva completada',
              template: 'bulk-operation-complete',
              data: {
                operationType: 'Actualización de estado',
                totalProcessed: progress.processed,
                succeeded: progress.succeeded,
                failed: progress.failed,
                operationId
              }
            });
          }
        } catch (emailError) {
          logger.error('Error sending completion email:', emailError);
        }
      }
    });
    
    // Return immediate response
    return ApiResponse.success(res, {
      operationId,
      message: 'Operación iniciada',
      total: applicationIds.length,
      trackingUrl: `/api/admin/bulk/status/${operationId}`
    });
    
  } catch (error) {
    logger.error('Error initiating bulk status update:', error);
    return ApiResponse.error(res, 'Error al iniciar actualización masiva', 500);
  }
};

/**
 * Bulk regenerate PDFs for applications
 */
exports.bulkRegeneratePDFs = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { applicationIds } = req.body;
    
    // Validation
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return ApiResponse.badRequest(res, 'Se requiere un array de IDs de aplicaciones');
    }
    
    if (applicationIds.length > BULK_OPERATION_LIMITS.applications) {
      return ApiResponse.badRequest(res, `Límite excedido. Máximo ${BULK_OPERATION_LIMITS.applications} aplicaciones por operación`);
    }
    
    // Generate operation ID
    const operationId = generateOperationId();
    
    logger.info(`Admin ${adminId} initiating bulk PDF regeneration for ${applicationIds.length} applications`);
    
    // Initialize progress tracking
    const initialProgress = {
      operationId,
      type: 'bulk_pdf_regeneration',
      status: 'processing',
      total: applicationIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      adminId
    };
    
    await updateOperationProgress(operationId, initialProgress);
    
    // Process in background
    setImmediate(async () => {
      const db = require('../db');
      const progress = { ...initialProgress };
      
      // Get PDF queue service
      if (!pdfQueueService) {
        const { getInstance } = require('../services/pdf-queue-factory.service');
        pdfQueueService = getInstance();
      }
      
      for (let i = 0; i < applicationIds.length; i++) {
        const applicationId = applicationIds[i];
        
        try {
          // Validate ID
          const appId = parseInt(applicationId, 10);
          if (isNaN(appId)) {
            throw new Error('ID de aplicación inválido');
          }
          
          // Check application exists and is in valid state
          const appResult = await db.query(
            `SELECT id, status, user_id FROM permit_applications WHERE id = $1`,
            [appId]
          );
          
          if (appResult.rows.length === 0) {
            throw new Error('Aplicación no encontrada');
          }
          
          const app = appResult.rows[0];
          const validStatuses = ['PAYMENT_RECEIVED', 'ERROR_GENERATING_PERMIT', 'GENERATING_PERMIT', 'PERMIT_READY'];
          
          if (!validStatuses.includes(app.status)) {
            throw new Error(`Estado inválido para regenerar PDF: ${app.status}`);
          }
          
          // Update status to GENERATING_PERMIT if needed
          if (app.status !== 'GENERATING_PERMIT') {
            await db.query(
              `UPDATE permit_applications SET status = 'GENERATING_PERMIT', updated_at = NOW() WHERE id = $1`,
              [appId]
            );
          }
          
          // Queue the PDF generation job
          const jobData = {
            applicationId: appId,
            userId: app.user_id,
            triggeredBy: 'admin_bulk',
            adminId: adminId,
            operationId,
            originalStatus: app.status
          };
          
          await pdfQueueService.addJob(jobData);
          
          progress.succeeded++;
          
        } catch (error) {
          logger.error(`Error queueing PDF for application ${applicationId}:`, error);
          progress.failed++;
          progress.errors.push({
            applicationId,
            error: error.message
          });
        }
        
        progress.processed++;
        
        // Update progress every 10 items or at the end
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          await updateOperationProgress(operationId, progress);
        }
      }
      
      // Final update
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      await updateOperationProgress(operationId, progress);
      
      // Log audit action
      if (auditService) {
        await auditService.logAdminAction(
          adminId,
          'bulk_regenerate',
          'pdfs',
          null,
          {
            operationId,
            totalProcessed: progress.processed,
            succeeded: progress.succeeded,
            failed: progress.failed
          },
          null
        );
      }
    });
    
    // Return immediate response
    return ApiResponse.success(res, {
      operationId,
      message: 'Operación iniciada',
      total: applicationIds.length,
      trackingUrl: `/api/admin/bulk/status/${operationId}`
    });
    
  } catch (error) {
    logger.error('Error initiating bulk PDF regeneration:', error);
    return ApiResponse.error(res, 'Error al iniciar regeneración masiva de PDFs', 500);
  }
};

/**
 * Bulk send email reminders
 */
exports.bulkSendReminders = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { applicationIds, reminderType = 'payment_reminder' } = req.body;
    
    // Validation
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return ApiResponse.badRequest(res, 'Se requiere un array de IDs de aplicaciones');
    }
    
    if (applicationIds.length > BULK_OPERATION_LIMITS.applications) {
      return ApiResponse.badRequest(res, `Límite excedido. Máximo ${BULK_OPERATION_LIMITS.applications} aplicaciones por operación`);
    }
    
    const validReminderTypes = ['payment_reminder', 'permit_ready', 'expiration_reminder', 'custom'];
    if (!validReminderTypes.includes(reminderType)) {
      return ApiResponse.badRequest(res, 'Tipo de recordatorio inválido');
    }
    
    // Generate operation ID
    const operationId = generateOperationId();
    
    logger.info(`Admin ${adminId} initiating bulk reminder sending for ${applicationIds.length} applications`);
    
    // Initialize progress tracking
    const initialProgress = {
      operationId,
      type: 'bulk_send_reminders',
      status: 'processing',
      total: applicationIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      adminId,
      parameters: { reminderType }
    };
    
    await updateOperationProgress(operationId, initialProgress);
    
    // Process in background
    setImmediate(async () => {
      const db = require('../db');
      const progress = { ...initialProgress };
      
      if (!emailService) {
        emailService = require('../services/email.service');
      }
      
      for (let i = 0; i < applicationIds.length; i++) {
        const applicationId = applicationIds[i];
        
        try {
          // Validate ID
          const appId = parseInt(applicationId, 10);
          if (isNaN(appId)) {
            throw new Error('ID de aplicación inválido');
          }
          
          // Get application and user details
          const appResult = await db.query(
            `SELECT pa.*, u.email, u.first_name, u.last_name, u.phone
             FROM permit_applications pa
             JOIN users u ON pa.user_id = u.id
             WHERE pa.id = $1`,
            [appId]
          );
          
          if (appResult.rows.length === 0) {
            throw new Error('Aplicación no encontrada');
          }
          
          const app = appResult.rows[0];
          
          // Determine email template and data based on reminder type
          let emailTemplate, emailData;
          
          switch (reminderType) {
            case 'payment_reminder':
              if (!['PENDING_PAYMENT', 'AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT'].includes(app.status)) {
                throw new Error('La aplicación no está pendiente de pago');
              }
              emailTemplate = 'payment-reminder';
              emailData = {
                userName: `${app.first_name} ${app.last_name}`,
                applicationId: app.id,
                vehicleInfo: `${app.marca} ${app.linea} ${app.ano_modelo}`,
                amount: app.importe,
                paymentLink: `${process.env.FRONTEND_URL}/permits/${app.id}/payment`
              };
              break;
              
            case 'permit_ready':
              if (app.status !== 'PERMIT_READY') {
                throw new Error('El permiso no está listo');
              }
              emailTemplate = 'permit-ready';
              emailData = {
                userName: `${app.first_name} ${app.last_name}`,
                applicationId: app.id,
                folio: app.folio,
                downloadLink: `${process.env.FRONTEND_URL}/permits/${app.id}`
              };
              break;
              
            case 'expiration_reminder':
              emailTemplate = 'permit-expiration';
              emailData = {
                userName: `${app.first_name} ${app.last_name}`,
                vehicleInfo: `${app.marca} ${app.linea} ${app.ano_modelo}`,
                expirationDate: app.fecha_vencimiento,
                renewalLink: `${process.env.FRONTEND_URL}/permits/${app.id}/renew`
              };
              break;
              
            default:
              throw new Error('Tipo de recordatorio no implementado');
          }
          
          // Send email
          await emailService.sendEmail({
            to: app.email,
            subject: getEmailSubject(reminderType),
            template: emailTemplate,
            data: emailData
          });
          
          // Record the reminder
          await db.query(
            `INSERT INTO email_reminders (
              application_id, user_id, reminder_type, email_sent_to, 
              sent_at, status, admin_triggered, admin_id
            ) VALUES ($1, $2, $3, $4, NOW(), 'sent', true, $5)`,
            [appId, app.user_id, reminderType, app.email, adminId]
          );
          
          progress.succeeded++;
          
        } catch (error) {
          logger.error(`Error sending reminder for application ${applicationId}:`, error);
          progress.failed++;
          progress.errors.push({
            applicationId,
            error: error.message
          });
        }
        
        progress.processed++;
        
        // Update progress every 10 items or at the end
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          await updateOperationProgress(operationId, progress);
        }
      }
      
      // Final update
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      await updateOperationProgress(operationId, progress);
      
      // Log audit action
      if (auditService) {
        await auditService.logAdminAction(
          adminId,
          'bulk_send',
          'reminders',
          null,
          {
            operationId,
            totalProcessed: progress.processed,
            succeeded: progress.succeeded,
            failed: progress.failed,
            reminderType
          },
          null
        );
      }
    });
    
    // Return immediate response
    return ApiResponse.success(res, {
      operationId,
      message: 'Operación iniciada',
      total: applicationIds.length,
      trackingUrl: `/api/admin/bulk/status/${operationId}`
    });
    
  } catch (error) {
    logger.error('Error initiating bulk reminder sending:', error);
    return ApiResponse.error(res, 'Error al iniciar envío masivo de recordatorios', 500);
  }
};

/**
 * Bulk export users to CSV
 */
exports.bulkExportUsers = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { userIds, includeApplications = false } = req.body;
    
    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return ApiResponse.badRequest(res, 'Se requiere un array de IDs de usuarios');
    }
    
    if (userIds.length > BULK_OPERATION_LIMITS.users) {
      return ApiResponse.badRequest(res, `Límite excedido. Máximo ${BULK_OPERATION_LIMITS.users} usuarios por exportación`);
    }
    
    logger.info(`Admin ${adminId} exporting ${userIds.length} users to CSV`);
    
    const db = require('../db');
    
    // Build query
    const params = [userIds];
    let query = `
      SELECT 
        u.id,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        u.account_type,
        u.is_email_verified,
        u.account_status,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        u.login_count,
        (
          SELECT COUNT(*) 
          FROM permit_applications 
          WHERE user_id = u.id
        ) as total_applications,
        (
          SELECT COUNT(*) 
          FROM permit_applications 
          WHERE user_id = u.id AND status = 'PERMIT_READY'
        ) as completed_applications
    `;
    
    if (includeApplications) {
      query += `,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pa.id,
              'status', pa.status,
              'created_at', pa.created_at,
              'folio', pa.folio,
              'marca', pa.marca,
              'linea', pa.linea,
              'placas', pa.placas,
              'importe', pa.importe
            ) ORDER BY pa.created_at DESC
          )
          FROM permit_applications pa
          WHERE pa.user_id = u.id
        ) as applications
      `;
    }
    
    query += `
      FROM users u
      WHERE u.id = ANY($1::int[])
      ORDER BY u.created_at DESC
    `;
    
    // Execute query
    const { rows } = await db.query(query, params);
    
    // Build CSV
    const csvHeaders = [
      'ID',
      'Email',
      'Teléfono',
      'Nombre',
      'Apellido',
      'Tipo de Cuenta',
      'Email Verificado',
      'Estado de Cuenta',
      'Fecha de Registro',
      'Última Actualización',
      'Último Acceso',
      'Número de Accesos',
      'Total de Aplicaciones',
      'Aplicaciones Completadas'
    ];
    
    if (includeApplications) {
      csvHeaders.push('Detalles de Aplicaciones');
    }
    
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
    const csvRows = rows.map(row => {
      const baseData = [
        row.id,
        row.email,
        row.phone || '',
        row.first_name,
        row.last_name,
        row.account_type,
        row.is_email_verified ? 'Sí' : 'No',
        row.account_status,
        row.created_at ? new Date(row.created_at).toLocaleString('es-MX') : '',
        row.updated_at ? new Date(row.updated_at).toLocaleString('es-MX') : '',
        row.last_login_at ? new Date(row.last_login_at).toLocaleString('es-MX') : 'Nunca',
        row.login_count || 0,
        row.total_applications || 0,
        row.completed_applications || 0
      ];
      
      if (includeApplications && row.applications) {
        const appSummary = row.applications
          .map(app => `${app.id}: ${app.status} - ${app.marca} ${app.linea} ${app.placas || 'Sin placas'}`)
          .join('; ');
        baseData.push(appSummary);
      }
      
      return baseData.map(escapeCSV).join(',');
    });
    
    // Combine headers and rows
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows
    ].join('\n');
    
    // Add UTF-8 BOM for proper Excel compatibility
    const bom = '\ufeff';
    const csvWithBom = bom + csvContent;
    
    // Log audit action
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'bulk_export',
        'users',
        null,
        {
          userCount: rows.length,
          includeApplications
        },
        req
      );
    }
    
    // Set response headers
    const filename = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.send(csvWithBom);
    
  } catch (error) {
    logger.error('Error exporting users:', error);
    return ApiResponse.error(res, 'Error al exportar usuarios', 500);
  }
};

/**
 * Bulk send email to users
 */
exports.bulkEmailUsers = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { userIds, subject, message, template = 'custom' } = req.body;
    
    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return ApiResponse.badRequest(res, 'Se requiere un array de IDs de usuarios');
    }
    
    if (userIds.length > BULK_OPERATION_LIMITS.users) {
      return ApiResponse.badRequest(res, `Límite excedido. Máximo ${BULK_OPERATION_LIMITS.users} usuarios por operación`);
    }
    
    if (!subject || !message) {
      return ApiResponse.badRequest(res, 'Asunto y mensaje son requeridos');
    }
    
    // Generate operation ID
    const operationId = generateOperationId();
    
    logger.info(`Admin ${adminId} initiating bulk email to ${userIds.length} users`);
    
    // Initialize progress tracking
    const initialProgress = {
      operationId,
      type: 'bulk_email_users',
      status: 'processing',
      total: userIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      adminId,
      parameters: { subject, template }
    };
    
    await updateOperationProgress(operationId, initialProgress);
    
    // Process in background
    setImmediate(async () => {
      const db = require('../db');
      const progress = { ...initialProgress };
      
      if (!emailService) {
        emailService = require('../services/email.service');
      }
      
      // Get admin details for sender info
      const adminResult = await db.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [adminId]
      );
      const adminUser = adminResult.rows[0];
      
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        
        try {
          // Validate ID
          const uid = parseInt(userId, 10);
          if (isNaN(uid)) {
            throw new Error('ID de usuario inválido');
          }
          
          // Get user details
          const userResult = await db.query(
            'SELECT email, first_name, last_name FROM users WHERE id = $1',
            [uid]
          );
          
          if (userResult.rows.length === 0) {
            throw new Error('Usuario no encontrado');
          }
          
          const user = userResult.rows[0];
          
          // Send email
          await emailService.sendEmail({
            to: user.email,
            subject: subject,
            template: template === 'custom' ? 'admin-message' : template,
            data: {
              userName: `${user.first_name} ${user.last_name}`,
              message: message,
              adminName: `${adminUser.first_name} ${adminUser.last_name}`,
              adminEmail: adminUser.email,
              timestamp: new Date().toISOString()
            }
          });
          
          // Record the email
          await db.query(
            `INSERT INTO email_notifications (
              user_id, email_type, email_to, subject, 
              status, sent_at, admin_triggered, admin_id
            ) VALUES ($1, 'admin_bulk_email', $2, $3, 'sent', NOW(), true, $4)`,
            [uid, user.email, subject, adminId]
          );
          
          progress.succeeded++;
          
        } catch (error) {
          logger.error(`Error sending email to user ${userId}:`, error);
          progress.failed++;
          progress.errors.push({
            userId,
            error: error.message
          });
        }
        
        progress.processed++;
        
        // Update progress every 10 items or at the end
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          await updateOperationProgress(operationId, progress);
        }
      }
      
      // Final update
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      await updateOperationProgress(operationId, progress);
      
      // Log audit action
      if (auditService) {
        await auditService.logAdminAction(
          adminId,
          'bulk_email',
          'users',
          null,
          {
            operationId,
            totalProcessed: progress.processed,
            succeeded: progress.succeeded,
            failed: progress.failed,
            subject
          },
          null
        );
      }
    });
    
    // Return immediate response
    return ApiResponse.success(res, {
      operationId,
      message: 'Operación iniciada',
      total: userIds.length,
      trackingUrl: `/api/admin/bulk/status/${operationId}`
    });
    
  } catch (error) {
    logger.error('Error initiating bulk email to users:', error);
    return ApiResponse.error(res, 'Error al iniciar envío masivo de emails', 500);
  }
};

/**
 * Bulk cleanup old expired applications
 */
exports.bulkCleanupApplications = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { 
      daysOld = 90, 
      statuses = ['EXPIRED', 'PAYMENT_EXPIRED', 'CANCELLED'],
      dryRun = true 
    } = req.body;
    
    // Validation
    if (daysOld < 30) {
      return ApiResponse.badRequest(res, 'Las aplicaciones deben tener al menos 30 días de antigüedad');
    }
    
    const validStatuses = ['EXPIRED', 'PAYMENT_EXPIRED', 'CANCELLED', 'PAYMENT_FAILED'];
    const invalidStatuses = statuses.filter(s => !validStatuses.includes(s));
    if (invalidStatuses.length > 0) {
      return ApiResponse.badRequest(res, `Estados inválidos: ${invalidStatuses.join(', ')}`);
    }
    
    logger.info(`Admin ${adminId} initiating bulk cleanup of applications older than ${daysOld} days`);
    
    const db = require('../db');
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Find applications to clean up
    const findQuery = `
      SELECT 
        pa.id,
        pa.status,
        pa.created_at,
        pa.permit_file_path,
        pa.certificado_file_path,
        pa.placas_file_path,
        pa.recomendaciones_file_path,
        u.account_email as user_email
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.status = ANY($1::text[])
      AND pa.created_at < $2
      AND pa.id NOT IN (
        SELECT DISTINCT renewed_from_id 
        FROM permit_applications 
        WHERE renewed_from_id IS NOT NULL
      )
      ORDER BY pa.created_at ASC
      LIMIT $3
    `;
    
    const { rows: applications } = await db.query(findQuery, [
      statuses,
      cutoffDate,
      BULK_OPERATION_LIMITS.cleanup
    ]);
    
    if (applications.length === 0) {
      return ApiResponse.success(res, {
        message: 'No se encontraron aplicaciones para limpiar',
        count: 0,
        dryRun
      });
    }
    
    // If dry run, just return what would be deleted
    if (dryRun) {
      return ApiResponse.success(res, {
        message: 'Modo de prueba - no se eliminaron aplicaciones',
        count: applications.length,
        dryRun: true,
        preview: applications.slice(0, 10).map(app => ({
          id: app.id,
          status: app.status,
          createdAt: app.created_at,
          userEmail: app.user_email
        }))
      });
    }
    
    // Generate operation ID for actual cleanup
    const operationId = generateOperationId();
    
    // Initialize progress tracking
    const initialProgress = {
      operationId,
      type: 'bulk_cleanup_applications',
      status: 'processing',
      total: applications.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      adminId,
      parameters: { daysOld, statuses }
    };
    
    await updateOperationProgress(operationId, initialProgress);
    
    // Process cleanup in background
    setImmediate(async () => {
      const progress = { ...initialProgress };
      const { deleteFile } = require('../utils/storage-utils');
      
      for (let i = 0; i < applications.length; i++) {
        const app = applications[i];
        
        try {
          const client = await db.dbPool.connect();
          try {
            await client.query('BEGIN');
            
            // Delete associated files
            const filesToDelete = [
              app.permit_file_path,
              app.certificado_file_path,
              app.placas_file_path,
              app.recomendaciones_file_path
            ].filter(Boolean);
            
            for (const filePath of filesToDelete) {
              try {
                await deleteFile(filePath);
              } catch (fileError) {
                logger.error(`Error deleting file ${filePath}:`, fileError);
              }
            }
            
            // Delete related records
            await client.query('DELETE FROM payment_events WHERE application_id = $1', [app.id]);
            await client.query('DELETE FROM pdf_queue WHERE application_id = $1', [app.id]);
            await client.query('DELETE FROM pdf_generation_queue WHERE application_id = $1', [app.id]);
            await client.query('DELETE FROM failed_permits WHERE application_id = $1', [app.id]);
            await client.query('DELETE FROM email_reminders WHERE application_id = $1', [app.id]);
            await client.query('DELETE FROM payment_recovery_attempts WHERE application_id = $1', [app.id]);
            
            // Delete the application
            await client.query('DELETE FROM permit_applications WHERE id = $1', [app.id]);
            
            await client.query('COMMIT');
            
            progress.succeeded++;
            
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
          
        } catch (error) {
          logger.error(`Error cleaning up application ${app.id}:`, error);
          progress.failed++;
          progress.errors.push({
            applicationId: app.id,
            error: error.message
          });
        }
        
        progress.processed++;
        
        // Update progress every 10 items or at the end
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          await updateOperationProgress(operationId, progress);
        }
      }
      
      // Final update
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      await updateOperationProgress(operationId, progress);
      
      // Log audit action
      if (auditService) {
        await auditService.logAdminAction(
          adminId,
          'bulk_cleanup',
          'applications',
          null,
          {
            operationId,
            totalProcessed: progress.processed,
            succeeded: progress.succeeded,
            failed: progress.failed,
            daysOld,
            statuses
          },
          null
        );
      }
    });
    
    // Return immediate response
    return ApiResponse.success(res, {
      operationId,
      message: 'Limpieza iniciada',
      total: applications.length,
      trackingUrl: `/api/admin/bulk/status/${operationId}`
    });
    
  } catch (error) {
    logger.error('Error initiating bulk cleanup:', error);
    return ApiResponse.error(res, 'Error al iniciar limpieza masiva', 500);
  }
};

/**
 * Get operation status
 */
exports.getOperationStatus = async (req, res) => {
  try {
    const { operationId } = req.params;
    
    if (!operationId) {
      return ApiResponse.badRequest(res, 'ID de operación requerido');
    }
    
    const progress = await getOperationProgress(operationId);
    
    if (!progress) {
      return ApiResponse.notFound(res, 'Operación no encontrada');
    }
    
    // Calculate duration if completed
    let duration = null;
    if (progress.completedAt) {
      const start = new Date(progress.startedAt);
      const end = new Date(progress.completedAt);
      duration = (end - start) / 1000; // seconds
    }
    
    const response = {
      ...progress,
      duration,
      successRate: progress.total > 0 
        ? ((progress.succeeded / progress.total) * 100).toFixed(2) + '%'
        : '0%'
    };
    
    return ApiResponse.success(res, response);
    
  } catch (error) {
    logger.error('Error getting operation status:', error);
    return ApiResponse.error(res, 'Error al obtener estado de la operación', 500);
  }
};

/**
 * Helper function to get email subject based on reminder type
 */
function getEmailSubject(reminderType) {
  const subjects = {
    'payment_reminder': 'Recordatorio: Pago pendiente para su permiso',
    'permit_ready': '¡Su permiso está listo para descargar!',
    'expiration_reminder': 'Su permiso está próximo a vencer',
    'custom': 'Mensaje importante sobre su cuenta'
  };
  
  return subjects[reminderType] || 'Notificación de Permisos Digitales';
}
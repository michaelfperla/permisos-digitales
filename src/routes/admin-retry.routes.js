// src/routes/admin-retry.routes.js
// Admin routes for retrying failed permit generations

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { applicationRepository, paymentRepository } = require('../repositories');
const { ApplicationStatus } = require('../constants');
const { ApiResponse } = require('../utils/api-response');

/**
 * Retry permit generation for applications stuck in PAYMENT_RECEIVED status
 * POST /admin/retry/permit-generation
 */
router.post('/permit-generation', async (req, res) => {
  try {
    const { applicationId, applicationIds } = req.body;

    // Support both single and batch retry
    const idsToRetry = applicationId ? [applicationId] : (applicationIds || []);

    if (idsToRetry.length === 0) {
      return ApiResponse.badRequest(res, 'No application IDs provided');
    }

    if (idsToRetry.length > 50) {
      return ApiResponse.badRequest(res, 'Maximum 50 applications can be retried at once');
    }

    logger.info('[ADMIN-RETRY] Starting permit generation retry', {
      applicationIds: idsToRetry,
      requestedBy: req.user?.id || 'unknown',
      count: idsToRetry.length
    });

    const results = [];
    const errors = [];

    // Get PDF queue service
    const { getService } = require('../core/service-container-singleton');
    let pdfQueueService;
    try {
      pdfQueueService = getService('pdfQueue');
    } catch (error) {
      logger.error('[ADMIN-RETRY] Failed to get PDF queue service', { error: error.message });
      return ApiResponse.serverError(res, 'PDF queue service not available');
    }

    // Process each application
    for (const appId of idsToRetry) {
      try {
        const applicationId = parseInt(appId, 10);
        if (isNaN(applicationId)) {
          errors.push({ applicationId: appId, error: 'Invalid application ID' });
          continue;
        }

        // Get application details
        const application = await applicationRepository.findById(applicationId);
        if (!application) {
          errors.push({ applicationId, error: 'Application not found' });
          continue;
        }

        // Validate application status
        if (application.status !== ApplicationStatus.PAYMENT_RECEIVED) {
          errors.push({
            applicationId,
            error: `Invalid status: ${application.status}. Expected: ${ApplicationStatus.PAYMENT_RECEIVED}`
          });
          continue;
        }

        // Check if payment was actually received
        if (!application.payment_processor_order_id) {
          errors.push({
            applicationId,
            error: 'No payment processor order ID found'
          });
          continue;
        }

        // Reset queue status to allow retry
        await applicationRepository.update(applicationId, {
          queue_status: null,
          queue_error: null,
          puppeteer_error_message: null,
          queue_started_at: null,
          queue_completed_at: null,
          queue_duration_ms: null,
          queue_job_id: null
        });

        // Add to PDF queue
        const job = await pdfQueueService.addJob({
          applicationId,
          userId: application.user_id,
          priority: 0, // High priority for manual retries
          metadata: {
            paymentIntentId: application.payment_processor_order_id,
            source: 'admin_manual_retry',
            retryBy: req.user?.id || 'admin',
            retryAt: new Date().toISOString()
          }
        });

        // Update application status
        await applicationRepository.update(applicationId, {
          status: ApplicationStatus.GENERATING_PERMIT,
          queue_job_id: job.id,
          queue_status: 'queued',
          queue_entered_at: new Date()
        });

        // Create retry event
        await paymentRepository.createPaymentEvent(
          applicationId,
          'pdf_generation.manual_retry',
          {
            jobId: job.id,
            paymentIntentId: application.payment_processor_order_id,
            retryBy: req.user?.id || 'admin',
            retryAt: new Date().toISOString()
          },
          application.payment_processor_order_id
        );

        results.push({
          applicationId,
          jobId: job.id,
          status: 'queued',
          message: 'Successfully queued for retry'
        });

        logger.info('[ADMIN-RETRY] Application queued for retry', {
          applicationId,
          jobId: job.id,
          source: application.source,
          retryBy: req.user?.id || 'admin'
        });

      } catch (error) {
        logger.error('[ADMIN-RETRY] Error retrying application', {
          applicationId: appId,
          error: error.message,
          stack: error.stack
        });

        errors.push({
          applicationId: appId,
          error: error.message
        });
      }
    }

    const response = {
      successful: results,
      failed: errors,
      summary: {
        total: idsToRetry.length,
        successful: results.length,
        failed: errors.length
      }
    };

    logger.info('[ADMIN-RETRY] Permit generation retry completed', response.summary);

    return ApiResponse.success(res, response);

  } catch (error) {
    logger.error('[ADMIN-RETRY] Error in permit generation retry endpoint', {
      error: error.message,
      stack: error.stack
    });

    return ApiResponse.serverError(res, 'Internal server error during retry operation');
  }
});

/**
 * Get applications stuck in PAYMENT_RECEIVED status
 * GET /admin/retry/stuck-applications
 */
router.get('/stuck-applications', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const source = req.query.source; // Filter by source (whatsapp, web, etc.)

    let whereClause = `status = $1 AND payment_processor_order_id IS NOT NULL`;
    const queryParams = [ApplicationStatus.PAYMENT_RECEIVED];
    let paramCount = 1;

    if (source) {
      paramCount++;
      whereClause += ` AND source = $${paramCount}`;
      queryParams.push(source);
    }

    const query = `
      SELECT
        id,
        status,
        queue_status,
        queue_error,
        payment_processor_order_id,
        source,
        created_at,
        updated_at,
        user_id,
        nombre_completo,
        marca,
        linea
      FROM permit_applications
      WHERE ${whereClause}
      ORDER BY updated_at ASC
      LIMIT $${paramCount + 1}
      OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const { rows } = await require('../db').query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM permit_applications
      WHERE ${whereClause}
    `;

    const { rows: countRows } = await require('../db').query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countRows[0].total, 10);

    return ApiResponse.success(res, {
      applications: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    logger.error('[ADMIN-RETRY] Error getting stuck applications', {
      error: error.message,
      stack: error.stack
    });

    return ApiResponse.serverError(res, 'Error retrieving stuck applications');
  }
});

module.exports = router;
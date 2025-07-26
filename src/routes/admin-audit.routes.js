const express = require('express');
const router = express.Router();

module.exports = (container) => {
  const adminAuditController = container.get('adminAuditController');
  const authMiddleware = container.get('authMiddleware');
  const validationMiddleware = container.get('validationMiddleware');
  const { query, param } = require('express-validator');

  // Validation rules
  const auditLogValidation = [
    query('adminId').optional().isInt().withMessage('Admin ID must be an integer'),
    query('action').optional().isString().trim(),
    query('entityType').optional().isString().trim(),
    query('entityId').optional().isString().trim(),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('ipAddress').optional().isIP().withMessage('Invalid IP address'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ];

  const entityHistoryValidation = [
    param('entityType').notEmpty().isString().trim(),
    param('entityId').notEmpty().isString().trim()
  ];

  const adminActivityValidation = [
    param('adminId').isInt().withMessage('Admin ID must be an integer'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date')
  ];

  const securityEventValidation = [
    query('adminId').optional().isInt().withMessage('Admin ID must be an integer'),
    query('eventType').optional().isString().trim(),
    query('severity').optional().isIn(['info', 'warning', 'critical']),
    query('resolved').optional().isBoolean(),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ];

  // Apply auth middleware to all routes
  router.use(authMiddleware.requireAdminAuth.bind(authMiddleware));

  // Audit log routes
  router.get('/audit-logs',
    auditLogValidation,
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getAuditLogs.bind(adminAuditController)
  );

  router.get('/audit-logs/export',
    auditLogValidation,
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.exportAuditLogs.bind(adminAuditController)
  );

  router.get('/audit-logs/stats',
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getAuditStats.bind(adminAuditController)
  );

  router.get('/audit-logs/:entityType/:entityId',
    entityHistoryValidation,
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getEntityHistory.bind(adminAuditController)
  );

  // Admin activity routes
  router.get('/activity/:adminId',
    adminActivityValidation,
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getAdminActivity.bind(adminAuditController)
  );

  router.get('/my-activity',
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getMyActivity.bind(adminAuditController)
  );

  // Security event routes
  router.get('/security-events',
    securityEventValidation,
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.getSecurityEvents.bind(adminAuditController)
  );

  router.post('/security-events/:eventId/resolve',
    param('eventId').isInt().withMessage('Event ID must be an integer'),
    validationMiddleware.validate.bind(validationMiddleware),
    adminAuditController.resolveSecurityEvent.bind(adminAuditController)
  );

  return router;
};
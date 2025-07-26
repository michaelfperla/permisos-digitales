const express = require('express');
const router = express.Router();
const AdminAuditController = require('../controllers/admin-audit.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { query, param } = require('express-validator');
const validationMiddleware = require('../middleware/validation.middleware');

// Create a temporary instance of the audit controller
// This will be replaced when the service container is properly integrated into routes
const getServiceContainer = () => {
  try {
    const container = require('../core/service-container-singleton').getInstance();
    return container;
  } catch (error) {
    // Return a mock container for now
    return {
      get: (serviceName) => {
        if (serviceName === 'auditService') {
          const AuditService = require('../services/audit.service');
          return new AuditService({
            get: (name) => {
              if (name === 'database') return require('../db');
              if (name === 'redis') return require('../utils/redis-client');
              if (name === 'logger') return require('../utils/logger').logger;
              return null;
            }
          });
        }
        return null;
      }
    };
  }
};

const adminAuditController = new AdminAuditController(getServiceContainer());

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
router.use(isAuthenticated);
router.use(isAdminPortal);

// Audit log routes
router.get('/audit-logs',
  auditLogValidation,
  validationMiddleware.validate,
  adminAuditController.getAuditLogs.bind(adminAuditController)
);

router.get('/audit-logs/export',
  auditLogValidation,
  query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  validationMiddleware.validate,
  csrfProtection,
  adminAuditController.exportAuditLogs.bind(adminAuditController)
);

router.get('/audit-logs/stats',
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  validationMiddleware.validate,
  adminAuditController.getAuditStats.bind(adminAuditController)
);

router.get('/audit-logs/:entityType/:entityId',
  entityHistoryValidation,
  validationMiddleware.validate,
  adminAuditController.getEntityHistory.bind(adminAuditController)
);

// Admin activity routes
router.get('/activity/:adminId',
  adminActivityValidation,
  validationMiddleware.validate,
  adminAuditController.getAdminActivity.bind(adminAuditController)
);

router.get('/my-activity',
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  validationMiddleware.validate,
  adminAuditController.getMyActivity.bind(adminAuditController)
);

// Security event routes
router.get('/security-events',
  securityEventValidation,
  validationMiddleware.validate,
  adminAuditController.getSecurityEvents.bind(adminAuditController)
);

router.post('/security-events/:eventId/resolve',
  param('eventId').isInt().withMessage('Event ID must be an integer'),
  validationMiddleware.validate,
  csrfProtection,
  adminAuditController.resolveSecurityEvent.bind(adminAuditController)
);

module.exports = router;
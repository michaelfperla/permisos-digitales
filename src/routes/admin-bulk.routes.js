// src/routes/admin-bulk.routes.js
const express = require('express');
const adminBulkController = require('../controllers/admin-bulk.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation rules
const bulkApplicationIdsValidation = [
  body('applicationIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Se requiere un array de IDs entre 1 y 100 elementos'),
  body('applicationIds.*')
    .isInt({ min: 1 })
    .withMessage('Cada ID debe ser un número entero positivo')
];

const bulkUserIdsValidation = [
  body('userIds')
    .isArray({ min: 1, max: 500 })
    .withMessage('Se requiere un array de IDs entre 1 y 500 elementos'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('Cada ID debe ser un número entero positivo')
];

const bulkStatusUpdateValidation = [
  ...bulkApplicationIdsValidation,
  body('status')
    .isString()
    .notEmpty()
    .withMessage('Estado es requerido'),
  body('reason')
    .optional()
    .isString()
    .withMessage('La razón debe ser texto'),
  body('notify')
    .optional()
    .isBoolean()
    .withMessage('Notify debe ser booleano')
];

const bulkReminderValidation = [
  ...bulkApplicationIdsValidation,
  body('reminderType')
    .optional()
    .isIn(['payment_reminder', 'permit_ready', 'expiration_reminder', 'custom'])
    .withMessage('Tipo de recordatorio inválido')
];

const bulkEmailValidation = [
  ...bulkUserIdsValidation,
  body('subject')
    .isString()
    .notEmpty()
    .isLength({ min: 1, max: 200 })
    .withMessage('Asunto es requerido (máximo 200 caracteres)'),
  body('message')
    .isString()
    .notEmpty()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Mensaje es requerido (máximo 5000 caracteres)'),
  body('template')
    .optional()
    .isString()
    .withMessage('Template debe ser texto')
];

const bulkCleanupValidation = [
  body('daysOld')
    .optional()
    .isInt({ min: 30 })
    .withMessage('Los días deben ser al menos 30'),
  body('statuses')
    .optional()
    .isArray()
    .withMessage('Statuses debe ser un array'),
  body('statuses.*')
    .isIn(['EXPIRED', 'PAYMENT_EXPIRED', 'CANCELLED', 'PAYMENT_FAILED'])
    .withMessage('Estado inválido'),
  body('dryRun')
    .optional()
    .isBoolean()
    .withMessage('dryRun debe ser booleano')
];

// Custom validation middleware
const validateBulkRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  next();
};

// All routes require authentication and admin portal access
router.use(isAuthenticated);
router.use(isAdminPortal);
router.use(csrfProtection);

// Bulk application operations
router.post(
  '/applications/status',
  bulkStatusUpdateValidation,
  validateBulkRequest,
  adminBulkController.bulkUpdateApplicationStatus
);

router.post(
  '/applications/regenerate-pdf',
  bulkApplicationIdsValidation,
  validateBulkRequest,
  adminBulkController.bulkRegeneratePDFs
);

router.post(
  '/applications/send-reminder',
  bulkReminderValidation,
  validateBulkRequest,
  adminBulkController.bulkSendReminders
);

router.delete(
  '/applications/cleanup',
  bulkCleanupValidation,
  validateBulkRequest,
  adminBulkController.bulkCleanupApplications
);

// Bulk user operations
router.post(
  '/users/export',
  bulkUserIdsValidation,
  validateBulkRequest,
  adminBulkController.bulkExportUsers
);

router.post(
  '/users/email',
  bulkEmailValidation,
  validateBulkRequest,
  adminBulkController.bulkEmailUsers
);

// Get operation status
router.get('/status/:operationId', adminBulkController.getOperationStatus);

module.exports = router;
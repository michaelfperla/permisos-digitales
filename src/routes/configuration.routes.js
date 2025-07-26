const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');
const configurationController = require('../controllers/configuration.controller');

// All configuration routes require admin authentication
router.use(isAuthenticated);
router.use(isAdminPortal);

/**
 * Get configuration schema for UI
 */
router.get(
  '/schema',
  configurationController.getSchema
);

/**
 * Get default values
 */
router.get(
  '/defaults',
  configurationController.getDefaults
);

/**
 * Export all configurations
 */
router.get(
  '/export',
  configurationController.export
);

/**
 * Get all configurations
 */
router.get(
  '/',
  [
    query('category')
      .optional()
      .isIn(['general', 'email', 'payment', 'security', 'features', 'limits'])
      .withMessage('Invalid category')
  ],
  validateRequest,
  configurationController.getAll
);

/**
 * Clear configuration cache
 */
router.post(
  '/cache/clear',
  configurationController.clearCache
);

/**
 * Import configurations
 */
router.post(
  '/import',
  [
    body('configurations')
      .exists()
      .withMessage('Configurations object is required')
      .isObject()
      .withMessage('Configurations must be an object'),
    body('version')
      .optional()
      .isString()
      .withMessage('Version must be a string')
  ],
  validateRequest,
  configurationController.import
);

/**
 * Bulk update configurations
 */
router.post(
  '/bulk',
  [
    body('updates')
      .isArray({ min: 1 })
      .withMessage('Updates must be a non-empty array'),
    body('updates.*.key')
      .exists()
      .withMessage('Key is required for each update')
      .isString()
      .withMessage('Key must be a string'),
    body('updates.*.value')
      .exists()
      .withMessage('Value is required for each update'),
    body('updates.*.reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
  ],
  validateRequest,
  configurationController.bulkUpdate
);

/**
 * Get specific configuration
 */
router.get(
  '/:key',
  [
    param('key')
      .isString()
      .withMessage('Key must be a string')
      .matches(/^[a-z_]+$/)
      .withMessage('Key must contain only lowercase letters and underscores')
  ],
  validateRequest,
  configurationController.getByKey
);

/**
 * Update configuration
 */
router.put(
  '/:key',
  [
    param('key')
      .isString()
      .withMessage('Key must be a string')
      .matches(/^[a-z_]+$/)
      .withMessage('Key must contain only lowercase letters and underscores'),
    body('value')
      .exists()
      .withMessage('Value is required'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
  ],
  validateRequest,
  configurationController.update
);

/**
 * Reset configuration to default
 */
router.post(
  '/:key/reset',
  [
    param('key')
      .isString()
      .withMessage('Key must be a string')
      .matches(/^[a-z_]+$/)
      .withMessage('Key must contain only lowercase letters and underscores')
  ],
  validateRequest,
  configurationController.resetToDefault
);

/**
 * Get configuration audit history
 */
router.get(
  '/:key/history',
  [
    param('key')
      .isString()
      .withMessage('Key must be a string')
      .matches(/^[a-z_]+$/)
      .withMessage('Key must contain only lowercase letters and underscores'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  configurationController.getHistory
);

module.exports = router;
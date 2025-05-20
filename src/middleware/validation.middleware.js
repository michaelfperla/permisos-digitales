// src/middleware/validation.middleware.js
const { validationResult } = require('express-validator');
const { logger } = require('../utils/enhanced-logger');

/**
 * Middleware to handle validation errors from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.debug(`Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      message: 'Los datos no son válidos',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Middleware to validate application ID parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateApplicationId = (req, res, next) => {
  const { applicationId } = req.params;

  if (!applicationId || isNaN(parseInt(applicationId, 10))) {
    logger.debug(`Invalid application ID: ${applicationId}`);
    return res.status(400).json({
      message: 'Número de solicitud inválido',
      errors: [{ param: 'applicationId', msg: 'El número de solicitud debe ser válido' }]
    });
  }

  next();
};

module.exports = {
  handleValidationErrors,
  validateApplicationId
};

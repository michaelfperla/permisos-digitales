const { validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

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

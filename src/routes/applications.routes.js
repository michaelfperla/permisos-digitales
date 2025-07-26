const express = require('express');
const applicationController = require('../controllers/application.controller');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { body, validationResult, param } = require('express-validator');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const applicationValidationRules = [
  body('nombre_completo').trim().notEmpty().withMessage('Falta el nombre completo.').isLength({ max: 255 }).withMessage('El nombre completo no debe pasar de 255 caracteres.').escape(),
  body('curp_rfc').trim().notEmpty().withMessage('Falta el CURP/RFC.').isLength({ min: 10, max: 50 }).withMessage('El CURP/RFC debe tener entre 10 y 50 caracteres.').matches(/^[A-Z0-9]+$/i).withMessage('El CURP/RFC solo debe tener letras y números.').escape(),
  body('domicilio').trim().notEmpty().withMessage('Falta la dirección.').escape(),
  body('marca').trim().notEmpty().withMessage('Falta la marca.').isLength({ max: 100 }).withMessage('La marca no debe pasar de 100 caracteres.').escape(),
  body('linea').trim().notEmpty().withMessage('Falta el modelo.').isLength({ max: 100 }).withMessage('El modelo no debe pasar de 100 caracteres.').escape(),
  body('color').trim().notEmpty().withMessage('Falta el color.').isLength({ max: 100 }).withMessage('El color no debe pasar de 100 caracteres.').escape(),
  body('numero_serie').trim().notEmpty().withMessage('Falta el número de serie.').isLength({ min: 5, max: 50 }).withMessage('El número de serie debe tener entre 5 y 50 caracteres.').matches(/^[A-Z0-9]+$/i).withMessage('El número de serie solo debe tener letras y números.').escape(),
  body('numero_motor').trim().notEmpty().withMessage('Falta el número de motor.').isLength({ max: 50 }).withMessage('El número de motor no debe pasar de 50 caracteres.').escape(),
  body('ano_modelo').notEmpty().withMessage('Falta el año.')
    .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
    .withMessage(`El año debe ser válido entre 1900 y ${new Date().getFullYear() + 2}.`)
    .toInt()
];

const idParamValidation = [
  param('id').isInt({ gt: 0 }).withMessage('El ID del permiso debe ser un número positivo.')
];
const typeParamValidation = [
  param('type').isIn(['permiso', 'certificado', 'placas', 'recomendaciones']).withMessage('Tipo de documento no válido.')
];

router.get('/test', (req, res) => {
  res.status(200).json({ message: 'Accessed protected application route!', userId: req.session.userId });
});

router.get('/', applicationController.getUserApplications);

router.get('/pending-payment', applicationController.getPendingApplications);

router.post(
  '/',
  csrfProtection,
  applicationValidationRules,
  handleValidationErrors,
  applicationController.createApplication
);

router.get(
  '/:id/status',
  idParamValidation,
  handleValidationErrors,
  applicationController.getApplicationStatus
);

router.put('/:id',
  csrfProtection,
  idParamValidation,
  applicationValidationRules.map(rule => rule.optional()),
  handleValidationErrors,
  applicationController.updateApplication
);

router.get(
  '/:id/download/:type',
  idParamValidation,
  typeParamValidation,
  handleValidationErrors,
  applicationController.downloadPermit
);

router.get(
  '/:id/pdf-url/:type',
  idParamValidation,
  typeParamValidation,
  handleValidationErrors,
  applicationController.getPdfUrl
);

router.get(
  '/:id/renewal-eligibility',
  idParamValidation,
  handleValidationErrors,
  applicationController.checkRenewalEligibility
);

router.post(
  '/:id/renew',
  csrfProtection,
  idParamValidation,
  handleValidationErrors,
  applicationController.renewApplication
);

router.post(
  '/:id/payment-proof',
  (req, res) => {
    res.status(410).json({
      success: false,
      message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
    });
  }
);

module.exports = router;
module.exports.applicationValidationRules = applicationValidationRules;
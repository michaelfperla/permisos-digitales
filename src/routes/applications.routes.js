// src/routes/applications.routes.js
const express = require('express');
const applicationController = require('../controllers/application.controller');
// Upload functionality removed since app no longer needs document uploads
const { csrfProtection } = require('../middleware/csrf.middleware');
const rateLimiters = require('../middleware/rate-limit.middleware');
// Assuming auth middleware is applied *before* this router is mounted in index.js
// const { isAuthenticated, isClient } = require('../middleware/auth.middleware');

const { body, validationResult, param } = require('express-validator'); // Import param for ID validation

const router = express.Router();

// --- Middleware to handle validation results ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// --- Define Validation Rules for New Application ---
const applicationValidationRules = [
  // Solicitante
  body('nombre_completo').trim().notEmpty().withMessage('Falta el nombre completo.').isLength({ max: 255 }).withMessage('El nombre completo no debe pasar de 255 caracteres.').escape(),
  body('curp_rfc').trim().notEmpty().withMessage('Falta el CURP/RFC.').isLength({ min: 10, max: 50 }).withMessage('El CURP/RFC debe tener entre 10 y 50 caracteres.').matches(/^[A-Z0-9]+$/i).withMessage('El CURP/RFC solo debe tener letras y números.').escape(),
  body('domicilio').trim().notEmpty().withMessage('Falta la dirección.').escape(),
  // Vehiculo
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

// --- Define Validation Rules for URL Parameters ---
const idParamValidation = [
  param('id').isInt({ gt: 0 }).withMessage('El ID del permiso debe ser un número positivo.')
];
const typeParamValidation = [
  param('type').isIn(['permiso', 'recibo', 'certificado', 'placas']).withMessage('Tipo de documento no válido.')
];


// === APPLICATION ROUTES ===

// GET /api/applications/test (Keep if needed for testing auth)
router.get('/test', (req, res) => {
  res.status(200).json({ message: 'Accessed protected application route!', userId: req.session.userId });
});

// GET /api/applications - Get all applications for the logged-in user
// Auth middleware (isAuthenticated, isClient) applied in src/routes/index.js
router.get('/', applicationController.getUserApplications);


// POST /api/applications - Create a new permit application
router.post(
  '/',
  csrfProtection,
  applicationValidationRules,
  handleValidationErrors,
  applicationController.createApplication
);


// --- CORRECTED STATUS ROUTE ---
// GET /api/applications/:id/status - Get detailed application status
// Auth applied in src/routes/index.js
router.get(
  '/:id/status', // Added /status
  idParamValidation, // Validate the ID parameter
  handleValidationErrors, // Handle validation errors
  applicationController.getApplicationStatus
);

// PUT /api/applications/:id - Update application data before payment
// Auth applied in src/routes/index.js
router.put('/:id',
  csrfProtection,
  idParamValidation, // Validate ID
  applicationValidationRules.map(rule => rule.optional()), // Optional validation for updates
  handleValidationErrors,
  applicationController.updateApplication
);

// --- CORRECTED DOWNLOAD ROUTE ---
// GET /api/applications/:id/download/:type - Download a specific permit document
// Auth applied in src/routes/index.js
router.get(
  '/:id/download/:type', // Added /:type parameter
  idParamValidation,     // Validate ID
  typeParamValidation,   // Validate Type
  handleValidationErrors,
  applicationController.downloadPermit
);

// GET /api/applications/:id/pdf-url/:type - Get secure URL for PDF access
// Auth applied in src/routes/index.js
router.get(
  '/:id/pdf-url/:type',
  idParamValidation,     // Validate ID
  typeParamValidation,   // Validate Type
  handleValidationErrors,
  applicationController.getPdfUrl
);

// GET /api/applications/:id/renewal-eligibility - Check if a permit is eligible for renewal
// Auth applied in src/routes/index.js
router.get(
  '/:id/renewal-eligibility',
  idParamValidation, // Validate ID
  handleValidationErrors,
  applicationController.checkRenewalEligibility
);

// POST /api/applications/:id/renew - Create a renewal application
// Auth applied in src/routes/index.js
router.post(
  '/:id/renew',
  csrfProtection,
  idParamValidation, // Validate ID
  handleValidationErrors,
  applicationController.renewApplication
);

// [Refactor - Remove Manual Payment] Route for manual payment proof upload. Obsolete.

// Temporary route handler for payment proof upload - returns 410 Gone status
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

// Export validation rules for testing
module.exports.applicationValidationRules = applicationValidationRules;
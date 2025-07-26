// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { body, validationResult } = require('express-validator');
const rateLimiters = require('../middleware/rate-limit.middleware');

// --- Middleware to handle validation results ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// --- Define Validation Rules for Profile Update ---
const profileUpdateValidationRules = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('El nombre debe tener entre 1 y 100 caracteres.')
    .escape(),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('El apellido debe tener entre 1 y 100 caracteres.')
    .escape(),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe ser una dirección de correo electrónico válida.')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('El correo electrónico no puede exceder 255 caracteres.')
];

// GET /user/profile - Get user profile
router.get('/profile', userController.getProfile);

// PUT /user/profile - Update user profile
router.put(
  '/profile',
  csrfProtection,
  profileUpdateValidationRules,
  handleValidationErrors,
  userController.updateProfile
);

// --- Define Validation Rules for Account Deletion ---
const accountDeletionValidationRules = [
  body('confirmEmail')
    .notEmpty().withMessage('El correo de confirmación es requerido')
    .isEmail().withMessage('Debe ser un correo válido')
    .normalizeEmail(),
  body('deleteReason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('La razón no puede exceder 500 caracteres')
    .escape()
];

// DELETE /user/account - Delete user account
router.delete(
  '/account',
  rateLimiters.accountDeletion,
  csrfProtection,
  accountDeletionValidationRules,
  handleValidationErrors,
  userController.deleteAccount
);

// GET /user/data-export - Export user data
router.get('/data-export', rateLimiters.dataExport, userController.requestDataExport);

// --- Define Validation Rules for WhatsApp Toggle ---
const whatsappToggleValidationRules = [
  body('enabled')
    .isBoolean().withMessage('El campo enabled debe ser booleano'),
  body('whatsappPhone')
    .if(body('enabled').equals('true'))
    .notEmpty().withMessage('El número de WhatsApp es requerido')
    .matches(/^52\d{10}$/).withMessage('Formato inválido. Use: 52XXXXXXXXXX')
];

// PUT /user/whatsapp-notifications - Toggle WhatsApp notifications
router.put(
  '/whatsapp-notifications',
  rateLimiters.whatsappToggle,
  csrfProtection,
  whatsappToggleValidationRules,
  handleValidationErrors,
  userController.toggleWhatsAppNotifications
);

module.exports = router;

// src/routes/password-reset.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passwordResetController = require('../controllers/password-reset.controller');
const { handleValidationErrors } = require('../middleware/validation.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');

// --- Define Validation Rules for Password Reset Request ---
const requestResetValidationRules = [
  // email: must be an email, normalize it
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail()
];

// --- Define Validation Rules for Password Reset ---
const resetPasswordValidationRules = [
  // token: must not be empty
  body('token')
    .notEmpty().withMessage('Este link no es válido.'),

  // password: must be at least 8 characters long
  body('password')
    .isLength({ min: 8 }).withMessage('Tu contraseña debe tener mínimo 8 caracteres.')
];

// POST /api/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  csrfProtection,
  requestResetValidationRules,
  handleValidationErrors,
  passwordResetController.requestReset
);

// GET /api/auth/reset-password/:token - Validate reset token
router.get(
  '/reset-password/:token',
  passwordResetController.validateResetToken
);

// POST /api/auth/reset-password - Reset password with token
router.post(
  '/reset-password',
  csrfProtection,
  resetPasswordValidationRules,
  handleValidationErrors,
  passwordResetController.resetPassword
);

module.exports = router;

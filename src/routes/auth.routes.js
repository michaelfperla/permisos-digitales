const express = require('express');
const authController = require('../controllers/auth.controller');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidationRules = [
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres.'),

  body('first_name')
    .notEmpty().withMessage('Falta tu nombre.')
    .trim()
    .escape(),

  body('last_name')
    .notEmpty().withMessage('Falta tu apellido.')
    .trim()
    .escape(),
    
  body('whatsapp_phone')
    .notEmpty().withMessage('Falta tu número de WhatsApp.')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Ingresa un número de teléfono válido.')
    .trim()
];

router.post(
  '/register',
  csrfProtection,
  registerValidationRules,
  handleValidationErrors,
  authController.register
);

const loginValidationRules = [
  body('email')
    .custom((value) => {
      // Accept either email or phone number
      const isEmail = value.includes('@');
      const isPhone = /^[0-9+\-\s()]+$/.test(value);
      
      if (!isEmail && !isPhone) {
        throw new Error('Escribe un correo válido o número de teléfono.');
      }
      
      if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Escribe un correo válido.');
      }
      
      if (isPhone && value.replace(/\D/g, '').length < 10) {
        throw new Error('El número de teléfono debe tener al menos 10 dígitos.');
      }
      
      return true;
    })
    .trim(),

  body('password')
    .notEmpty().withMessage('Falta tu contraseña.')
];

router.post(
  '/login',
  csrfProtection,
  loginValidationRules,
  handleValidationErrors,
  authController.login
);

router.post('/logout', csrfProtection, authController.logout);

router.get('/status', authController.status);
router.get('/check', authController.status);

router.get('/csrf-token', csrfProtection, (req, res) => {
  const ApiResponse = require('../utils/api-response');
  ApiResponse.success(res, { csrfToken: req.csrfToken() });
});

const changePasswordValidationRules = [
  body('currentPassword')
    .notEmpty().withMessage('Falta tu contraseña actual.'),

  body('newPassword')
    .isLength({ min: 8 }).withMessage('Tu nueva contraseña debe tener mínimo 8 caracteres.')
];

router.post(
  '/change-password',
  csrfProtection,
  changePasswordValidationRules,
  handleValidationErrors,
  authController.changePassword
);

const resendVerificationEmailValidationRules = [
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail()
];

router.get('/verify-email/:token', authController.verifyEmail);

router.post(
  '/resend-verification',
  csrfProtection,
  resendVerificationEmailValidationRules,
  handleValidationErrors,
  authController.resendVerificationEmail
);

module.exports = router;

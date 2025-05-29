// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { body, validationResult } = require('express-validator');

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

// GET /api/user/profile - Get user profile
router.get('/profile', userController.getProfile);

// PUT /api/user/profile - Update user profile
router.put(
  '/profile',
  csrfProtection,
  profileUpdateValidationRules,
  handleValidationErrors,
  userController.updateProfile
);

module.exports = router;

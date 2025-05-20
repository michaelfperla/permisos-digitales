// src/routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const { csrfProtection } = require('../middleware/csrf.middleware');

const { body, validationResult } = require('express-validator');

const router = express.Router();


// --- Middleware to handle validation results ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // If there are errors, return a 400 response with the error messages
    return res.status(400).json({ errors: errors.array() });
  }
  // If no errors, proceed to the next middleware/controller
  next();
};

// --- Define Validation Rules for Registration ---
const registerValidationRules = [
  // email: must be an email, normalize it (lowercase)
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail(), // Converts to lowercase, removes dots etc. depending on options

  // password: must be at least 8 characters long
  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres.'),
  // Add more rules later? (e.g., require uppercase, number, symbol)
  // .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
  // .withMessage('Password must contain uppercase, lowercase, number, and special character.'),

  // first_name: required, trim whitespace, escape potentially harmful HTML chars
  body('first_name')
    .notEmpty().withMessage('Falta tu nombre.')
    .trim()                         // Remove leading/trailing whitespace
    .escape(),                      // Convert <, >, &, ', " to HTML entities

  // last_name: required, trim whitespace, escape
  body('last_name')
    .notEmpty().withMessage('Falta tu apellido.')
    .trim()
    .escape()
];

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: User registration
 *     description: Registers a new user and creates a session
 *     tags: [Authentication]
 *     security:
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully!
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                       param:
 *                         type: string
 *                       location:
 *                         type: string
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User with this email already exists.
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Chain: Run validation rules -> Handle errors -> Run controller if no errors
router.post(
  '/register',
  csrfProtection,         // Apply CSRF protection
  registerValidationRules, // Apply the validation rules array
  handleValidationErrors,  // Handle any errors found by the rules
  authController.register  // Proceed to controller only if validation passes
);

// --- ADD Validation Rules for Login ---
const loginValidationRules = [
  // email: must be an email, normalize
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail(),

  // password: cannot be empty
  body('password')
    .notEmpty().withMessage('Falta tu contraseña.')
  // Note: We don't check length here, as the backend bcrypt compare handles incorrect passwords.
  // We just need to ensure *something* was submitted.
];

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticates a user and creates a session
 *     tags: [Authentication]
 *     security:
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/auth/login
router.post(
  '/login',
  csrfProtection,         // Apply CSRF protection
  loginValidationRules,    // Add login rules
  handleValidationErrors,  // Add error handler
  authController.login     // Keep controller last
);
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     description: Destroys the user session
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *       - csrfToken: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout successful.
 */
// POST /api/auth/logout
router.post('/logout', csrfProtection, authController.logout);

/**
 * @swagger
 * /auth/status:
 *   get:
 *     summary: Check authentication status
 *     description: Returns the current user's authentication status and details
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isLoggedIn:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     accountType:
 *                       type: string
 *                     isAdminPortal:
 *                       type: boolean
 *                     accessDetails:
 *                       type: object
 *                       properties:
 *                         isAdmin:
 *                           type: boolean
 *                         hasAdminPortalAccess:
 *                           type: boolean
 *                         sessionId:
 *                           type: string
 */
// GET /api/auth/status
router.get('/status', authController.status);

/**
 * @swagger
 * /auth/check:
 *   get:
 *     summary: Check authentication status (alias)
 *     description: Alias for /auth/status endpoint
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isLoggedIn:
 *                   type: boolean
 *                 user:
 *                   type: object
 */
// GET /api/auth/check - Alias for status endpoint for new frontend
router.get('/check', authController.status);

/**
 * @swagger
 * /auth/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     description: Returns a CSRF token for form submissions
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: CSRF token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csrfToken:
 *                   type: string
 */
// GET /api/auth/csrf-token - Endpoint to get a CSRF token
router.get('/csrf-token', csrfProtection, (req, res) => {
  const ApiResponse = require('../utils/api-response');
  ApiResponse.success(res, { csrfToken: req.csrfToken() });
});

// --- Define Validation Rules for Change Password ---
const changePasswordValidationRules = [
  // currentPassword: must not be empty
  body('currentPassword')
    .notEmpty().withMessage('Falta tu contraseña actual.'),

  // newPassword: must be at least 8 characters long
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Tu nueva contraseña debe tener mínimo 8 caracteres.')
    // Add more rules later? (e.g., require uppercase, number, symbol)
    // .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    // .withMessage('Password must contain uppercase, lowercase, number, and special character.')
];

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     description: Changes the password for the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully.
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized or incorrect current password
 */
// POST /api/auth/change-password - Change user password (requires authentication)
router.post(
  '/change-password',
  csrfProtection,
  changePasswordValidationRules,
  handleValidationErrors,
  authController.changePassword
);

// --- Define Validation Rules for Resend Verification Email ---
const resendVerificationEmailValidationRules = [
  // email: must be an email, normalize it
  body('email')
    .isEmail().withMessage('Escribe un correo válido.')
    .normalizeEmail()
];

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address
 *     description: Verifies a user's email address using the token sent to their email
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
// GET /api/auth/verify-email/:token - Verify email address
router.get('/verify-email/:token', authController.verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     description: Resends the verification email to the user
 *     tags: [Authentication]
 *     security:
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Invalid email
 *       429:
 *         description: Too many requests
 */
// POST /api/auth/resend-verification - Resend verification email
router.post(
  '/resend-verification',
  csrfProtection,
  resendVerificationEmailValidationRules,
  handleValidationErrors,
  authController.resendVerificationEmail
);

module.exports = router;

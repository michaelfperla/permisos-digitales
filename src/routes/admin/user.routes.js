/**
 * Admin User Routes
 * Handles admin user management routes
 */
const express = require('express');
const userController = require('../../controllers/admin/user.controller');
const { isAuthenticated, isAdminPortal } = require('../../middleware/auth.middleware');
const { csrfProtection } = require('../../middleware/csrf.middleware');

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(isAuthenticated, isAdminPortal);

// Get users with pagination and filtering
router.get('/', userController.getUsers);

// Get user details by ID
router.get('/:id', userController.getUserById);

// Get applications for a specific user
router.get('/:userId/applications', userController.getUserApplications);

// Enable a user account
router.patch('/:id/enable', csrfProtection, userController.enableUser);

// Disable a user account
router.patch('/:id/disable', csrfProtection, userController.disableUser);

module.exports = router;

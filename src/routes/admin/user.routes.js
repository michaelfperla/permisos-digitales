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

// Get all users with advanced filtering and sorting
router.get('/all', userController.getAllUsers);

// Get users with pagination and filtering (legacy)
router.get('/', userController.getUsers);

// Get complete user details including history
router.get('/:id/details', userController.getUserDetails);

// Get user details by ID (legacy)
router.get('/:id', userController.getUserById);

// Get applications for a specific user
router.get('/:userId/applications', userController.getUserApplications);

// Update user information
router.put('/:id', csrfProtection, userController.updateUser);

// Reset user password
router.post('/:id/reset-password', csrfProtection, userController.resetUserPassword);

// Delete user (soft delete with data retention)
router.delete('/:id', csrfProtection, userController.deleteUser);

// Enable a user account
router.patch('/:id/enable', csrfProtection, userController.enableUser);

// Disable a user account
router.patch('/:id/disable', csrfProtection, userController.disableUser);

module.exports = router;

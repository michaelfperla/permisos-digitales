// src/controllers/user.controller.js
const userService = require('../services/user.service');
const { logger } = require('../utils/enhanced-logger');
const { handleControllerError, createError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');

/**
 * Get user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getProfile = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return ApiResponse.unauthorized(res, 'User not authenticated.');
  }

  try {
    logger.info(`Fetching profile for user ID: ${userId}`);

    const user = await userService.getUserProfile(userId);

    if (!user) {
      return ApiResponse.notFound(res, 'User profile not found.');
    }

    // Return user profile data without sensitive information
    return ApiResponse.success(res, {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        account_type: user.account_type,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    handleControllerError(error, 'getProfile', req, res, next);
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.updateProfile = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return ApiResponse.unauthorized(res, 'User not authenticated.');
  }

  try {
    logger.info(`Updating profile for user ID: ${userId}`);

    const { first_name, last_name, email } = req.body;

    // Create update data object with only provided fields
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return ApiResponse.badRequest(res, 'No valid fields provided for update.');
    }

    // If email is being updated, check if it's already in use
    if (email) {
      const emailExists = await userService.checkEmailExists(email, userId);
      if (emailExists) {
        return ApiResponse.conflict(res, 'Email is already in use by another account.');
      }
    }

    const updatedUser = await userService.updateUserProfile(userId, updateData);

    if (!updatedUser) {
      return ApiResponse.notFound(res, 'User profile not found.');
    }

    // Update session data to match the database
    if (updatedUser.first_name) req.session.userName = updatedUser.first_name;
    if (updatedUser.last_name) req.session.userLastName = updatedUser.last_name;
    // IMPORTANT: Only update email in session if it was actually changed and validated
    // if (updatedUser.email && email) req.session.userEmail = updatedUser.email; // Be careful if email shouldn't change
    req.session.accountType = updatedUser.account_type || req.session.accountType; // Ensure accountType persists

    console.log(`[userController.updateProfile] DEBUG: Session updated. New name: ${req.session.userName} ${req.session.userLastName}`);

    try {
      await new Promise((resolve, reject) => {
        req.session.save(err => {
          if (err) {
            logger.error(`[userController.updateProfile] Error saving session: ${err}`);
            // Decide how to handle - maybe reject or allow response anyway?
            // For now, let's log and continue to send success, as DB was updated.
            resolve(); // Resolve even on save error for this test
          } else {
            console.log(`[userController.updateProfile] DEBUG: Session explicitly saved. Session ID: ${req.session.id}`);
            resolve();
          }
        });
      });
    } catch (saveError) {
      // Catch potential errors from the Promise wrapper itself
      logger.error(`[userController.updateProfile] Exception during session save promise: ${saveError}`);
    }

    // Log before sending the response
    console.log(`[userController.updateProfile] DEBUG: About to send success response for user ${userId}. Session ID: ${req.session.id}`);

    // Return success response
    const result = ApiResponse.success(res,
      null,
      200,
      'Perfil actualizado exitosamente.'
    );

    // This might not execute if res.json() ends the request cycle
    console.log(`[userController.updateProfile] DEBUG: Success response sent for user ${userId}. Session still exists? ID: ${req.session?.id}`);

    return result;
  } catch (error) {
    handleControllerError(error, 'updateProfile', req, res, next, {
      errorMappings: {
        '23505': {
          status: 409,
          message: 'El correo electrónico ya está en uso por otra cuenta.'
        }
      }
    });
  }
};

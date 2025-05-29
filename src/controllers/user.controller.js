const userService = require('../services/user.service');
const { logger } = require('../utils/enhanced-logger');
const { handleControllerError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');

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

exports.updateProfile = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return ApiResponse.unauthorized(res, 'User not authenticated.');
  }

  try {
    logger.info(`Updating profile for user ID: ${userId}`);

    const { first_name, last_name, email } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return ApiResponse.badRequest(res, 'No valid fields provided for update.');
    }

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

    // Update session data
    if (updatedUser.first_name) req.session.userName = updatedUser.first_name;
    if (updatedUser.last_name) req.session.userLastName = updatedUser.last_name;
    req.session.accountType = updatedUser.account_type || req.session.accountType;

    try {
      await new Promise((resolve, _reject) => {
        req.session.save(err => {
          if (err) {
            logger.error(`[userController.updateProfile] Error saving session: ${err}`);
            resolve();
          } else {
            logger.debug(`Session explicitly saved. Session ID: ${req.session.id}`);
            resolve();
          }
        });
      });
    } catch (saveError) {
      logger.error(`[userController.updateProfile] Exception during session save promise: ${saveError}`);
    }

    return ApiResponse.success(res,
      null,
      200,
      'Perfil actualizado exitosamente.'
    );
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

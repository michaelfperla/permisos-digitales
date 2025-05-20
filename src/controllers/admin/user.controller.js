/**
 * Admin User Controller
 * Handles admin user management operations
 */
const { userRepository, applicationRepository } = require('../../repositories');
const ApiResponse = require('../../utils/api-response');
const { logger } = require('../../utils/enhanced-logger');

/**
 * Get users with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUsers = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const { page = 1, limit = 10, role, search } = req.query;

    logger.info(`Admin ${adminId} requested users list with filters: ${JSON.stringify({ page, limit, role, search })}`);

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return ApiResponse.badRequest(res, 'Invalid page parameter');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return ApiResponse.badRequest(res, 'Invalid limit parameter (must be between 1 and 100)');
    }

    // Get users with pagination and filtering
    const result = await userRepository.findUsersWithPagination(
      { role, search },
      { page: pageNum, limit: limitNum }
    );

    // Return paginated users
    return ApiResponse.success(res, {
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    return next(error);
  }
};

/**
 * Get user details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserById = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'Invalid user ID');
    }

    logger.info(`Admin ${adminId} requested details for user ${userId}`);

    // Get user details
    const user = await userRepository.getUserDetails(userId);

    if (!user) {
      logger.warn(`Admin ${req.session.userId} requested non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Return user details
    return ApiResponse.success(res, { user });
  } catch (error) {
    logger.error(`Error getting user details for ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Get applications for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserApplications = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'Invalid user ID');
    }

    logger.info(`Admin ${adminId} requested applications for user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} requested applications for non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Get applications for the user
    const applications = await applicationRepository.findByUserId(userId);

    // Return applications
    return ApiResponse.success(res, { applications });
  } catch (error) {
    logger.error(`Error getting applications for user ID ${req.params.userId}:`, error);
    return next(error);
  }
};

/**
 * Enable a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.enableUser = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'Invalid user ID');
    }

    logger.info(`Admin ${adminId} is enabling user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} attempted to enable non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Update user status
    const updated = await userRepository.setUserStatus(userId, true);
    if (!updated) {
      logger.error(`Failed to enable user ID: ${userId}`);
      return ApiResponse.serverError(res, 'Failed to enable user account');
    }

    logger.info(`Admin ${adminId} successfully enabled user ${userId}`);
    return ApiResponse.success(res, null, 200, 'User account enabled successfully');
  } catch (error) {
    logger.error(`Error enabling user ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Disable a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.disableUser = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'Invalid user ID');
    }

    // Prevent admins from disabling their own account
    if (userId === adminId) {
      logger.warn(`Admin ${adminId} attempted to disable their own account`);
      return ApiResponse.badRequest(res, 'You cannot disable your own account');
    }

    logger.info(`Admin ${adminId} is disabling user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} attempted to disable non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Update user status
    const updated = await userRepository.setUserStatus(userId, false);
    if (!updated) {
      logger.error(`Failed to disable user ID: ${userId}`);
      return ApiResponse.serverError(res, 'Failed to disable user account');
    }

    logger.info(`Admin ${adminId} successfully disabled user ${userId}`);
    return ApiResponse.success(res, null, 200, 'User account disabled successfully');
  } catch (error) {
    logger.error(`Error disabling user ID ${req.params.id}:`, error);
    return next(error);
  }
};

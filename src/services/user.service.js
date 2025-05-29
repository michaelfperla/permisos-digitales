const { userRepository } = require('../repositories');
const { logger } = require('../utils/enhanced-logger');
const { NotFoundError } = require('../utils/errors');

exports.getUserProfile = async (userId) => {
  try {
    logger.debug(`Getting profile for user ID: ${userId}`);

    const user = await userRepository.findById(userId);

    if (!user) {
      logger.warn(`User profile not found for ID: ${userId}`);
      return null;
    }

    return user;
  } catch (error) {
    logger.error(`Error getting user profile for ID ${userId}:`, error);
    throw error;
  }
};

exports.updateUserProfile = async (userId, updateData) => {
  try {
    logger.debug(`Updating profile for user ID: ${userId}`, updateData);

    const existingUser = await userRepository.findById(userId);

    if (!existingUser) {
      logger.warn(`User not found for ID: ${userId}`);
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const updatedUser = await userRepository.update(userId, updateData);

    logger.info(`Profile updated for user ID: ${userId}`);
    return updatedUser;
  } catch (error) {
    logger.error(`Error updating user profile for ID ${userId}:`, error);
    throw error;
  }
};

exports.checkEmailExists = async (email, currentUserId) => {
  try {
    logger.debug(`Checking if email ${email} exists for a user other than ${currentUserId}`);

    const user = await userRepository.findByEmail(email);

    return user !== null && user.id !== currentUserId;
  } catch (error) {
    logger.error(`Error checking if email ${email} exists:`, error);
    throw error;
  }
};

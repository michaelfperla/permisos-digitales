// src/services/user.service.js
const { userRepository } = require('../repositories');
const { logger } = require('../utils/enhanced-logger');
const { NotFoundError } = require('../utils/errors');

/**
 * Get user profile by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - User object or null
 */
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

/**
 * Update user profile
 * @param {number} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} - Updated user object or null
 */
exports.updateUserProfile = async (userId, updateData) => {
  try {
    logger.debug(`Updating profile for user ID: ${userId}`, updateData);
    
    // Verify user exists
    const existingUser = await userRepository.findById(userId);
    
    if (!existingUser) {
      logger.warn(`User not found for ID: ${userId}`);
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
    
    // Update user profile
    const updatedUser = await userRepository.update(userId, updateData);
    
    logger.info(`Profile updated for user ID: ${userId}`);
    return updatedUser;
  } catch (error) {
    logger.error(`Error updating user profile for ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Check if email exists for a different user
 * @param {string} email - Email to check
 * @param {number} currentUserId - Current user ID (to exclude from check)
 * @returns {Promise<boolean>} - True if email exists for another user
 */
exports.checkEmailExists = async (email, currentUserId) => {
  try {
    logger.debug(`Checking if email ${email} exists for a user other than ${currentUserId}`);
    
    const user = await userRepository.findByEmail(email);
    
    // If user with email exists and it's not the current user
    return user !== null && user.id !== currentUserId;
  } catch (error) {
    logger.error(`Error checking if email ${email} exists:`, error);
    throw error;
  }
};

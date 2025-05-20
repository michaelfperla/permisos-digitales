/**
 * Password Utilities
 * Secure password hashing and verification
 *
 * IMPORTANT: This file supports both bcrypt and legacy PBKDF2 hashes
 * stored in the format 'iterations:salt:hash'.
 * New passwords are created using bcrypt.
 * Verification checks the hash format and uses the appropriate method.
 */
const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcrypt');

// Use promisify to convert callback-based functions to Promise-based
const randomBytes = promisify(crypto.randomBytes);
const pbkdf2 = promisify(crypto.pbkdf2);

// Configuration
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

/**
 * Generate a secure password hash using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password string (bcrypt format)
 */
async function hashPassword(password) {
  const saltRounds = 10; // Standard bcrypt cost factor
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} hashedPassword - Previously hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hashedPassword) {
  // Check for undefined or invalid inputs
  if (!password || !hashedPassword) {
    return false;
  }

  try {
    // Check if it's a bcrypt hash (starts with $2b$)
    if (hashedPassword.startsWith('$2b$')) {
      console.debug('Verifying password using bcrypt');
      return await bcrypt.compare(password, hashedPassword);
    }

    // Otherwise, assume it's our PBKDF2 hash format
    console.debug('Verifying password using PBKDF2');
    // Split the stored hash into its components
    const [iterations, salt, storedHash] = hashedPassword.split(':');

    // Validate components
    if (!iterations || !salt || !storedHash) {
      return false;
    }

    // Convert iterations to number and salt to Buffer
    const iterCount = parseInt(iterations, 10);
    const saltBuffer = Buffer.from(salt, 'hex');

    // Hash the password with the same salt and iterations
    const hash = await pbkdf2(
      password,
      saltBuffer,
      iterCount,
      KEY_LENGTH,
      DIGEST
    );

    // Compare the computed hash with the stored hash
    return hash.toString('hex') === storedHash;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};

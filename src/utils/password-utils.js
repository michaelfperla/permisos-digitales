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
    console.debug('[Password Utils] Invalid inputs for password verification: password or hashedPassword is empty');
    return false;
  }

  try {
    // Check if it's a bcrypt hash (starts with $2b$)
    if (hashedPassword.startsWith('$2b$')) {
      console.debug('[Password Utils] Verifying password using bcrypt');
      const startTime = Date.now();
      const result = await bcrypt.compare(password, hashedPassword);
      const duration = Date.now() - startTime;
      console.debug(`[Password Utils] bcrypt comparison completed in ${duration}ms, result: ${result}`);
      return result;
    }

    // Otherwise, assume it's our PBKDF2 hash format
    console.debug('[Password Utils] Verifying password using PBKDF2');
    // Split the stored hash into its components
    const [iterations, salt, storedHash] = hashedPassword.split(':');

    // Validate components
    if (!iterations || !salt || !storedHash) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: missing components');
      return false;
    }

    // Convert iterations to number and salt to Buffer
    const iterCount = parseInt(iterations, 10);
    if (isNaN(iterCount)) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: iterations is not a number');
      return false;
    }

    console.debug(`[Password Utils] PBKDF2 using ${iterCount} iterations`);

    let saltBuffer;
    try {
      saltBuffer = Buffer.from(salt, 'hex');
    } catch (bufferError) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: salt is not valid hex', bufferError);
      return false;
    }

    // Hash the password with the same salt and iterations
    console.debug('[Password Utils] Computing PBKDF2 hash');
    const startTime = Date.now();
    const hash = await pbkdf2(
      password,
      saltBuffer,
      iterCount,
      KEY_LENGTH,
      DIGEST
    );
    const duration = Date.now() - startTime;
    console.debug(`[Password Utils] PBKDF2 hash computed in ${duration}ms`);

    // Compare the computed hash with the stored hash
    const computedHash = hash.toString('hex');
    const matches = computedHash === storedHash;
    console.debug(`[Password Utils] PBKDF2 hash comparison result: ${matches}`);
    return matches;
  } catch (error) {
    console.error('[Password Utils] Error verifying password:', error);
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};

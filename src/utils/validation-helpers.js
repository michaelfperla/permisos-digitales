/**
 * Validation Helper Functions
 * Secure validation utilities for controllers
 */

/**
 * Safely parse and validate an integer with range checking
 * @param {any} value - Value to parse
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {number} options.default - Default value if invalid
 * @param {string} options.name - Field name for error messages
 * @returns {Object} - {isValid: boolean, value: number, error?: string}
 */
function validateInteger(value, options = {}) {
  const {
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    default: defaultValue,
    name = 'value'
  } = options;

  // Handle null/undefined
  if (value == null) {
    if (defaultValue !== undefined) {
      return { isValid: true, value: defaultValue };
    }
    return { isValid: false, error: `${name} is required` };
  }

  // Convert to number
  const parsed = parseInt(String(value), 10);
  
  // Check if parsing was successful
  if (isNaN(parsed)) {
    return { isValid: false, error: `${name} must be a valid integer` };
  }

  // Check range
  if (parsed < min) {
    return { isValid: false, error: `${name} must be at least ${min}` };
  }
  
  if (parsed > max) {
    return { isValid: false, error: `${name} must be at most ${max}` };
  }

  return { isValid: true, value: parsed };
}

/**
 * Validate application ID - commonly used across controllers
 * @param {any} id - ID to validate
 * @returns {Object} - {isValid: boolean, value: number, error?: string}
 */
function validateApplicationId(id) {
  return validateInteger(id, {
    min: 1,
    max: 2147483647, // PostgreSQL integer max
    name: 'Application ID'
  });
}

/**
 * Validate user ID
 * @param {any} id - ID to validate
 * @returns {Object} - {isValid: boolean, value: number, error?: string}
 */
function validateUserId(id) {
  return validateInteger(id, {
    min: 1,
    max: 2147483647,
    name: 'User ID'
  });
}

/**
 * Validate year (for ano_modelo)
 * @param {any} year - Year to validate
 * @returns {Object} - {isValid: boolean, value: number, error?: string}
 */
function validateYear(year) {
  const currentYear = new Date().getFullYear();
  return validateInteger(year, {
    min: 1900,
    max: currentYear + 10, // Allow up to 10 years in future
    name: 'Year'
  });
}

/**
 * Validate pagination parameters
 * @param {any} page - Page number
 * @param {any} limit - Items per page
 * @returns {Object} - {isValid: boolean, page: number, limit: number, error?: string}
 */
function validatePagination(page, limit) {
  const pageResult = validateInteger(page, {
    min: 1,
    max: 10000,
    default: 1,
    name: 'Page'
  });

  const limitResult = validateInteger(limit, {
    min: 1,
    max: 100,
    default: 10,
    name: 'Limit'
  });

  if (!pageResult.isValid) {
    return { isValid: false, error: pageResult.error };
  }

  if (!limitResult.isValid) {
    return { isValid: false, error: limitResult.error };
  }

  return {
    isValid: true,
    page: pageResult.value,
    limit: limitResult.value
  };
}

module.exports = {
  validateInteger,
  validateApplicationId,
  validateUserId,
  validateYear,
  validatePagination
};
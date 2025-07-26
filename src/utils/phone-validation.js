/**
 * Phone number validation and sanitization utilities
 * Prevents SQL injection and ensures data integrity
 */

const { logger } = require('./logger');

/**
 * Validate and sanitize Mexican WhatsApp phone number
 * @param {string} phone - Phone number to validate
 * @returns {object} { isValid: boolean, sanitized: string, error: string }
 */
function validateAndSanitizeWhatsAppPhone(phone) {
  try {
    if (!phone) {
      return { isValid: false, sanitized: null, error: 'Phone number is required' };
    }

    // Convert to string and remove all non-digits
    const phoneStr = String(phone);
    const digitsOnly = phoneStr.replace(/\D/g, '');

    // Check for SQL injection attempts
    if (phoneStr.includes("'") || phoneStr.includes('"') || phoneStr.includes(';') || 
        phoneStr.includes('--') || phoneStr.includes('/*') || phoneStr.includes('*/')) {
      logger.warn('Potential SQL injection attempt in phone number', { 
        phone: phoneStr.substring(0, 20) // Log only first 20 chars for safety
      });
      return { isValid: false, sanitized: null, error: 'Invalid characters in phone number' };
    }

    // Validate Mexican WhatsApp format: 52XXXXXXXXXX (12 digits)
    if (!/^52\d{10}$/.test(digitsOnly)) {
      return { 
        isValid: false, 
        sanitized: null, 
        error: 'Invalid WhatsApp phone format. Expected: 52XXXXXXXXXX' 
      };
    }

    // Additional validation: check if it's a valid Mexican number pattern
    const areaCode = digitsOnly.substring(2, 5);
    const validAreaCodes = [
      '55', '33', '81', '222', '444', '477', '664', '686', '656', '614',
      '618', '667', '669', '722', '744', '777', '844', '867', '899', '921',
      '961', '984', '998', '999'
    ];

    const isValidAreaCode = validAreaCodes.some(code => 
      digitsOnly.substring(2).startsWith(code)
    );

    if (!isValidAreaCode) {
      logger.debug('Unusual area code detected', { areaCode });
      // Don't reject, just log - some valid numbers might not be in our list
    }

    return { isValid: true, sanitized: digitsOnly, error: null };
  } catch (error) {
    logger.error('Error validating phone number', { error: error.message });
    return { isValid: false, sanitized: null, error: 'Validation error' };
  }
}

/**
 * Mask phone number for logging and display
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone number
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 8) {
    return '****';
  }
  
  const phoneStr = String(phone);
  const digitsOnly = phoneStr.replace(/\D/g, '');
  
  if (digitsOnly.length >= 12) {
    // Format: 52XX****XXXX
    return `${digitsOnly.substring(0, 4)}****${digitsOnly.substring(8)}`;
  } else if (digitsOnly.length >= 10) {
    // Format: XX****XXXX
    return `${digitsOnly.substring(0, 2)}****${digitsOnly.substring(6)}`;
  } else {
    // Just mask middle portion
    const visibleChars = Math.floor(digitsOnly.length / 3);
    return digitsOnly.substring(0, visibleChars) + 
           '*'.repeat(digitsOnly.length - 2 * visibleChars) + 
           digitsOnly.substring(digitsOnly.length - visibleChars);
  }
}

/**
 * Compare two phone numbers accounting for different formats
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} True if phones match
 */
function comparePhoneNumbers(phone1, phone2) {
  if (!phone1 || !phone2) {
    return false;
  }

  const digits1 = String(phone1).replace(/\D/g, '');
  const digits2 = String(phone2).replace(/\D/g, '');

  // Direct comparison
  if (digits1 === digits2) {
    return true;
  }

  // Check if one has country code and other doesn't
  if (digits1.startsWith('52') && digits1.substring(2) === digits2) {
    return true;
  }
  if (digits2.startsWith('52') && digits2.substring(2) === digits1) {
    return true;
  }

  // Check for 521 prefix (old format)
  if (digits1.startsWith('521') && digits1.substring(3) === digits2) {
    return true;
  }
  if (digits2.startsWith('521') && digits2.substring(3) === digits1) {
    return true;
  }

  return false;
}

/**
 * Normalize phone number to standard format
 * @param {string} phone - Phone number to normalize
 * @returns {string|null} Normalized phone or null if invalid
 */
function normalizeWhatsAppPhone(phone) {
  const validation = validateAndSanitizeWhatsAppPhone(phone);
  
  if (!validation.isValid) {
    return null;
  }

  // Convert 521XXXXXXXXXX to 52XXXXXXXXXX if needed
  let normalized = validation.sanitized;
  if (normalized.startsWith('521') && normalized.length === 13) {
    normalized = '52' + normalized.substring(3);
  }

  return normalized;
}

module.exports = {
  validateAndSanitizeWhatsAppPhone,
  maskPhoneNumber,
  comparePhoneNumbers,
  normalizeWhatsAppPhone
};
/**
 * Data Sanitization Utilities
 * Handles sensitive data detection and sanitization for GDPR compliance
 */

const { logger } = require('./logger');

// Patterns for detecting sensitive data
const SENSITIVE_PATTERNS = {
  // Mexican identification patterns
  curp: /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/gi,
  rfc: /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi,
  
  // Phone numbers
  phone: /(?:\+?52\s?)?(?:\d{2,3}[-.\s]?)?\d{3,4}[-.\s]?\d{4}/g,
  
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  
  // Credit card patterns (basic)
  creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  
  // License plates (Mexican format)
  licensePlate: /[A-Z]{3}-?\d{3}-?[A-Z]|[A-Z]{2}-?\d{2}-?\d{3}|\d{3}-?[A-Z]{3}/gi,
  
  // Addresses (basic patterns)
  address: /(?:calle|av\.|avenida|blvd\.|boulevard|col\.|colonia)\s+[a-záéíóúñ\s\d#.-]+/gi,
  
  // Bank account numbers (basic)
  bankAccount: /\b\d{10,18}\b/g
};

// Replacement patterns for sanitization
const REPLACEMENTS = {
  curp: '[CURP]',
  rfc: '[RFC]',
  phone: '[TELÉFONO]',
  email: '[EMAIL]',
  creditCard: '[TARJETA]',
  licensePlate: '[PLACA]',
  address: '[DIRECCIÓN]',
  bankAccount: '[CUENTA]'
};

/**
 * Detect if content contains sensitive data
 */
function detectSensitiveData(content) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(content)) {
      logger.debug('Sensitive data detected', { type, contentLength: content.length });
      return true;
    }
  }

  return false;
}

/**
 * Sanitize content for display (replace sensitive data with placeholders)
 */
function sanitizeForDisplay(content, maxLength = null) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let sanitized = content;

  // Replace sensitive patterns
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    sanitized = sanitized.replace(pattern, REPLACEMENTS[type]);
  }

  // Truncate if maxLength specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Sanitize content for logging (more aggressive)
 */
function sanitizeForLogging(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let sanitized = content;

  // Replace sensitive patterns
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
  }

  // Additional sanitization for logging
  // Replace potential names (sequences of capitalized words)
  sanitized = sanitized.replace(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+\b/g, '[NOMBRE]');
  
  // Replace numbers that might be sensitive (4+ consecutive digits)
  sanitized = sanitized.replace(/\b\d{4,}\b/g, '[NÚMERO]');

  return sanitized;
}

/**
 * Create a safe preview of content for admin interface
 */
function createSafePreview(content, options = {}) {
  const {
    maxLength = 100,
    showSensitiveData = false,
    adminLevel = 'standard' // 'standard' | 'senior' | 'super'
  } = options;

  if (!content || typeof content !== 'string') {
    return {
      preview: content || '[Sin contenido]',
      hasSensitiveData: false,
      isTruncated: false,
      originalLength: 0
    };
  }

  const hasSensitiveData = detectSensitiveData(content);
  let preview = content;

  // Apply sanitization based on admin level and settings
  if (hasSensitiveData && !showSensitiveData) {
    if (adminLevel === 'super') {
      // Super admins see partial data
      preview = sanitizeForDisplay(content);
    } else {
      // Standard admins see fully sanitized data
      preview = sanitizeForLogging(content);
    }
  }

  // Truncate if necessary
  const isTruncated = preview.length > maxLength;
  if (isTruncated) {
    preview = preview.substring(0, maxLength) + '...';
  }

  return {
    preview,
    hasSensitiveData,
    isTruncated,
    originalLength: content.length,
    sanitizationLevel: hasSensitiveData ? (showSensitiveData ? 'none' : adminLevel) : 'none'
  };
}

/**
 * Validate if user has consent for data processing
 */
function validateUserConsent(userContext) {
  const {
    hasConsent = false,
    consentDate = null,
    consentMethod = null
  } = userContext;

  if (!hasConsent || !consentDate) {
    return {
      isValid: false,
      reason: 'No consent provided'
    };
  }

  // Check if consent is not too old (1 year max)
  const consentAge = Date.now() - new Date(consentDate).getTime();
  const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

  if (consentAge > maxAge) {
    return {
      isValid: false,
      reason: 'Consent expired'
    };
  }

  return {
    isValid: true,
    consentAge: Math.floor(consentAge / (24 * 60 * 60 * 1000)), // Age in days
    consentMethod
  };
}

/**
 * Generate privacy-compliant message metadata
 */
function generatePrivacyMetadata(content, userContext) {
  const hasSensitiveData = detectSensitiveData(content);
  const consentValidation = validateUserConsent(userContext);
  
  return {
    hasSensitiveData,
    consentValid: consentValidation.isValid,
    consentReason: consentValidation.reason,
    shouldRedact: hasSensitiveData && !consentValidation.isValid,
    privacyLevel: hasSensitiveData ? 'high' : 'standard',
    retentionPeriod: hasSensitiveData ? 30 : 90, // Days
    canDisplay: consentValidation.isValid || !hasSensitiveData
  };
}

/**
 * Mask phone number for display
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }

  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length >= 10) {
    const masked = digits.substring(0, 3) + '****' + digits.substring(digits.length - 3);
    return masked;
  }
  
  return phoneNumber;
}

/**
 * Mask email address for display
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  
  if (localPart.length <= 2) {
    return `${localPart}***@${domain}`;
  }
  
  const maskedLocal = localPart.substring(0, 2) + '***' + localPart.substring(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
}

module.exports = {
  detectSensitiveData,
  sanitizeForDisplay,
  sanitizeForLogging,
  createSafePreview,
  validateUserConsent,
  generatePrivacyMetadata,
  maskPhoneNumber,
  maskEmail,
  SENSITIVE_PATTERNS,
  REPLACEMENTS
};

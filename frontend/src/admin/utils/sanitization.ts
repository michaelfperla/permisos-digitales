/**
 * Input sanitization utilities for admin portal security
 * Prevents XSS attacks and malicious input
 */

/**
 * Sanitize string input to prevent XSS attacks
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>'"&]/g, (match) => {
      const htmlEntities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return htmlEntities[match] || match;
    })
    // Remove potentially dangerous characters
    .replace(/[^\w\s\-@.áéíóúñü]/gi, '')
    // Limit length to prevent DoS
    .substring(0, 500);
};

/**
 * Sanitize search term for API calls
 */
export const sanitizeSearchTerm = (searchTerm: string): string => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return '';
  }

  return searchTerm
    .trim()
    // Allow alphanumeric, spaces, hyphens, periods, @ symbols, and Spanish characters
    .replace(/[^\w\s\-@.áéíóúñü]/gi, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    // Limit length
    .substring(0, 100);
};

/**
 * Sanitize email input
 */
export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email
    .trim()
    .toLowerCase()
    // Only allow valid email characters
    .replace(/[^\w@.\-+]/g, '')
    .substring(0, 254); // RFC 5321 limit
};

/**
 * Sanitize status values for API calls
 */
export const sanitizeStatus = (status: string): string => {
  if (!status || typeof status !== 'string') {
    return '';
  }

  // Only allow alphanumeric and underscores (valid status format)
  return status
    .trim()
    .toUpperCase()
    .replace(/[^\w_]/g, '')
    .substring(0, 50);
};

/**
 * Validate and sanitize date strings
 */
export const sanitizeDate = (dateString: string): string => {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }

  // Basic ISO date format validation
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  
  if (!isoDateRegex.test(dateString.trim())) {
    return '';
  }

  return dateString.trim();
};

/**
 * Sanitize numeric ID values
 */
export const sanitizeId = (id: string | number): string => {
  if (typeof id === 'number') {
    return Math.abs(Math.floor(id)).toString();
  }

  if (typeof id === 'string') {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId) || numericId <= 0) {
      return '';
    }
    return numericId.toString();
  }

  return '';
};

/**
 * Sanitize notes/reason text for admin actions
 */
export const sanitizeNotes = (notes: string): string => {
  if (!notes || typeof notes !== 'string') {
    return '';
  }

  return notes
    .trim()
    // Allow most characters for notes but sanitize HTML
    .replace(/[<>]/g, (match) => (match === '<' ? '&lt;' : '&gt;'))
    // Limit length
    .substring(0, 1000);
};

/**
 * Comprehensive input sanitization for admin API parameters
 */
export const sanitizeAdminParams = (params: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) {
      return; // Skip null/undefined values
    }

    switch (key) {
      case 'search':
      case 'searchTerm':
        sanitized[key] = sanitizeSearchTerm(value);
        break;
      
      case 'email':
        sanitized[key] = sanitizeEmail(value);
        break;
      
      case 'status':
        sanitized[key] = sanitizeStatus(value);
        break;
      
      case 'startDate':
      case 'endDate':
        sanitized[key] = sanitizeDate(value);
        break;
      
      case 'id':
      case 'userId':
      case 'applicationId':
        sanitized[key] = sanitizeId(value);
        break;
      
      case 'notes':
      case 'reason':
      case 'adminNotes':
        sanitized[key] = sanitizeNotes(value);
        break;
      
      case 'page':
      case 'limit':
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue > 0) {
          sanitized[key] = Math.min(numValue, key === 'limit' ? 100 : 1000);
        }
        break;
      
      default:
        // For unknown keys, apply basic string sanitization
        if (typeof value === 'string') {
          sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'number') {
          sanitized[key] = Math.abs(Math.floor(value));
        }
        break;
    }
  });

  return sanitized;
};
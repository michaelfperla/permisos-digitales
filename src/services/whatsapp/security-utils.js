/**
 * Security utilities for WhatsApp bot
 * Prevents common attack vectors and ensures data integrity
 */

const crypto = require('crypto');
const { logger } = require('../../utils/logger');

class WhatsAppSecurityUtils {
  constructor() {
    // Track recent messages for deduplication
    this.recentMessages = new Map();
    this.MESSAGE_WINDOW_MS = 5000; // 5 second window for duplicates
    this.MAX_CACHE_SIZE = 10000; // Maximum cached entries
    
    // Rate limit tracking
    this.stateRateLimits = new Map();
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupCaches(), 5 * 60 * 1000); // Every 5 minutes
    
    this.MAX_INPUT_LENGTHS = {
      nombre_completo: 100,
      curp_rfc: 50,
      domicilio: 200,
      email: 100,
      marca: 50,
      linea: 50,
      color: 30,
      numero_serie: 30,
      numero_motor: 30,
      ano_modelo: 4,
      default: 500
    };
  }

  /**
   * Create hash of message for deduplication
   */
  createMessageHash(from, message) {
    return crypto.createHash('sha256')
      .update(`${from}:${message}:${Math.floor(Date.now() / 1000)}`)
      .digest('hex');
  }

  /**
   * Check if message is duplicate
   */
  isDuplicateMessage(from, message) {
    const hash = this.createMessageHash(from, message);
    const now = Date.now();
    
    // Clean old entries
    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.MESSAGE_WINDOW_MS) {
        this.recentMessages.delete(key);
      }
    }
    
    // Check if duplicate
    if (this.recentMessages.has(hash)) {
      logger.warn('Duplicate message detected', { from, messagePreview: message.substring(0, 50) });
      return true;
    }
    
    // Store hash
    this.recentMessages.set(hash, now);
    return false;
  }

  /**
   * Normalize and sanitize Unicode input
   */
  normalizeInput(input, fieldType = 'default') {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Normalize Unicode (NFC form)
    let normalized = input.normalize('NFC');
    
    // Remove control characters except newlines and tabs
    normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Remove zero-width characters
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Trim whitespace
    normalized = normalized.trim();
    
    // Apply length limit
    const maxLength = this.MAX_INPUT_LENGTHS[fieldType] || this.MAX_INPUT_LENGTHS.default;
    if (normalized.length > maxLength) {
      logger.warn('Input truncated', { 
        fieldType, 
        originalLength: normalized.length, 
        maxLength 
      });
      normalized = normalized.substring(0, maxLength);
    }
    
    return normalized;
  }

  /**
   * Validate input doesn't contain command injections
   */
  containsCommandInjection(input) {
    if (!input || typeof input !== 'string') {
      return false;
    }
    
    // Check for command patterns at start of words
    const commandPattern = /(?:^|\s)\/(?:permiso|ayuda|estado|pagar|reset|cancelar|mis-permisos|renovar)\b/i;
    return commandPattern.test(input);
  }

  /**
   * Enhanced field validation with security checks
   */
  validateFieldSecure(field, value) {
    // First normalize the input
    const normalized = this.normalizeInput(value, field);
    
    // Check for command injection
    if (this.containsCommandInjection(normalized)) {
      return { 
        isValid: false, 
        error: 'El texto no puede contener comandos. Por favor ingresa solo la información solicitada.',
        sanitized: normalized.replace(/\/\w+/g, '')
      };
    }
    
    // Field-specific validation
    switch (field) {
      case 'nombre_completo':
        if (normalized.split(' ').length < 2) {
          return { isValid: false, error: 'Por favor incluye nombre y apellido' };
        }
        if (!/^[a-zA-ZáéíóúñÑÁÉÍÓÚ\s\-'\.]+$/.test(normalized)) {
          return { isValid: false, error: 'El nombre solo puede contener letras y espacios' };
        }
        break;
        
      case 'email':
        // More robust email validation regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(normalized)) {
          return { isValid: false, error: 'Por favor ingresa un email válido' };
        }
        // Additional validation
        if (normalized.length > 254) { // Max email length per RFC
          return { isValid: false, error: 'Email demasiado largo' };
        }
        // Prevent multiple @ symbols
        if ((normalized.match(/@/g) || []).length !== 1) {
          return { isValid: false, error: 'Email inválido' };
        }
        break;
        
      case 'curp_rfc':
        // Remove any non-alphanumeric
        const cleanedRFC = normalized.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleanedRFC.length < 10 || cleanedRFC.length > 18) {
          return { isValid: false, error: 'CURP/RFC debe tener entre 10 y 18 caracteres' };
        }
        return { isValid: true, sanitized: cleanedRFC };
        
      case 'numero_serie':
      case 'numero_motor':
        // Only alphanumeric allowed
        const cleanedSerial = normalized.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleanedSerial.length < 5) {
          return { isValid: false, error: `${field === 'numero_serie' ? 'Número de serie' : 'Número de motor'} muy corto` };
        }
        return { isValid: true, sanitized: cleanedSerial };
        
      case 'ano_modelo':
        const year = parseInt(normalized);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1900 || year > currentYear + 1) {
          return { isValid: false, error: 'Año inválido. Debe ser entre 1900 y ' + (currentYear + 1) };
        }
        return { isValid: true, sanitized: year.toString() };
        
      case 'color':
        // Sanitize slashes to prevent issues
        if (normalized.includes('/') || normalized.includes('\\')) {
          const sanitized = normalized.replace(/[\/\\]/g, ' y ');
          return { isValid: true, sanitized: sanitized };
        }
        break;
    }
    
    return { isValid: true, sanitized: normalized };
  }

  /**
   * Create state lock key
   */
  getStateLockKey(userId) {
    return `lock:wa:${userId}`;
  }

  /**
   * Clean user input for logging (remove sensitive data)
   */
  sanitizeForLogging(field, value) {
    if (!value) return '';
    
    const sensitive = ['curp_rfc', 'email', 'numero_serie', 'numero_motor'];
    if (sensitive.includes(field)) {
      // Show only first 3 and last 2 characters
      if (value.length > 5) {
        return value.substring(0, 3) + '***' + value.substring(value.length - 2);
      }
      return '***';
    }
    
    return value.substring(0, 50);
  }

  /**
   * Validate message rate for specific state
   */
  checkStateRateLimit(from, state, maxPerMinute = 10) {
    const key = `rate:${from}:${state}`;
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    
    const rateKey = `${key}:${minute}`;
    const count = this.stateRateLimits.get(rateKey) || 0;
    
    if (count >= maxPerMinute) {
      logger.warn('State rate limit exceeded', { from, state, count });
      return false;
    }
    
    this.stateRateLimits.set(rateKey, count + 1);
    
    // Clean old rate limit entries inline
    for (const [k, ] of this.stateRateLimits.entries()) {
      const [, , keyMinute] = k.split(':');
      if (parseInt(keyMinute) < minute - 5) {
        this.stateRateLimits.delete(k);
      }
    }
    
    return true;
  }

  /**
   * Clean up caches to prevent memory leaks
   */
  cleanupCaches() {
    const now = Date.now();
    
    // Clean old messages
    let messagesDeleted = 0;
    for (const [hash, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.MESSAGE_WINDOW_MS * 2) {
        this.recentMessages.delete(hash);
        messagesDeleted++;
      }
    }
    
    // Enforce size limit using LRU
    if (this.recentMessages.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = [...this.recentMessages.entries()]
        .sort((a, b) => a[1] - b[1]);
      const toDelete = sortedEntries.slice(0, this.recentMessages.size - this.MAX_CACHE_SIZE);
      toDelete.forEach(([hash]) => this.recentMessages.delete(hash));
      messagesDeleted += toDelete.length;
    }
    
    // Clean old rate limits
    const currentMinute = Math.floor(now / 60000);
    let rateLimitsDeleted = 0;
    for (const [key] of this.stateRateLimits.entries()) {
      const parts = key.split(':');
      const keyMinute = parseInt(parts[parts.length - 1]);
      if (keyMinute < currentMinute - 10) {
        this.stateRateLimits.delete(key);
        rateLimitsDeleted++;
      }
    }
    
    if (messagesDeleted > 0 || rateLimitsDeleted > 0) {
      logger.info('Security cache cleanup completed', {
        messagesDeleted,
        rateLimitsDeleted,
        currentMessageCacheSize: this.recentMessages.size,
        currentRateLimitCacheSize: this.stateRateLimits.size
      });
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = new WhatsAppSecurityUtils();
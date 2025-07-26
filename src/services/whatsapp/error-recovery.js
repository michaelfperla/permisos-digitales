const logger = require('../../utils/enhanced-logger');

/**
 * Error Recovery System for WhatsApp Service
 * Provides comprehensive error handling and user guidance
 */
class ErrorRecovery {
  constructor(stateManager, whatsAppService) {
    this.stateManager = stateManager;
    this.whatsAppService = whatsAppService;
    this.errorCounts = new Map(); // Track error frequency per user
    this.MAX_ERRORS_PER_HOUR = 10;
    this.RECOVERY_OPTIONS = {
      CORRUPTED_STATE: 'corrupted_state',
      REDIS_FAILURE: 'redis_failure',
      VALIDATION_ERROR: 'validation_error',
      PROCESSING_ERROR: 'processing_error',
      RATE_LIMIT_ERROR: 'rate_limit_error'
    };
  }

  /**
   * Handle any error with appropriate recovery strategy
   */
  async handleError(from, error, context = {}) {
    const errorType = this.classifyError(error);
    const errorId = this.generateErrorId();
    
    // Log the error with context
    logger.error('WhatsApp service error', {
      errorId,
      errorType,
      error: error.message,
      stack: error.stack,
      from,
      context
    });

    // Track error frequency
    if (this.shouldBlockUser(from)) {
      await this.handleUserBlocking(from, errorId);
      return;
    }

    // Apply appropriate recovery strategy
    switch (errorType) {
      case this.RECOVERY_OPTIONS.CORRUPTED_STATE:
        await this.recoverFromCorruptedState(from, errorId, context);
        break;
      case this.RECOVERY_OPTIONS.REDIS_FAILURE:
        await this.recoverFromRedisFailure(from, errorId, context);
        break;
      case this.RECOVERY_OPTIONS.VALIDATION_ERROR:
        await this.recoverFromValidationError(from, errorId, context);
        break;
      case this.RECOVERY_OPTIONS.RATE_LIMIT_ERROR:
        await this.recoverFromRateLimit(from, errorId, context);
        break;
      default:
        await this.recoverFromGeneralError(from, errorId, context);
    }
  }

  /**
   * Classify error type for appropriate recovery
   */
  classifyError(error) {
    if (error.message.includes('JSON.parse') || error.message.includes('parsing')) {
      return this.RECOVERY_OPTIONS.CORRUPTED_STATE;
    }
    if (error.message.includes('Redis') || error.message.includes('ECONNREFUSED')) {
      return this.RECOVERY_OPTIONS.REDIS_FAILURE;
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return this.RECOVERY_OPTIONS.VALIDATION_ERROR;
    }
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      return this.RECOVERY_OPTIONS.RATE_LIMIT_ERROR;
    }
    return this.RECOVERY_OPTIONS.PROCESSING_ERROR;
  }

  /**
   * Recover from corrupted state
   */
  async recoverFromCorruptedState(from, errorId, context) {
    try {
      // Clear corrupted state
      await this.stateManager.clearState(from);
      
      // Offer recovery options
      await this.whatsAppService.sendMessage(from, 
        `🔧 *Error en tu sesión* (${errorId})\n\n` +
        `Tu progreso ha sido guardado por seguridad.\n\n` +
        `*¿Qué deseas hacer?*\n\n` +
        `1️⃣ Recuperar mi solicitud\n` +
        `2️⃣ Empezar de nuevo\n` +
        `3️⃣ Contactar soporte\n\n` +
        `*Escribe el número* de tu elección.`
      );

      // Set recovery state
      await this.stateManager.setState(from, {
        status: 'error_recovery',
        errorType: 'corrupted_state',
        errorId,
        options: ['recover', 'restart', 'support']
      });

    } catch (recoveryError) {
      logger.error('Error during corrupted state recovery', {
        errorId,
        from,
        recoveryError: recoveryError.message
      });
      await this.fallbackRecovery(from, errorId);
    }
  }

  /**
   * Recover from Redis failure
   */
  async recoverFromRedisFailure(from, errorId, context) {
    try {
      await this.whatsAppService.sendMessage(from, 
        `⚠️ *Problema temporal* (${errorId})\n\n` +
        `Estamos experimentando problemas técnicos.\n\n` +
        `*Tu progreso está guardado.* Intenta de nuevo en:\n\n` +
        `• 2-3 minutos para problemas menores\n` +
        `• Si persiste, contacta soporte\n\n` +
        `💡 También puedes continuar en:\n` +
        `https://permisosdigitales.com.mx`
      );

      // Set a retry state with exponential backoff suggestion
      const retryCount = context.retryCount || 0;
      const waitMinutes = Math.min(Math.pow(2, retryCount), 15); // Max 15 minutes

      if (retryCount < 3) {
        setTimeout(async () => {
          await this.whatsAppService.sendMessage(from, 
            `🔄 *Sistema restaurado*\n\n` +
            `Ya puedes continuar con tu solicitud.\n\n` +
            `Si necesitas ayuda, escribe "ayuda".`
          );
        }, waitMinutes * 60000);
      }

    } catch (recoveryError) {
      logger.error('Error during Redis failure recovery', {
        errorId,
        from,
        recoveryError: recoveryError.message
      });
      await this.fallbackRecovery(from, errorId);
    }
  }

  /**
   * Recover from validation errors
   */
  async recoverFromValidationError(from, errorId, context) {
    try {
      const fieldInfo = context.field || {};
      const helpExample = this.getFieldHelpExample(fieldInfo.type);
      
      await this.whatsAppService.sendMessage(from, 
        `❌ *Error de validación* (${errorId})\n\n` +
        `${context.errorMessage || 'Formato inválido detectado.'}\n\n` +
        `${helpExample}\n\n` +
        `*¿Necesitas ayuda?*\n\n` +
        `1️⃣ Ver más ejemplos\n` +
        `2️⃣ Contactar soporte\n` +
        `3️⃣ Continuar intentando\n\n` +
        `*Escribe el número* o intenta de nuevo.`
      );

    } catch (recoveryError) {
      logger.error('Error during validation error recovery', {
        errorId,
        from,
        recoveryError: recoveryError.message
      });
      await this.fallbackRecovery(from, errorId);
    }
  }

  /**
   * Recover from rate limit errors
   */
  async recoverFromRateLimit(from, errorId, context) {
    try {
      const waitTime = context.waitTime || 60;
      
      await this.whatsAppService.sendMessage(from, 
        `⏰ *Límite de mensajes alcanzado* (${errorId})\n\n` +
        `Para prevenir spam, hay un límite de mensajes por minuto.\n\n` +
        `⏳ Espera ${waitTime} segundos y podrás continuar.\n\n` +
        `💡 *Mientras tanto:*\n` +
        `• Prepara tu información\n` +
        `• Revisa que tengas todos los datos\n` +
        `• Visita https://permisosdigitales.com.mx`
      );

    } catch (recoveryError) {
      logger.error('Error during rate limit recovery', {
        errorId,
        from,
        recoveryError: recoveryError.message
      });
    }
  }

  /**
   * General error recovery
   */
  async recoverFromGeneralError(from, errorId, context) {
    try {
      await this.whatsAppService.sendMessage(from, 
        `🔧 *Error técnico* (${errorId})\n\n` +
        `Se produjo un error inesperado.\n\n` +
        `*Tu progreso está guardado.*\n\n` +
        `*¿Qué deseas hacer?*\n\n` +
        `1️⃣ Intentar de nuevo\n` +
        `2️⃣ Continuar en la web\n` +
        `3️⃣ Contactar soporte\n\n` +
        `Web: https://permisosdigitales.com.mx\n` +
        `Soporte: soporte@permisosdigitales.com.mx`
      );

    } catch (recoveryError) {
      logger.error('Error during general error recovery', {
        errorId,
        from,
        recoveryError: recoveryError.message
      });
      await this.fallbackRecovery(from, errorId);
    }
  }

  /**
   * Last resort recovery when everything else fails
   */
  async fallbackRecovery(from, errorId) {
    try {
      // Use the most basic message sending possible
      const config = this.whatsAppService.getConfig();
      const response = await fetch(`${config.apiUrl}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: {
            body: `⚠️ Error crítico (${errorId})\n\nContacta soporte:\nsoporte@permisosdigitales.com.mx\n\nO visita:\nhttps://permisosdigitales.com.mx`
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (fallbackError) {
      logger.error('Fallback recovery failed', {
        errorId,
        from,
        fallbackError: fallbackError.message
      });
    }
  }

  /**
   * Check if user should be temporarily blocked due to excessive errors
   */
  shouldBlockUser(from) {
    const now = Date.now();
    const userErrors = this.errorCounts.get(from) || [];
    
    // Clean old errors (older than 1 hour)
    const recentErrors = userErrors.filter(errorTime => now - errorTime < 3600000);
    this.errorCounts.set(from, recentErrors);
    
    // Add current error
    recentErrors.push(now);
    
    return recentErrors.length > this.MAX_ERRORS_PER_HOUR;
  }

  /**
   * Handle user blocking due to excessive errors
   */
  async handleUserBlocking(from, errorId) {
    try {
      await this.whatsAppService.sendMessage(from,
        `🚫 *Cuenta temporalmente suspendida* (${errorId})\n\n` +
        `Demasiados errores detectados en la última hora.\n\n` +
        `*Suspensión temporal:* 1 hora\n\n` +
        `*Para ayuda inmediata:*\n` +
        `📧 soporte@permisosdigitales.com.mx\n` +
        `🌐 https://permisosdigitales.com.mx\n\n` +
        `*Motivo:* Protección del sistema`
      );

      // Clear error count after sending message
      setTimeout(() => {
        this.errorCounts.delete(from);
      }, 3600000); // 1 hour

    } catch (blockingError) {
      logger.error('Error during user blocking', {
        errorId,
        from,
        blockingError: blockingError.message
      });
    }
  }

  /**
   * Generate unique error ID for tracking
   */
  generateErrorId() {
    return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  }

  /**
   * Get help examples for field types
   */
  getFieldHelpExample(fieldType) {
    const examples = {
      'curp': '📝 Ejemplo CURP: GOPA123456HDFRRL09',
      'email': '📧 Ejemplo email: juan@gmail.com',
      'phone': '📱 Ejemplo teléfono: 5512345678',
      'text': '✏️ Escribe texto normal sin símbolos especiales',
      'number': '🔢 Solo números, sin letras ni símbolos'
    };
    
    return examples[fieldType] || '💡 Revisa el formato solicitado';
  }

  /**
   * Clean up old error tracking data
   */
  cleanup() {
    const now = Date.now();
    for (const [userId, errors] of this.errorCounts.entries()) {
      const recentErrors = errors.filter(errorTime => now - errorTime < 3600000);
      if (recentErrors.length === 0) {
        this.errorCounts.delete(userId);
      } else {
        this.errorCounts.set(userId, recentErrors);
      }
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getStatistics() {
    return {
      activeErrorTracking: this.errorCounts.size,
      totalRecentErrors: Array.from(this.errorCounts.values())
        .reduce((sum, errors) => sum + errors.length, 0)
    };
  }
}

module.exports = ErrorRecovery;
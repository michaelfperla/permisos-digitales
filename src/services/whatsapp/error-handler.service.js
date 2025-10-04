/**
 * WhatsApp Error Handler Service
 * Provides contextual, empathetic error messages with clear recovery steps
 * Designed for Mexican users with natural, friendly language
 */

const { logger } = require('../../utils/logger');

class WhatsAppErrorHandler {
  constructor() {
    this.errorTypes = {
      VALIDATION: 'validation',
      NETWORK: 'network', 
      PAYMENT: 'payment',
      DATABASE: 'database',
      SYSTEM: 'system',
      USER_INPUT: 'user_input',
      RATE_LIMIT: 'rate_limit',
      SESSION: 'session'
    };

    this.userStates = {
      COLLECTING: 'collecting',
      CONFIRMING: 'confirming', 
      RENEWAL: 'renewal',
      PASSWORD_RESET: 'password_reset',
      MENU: 'menu',
      IDLE: 'idle'
    };
  }

  /**
   * Generate contextual error message based on error type and user state
   */
  async generateErrorMessage(errorType, userState, context = {}) {
    try {
      const errorContext = {
        type: errorType,
        state: userState,
        fieldName: context.fieldName,
        attemptCount: context.attemptCount || 1,
        lastAction: context.lastAction,
        timeOfDay: this.getTimeOfDay(),
        ...context
      };

      // Log error for monitoring
      logger.warn('Generating contextual error message', {
        errorType,
        userState,
        context: errorContext
      });

      switch (errorType) {
        case this.errorTypes.VALIDATION:
          return this.getValidationError(errorContext);
          
        case this.errorTypes.NETWORK:
          return this.getNetworkError(errorContext);
          
        case this.errorTypes.PAYMENT:
          return this.getPaymentError(errorContext);
          
        case this.errorTypes.DATABASE:
          return this.getDatabaseError(errorContext);
          
        case this.errorTypes.USER_INPUT:
          return this.getUserInputError(errorContext);
          
        case this.errorTypes.RATE_LIMIT:
          return this.getRateLimitError(errorContext);
          
        case this.errorTypes.SESSION:
          return this.getSessionError(errorContext);
          
        case this.errorTypes.SYSTEM:
        default:
          return this.getSystemError(errorContext);
      }

    } catch (error) {
      logger.error('Error generating error message', { error: error.message });
      return this.getFallbackError();
    }
  }

  /**
   * Validation error messages with field-specific guidance
   */
  getValidationError(context) {
    const { fieldName, attemptCount, state } = context;
    
    let message = this.getEmpathyMessage(attemptCount) + '\n\n';
    
    // Field-specific validation guidance
    switch (fieldName) {
      case 'nombre_completo':
        message += `👤 *NOMBRE COMPLETO*\n\n`;
        message += `Necesito tu nombre como aparece en tu INE:\n`;
        message += `✅ Juan Gabriel Pérez González\n`;
        message += `❌ Juan, J. Pérez, JuanPerez\n\n`;
        message += `💡 Incluye nombres y apellidos completos`;
        break;
        
      case 'curp_rfc':
        message += `📄 *CURP O RFC*\n\n`;
        message += `Acepto cualquiera de los dos:\n`;
        message += `✅ CURP: PERJ850124HDFRZN01\n`;
        message += `✅ RFC: PERJ850124AB1\n\n`;
        message += `💡 Copia tal como aparece en tu documento`;
        break;
        
      case 'email':
        message += `📧 *CORREO ELECTRÓNICO*\n\n`;
        message += `Formato válido:\n`;
        message += `✅ juan.perez@gmail.com\n`;
        message += `✅ maria_lopez@hotmail.com\n\n`;
        message += `🚫 ¿No tienes email? Escribe "no"`;
        break;
        
      case 'ano_modelo':
        message += `📅 *AÑO DEL VEHÍCULO*\n\n`;
        message += `Necesito exactamente 4 números:\n`;
        message += `✅ 2020, 2018, 2023\n`;
        message += `❌ 20, 2k20, dos mil veinte\n\n`;
        message += `💡 Busca en tu tarjeta de circulación`;
        break;
        
      case 'numero_serie':
        message += `🔧 *NÚMERO DE SERIE (VIN)*\n\n`;
        message += `Copia exactamente como aparece:\n`;
        message += `✅ 1HGBH41JXMN109186\n`;
        message += `✅ KMHJ281GPMU123456\n\n`;
        message += `📄 Búscalo en tu tarjeta de circulación`;
        break;
        
      case 'numero_motor':
        message += `⚙️ *NÚMERO DE MOTOR*\n\n`;
        message += `Tal como aparece en tu tarjeta:\n`;
        message += `✅ 4G15MN123456\n`;
        message += `✅ L15B7-1234567\n\n`;
        message += `📄 Revisa tu tarjeta de circulación`;
        break;
        
      default:
        message += `📝 *FORMATO REQUERIDO*\n\n`;
        message += `Por favor revisa que el formato sea correcto.\n\n`;
        message += `💡 Si tienes dudas, escribe "ayuda"`;
    }
    
    return message + this.getFieldRecoveryOptions(fieldName, state);
  }

  /**
   * Network/connectivity error messages  
   */
  getNetworkError(context) {
    const { state, attemptCount } = context;
    
    let message = `🌐 *PROBLEMA DE CONEXIÓN*\n\n`;
    
    if (attemptCount === 1) {
      message += `Parece que hay un pequeño problema de conexión.\n\n`;
      message += `⏱️ En un momento estará resuelto`;
    } else {
      message += `Los problemas de conexión a veces tardan un poquito.\n\n`;
      message += `💪 No te preocupes, vamos a solucionarlo`;
    }
    
    message += '\n\n💡 *MIENTRAS TANTO:*\n';
    message += `• Espera 30 segundos\n`;
    message += `• Verifica tu señal WiFi/datos\n`;
    message += `• Intenta de nuevo\n\n`;
    
    if (state === this.userStates.CONFIRMING) {
      message += `🔒 Tus datos están seguros y guardados`;
    }
    
    return message + this.getNetworkRecoveryOptions(state);
  }

  /**
   * Payment-related error messages
   */
  getPaymentError(context) {
    const { state, errorDetails, attemptCount } = context;
    
    let message = `💳 *PROBLEMA CON EL PAGO*\n\n`;
    
    if (errorDetails?.includes('declined')) {
      message += `Tu tarjeta fue rechazada por el banco.\n\n`;
      message += `💡 *SOLUCIONES RÁPIDAS:*\n`;
      message += `• Verifica saldo disponible\n`;
      message += `• Confirma límites de compra en línea\n`;
      message += `• Intenta con otra tarjeta\n`;
      message += `• Contacta a tu banco\n\n`;
      message += `🏦 A veces los bancos bloquean compras nuevas por seguridad`;
    } else if (errorDetails?.includes('expired')) {
      message += `El link de pago ha expirado.\n\n`;
      message += `🔄 No hay problema, generamos uno nuevo al instante`;
    } else {
      message += `Hubo un problemita técnico con el procesamiento.\n\n`;
      message += `🔧 El sistema de pagos a veces tiene hickups`;
    }
    
    return message + this.getPaymentRecoveryOptions(state);
  }

  /**
   * Database error messages
   */
  getDatabaseError(context) {
    const { state } = context;
    
    let message = `📄 *GUARDANDO TUS DATOS*\n\n`;
    message += `Hay un pequeño retraso en nuestros servidores.\n\n`;
    message += `⚡ Usualmente se resuelve en menos de un minuto.\n\n`;
    
    if (state === this.userStates.COLLECTING) {
      message += `🔒 Tu información está segura`;
    } else if (state === this.userStates.CONFIRMING) {
      message += `💾 Todos tus datos están bien guardados`;
    }
    
    return message + this.getDatabaseRecoveryOptions(state);
  }

  /**
   * User input error messages
   */
  getUserInputError(context) {
    const { lastInput, state, suggestions } = context;
    
    let message = `🤔 *NO ENTENDÍ ESO*\n\n`;
    
    if (state === this.userStates.MENU) {
      message += `Para el menú, usa los números:\n`;
      message += `1️⃣ Nuevo permiso\n`;
      message += `2️⃣ Renovar permiso\n`;
      message += `3️⃣ Contraseña para portal\n`;
      message += `4️⃣ Ver mis permisos\n\n`;
      message += `✍️ Simplemente escribe el número`;
    } else if (state === this.userStates.COLLECTING) {
      message += `Estamos llenando tu solicitud de permiso.\n\n`;
      message += `💡 *¿NECESITAS AYUDA?*\n`;
      message += `• Escribe "ayuda" para asistencia\n`;
      message += `• Escribe "ejemplo" para ver un ejemplo\n`;
      message += `• Escribe "salir" para cancelar`;
    } else {
      message += `No estoy seguro de qué necesitas.\n\n`;
      message += `💬 Intenta con palabras simples como:\n`;
      message += `• "permiso" - para nuevo permiso\n`;
      message += `• "renovar" - para renovar\n`;
      message += `• "ayuda" - para asistencia`;
    }
    
    return message;
  }

  /**
   * Rate limit error messages
   */
  getRateLimitError(context) {
    const { timeUntilReset } = context;
    
    let message = `⏰ *MUCHOS MENSAJES MUY RÁPIDO*\n\n`;
    message += `Para proteger el sistema, necesito que vayas más despacio.\n\n`;
    
    if (timeUntilReset) {
      const minutes = Math.ceil(timeUntilReset / 60);
      message += `🕐 Espera ${minutes} minuto${minutes > 1 ? 's' : ''} y podrás continuar.\n\n`;
    } else {
      message += `🕐 Espera un minutito y podrás continuar.\n\n`;
    }
    
    message += `💡 *MIENTRAS ESPERAS:*\n`;
    message += `• Prepara los documentos de tu vehículo\n`;
    message += `• Ten lista tu tarjeta de circulación\n`;
    message += `• Verifica que tengas tu CURP o RFC\n\n`;
    message += `🚀 Así será súper rápido cuando continúes`;
    
    return message;
  }

  /**
   * Session error messages
   */
  getSessionError(context) {
    const { state, timeActive } = context;
    
    let message = `⏰ *SESIÓN EXPIRADA*\n\n`;
    
    if (state === this.userStates.CONFIRMING) {
      message += `Tu solicitud estaba lista para pagar, pero la sesión expiró.\n\n`;
      message += `😊 No hay problema - reiniciamos en 30 segundos.\n\n`;
      message += `💾 Toda tu información está guardada de forma segura`;
    } else if (state === this.userStates.COLLECTING) {
      message += `Estabas llenando tu solicitud pero la sesión se cerró.\n\n`;
      message += `🔄 Podemos continuar desde donde te quedaste`;
    } else {
      message += `La sesión se cerró por inactividad.\n\n`;
      message += `🔄 Empezamos de nuevo - será rapidísimo`;
    }
    
    return message + this.getSessionRecoveryOptions(state);
  }

  /**
   * System error messages (fallback)
   */
  getSystemError(context) {
    const { state } = context;
    
    let message = `🔧 *PROBLEMITA TÉCNICO*\n\n`;
    message += `Algo no salió como esperábamos.\n\n`;
    message += `⚡ Nuestro equipo técnico ya está en ello.\n\n`;
    
    if (state === this.userStates.CONFIRMING) {
      message += `💾 Tus datos están seguros`;
    }
    
    return message + this.getSystemRecoveryOptions(state);
  }

  /**
   * Get empathy message based on attempt count
   */
  getEmpathyMessage(attemptCount) {
    if (attemptCount === 1) {
      return '🙏 Ups, necesito un ajustito en ese dato';
    } else if (attemptCount === 2) {
      return '😊 Casi lo tienes, un pequeño detalle más';  
    } else {
      return '💪 Entiendo que puede ser frustrante, vamos paso a paso';
    }
  }

  /**
   * Get time of day for contextual greetings
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  /**
   * Recovery options for field validation errors
   */
  getFieldRecoveryOptions(fieldName, state) {
    let options = '\n\n💡 *OPCIONES:*\n';
    options += `• Intenta de nuevo\n`;
    options += `• Escribe "ejemplo" para ver más ejemplos\n`;
    options += `• Escribe "ayuda" para asistencia personalizada\n`;
    
    if (state === this.userStates.COLLECTING) {
      options += `• Escribe "salir" si quieres cancelar`;
    }
    
    return options;
  }

  /**
   * Recovery options for network errors
   */
  getNetworkRecoveryOptions(state) {
    let options = '\n\n🔄 *REINTENTAR:*\n';
    options += `• Espera 30 segundos\n`;
    options += `• Escribe cualquier cosa para continuar\n`;
    
    if (state === this.userStates.CONFIRMING) {
      options += `• Escribe "pagar" para generar nuevo link`;
    }
    
    options += `\n📞 *¿PROBLEMAS PERSISTENTES?*\n`;
    options += `Contáctanos: +52 55 4943 0313`;
    
    return options;
  }

  /**
   * Recovery options for payment errors
   */
  getPaymentRecoveryOptions(state) {
    let options = '\n\n🔄 *REINTENTAR PAGO:*\n';
    options += `• Escribe "pagar" para nuevo link\n`;
    options += `• Verifica tu tarjeta y límites\n`;
    options += `• Intenta con otra tarjeta\n\n`;
    options += `🏦 *¿TARJETA RECHAZADA?*\n`;
    options += `• Contacta a tu banco\n`;
    options += `• Habilita compras en línea\n`;
    options += `• Verifica saldo disponible\n\n`;
    options += `💬 Para ayuda: "soporte"`;
    
    return options;
  }

  /**
   * Recovery options for database errors
   */
  getDatabaseRecoveryOptions(state) {
    let options = '\n\n⏳ *ESPERAR Y REINTENTAR:*\n';
    options += `• Espera 1 minuto\n`;
    options += `• Escribe "continuar"\n`;
    options += `• Tu información no se perdió\n\n`;
    options += `📞 *SI PERSISTE:*\n`;
    options += `WhatsApp: +52 55 4943 0313`;
    
    return options;
  }

  /**
   * Recovery options for session errors
   */
  getSessionRecoveryOptions(state) {
    let options = '\n\n🚀 *CONTINUAR:*\n';
    
    if (state === this.userStates.CONFIRMING) {
      options += `• Escribe "pagar" para nuevo link\n`;
      options += `• Tus datos están guardados\n`;
    } else {
      options += `• Escribe "permiso" para empezar\n`;
      options += `• Escribe "continuar" si estabas en proceso\n`;
    }
    
    options += `• Escribe "ayuda" para asistencia`;
    
    return options;
  }

  /**
   * Recovery options for system errors
   */
  getSystemRecoveryOptions(state) {
    let options = '\n\n🔄 *OPCIONES:*\n';
    options += `• Espera 2 minutos e intenta de nuevo\n`;
    options += `• Escribe "reiniciar" para empezar limpio\n`;
    options += `• Visita: permisosdigitales.com.mx\n\n`;
    options += `📞 *SOPORTE INMEDIATO:*\n`;
    options += `WhatsApp: +52 55 4943 0313\n`;
    options += `Email: soporte@permisosdigitales.com.mx`;
    
    return options;
  }

  /**
   * Fallback error message when error handler itself fails
   */
  getFallbackError() {
    return `🔧 *ALGO NO SALIÓ BIEN*\n\n` +
           `Hubo un problemita, pero no te preocupes.\n\n` +
           `💬 Escribe "ayuda" para asistencia\n` +
           `🔄 O escribe "reiniciar" para empezar de nuevo\n\n` +
           `📞 Soporte: +52 55 4943 0313`;
  }

  /**
   * Log error for monitoring and analytics
   */
  logError(errorType, userState, context, userPhone) {
    logger.error('User experienced error', {
      errorType,
      userState,
      context,
      userPhone: userPhone ? userPhone.slice(-4) : null, // Only log last 4 digits
      timestamp: new Date().toISOString(),
      source: 'whatsapp_error_handler'
    });
  }
}

module.exports = new WhatsAppErrorHandler();
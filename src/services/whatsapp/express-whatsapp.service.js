/**
 * Express WhatsApp Service for FB Ad Traffic
 * Optimized for maximum conversion: FB Ad -> Fields -> Payment -> Done
 * No menus, no complexity, just results
 */

const { logger } = require('../../utils/logger');
const axios = require('axios');
const whatsappMonitoringService = require('../whatsapp-monitoring.service');
const errorHandler = require('./error-handler.service');

class ExpressWhatsAppService {
  constructor() {
    // Core configuration
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiUrl: `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
    };
    
    // Reuse existing state manager
    const StateManager = require('./state-manager');
    this.stateManager = new StateManager();
    
    // 11 required fields with relaxed validation for Mexican vehicles
    this.fields = [
      {
        key: 'nombre_completo',
        prompt: 'Por favor responda con su nombre completo:\n(Como aparece en su INE)',
        validation: (value) => value.trim().length >= 3, // Very relaxed - just need something
        example: 'Juan Gabriel Pérez González'
      },
      {
        key: 'curp_rfc',
        prompt: 'Ingrese su CURP o RFC:',
        validation: (value) => value.trim().length >= 5, // Relaxed - some RFC are shorter
        example: 'PERJ850124HDFRZN01'
      },
      {
        key: 'email',
        prompt: '📧 Su correo electrónico:',
        validation: (value) => {
          // Allow empty/skip for WhatsApp users
          if (!value || value.trim() === '' || value.toLowerCase() === 'no' || value.toLowerCase() === 'ninguno') {
            return true;
          }
          // If provided, validate format
          return value.includes('@') && value.includes('.');
        },
        example: 'juan.perez@gmail.com o escriba "no"'
      },
      {
        key: 'marca',
        prompt: '🚗 Marca del vehículo:\nEjemplo: Toyota, Nissan, Ford',
        validation: (value) => value.trim().length >= 2, // Very relaxed
        example: 'Toyota'
      },
      {
        key: 'linea',
        prompt: '🚙 Modelo o versión del vehículo:\nEjemplo: Corolla, Sentra, F-150',
        validation: (value) => value.trim().length >= 1, // Super relaxed
        example: 'Corolla'
      },
      {
        key: 'color',
        prompt: '🎨 Color del vehículo:\nEjemplo: Azul, Rojo/Negro, Blanco y Verde',
        validation: (value) => value.trim().length >= 2, // Very relaxed
        example: 'Azul'
      },
      {
        key: 'ano_modelo',
        prompt: '📅 Año del vehículo:\nEjemplo: 2020, 2018, 2023',
        validation: (value) => {
          const currentYear = new Date().getFullYear();
          return /^\d{4}$/.test(value) && parseInt(value) >= 1990 && parseInt(value) <= currentYear + 1;
        },
        example: '2020'
      },
      {
        key: 'numero_serie',
        prompt: '🔧 Número de serie (VIN):',
        validation: (value) => value.trim().length >= 3, // Very relaxed for Mexican vehicles
        example: '1HGBH41JXMN109186'
      },
      {
        key: 'numero_motor',
        prompt: '⚙️ Número de motor:',
        validation: (value) => value.trim().length >= 3, // Very relaxed
        example: '4G15-MN123456'
      },
      {
        key: 'domicilio',
        prompt: '📍 Domicilio completo:\nEjemplo: Calle Juárez 123, Centro, Guadalajara, Jalisco',
        validation: (value) => value.trim().length >= 5, // Relaxed address validation
        example: 'Calle Juárez 123, Centro, Guadalajara, Jalisco'
      }
    ];
  }

  /**
   * Main message handler - Express flow with smart user recognition
   */
  async handleMessage(from, message, messageId = null) {
    try {
      // Log incoming message for monitoring
      try {
        const userContext = await this.getUserContext(from);
        await whatsappMonitoringService.logIncomingMessage({
          messageId: messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from,
          messageType: 'text',
          content: message,
          timestamp: new Date().toISOString(),
          userContext
        });
      } catch (monitoringError) {
        logger.error('Error logging incoming message for monitoring:', monitoringError);
        // Don't fail the main process if monitoring fails
      }

      const state = await this.stateManager.getState(from);
      const normalizedMessage = message.toLowerCase().trim();
      
      // Handle exit commands first (salir, cancelar, cerrar, etc.)
      const exitCommands = ['salir', 'cancelar', 'cerrar', 'cancel', 'exit', 'stop', 'parar', '0'];
      if (exitCommands.includes(normalizedMessage)) {
        await this.stateManager.clearState(from);
        await this.sendMessage(from, 
          `❌ Proceso cancelado\n\n` +
          `Si quieres reintentar más tarde, escribe:\n` +
          `"necesito permiso urgente"`
        );
        return;
      }
      
      // Handle help command
      if (normalizedMessage === 'ayuda' || normalizedMessage === 'help') {
        return await this.showSimpleHelp(from);
      }
      
      // Handle pricing inquiry command
      const pricingTriggers = [
        'precio', 'costo', 'cuanto cuesta', 'cuánto cuesta', 'cuanto vale', 'cuánto vale',
        'precio del permiso', 'costo del permiso', 'cuanto es', 'cuánto es',
        'tarifa', 'precios', 'costos'
      ];
      
      if (pricingTriggers.some(trigger => normalizedMessage.includes(trigger))) {
        await this.sendMessage(from,
          `💰 *INFORMACIÓN DE PRECIOS*\n\n` +
          `📋 Permiso provisional (30 días): $99 pesos\n` +
          `💳 Pago con tarjeta bancaria o en OXXO\n` +
          `⚡ Proceso automático en 3 minutos\n\n` +
          `🏛️ *Autorizado por gobierno oficial*\n` +
          `Dirección de Tránsito Huitzuco de los Figueroa\n\n` +
          `¿Quieres continuar?\n` +
          `✅ Responde con tu *nombre completo*\n` +
          `❌ Escribe "salir" para cancelar`
        );
        return;
      }
      
      // Handle password reset command (multiple natural triggers)
      const passwordTriggers = [
        'contraseña', 'password', '/contraseña', '/password',
        'olvidé mi contraseña', 'olvide mi contraseña', 'no puedo entrar',
        'acceso', 'portal', 'no me acuerdo', 'no recuerdo mi contraseña',
        'sitio web', 'pagina web', 'página web', 'entrar', 'login',
        'cuenta', 'mi cuenta', 'no puedo acceder'
      ];
      
      if (passwordTriggers.some(trigger => normalizedMessage.includes(trigger))) {
        return await this.handlePasswordReset(from);
      }
      
      // Smart detection for portal-related queries (proactive help)
      const portalKeywords = [
        'descargar', 'bajar', 'ver permiso', 'mi permiso',
        'donde esta mi permiso', 'dónde está mi permiso',
        'como veo mi permiso', 'cómo veo mi permiso',
        'como descargo', 'cómo descargo', 'donde descargo', 'dónde descargo',
        'revisar permiso', 'consultar permiso', 'estado permiso'
      ];
      
      if (portalKeywords.some(keyword => normalizedMessage.includes(keyword)) && 
          !state?.status) { // Only if not in active flow
        await this.sendMessage(from,
          `🌐 *ACCESO AL PORTAL*\n\n` +
          `Para ver y descargar tus permisos:\n` +
          `📱 Sitio: permisosdigitales.com.mx\n\n` +
          `¿Necesitas tu contraseña?\n` +
          `1️⃣ Sí, envíame mi contraseña\n` +
          `2️⃣ Ya tengo acceso\n\n` +
          `Responde con el número:`
        );
        
        await this.stateManager.setState(from, {
          status: 'portal_help_menu',
          source: 'express'
        });
        return;
      }
      
      // Handle portal help menu responses
      if (state?.status === 'portal_help_menu') {
        if (normalizedMessage === '1') {
          await this.stateManager.clearState(from);
          return await this.handlePasswordReset(from);
        } else if (normalizedMessage === '2') {
          await this.stateManager.clearState(from);
          await this.sendMessage(from,
            `✅ Perfecto!\n\n` +
            `Puedes acceder en:\n` +
            `📱 permisosdigitales.com.mx\n\n` +
            `¿Necesitas algo más?\n` +
            `Escribe "ayuda" para ver opciones`
          );
          return;
        } else {
          await this.sendMessage(from,
            `Por favor responde:\n\n` +
            `1️⃣ Sí, envíame mi contraseña\n` +
            `2️⃣ Ya tengo acceso`
          );
          return;
        }
      }

      // Handle field editing (e.g., "3 Toyota")
      const editMatch = message.trim().match(/^(\d+)\s+(.+)$/);
      if (editMatch && state?.status === 'confirming') {
        const fieldNumber = parseInt(editMatch[1]);
        const newValue = editMatch[2].trim();
        return await this.handleFieldEdit(from, fieldNumber, newValue, state);
      }

      // Handle returning user menu
      if (state?.status === 'returning_user_menu') {
        return await this.handleReturningUserMenu(from, message, state);
      }

      // Handle renewal flows
      if (state?.status === 'renewal_selection') {
        return await this.handleRenewalSelection(from, message, state);
      }

      if (state?.status === 'renewal_confirmation') {
        return await this.handleRenewalEdit(from, message, state);
      }
      
      // Handle states
      if (!state || state.status === 'idle') {
        return await this.detectUserAndStart(from);
      }
      
      if (state.status === 'collecting') {
        return await this.collectNextField(from, message, state);
      }
      
      if (state.status === 'confirming') {
        return await this.handleConfirmation(from, message, state);
      }
      
    } catch (error) {
      logger.error('Error in express WhatsApp handler', { error: error.message, from });
      
      // Get current state for contextual error
      const currentState = await this.stateManager.getState(from).catch(() => null);
      const userState = currentState?.status || 'idle';
      
      // Generate contextual error message
      const errorMessage = await errorHandler.generateErrorMessage(
        errorHandler.errorTypes.SYSTEM,
        userState,
        { 
          lastAction: 'message_processing',
          errorDetails: error.message,
          userPhone: from
        }
      );
      
      // Log error for monitoring
      errorHandler.logError(
        errorHandler.errorTypes.SYSTEM,
        userState,
        { errorDetails: error.message, lastAction: 'message_processing' },
        from
      );
      
      await this.sendMessage(from, errorMessage);
    }
  }

  /**
   * Detect if user exists and show appropriate flow
   */
  async detectUserAndStart(from) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(from);
      const userAccountService = require('./user-account.service');
      
      // Check if user exists by WhatsApp phone
      const existingUser = await userAccountService.findByWhatsAppPhone(normalizedPhone);
      
      if (!existingUser) {
        // Brand new user - use current express flow
        logger.info('New user detected - starting express collection', { from: normalizedPhone });
        return await this.startCollection(from);
      }
      
      // Returning user - check their permits
      const permits = await this.getUserPermits(existingUser.id);
      
      if (permits.length === 0) {
        // Has account but no permits - treat as new for better UX
        logger.info('Returning user with no permits - starting collection', { 
          from: normalizedPhone, 
          userId: existingUser.id 
        });
        return await this.startCollectionForExistingUser(from, existingUser);
      }
      
      // Show smart menu for returning users
      logger.info('Returning user with permits - showing menu', { 
        from: normalizedPhone, 
        userId: existingUser.id,
        permitCount: permits.length 
      });
      return await this.showReturningUserMenu(from, existingUser, permits);
      
    } catch (error) {
      logger.error('Error in user detection', { error: error.message, from });
      // Fallback to normal collection
      return await this.startCollection(from);
    }
  }

  /**
   * Show menu for returning users
   */
  async showReturningUserMenu(from, user, permits) {
    // Use user's actual first name, fallback to permit name if needed
    const name = user.first_name || permits[0]?.nombre_completo?.split(' ')[0] || 'Usuario';
    
    await this.sendMessage(from,
      `👋 ¡Hola ${name}!\n\n` +
      `¿Qué necesitas hoy?\n\n` +
      `1️⃣ Nuevo permiso\n` +
      `2️⃣ Renovar permiso\n` +
      `3️⃣ Contraseña para el portal web\n` +
      `4️⃣ Ver mis permisos\n\n` +
      `Responde con el número:`
    );
    
    await this.stateManager.setState(from, {
      status: 'returning_user_menu',
      userId: user.id,
      permits: permits,
      source: 'express'
    });
  }

  /**
   * Handle returning user menu selection
   */
  async handleReturningUserMenu(from, selection, state) {
    const normalizedSelection = selection.trim();
    
    switch(normalizedSelection) {
      case '1':
        // Nuevo permiso - start collection for existing user
        logger.info('Returning user chose new permit', { userId: state.userId });
        return await this.startCollectionForExistingUser(from, { id: state.userId });
        
      case '2':
        // Renovar - show all permits
        logger.info('Returning user chose renewal', { userId: state.userId });
        return await this.showAllPermitsForRenewal(from, state.userId);
        
      case '3':
        // Contraseña - password reset
        logger.info('Returning user chose password reset', { userId: state.userId });
        await this.stateManager.clearState(from);
        return await this.handlePasswordReset(from);
        
      case '4':
        // Ver permisos - show user's permits
        logger.info('Returning user chose to view permits', { userId: state.userId });
        return await this.showUserPermitsList(from, state.userId);
        
      default:
        await this.sendMessage(from,
          `Por favor responde:\n\n` +
          `1️⃣ Nuevo permiso\n` +
          `2️⃣ Renovar permiso\n` +
          `3️⃣ Contraseña para el portal web\n` +
          `4️⃣ Ver mis permisos`
        );
    }
  }

  /**
   * Start collection for existing user (same experience as new users)
   */
  async startCollectionForExistingUser(from, user) {
    // Send the EXACT same enhanced message that first-time users see
    await this.sendMessage(from, 
      `🚗💨 *PERMISO PROVISIONAL URGENTE*\n` +
      `📋 Circular SIN placas, engomado y tarjeta por 30 días\n` +
      `🏛️ Autorizado por Dirección de Tránsito Huitzuco (gobierno oficial)\n\n` +
      `💰 *Precio: $99 pesos*\n` +
      `⏱️ Listo en 3 minutos | 💳 Pago con tarjeta o OXXO\n\n` +
      `🚨 *¿Acabas de comprar tu vehículo?*\n` +
      `✅ No esperes semanas en el tránsito\n` +
      `✅ Circula HOY mismo de forma legal\n\n` +
      `🔒 Datos protegidos y solo para generar permiso oficial\n\n` +
      `👤 Si tienes tu documentación lista, responde con tu *nombre completo* para empezar:\n\n` +
      `💡 Escribe "precio" para más detalles | "salir" para cancelar`
    );
    
    // Set initial state with existing user ID
    await this.stateManager.setState(from, {
      status: 'collecting',
      currentFieldIndex: 0,
      data: {},
      userId: user.id, // Store existing user ID
      startTime: Date.now(),
      source: 'express',
      isReturningUser: true
    });
    
    logger.info('Express collection started for existing user', { from, userId: user.id });
  }

  /**
   * Start immediate data collection
   */
  async startCollection(from) {
    const firstField = this.fields[0];
    
    // Send enhanced messaging with pricing and urgency focus
    await this.sendMessage(from, 
      `🚗💨 *PERMISO PROVISIONAL URGENTE*\n` +
      `📋 Circular SIN placas, engomado y tarjeta por 30 días\n` +
      `🏛️ Autorizado por Dirección de Tránsito Huitzuco (gobierno oficial)\n\n` +
      `💰 *Precio: $99 pesos*\n` +
      `⏱️ Listo en 3 minutos | 💳 Pago con tarjeta o OXXO\n\n` +
      `🚨 *¿Acabas de comprar tu vehículo?*\n` +
      `✅ No esperes semanas en el tránsito\n` +
      `✅ Circula HOY mismo de forma legal\n\n` +
      `🔒 Datos protegidos y solo para generar permiso oficial\n\n` +
      `👤 Si tienes tu documentación lista, responde con tu *nombre completo* para empezar:\n\n` +
      `💡 Escribe "precio" para más detalles | "salir" para cancelar`
    );
    
    // Set initial state
    await this.stateManager.setState(from, {
      status: 'collecting',
      currentFieldIndex: 0,
      data: {},
      startTime: Date.now(),
      source: 'express'
    });
    
    logger.info('Express collection started', { from });
  }

  /**
   * Collect next field in sequence
   */
  async collectNextField(from, input, state) {
    const currentField = this.fields[state.currentFieldIndex];
    const cleanInput = input.trim();
    
    // Validate current field
    if (!currentField.validation(cleanInput)) {
      // Track validation attempt for error context
      state.validationAttempts = state.validationAttempts || {};
      state.validationAttempts[currentField.key] = (state.validationAttempts[currentField.key] || 0) + 1;
      
      // Generate contextual validation error
      const errorMessage = await errorHandler.generateErrorMessage(
        errorHandler.errorTypes.VALIDATION,
        state.status,
        {
          fieldName: currentField.key,
          attemptCount: state.validationAttempts[currentField.key],
          lastInput: cleanInput,
          userPhone: from
        }
      );
      
      // Log validation error for monitoring
      errorHandler.logError(
        errorHandler.errorTypes.VALIDATION,
        state.status,
        {
          fieldName: currentField.key,
          attemptCount: state.validationAttempts[currentField.key],
          lastInput: cleanInput.slice(0, 10) + '...' // Truncate for privacy
        },
        from
      );
      
      await this.sendMessage(from, errorMessage);
      return;
    }
    
    // Save field data (handle optional email and color normalization)
    if (currentField.key === 'email' && (cleanInput.toLowerCase() === 'no' || cleanInput.toLowerCase() === 'ninguno' || cleanInput.trim() === '')) {
      state.data[currentField.key] = null; // Set to null for no email
    } else if (currentField.key === 'color') {
      // Normalize color: convert "rojo/negro" to "rojo y negro"
      let sanitizedColor = cleanInput;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }
      state.data[currentField.key] = sanitizedColor;
    } else {
      state.data[currentField.key] = cleanInput;
    }
    state.currentFieldIndex++;
    
    // Check if we're done collecting
    if (state.currentFieldIndex >= this.fields.length) {
      state.status = 'confirming';
      await this.stateManager.setState(from, state);
      return await this.showConfirmationAndPayment(from, state);
    }
    
    // Get next field
    const nextField = this.fields[state.currentFieldIndex];
    const progress = Math.round((state.currentFieldIndex / this.fields.length) * 100);
    const progressBar = this.getProgressBar(state.currentFieldIndex, this.fields.length);
    
    // Build clean professional message with strategic momentum
    let message = '';
    
    // Strategic momentum at key psychological points only
    if (state.currentFieldIndex === 8) {
      message += `🔥 Casi termina!\n\n`;
    }
    
    message += nextField.prompt;
    
    // Clean step counters and momentum messages
    if (state.currentFieldIndex === 1) {
      message += `\n\nPaso 2 de 10`;
    } else if (state.currentFieldIndex === 5) {
      message += `\n\n⚡ Ya vamos a la mitad!`;
    } else if (state.currentFieldIndex === 8) {
      message += `\n\nPaso 9 de 10`;
    } else if (state.currentFieldIndex === 9) {
      message += `\n\n¡Último paso! 🔥`;
    }
    // Email (2), Car make (3), Car model (4), Year (6), VIN (7) have no counters
    
    await this.sendMessage(from, message);
    await this.stateManager.setState(from, state);
  }

  /**
   * Show all data for confirmation + payment link
   */
  async showConfirmationAndPayment(from, state) {
    try {
      // Create application to get payment link
      await this.sendMessage(from, '⏳ Generando tu solicitud...');
      
      const permitApplicationService = require('./permit-application.service');
      
      // Use existing user ID if available (for returning users)
      const result = await permitApplicationService.createFromWhatsApp(
        from, 
        state.data, 
        state.userId || null
      );
      
      // Create short URL for payment
      const urlShortener = require('./url-shortener.service');
      const shortPaymentUrl = await urlShortener.createShortUrl(result.paymentLink, result.applicationId);
      
      // Build confirmation message with all data
      let confirmationMessage = `✅ CONFIRMA Y PAGA TU PERMISO\n\n📋 TUS DATOS:\n`;
      
      this.fields.forEach((field, index) => {
        const value = state.data[field.key] || 'No especificado';
        confirmationMessage += `${index + 1}. ${value}\n`;
      });
      
      confirmationMessage += `\n━━━━━━━━━━━━━━━━━\n`;
      confirmationMessage += `💳 PAGAR $99 AHORA\n\n`;
      confirmationMessage += `🔗 *LINK DE PAGO SEGURO*\n`;
      confirmationMessage += `${shortPaymentUrl}\n\n`;
      confirmationMessage += `━━━━━━━━━━━━━━━━━\n\n`;
      confirmationMessage += `✏️ ¿Error? Escribe [número] [nuevo valor]\n`;
      confirmationMessage += `Ejemplo: "3 Toyota" para cambiar marca\n\n`;
      confirmationMessage += `🔒 Pago seguro certificado`;
      
      await this.sendMessage(from, confirmationMessage);
      
      // Store payment info for tracking
      state.paymentLink = shortPaymentUrl;
      state.applicationId = result.applicationId;
      
      // Only set reminders if not already set for this session
      if (!state.remindersSet) {
        state.remindersSet = true;
        this.setAbandonedCartReminders(from, shortPaymentUrl);
      }
      
      await this.stateManager.setState(from, state);
      
      logger.info('Payment confirmation sent', { from, applicationId: result.applicationId });
      
    } catch (error) {
      logger.error('Error creating application', { error: error.message, from });
      
      // Determine error type based on error details
      let errorType = errorHandler.errorTypes.SYSTEM;
      if (error.message.includes('ya está registrado')) {
        errorType = errorHandler.errorTypes.VALIDATION;
      } else if (error.message.includes('database') || error.message.includes('sql')) {
        errorType = errorHandler.errorTypes.DATABASE;
      } else if (error.message.includes('Stripe') || error.message.includes('payment')) {
        errorType = errorHandler.errorTypes.PAYMENT;
      }
      
      // Generate contextual error message
      const errorMessage = await errorHandler.generateErrorMessage(
        errorType,
        state.status,
        {
          lastAction: 'creating_application',
          errorDetails: error.message,
          userPhone: from
        }
      );
      
      // Log error for monitoring
      errorHandler.logError(
        errorType,
        state.status,
        { lastAction: 'creating_application', errorDetails: error.message },
        from
      );
      
      // Special handling for duplicate email - allow user to edit
      if (error.message.includes('ya está registrado')) {
        await this.sendMessage(from, errorMessage);
        
        // Set state to edit email field
        state.status = 'collecting';
        state.currentFieldIndex = 2; // Email field
        await this.stateManager.setState(from, state);
      } else {
        await this.sendMessage(from, errorMessage);
      }
    }
  }

  /**
   * Handle field editing by number
   */
  async handleFieldEdit(from, fieldNumber, newValue, state) {
    if (fieldNumber < 1 || fieldNumber > this.fields.length) {
      const errorMessage = await errorHandler.generateErrorMessage(
        errorHandler.errorTypes.USER_INPUT,
        state.status,
        {
          lastInput: `${fieldNumber} ${newValue}`,
          expectedRange: `1-${this.fields.length}`,
          userPhone: from
        }
      );
      
      await this.sendMessage(from, errorMessage);
      return;
    }
    
    const field = this.fields[fieldNumber - 1];
    
    if (!field.validation(newValue)) {
      const errorMessage = await errorHandler.generateErrorMessage(
        errorHandler.errorTypes.VALIDATION,
        state.status,
        {
          fieldName: field.key,
          attemptCount: 1,
          lastInput: newValue,
          isFieldEdit: true,
          userPhone: from
        }
      );
      
      await this.sendMessage(from, errorMessage);
      return;
    }
    
    // Update the field with normalization
    if (field.key === 'color') {
      // Normalize color: convert "rojo/negro" to "rojo y negro"
      let sanitizedColor = newValue;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }
      state.data[field.key] = sanitizedColor;
    } else {
      state.data[field.key] = newValue;
    }
    await this.stateManager.setState(from, state);
    
    await this.sendMessage(from, `✅ Actualizado!`);
    
    // Show confirmation again
    await this.showConfirmationAndPayment(from, state);
  }

  /**
   * Handle any responses during confirmation
   */
  async handleConfirmation(from, message, state) {
    const normalized = message.toLowerCase().trim();
    
    if (normalized === 'reiniciar' || normalized === 'cancelar') {
      await this.stateManager.clearState(from);
      return await this.startCollection(from);
    }
    
    // If not editing, remind about payment (only if payment link exists)
    if (state.paymentLink && state.paymentLink !== 'undefined') {
      await this.sendMessage(from,
        `💳 Para procesar tu permiso:\n\n` +
        `🔗 *LINK DE PAGO SEGURO*\n` +
        `${state.paymentLink}\n\n` +
        `✏️ Para editar: [número] [nuevo valor]`
      );
    } else {
      // No payment link available, offer to restart
      await this.sendMessage(from,
        `❌ Tu sesión ha expirado\n\n` +
        `Para generar un nuevo permiso, escribe:\n` +
        `"necesito permiso urgente"`
      );
    }
  }

  /**
   * Set up abandoned cart recovery reminders
   */
  setAbandonedCartReminders(from, paymentUrl) {
    // First reminder after 2 minutes
    setTimeout(async () => {
      try {
        const currentState = await this.stateManager.getState(from);
        if (currentState?.status === 'confirming') {
          await this.sendMessage(from,
            `⚠️ Tu permiso está listo!\n\n` +
            `💳 Completa el pago:\n` +
            `🔗 *LINK DE PAGO SEGURO*\n` +
            `${paymentUrl}\n\n` +
            `⏰ No lo pierdas - expira pronto`
          );
        }
      } catch (error) {
        logger.error('Error in first abandoned cart reminder', { error: error.message });
      }
    }, 2 * 60 * 1000); // 2 minutes

    // Second reminder after 5 minutes with urgency
    setTimeout(async () => {
      try {
        const currentState = await this.stateManager.getState(from);
        if (currentState?.status === 'confirming') {
          await this.sendMessage(from,
            `🚨 ¡ÚLTIMO AVISO!\n\n` +
            `Tu permiso expira en 5 minutos\n\n` +
            `💳 PAGAR AHORA:\n` +
            `🔗 *LINK DE PAGO SEGURO*\n` +
            `${paymentUrl}\n\n` +
            `⚡ No pierdas todos tus datos`
          );
        }
      } catch (error) {
        logger.error('Error in final abandoned cart reminder', { error: error.message });
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Final cleanup after 10 minutes
    setTimeout(async () => {
      try {
        const currentState = await this.stateManager.getState(from);
        if (currentState?.status === 'confirming') {
          await this.stateManager.clearState(from);
          await this.sendMessage(from,
            `❌ Sesión expirada\n\n` +
            `Tus datos se guardaron por seguridad.\n\n` +
            `💬 Escribe "continuar" para retomar`
          );
        }
      } catch (error) {
        logger.error('Error in cart cleanup', { error: error.message });
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Get social proof message for specific field index
   */
  getSocialProofMessage(fieldIndex) {
    const socialProofMessages = [
      `💬 "Ana de Guadalajara acaba de recibir su permiso"`,
      `🔥 23 personas llenando formulario ahora`,
      `⭐ 4,327 permisos entregados este mes`,
      `💬 "Carlos: Mi permiso llegó en 30 segundos"`,
      `🚗 147 permisos procesados hoy`,
      `💬 "María: Súper fácil y rápido"`,
      `⚡ Promedio de respuesta: 28 segundos`,
      `🏆 +500 clientes satisfechos esta semana`
    ];
    
    // Show social proof at specific fields (4, 7, 9)
    const showAtFields = [4, 7, 9];
    
    if (showAtFields.includes(fieldIndex)) {
      const randomIndex = Math.floor(Math.random() * socialProofMessages.length);
      return socialProofMessages[randomIndex];
    }
    
    return null;
  }

  /**
   * Generate thick line progress bar
   */
  getProgressDots(current, total) {
    const totalBars = 10; // Always show 10 bars for consistency
    const filled = Math.floor((current / total) * totalBars);
    const empty = totalBars - filled;
    return '━'.repeat(filled) + '┅'.repeat(empty);
  }

  /**
   * Generate progress bar (keep for backward compatibility)
   */
  getProgressBar(current, total) {
    const filled = Math.floor((current / total) * 10);
    const empty = 10 - filled;
    return '⬛'.repeat(filled) + '⬜'.repeat(empty);
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(to, text) {
    try {
      const response = await axios.post(this.config.apiUrl, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const messageId = response.data.messages[0].id;
      logger.info('Express WhatsApp message sent', { to, messageId, messageLength: text.length });

      // Log outgoing message for monitoring
      try {
        const userContext = await this.getUserContext(to);
        await whatsappMonitoringService.logOutgoingMessage({
          messageId,
          to,
          messageType: 'text',
          content: text,
          timestamp: new Date().toISOString(),
          status: 'sent',
          userContext
        });
      } catch (monitoringError) {
        logger.error('Error logging outgoing message for monitoring:', monitoringError);
        // Don't fail the main process if monitoring fails
      }

      return response.data;
      
    } catch (error) {
      logger.error('Error sending WhatsApp message', { 
        error: error.message, 
        to, 
        responseData: error.response?.data 
      });
      
      // Log network error for monitoring
      errorHandler.logError(
        errorHandler.errorTypes.NETWORK,
        'messaging',
        { 
          errorDetails: error.message,
          responseData: error.response?.data,
          lastAction: 'sending_message'
        },
        to
      );
      
      throw error;
    }
  }

  /**
   * Get user context for monitoring
   */
  async getUserContext(phoneNumber) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      const state = await this.stateManager.getState(normalizedPhone) || {};

      // Try to find user in database
      let user = null;
      try {
        const db = require('../../db');
        const userQuery = `
          SELECT id, first_name, last_name, account_email, whatsapp_consent_date
          FROM users
          WHERE whatsapp_phone = $1 OR phone = $1
          LIMIT 1
        `;
        const userResult = await db.query(userQuery, [normalizedPhone]);
        user = userResult.rows[0] || null;
      } catch (error) {
        logger.debug('Error fetching user for context:', error);
      }

      return {
        userId: user?.id || state.userId || null,
        userName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null,
        userEmail: user?.account_email || null,
        state: state.status || null,
        intent: state.intent || 'express_flow',
        applicationId: state.applicationId || null,
        hasConsent: !!user?.whatsapp_consent_date,
        consentDate: user?.whatsapp_consent_date || null,
        sessionId: state.sessionId || null,
        source: 'express'
      };
    } catch (error) {
      logger.error('Error getting user context for monitoring:', error);
      return {
        userId: null,
        userName: null,
        userEmail: null,
        state: null,
        intent: 'express_flow',
        applicationId: null,
        hasConsent: false,
        consentDate: null,
        sessionId: null,
        source: 'express'
      };
    }
  }

  /**
   * Normalize phone number to WhatsApp 521 format
   */
  normalizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-numeric characters
    const cleaned = phone.toString().replace(/[^\d]/g, '');
    
    // If already in 521 format, return as-is
    if (cleaned.startsWith('521') && cleaned.length === 13) {
      return cleaned;
    }
    
    // If starts with 52 (10 digits), convert to 521
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      return '521' + cleaned.slice(2);
    }
    
    // If just 10 digits, add 521 prefix
    if (cleaned.length === 10) {
      return '521' + cleaned;
    }
    
    // Return original if can't normalize
    return cleaned;
  }

  /**
   * Get user permits for renewal
   */
  async getUserPermits(userId) {
    try {
      const applicationRepository = require('../../repositories/application.repository');
      
      // Get all permits for this user, ordered by creation date
      const permits = await applicationRepository.findByUserId(userId);
      
      return permits || [];
    } catch (error) {
      logger.error('Error getting user permits', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Show user's permits list (read-only view)
   */
  async showUserPermitsList(from, userId) {
    try {
      const permits = await this.getUserPermits(userId);
      
      if (permits.length === 0) {
        await this.sendMessage(from,
          `📋 *TUS PERMISOS*\n\n` +
          `No tienes permisos registrados aún.\n\n` +
          `¿Quieres crear tu primer permiso?\n` +
          `Escribe "1" para nuevo permiso`
        );
        return;
      }
      
      let message = `📋 *TUS PERMISOS*\n\n`;
      
      permits.forEach((permit, index) => {
        const expiryStatus = this.getExpiryStatus(permit);
        message += `${index + 1}. ID: ${permit.id}\n`;
        message += `   👤 ${permit.nombre_completo}\n`;
        message += `   🚗 ${permit.marca} ${permit.linea}\n`;
        message += `   ${expiryStatus}\n\n`;
      });
      
      message += `🌐 *VER EN PORTAL WEB:*\n`;
      message += `permisosdigitales.com.mx\n\n`;
      message += `¿Necesitas tu contraseña?\n`;
      message += `Escribe "3" para recibirla`;
      
      await this.sendMessage(from, message);
      
      // Don't set any state - let user continue naturally
      
    } catch (error) {
      logger.error('Error showing permits list', { error: error.message, userId });
      await this.sendMessage(from, '❌ Error al cargar tus permisos. Intenta de nuevo.');
    }
  }

  /**
   * Show all permits for renewal selection
   */
  async showAllPermitsForRenewal(from, userId) {
    try {
      const permits = await this.getUserPermits(userId);
      
      if (permits.length === 0) {
        await this.sendMessage(from,
          `❌ No tienes permisos para renovar.\n\n` +
          `¿Quieres crear un nuevo permiso?\n` +
          `Escribe "1" para nuevo permiso`
        );
        return;
      }
      
      let message = `🔄 *RENOVAR PERMISO*\n\n`;
      message += `Selecciona el permiso a renovar:\n\n`;
      
      // Simple, clean list
      permits.forEach((permit, index) => {
        const expiryStatus = this.getExpiryStatus(permit);
        message += `${index + 1}. ID: ${permit.id}\n`;
        message += `   👤 ${permit.nombre_completo}\n`;
        message += `   🚗 ${permit.marca} ${permit.linea}\n`;
        message += `   ${expiryStatus}\n\n`;
      });
      
      message += `Escribe el número (1-${permits.length}):`;
      
      await this.sendMessage(from, message);
      
      await this.stateManager.setState(from, {
        status: 'renewal_selection',
        permits: permits,
        userId: userId,
        source: 'express'
      });
      
    } catch (error) {
      logger.error('Error showing permits for renewal', { error: error.message, userId });
      await this.sendMessage(from, '❌ Error al cargar tus permisos. Intenta de nuevo.');
    }
  }

  /**
   * Get expiry status display
   */
  getExpiryStatus(permit) {
    // Calculate days until expiry based on permit creation date + 30 days
    const expiryDate = new Date(permit.created_at);
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry > 7) {
      return `✅ Vigente (${daysUntilExpiry} días)`;
    } else if (daysUntilExpiry > 0) {
      return `⚠️ Vence en ${daysUntilExpiry} días`;
    } else if (daysUntilExpiry === 0) {
      return `⚠️ Vence hoy`;
    } else if (daysUntilExpiry > -30) {
      return `❌ Venció hace ${Math.abs(daysUntilExpiry)} días`;
    } else {
      return `⛔ Expirado (crear nuevo)`;
    }
  }

  /**
   * Handle renewal selection
   */
  async handleRenewalSelection(from, selection, state) {
    // Defensive check for state and permits
    if (!state || !state.permits || !Array.isArray(state.permits)) {
      logger.error('Invalid state or permits in renewal selection', { 
        from, 
        state: state ? { status: state.status, hasPermits: !!state.permits } : null 
      });
      await this.sendMessage(from, '❌ Error en la sesión. Escribe "permiso" para reiniciar.');
      return;
    }
    
    const selectedIndex = parseInt(selection.trim()) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= state.permits.length) {
      await this.sendMessage(from,
        `Por favor elige un número válido entre 1 y ${state.permits.length}`
      );
      return;
    }
    
    const selectedPermit = state.permits[selectedIndex];
    
    // Show renewal confirmation with immediate payment link
    await this.showRenewalConfirmation(from, selectedPermit, state.userId);
  }

  /**
   * Show renewal confirmation WITH payment link (matching Express flow)
   */
  async showRenewalConfirmation(from, permit, userId) {
    try {
      // Create renewal application IMMEDIATELY
      await this.sendMessage(from, '⏳ Generando tu renovación...');
      
      const renewalData = {
        user_id: userId,
        nombre_completo: permit.nombre_completo,
        curp_rfc: permit.curp_rfc,
        domicilio: permit.domicilio,
        marca: permit.marca,
        linea: permit.linea,
        color: permit.color,
        ano_modelo: permit.ano_modelo,
        numero_motor: permit.numero_motor,
        numero_serie: permit.numero_serie,
        delivery_email: permit.delivery_email || null,
        renewed_from_id: permit.id,
        status: 'AWAITING_PAYMENT',
        importe: 99.00,
        source: 'whatsapp_renewal'
      };
      
      // Create application
      const applicationRepository = require('../../repositories/application.repository');
      const application = await applicationRepository.create(renewalData);
      
      // Create payment link
      const stripeLinkService = require('./stripe-payment-link.service');
      const paymentLink = await stripeLinkService.createCheckoutSession({
        applicationId: application.id,
        amount: 99,
        currency: 'MXN',
        customerEmail: permit.delivery_email || null,
        metadata: {
          renewal: true,
          original_permit_id: permit.id,
          source: 'whatsapp_express_renewal'
        }
      });
      
      // Create short URL
      const urlShortener = require('./url-shortener.service');
      const shortUrl = await urlShortener.createShortUrl(paymentLink.url, application.id);
      
      // Build confirmation message WITH payment link
      let message = `✅ CONFIRMA Y PAGA TU RENOVACIÓN\n\n📋 TUS DATOS:\n`;
      
      message += `1. ${permit.nombre_completo}\n`;
      message += `2. ${permit.curp_rfc}\n`;
      message += `3. ${permit.marca}\n`;
      message += `4. ${permit.linea}\n`;
      message += `5. ${permit.color}\n`;
      message += `6. ${permit.ano_modelo}\n`;
      message += `7. ${permit.numero_serie}\n`;
      message += `8. ${permit.numero_motor}\n`;
      message += `9. ${permit.domicilio}\n`;
      message += `10. ${permit.delivery_email || 'Sin email'}\n\n`;
      
      message += `━━━━━━━━━━━━━━━━━\n`;
      message += `💳 PAGAR $99 AHORA\n\n`;
      message += `🔗 *LINK DE PAGO SEGURO*\n`;
      message += `${shortUrl}\n\n`;
      message += `━━━━━━━━━━━━━━━━━\n\n`;
      message += `✏️ ¿Error? Escribe [número] [nuevo valor]\n`;
      message += `Ejemplo: "5 Azul" para cambiar color\n\n`;
      message += `🔒 Pago seguro certificado`;
      
      await this.sendMessage(from, message);
      
      // Store state for editing
      await this.stateManager.setState(from, {
        status: 'renewal_confirmation',
        applicationId: application.id,
        paymentLink: shortUrl,
        permitData: { ...permit },
        userId: userId,
        remindersSet: true, // Set flag to prevent duplicate reminders
        source: 'express'
      });
      
      // Set abandoned cart reminders for renewal
      this.setAbandonedCartReminders(from, shortUrl);
      
    } catch (error) {
      logger.error('Error creating renewal', { 
        error: error.message, 
        stack: error.stack,
        permitId: permit?.id,
        userId 
      });
      
      // Provide more specific error messages
      let errorMessage = '❌ Error generando renovación.';
      
      if (error.message.includes('Stripe')) {
        errorMessage += '\n\n💳 Error al crear link de pago. Intenta de nuevo.';
      } else if (error.message.includes('database') || error.message.includes('sql')) {
        errorMessage += '\n\n📄 Error guardando datos. Intenta de nuevo.';
      } else {
        errorMessage += '\n\nIntenta de nuevo o visita:\n🌐 permisosdigitales.com.mx';
      }
      
      await this.sendMessage(from, errorMessage);
    }
  }

  /**
   * Handle renewal edit (same as Express edit flow)
   */
  async handleRenewalEdit(from, input, state) {
    // Parse field edit: "5 Azul"
    const editMatch = input.match(/^(\d+)\s+(.+)$/);
    
    if (!editMatch) {
      // Not an edit, remind about payment
      return await this.sendMessage(from,
        `💳 Para procesar tu renovación:\n\n` +
        `🔗 *LINK DE PAGO SEGURO*\n` +
        `${state.paymentLink}\n\n` +
        `✏️ Para editar: [número] [nuevo valor]`
      );
    }
    
    const fieldNumber = parseInt(editMatch[1]);
    const newValue = editMatch[2].trim();
    
    // Map field numbers to keys
    const fieldMap = {
      1: 'nombre_completo',
      2: 'curp_rfc',
      3: 'marca',
      4: 'linea',
      5: 'color',
      6: 'ano_modelo',
      7: 'numero_serie',
      8: 'numero_motor',
      9: 'domicilio',
      10: 'delivery_email'
    };
    
    const fieldKey = fieldMap[fieldNumber];
    
    if (!fieldKey) {
      return await this.sendMessage(from,
        `❌ Número inválido. Usa 1-10\n` +
        `Ejemplo: "5 Azul" para cambiar color`
      );
    }
    
    // Apply color normalization if needed
    let finalValue = newValue;
    if (fieldKey === 'color') {
      // Normalize color: convert "rojo/negro" to "rojo y negro"
      if (finalValue && (finalValue.includes('/') || finalValue.includes('\\'))) {
        finalValue = finalValue.replace(/[\/\\]/g, ' y ');
      }
    }
    
    // Update the APPLICATION in database
    const applicationRepository = require('../../repositories/application.repository');
    await applicationRepository.update(state.applicationId, {
      [fieldKey]: finalValue
    });
    
    // Update local state
    state.permitData[fieldKey] = finalValue;
    await this.stateManager.setState(from, state);
    
    await this.sendMessage(from, `✅ Actualizado!`);
    
    // Re-show the confirmation with payment link
    await this.showUpdatedRenewalConfirmation(from, state);
  }

  /**
   * Show updated renewal confirmation
   */
  async showUpdatedRenewalConfirmation(from, state) {
    const permit = state.permitData;
    
    let message = `✅ CONFIRMA Y PAGA TU RENOVACIÓN\n\n📋 TUS DATOS:\n`;
    
    message += `1. ${permit.nombre_completo}\n`;
    message += `2. ${permit.curp_rfc}\n`;
    message += `3. ${permit.marca}\n`;
    message += `4. ${permit.linea}\n`;
    message += `5. ${permit.color}\n`;
    message += `6. ${permit.ano_modelo}\n`;
    message += `7. ${permit.numero_serie}\n`;
    message += `8. ${permit.numero_motor}\n`;
    message += `9. ${permit.domicilio}\n`;
    message += `10. ${permit.delivery_email || 'Sin email'}\n\n`;
    
    message += `━━━━━━━━━━━━━━━━━\n`;
    message += `💳 PAGAR $99 AHORA\n\n`;
    message += `🔗 *LINK DE PAGO SEGURO*\n`;
    message += `${state.paymentLink}\n\n`;
    message += `━━━━━━━━━━━━━━━━━\n\n`;
    message += `✏️ ¿Error? Escribe [número] [nuevo valor]\n`;
    message += `Ejemplo: "9 Calle Nueva 123" para cambiar domicilio\n\n`;
    message += `🔒 Pago seguro certificado`;
    
    await this.sendMessage(from, message);
  }

  /**
   * Show simple help message for Express service
   */
  async showSimpleHelp(from) {
    await this.sendMessage(from,
      `📚 *AYUDA RÁPIDA*\n\n` +
      `🚗 *PROCESO EXPRESS:*\n` +
      `• 10 datos del vehículo\n` +
      `• Confirmación\n` +
      `• Pago de $99\n` +
      `• Permiso listo en minutos\n\n` +
      `🔑 *COMANDOS ÚTILES:*\n` +
      `• *"contraseña"* - Nueva contraseña para el portal web\n` +
      `• *"cancelar"* - Cancelar proceso actual\n` +
      `• *"ayuda"* - Mostrar esta ayuda\n\n` +
      `🌐 *PORTAL WEB:*\n` +
      `permisosdigitales.com.mx\n\n` +
      `📞 *SOPORTE:*\n` +
      `📧 contacto@permisosdigitales.com.mx\n` +
      `💬 WhatsApp: +52 55 4943 0313`
    );
  }

  /**
   * Handle password reset request from WhatsApp
   */
  async handlePasswordReset(from) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(from);
      
      // Find user by WhatsApp phone
      const userAccountService = require('./user-account.service');
      const user = await userAccountService.findByWhatsAppPhone(normalizedPhone);
      
      if (!user) {
        await this.sendMessage(from,
          `❌ *NO ENCONTRADO*\n\n` +
          `No encontramos una cuenta con este número.\n\n` +
          `💡 *OPCIONES:*\n` +
          `• Crea tu cuenta: permisosdigitales.com.mx\n` +
          `• Solicita un permiso escribiendo "permiso"\n\n` +
          `❓ ¿Necesitas ayuda? Escribe /ayuda`
        );
        return;
      }

      // Check if user has account_email for web portal access
      if (!user.account_email) {
        await this.sendMessage(from,
          `⚠️ *CUENTA SIN EMAIL*\n\n` +
          `Hola ${user.first_name}!\n\n` +
          `Tu cuenta de WhatsApp no tiene email asociado.\n\n` +
          `💡 *PARA ACCESO WEB:*\n` +
          `Regístrate en permisosdigitales.com.mx con tu número de teléfono para vincular tu cuenta.\n\n` +
          `📱 Puedes seguir usando WhatsApp para tus permisos.\n\n` +
          `❓ ¿Necesitas ayuda? Escribe /ayuda`
        );
        return;
      }

      // Generate new memorable password
      const words = ['Solar', 'Luna', 'Cielo', 'Mar', 'Monte', 'Rio', 'Viento', 'Fuego', 'Tierra', 'Agua'];
      const word1 = words[Math.floor(Math.random() * words.length)];
      const word2 = words[Math.floor(Math.random() * words.length)];
      const num1 = Math.floor(Math.random() * 900) + 100;
      const num2 = Math.floor(Math.random() * 900) + 100;
      const newPassword = `${word1}-${num1}-${word2}-${num2}`;

      // Hash and update password
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(newPassword, 10);

      const db = require('../../db');
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, user.id]
      );

      // Log security event
      const { logger } = require('../../utils/logger');
      logger.info('Password reset via WhatsApp', {
        userId: user.id,
        phoneNumber: normalizedPhone,
        accountEmail: user.account_email
      });

      // Send new password via WhatsApp
      const whatsappNotificationService = require('../whatsapp-notification.service');
      await whatsappNotificationService.sendPasswordReset(
        from,
        user.first_name,
        newPassword
      );

      // Also send email notification if possible
      if (user.account_email) {
        try {
          const emailService = require('../email.service');
          
          const emailContent = `
            <h2>🔑 Contraseña Restablecida</h2>
            
            <p>Hola ${user.first_name},</p>
            
            <p>Tu contraseña fue restablecida desde WhatsApp.</p>
            
            <h3>📱 Nueva contraseña:</h3>
            <p><strong>${newPassword}</strong></p>
            
            <h3>🔐 Acceso:</h3>
            <ul>
              <li><strong>Sitio:</strong> <a href="https://permisosdigitales.com.mx">permisosdigitales.com.mx</a></li>
              <li><strong>Usuario:</strong> ${user.account_email} o ${user.whatsapp_phone}</li>
              <li><strong>Contraseña:</strong> ${newPassword}</li>
            </ul>
            
            <p>⚠️ <strong>Recomendación:</strong> Cambia tu contraseña al iniciar sesión.</p>
            
            <p>Si no solicitaste este cambio, contáctanos inmediatamente.</p>
            
            <p>Saludos,<br>
            El equipo de Permisos Digitales</p>
          `;
          
          await emailService.sendEmail({
            to: user.account_email,
            subject: '🔑 Contraseña Restablecida - Permisos Digitales',
            html: emailContent,
            text: emailContent.replace(/<[^>]*>/g, '')
          });
          
          logger.info('Password reset email sent', {
            userId: user.id,
            email: user.account_email
          });
          
        } catch (emailError) {
          logger.error('Error sending password reset email', {
            error: emailError.message,
            userId: user.id,
            email: user.account_email
          });
          // Don't fail if email fails - WhatsApp notification is primary
        }
      }

      logger.info('WhatsApp password reset completed', {
        userId: user.id,
        phoneNumber: normalizedPhone,
        hasEmail: !!user.account_email
      });

    } catch (error) {
      const { logger } = require('../../utils/logger');
      logger.error('Error in WhatsApp password reset', {
        error: error.message,
        stack: error.stack,
        phoneNumber: from
      });

      // Generate contextual error message for password reset failure
      const errorMessage = await errorHandler.generateErrorMessage(
        errorHandler.errorTypes.SYSTEM,
        'password_reset',
        {
          lastAction: 'password_reset',
          errorDetails: error.message,
          userPhone: from
        }
      );
      
      // Log error for monitoring
      errorHandler.logError(
        errorHandler.errorTypes.SYSTEM,
        'password_reset', 
        { lastAction: 'password_reset', errorDetails: error.message },
        from
      );

      await this.sendMessage(from, errorMessage);
    }
  }
}

module.exports = ExpressWhatsAppService;
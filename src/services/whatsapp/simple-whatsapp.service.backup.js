/**
 * Simple WhatsApp Service for Permisos Digitales
 * No AI, just pattern matching and linear flow
 */

const { logger } = require('../../utils/logger');
const redisClient = require('../../utils/redis-client');
const db = require('../../db');
const securityUtils = require('./security-utils');
const StateManager = require('./state-manager');
const ErrorRecovery = require('./error-recovery');
const MessageFormatter = require('./message-formatter');
const HealthMonitor = require('./health-monitor');

class SimpleWhatsAppService {
  constructor() {
    // Configuration management
    this._config = null;
    this._configInitialized = false;
    this._configInitializing = false;
    
    // State management
    this.stateManager = new StateManager();
    
    // Error recovery system
    this.errorRecovery = new ErrorRecovery(this.stateManager, this);
    
    // Message formatter for consistent styling
    this.formatter = new MessageFormatter();
    
    // Health monitoring system (initialized after other components)
    this.healthMonitor = null;
    
    // Rate limiter to prevent spam
    this.rateLimiter = new Map();
    this.rateLimitNotified = new Map(); // Track who we've notified
    this.RATE_LIMIT_MAX = 20; // Max messages per minute (increased for form completion)
    this.RATE_LIMIT_WINDOW = 60000; // 1 minute
    
    // Periodic cleanup to prevent memory leaks
    this.rateLimiterCleanupInterval = setInterval(() => {
      this.cleanRateLimiter();
    }, 5 * 60000); // Clean every 5 minutes
    
    // In-memory state fallback for Redis failures (deprecated - use stateManager)
    this.memoryStateCache = new Map();
    
    // Input limits
    this.MAX_INPUT_LENGTH = 500;
    this.MAX_FIELD_LENGTHS = {
      nombre_completo: 255,
      curp_rfc: 50,
      domicilio: 500,
      email: 255,
      marca: 100,
      linea: 100,
      color: 50,
      numero_serie: 50,
      numero_motor: 50,
      ano_modelo: 4
    };
    
    // Enhanced commands - now with numbered options and natural language
    this.commands = {
      // Slash commands (keep for backwards compatibility)
      '/permiso': 'startOrResumeApplication',
      '/estado': 'checkStatus',
      '/pagar': 'getPaymentLinks',
      '/mis-permisos': 'listUserPermits',
      '/renovar': 'renewPermit',
      '/ayuda': 'sendContextualHelp',
      '/cancelar': 'cancelCurrent',
      // Natural language and greetings
      'hola': 'handleGreeting',
      'inicio': 'handleGreeting',
      'menu': 'handleGreeting',
      'menú': 'handleGreeting',
      'ayuda': 'sendContextualHelp',
      'help': 'sendContextualHelp',
      'necesito ayuda': 'sendContextualHelp',
      'no entiendo': 'sendContextualHelp',
      // Numbered options
      '1': 'handleNumberedOption',
      '2': 'handleNumberedOption',
      '3': 'handleNumberedOption',
      '4': 'handleNumberedOption',
      '5': 'handleNumberedOption',
      '6': 'handleNumberedOption',
      // Action phrases
      'nuevo permiso': 'startOrResumeApplication',
      'solicitar permiso': 'startOrResumeApplication',
      'quiero un permiso': 'startOrResumeApplication',
      'necesito permiso': 'startOrResumeApplication',
      'ver estado': 'checkStatus',
      'como voy': 'checkStatus',
      'mi solicitud': 'checkStatus',
      'pagar': 'getPaymentLinks',
      'hacer pago': 'getPaymentLinks',
      'link de pago': 'getPaymentLinks',
      'mis permisos': 'listUserPermits',
      'ver permisos': 'listUserPermits',
      'renovar': 'renewPermit',
      'renovar permiso': 'renewPermit',
      'cancelar': 'cancelCurrent',
      'reiniciar': 'cancelCurrent',
      // Opt-out
      'stop': 'handleOptOut',
      'baja': 'handleOptOut',
      'detener': 'handleOptOut',
      'cancelar suscripcion': 'handleOptOut',
      'no mas mensajes': 'handleOptOut'
    };
    
    // Define the fields we need in order
    this.fields = [
      { 
        key: 'nombre_completo', 
        label: 'Nombre completo',
        prompt: '👤 ¿Cómo te llamas? (nombre y apellidos)', 
        type: 'text',
        help: 'Escribe tu nombre completo tal como aparece en tu identificación oficial. Ejemplo: Juan Pérez González'
      },
      { 
        key: 'curp_rfc', 
        label: 'CURP o RFC',
        prompt: '📄 ¿Cuál es tu CURP o RFC?\n\nEjemplo CURP: GOMJ880326HDFRRL09\nEjemplo RFC: GOMJ880326A01', 
        type: 'curp_rfc',
        help: 'Puedes usar CURP (18 caracteres) o RFC (13 caracteres). Lo encuentras en tu INE, acta de nacimiento o constancia del SAT.'
      },
      { 
        key: 'domicilio', 
        label: 'Domicilio',
        prompt: '🏠 ¿Cuál es tu domicilio completo?\n\nIncluye calle, número, colonia, ciudad y código postal', 
        type: 'text',
        help: 'Ejemplo: Av. Reforma 123, Col. Centro, Monterrey, NL, 64000. Este será el domicilio que aparecerá en tu permiso.'
      },
      { 
        key: 'email', 
        label: 'Correo electrónico',
        prompt: '📧 ¿Cuál es tu correo electrónico?\n\nAquí te enviaremos tu permiso', 
        type: 'email',
        help: 'Asegúrate de escribirlo correctamente. Aquí recibirás tu permiso y el comprobante de pago. Ejemplo: juan.perez@gmail.com'
      },
      { 
        key: 'marca', 
        label: 'Marca del vehículo',
        prompt: '🚗 Ahora vamos con tu vehículo!\n\n¿Qué marca es? (Ej: Toyota, Nissan, Ford)', 
        type: 'text',
        help: 'La marca es el fabricante del vehículo. Ejemplos: Toyota, Nissan, Chevrolet, Ford, Volkswagen, Honda, Mazda.'
      },
      { 
        key: 'linea', 
        label: 'Modelo/Línea',
        prompt: '📋 ¿Qué modelo es?\n\nEj: Corolla, Sentra, F-150', 
        type: 'text',
        help: 'El modelo o línea es el nombre específico del vehículo. Lo encuentras en la parte trasera del auto o en tu tarjeta de circulación.'
      },
      { 
        key: 'color', 
        label: 'Color',
        prompt: '🎨 ¿De qué color es tu vehículo?\n\n💡 Si tiene varios colores, sepáralos con "y"\nEj: Rojo y Negro', 
        type: 'color',
        help: 'Si tu vehículo tiene dos colores, escríbelos separados con "y". Ejemplo: Blanco y Azul, Gris y Negro.'
      },
      { 
        key: 'numero_serie', 
        label: 'Número de serie (VIN)',
        prompt: '🔢 ¿Cuál es el número de serie (VIN)?\n\nSon 17 caracteres, generalmente empieza con letras\nEj: 3VWFE21C04M123456', 
        type: 'vin',
        help: 'El VIN tiene 17 caracteres (letras y números). Lo encuentras en el parabrisas del lado del conductor, en la puerta del conductor o en tu tarjeta de circulación.'
      },
      { 
        key: 'numero_motor', 
        label: 'Número de motor',
        prompt: '⚙️ ¿Cuál es el número de motor?\n\nLo encuentras en el motor o en tu tarjeta de circulación', 
        type: 'numero_motor',
        help: 'Está grabado en el motor o en tu tarjeta de circulación. Es diferente al VIN. Ejemplo: 4G63S4M123456'
      },
      { 
        key: 'ano_modelo', 
        label: 'Año del vehículo',
        prompt: '📅 Por último, ¿de qué año es tu vehículo?', 
        type: 'year',
        help: 'Solo escribe el año en 4 dígitos. Ejemplo: 2015, 2020, 2023. Lo encuentras en tu tarjeta de circulación o factura.'
      }
    ];
    
    // Common colors in Spanish
    this.colors = ['blanco', 'negro', 'gris', 'plata', 'rojo', 'azul', 'verde', 
                   'amarillo', 'naranja', 'cafe', 'marron', 'dorado', 'beige'];
    
    // Common car brands
    this.brands = ['toyota', 'nissan', 'chevrolet', 'ford', 'volkswagen', 'honda', 
                   'mazda', 'hyundai', 'kia', 'bmw', 'mercedes', 'audi'];
  }

  /**
   * Validate configuration at startup
   */
  static validateConfig() {
    const required = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required WhatsApp configuration: ${missing.join(', ')}`);
    }
    
    logger.info('WhatsApp configuration validated successfully');
  }
  
  /**
   * Validate configuration with comprehensive runtime checks
   */
  async validateConfig(config) {
    const validationResults = {
      passed: [],
      warnings: [],
      errors: []
    };

    // Basic field validation
    if (!config.phoneNumberId || !config.accessToken || !config.apiUrl) {
      validationResults.errors.push('Missing required fields: phoneNumberId, accessToken, or apiUrl');
    } else {
      validationResults.passed.push('Required fields present');
    }
    
    // Validate phone number ID format
    if (config.phoneNumberId) {
      if (!/^\d+$/.test(config.phoneNumberId)) {
        validationResults.errors.push('Invalid phone number ID format - must be numeric');
      } else if (config.phoneNumberId.length < 10) {
        validationResults.warnings.push('Phone number ID seems too short - may be invalid');
      } else {
        validationResults.passed.push('Phone number ID format valid');
      }
    }
    
    // Validate access token format
    if (config.accessToken) {
      if (config.accessToken.length < 50) {
        validationResults.errors.push('Access token too short - likely invalid');
      } else if (config.accessToken.length > 500) {
        validationResults.warnings.push('Access token unusually long');
      } else if (!/^[A-Za-z0-9_-]+$/.test(config.accessToken)) {
        validationResults.warnings.push('Access token contains unexpected characters');
      } else {
        validationResults.passed.push('Access token format valid');
      }
    }
    
    // Validate API URL format
    if (config.apiUrl) {
      if (!config.apiUrl.startsWith('https://graph.facebook.com/')) {
        validationResults.errors.push('Invalid API URL - must use Facebook Graph API');
      } else if (!config.apiUrl.includes('/messages')) {
        validationResults.errors.push('Invalid API URL - must be a messages endpoint');
      } else {
        validationResults.passed.push('API URL format valid');
      }
    }

    // Environment-specific validations
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      // Production-specific validations
      if (config.accessToken && config.accessToken.includes('test')) {
        validationResults.warnings.push('Using test token in production environment');
      }
      
      if (config.apiUrl && config.apiUrl.includes('test')) {
        validationResults.warnings.push('Using test API URL in production environment');
      }
      
      validationResults.passed.push('Production environment checks completed');
    } else {
      validationResults.passed.push('Development environment detected');
    }

    // Check for common configuration issues
    if (config.phoneNumberId && config.apiUrl && !config.apiUrl.includes(config.phoneNumberId)) {
      validationResults.warnings.push('Phone number ID mismatch in API URL');
    }

    // Runtime connectivity validation (optional)
    try {
      await this.validateConnectivity(config);
      validationResults.passed.push('Connectivity validation passed');
    } catch (error) {
      validationResults.warnings.push(`Connectivity check failed: ${error.message}`);
    }

    // Log validation results
    if (validationResults.errors.length > 0) {
      logger.error('Configuration validation failed', {
        errors: validationResults.errors,
        warnings: validationResults.warnings,
        passed: validationResults.passed.length
      });
      throw new Error(`Configuration validation failed: ${validationResults.errors.join(', ')}`);
    }

    if (validationResults.warnings.length > 0) {
      logger.warn('Configuration validation completed with warnings', {
        warnings: validationResults.warnings,
        passed: validationResults.passed.length
      });
    } else {
      logger.info('Configuration validation passed', {
        phoneNumberId: config.phoneNumberId,
        apiUrl: config.apiUrl,
        tokenLength: config.accessToken.length,
        checksCompleted: validationResults.passed.length
      });
    }

    return validationResults;
  }

  /**
   * Validate connectivity to WhatsApp API
   */
  async validateConnectivity(config) {
    // Basic connectivity test - just check if we can reach the API
    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${config.phoneNumberId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        },
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      return true;
    } catch (error) {
      // Don't fail validation for connectivity issues, just warn
      throw new Error(`Connectivity test failed: ${error.message}`);
    }
  }
  
  /**
   * Initialize configuration once during startup
   */
  async initializeConfig() {
    if (this._configInitialized) {
      return this._config;
    }
    
    if (this._configInitializing) {
      // Wait for ongoing initialization to complete
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this._configInitialized) {
            clearInterval(checkInterval);
            resolve(this._config);
          } else if (!this._configInitializing) {
            clearInterval(checkInterval);
            reject(new Error('Configuration initialization failed'));
          }
        }, 50);
      });
    }
    
    this._configInitializing = true;
    
    try {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      
      if (!phoneNumberId || !accessToken) {
        throw new Error('WhatsApp configuration missing: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are required');
      }
      
      this._config = {
        phoneNumberId,
        accessToken,
        apiUrl: `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`
      };
      
      // Validate configuration
      await this.validateConfig(this._config);
      
      this._configInitialized = true;
      this._configInitializing = false;
      
      logger.info('WhatsApp configuration initialized', {
        phoneNumberId: this._config.phoneNumberId,
        hasAccessToken: !!this._config.accessToken,
        apiUrl: this._config.apiUrl,
        tokenPreview: accessToken.substring(0, 20) + '...'
      });
      
      return this._config;
      
    } catch (error) {
      this._configInitializing = false;
      logger.error('Failed to initialize WhatsApp configuration', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get configuration (initialized once)
   */
  getConfig() {
    if (!this._configInitialized) {
      throw new Error('Configuration not initialized. Call initializeConfig() first.');
    }
    
    return this._config;
  }

  /**
   * Reload configuration (for token updates)
   */
  async reloadConfig() {
    logger.info('Reloading WhatsApp configuration');
    this._configInitialized = false;
    this._config = null;
    return await this.initializeConfig();
  }

  /**
   * Initialize health monitoring
   */
  initializeHealthMonitoring() {
    if (!this.healthMonitor) {
      this.healthMonitor = new HealthMonitor(this);
      logger.info('Health monitoring initialized');
    }
    return this.healthMonitor;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    if (!this.healthMonitor) {
      return { status: 'not_initialized', message: 'Health monitoring not initialized' };
    }
    return this.healthMonitor.getCurrentHealth();
  }

  /**
   * Get detailed health report
   */
  getDetailedHealthReport() {
    if (!this.healthMonitor) {
      return { error: 'Health monitoring not initialized' };
    }
    return this.healthMonitor.getDetailedHealthReport();
  }

  /**
   * Validate current configuration (for runtime checks)
   */
  async validateCurrentConfig() {
    if (!this._configInitialized) {
      throw new Error('Configuration not initialized');
    }
    
    return await this.validateConfig(this._config);
  }

  /**
   * Get configuration validation status
   */
  async getConfigValidationStatus() {
    try {
      const validationResults = await this.validateCurrentConfig();
      return {
        status: 'valid',
        errors: validationResults.errors.length,
        warnings: validationResults.warnings.length,
        passed: validationResults.passed.length,
        details: validationResults
      };
    } catch (error) {
      return {
        status: 'invalid',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Process incoming message with comprehensive error handling
   */
  async processMessage(from, message) {
    const startTime = Date.now();
    
    try {
      // Initial validation and sanitization
      const sanitizedMessage = await this.validateAndSanitizeInput(from, message);
      if (!sanitizedMessage) return;
      
      // Store last message for numbered option handling
      this.lastMessageReceived = sanitizedMessage;
      
      // Handle global commands first
      if (await this.handleGlobalCommands(from, sanitizedMessage)) {
        return;
      }
      
      // Get user context and current state
      const context = await this.getUserContext(from);
      const state = await this.stateManager.getState(from);
      
      // Route to appropriate handler
      await this.routeMessage(from, sanitizedMessage, context, state);
      
      // Record processing time
      const processingTime = Date.now() - startTime;
      if (this.healthMonitor) {
        this.healthMonitor.recordMessageProcessingTime(processingTime);
      }
      
    } catch (error) {
      // Record error
      if (this.healthMonitor) {
        this.healthMonitor.recordError('message_processing', from);
      }
      
      await this.errorRecovery.handleError(from, error, {
        message: sanitizedMessage,
        method: 'processMessage'
      });
    }
  }

  /**
   * Validate and sanitize incoming message
   */
  async validateAndSanitizeInput(from, message) {
    // Check if user has opted out
    if (await this.isOptedOut(from)) {
      logger.info(`Opted out user attempted to message: ${from}`);
      await this.sendMessage(from, 
        '🚫 Tu número está dado de baja del servicio WhatsApp.\n\n' +
        'Para reactivar el servicio, por favor visita:\n' +
        'https://permisosdigitales.com.mx/perfil'
      );
      return null;
    }
    
    // Rate limiting check
    if (!await this.checkRateLimit(from)) {
      return null;
    }
    
    // Check for duplicate messages
    if (securityUtils.isDuplicateMessage(from, message)) {
      logger.info('Duplicate message ignored', { from });
      return null;
    }
    
    // Sanitize input
    const sanitizedMessage = this.sanitizeInput(message);
    if (!sanitizedMessage) {
      await this.sendMessage(from, '❌ Mensaje inválido. Por favor intenta de nuevo.');
      return null;
    }
    
    return sanitizedMessage;
  }

  /**
   * Handle global commands that work regardless of state
   */
  async handleGlobalCommands(from, sanitizedMessage) {
    const msgLower = sanitizedMessage.toLowerCase().trim();
    const stateKey = `wa:${from}`;
    
    // Check for global commands first (before checking state)
    if (msgLower === "/ayuda" || msgLower === "/permiso" || msgLower === "/reset" || msgLower === "/cancelar") {
      // Clear any existing state for reset command
      if (msgLower === "/reset" || msgLower === "/cancelar") {
        await this.stateManager.clearState(from);
      }
      
      // Handle commands
      if (msgLower === "/ayuda") {
        await this.sendHelp(from, await this.getUserContext(from));
        return true;
      } else if (msgLower === "/permiso") {
        await this.startPermitApplication(from);
        return true;
      } else if (msgLower === "/reset" || msgLower === "/cancelar") {
        await this.sendMessage(from, "✅ Conversación reiniciada. ¿En qué puedo ayudarte?");
        await this.sendWelcomeMessage(from);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Route message to appropriate handler based on context and state
   */
  async routeMessage(from, sanitizedMessage, context, state) {
    // If we have an active state, process it directly
    if (state) {
      await this.handleStateBasedMessage(from, sanitizedMessage, state);
      return;
    }
    
    // No active state - handle based on context
    await this.handleContextBasedMessage(from, sanitizedMessage, context);
  }

  /**
   * Handle messages when user has an active state
   */
  async handleStateBasedMessage(from, sanitizedMessage, state) {
    // Process confirmation
    if (state.status === 'confirming') {
      await this.handleConfirmation(from, sanitizedMessage, state);
      return;
    }
    
    // Handle field editing
    if (state.status === 'editing_field') {
      await this.handleFieldEditing(from, sanitizedMessage, state);
      return;
    }
    
    // Handle field collection
    if (state.status === 'collecting') {
      await this.handleFieldCollection(from, sanitizedMessage, state);
      return;
    }
    
    // Handle resume confirmation
    if (state.status === 'awaiting_resume_confirmation') {
      await this.handleResumeConfirmation(from, sanitizedMessage, state);
      return;
    }
  }

  /**
   * Handle field editing process
   */
  async handleFieldEditing(from, sanitizedMessage, state) {
    const fieldInfo = this.fields.find(f => f.key === state.editingField);
    const sanitizedValue = this.sanitizeFieldValue(sanitizedMessage, state.editingField);
    const value = this.extractField(sanitizedValue, fieldInfo.type);
    
    if (!value) {
      const example = this.getFieldExample(fieldInfo.type);
      const helpText = example ? `\n\n${example}` : '';
      await this.sendMessage(from, 
        `❌ Formato inválido.${helpText}\n\n${fieldInfo.prompt}`
      );
      return;
    }
    
    const validation = this.validateField(state.editingField, value);
    if (!validation.isValid) {
      const example = this.getFieldExample(fieldInfo.type);
      const helpText = example ? `\n\n${example}` : '';
      await this.sendMessage(from, 
        `❌ ${validation.error}${helpText}\n\n${fieldInfo.prompt}`
      );
      return;
    }
    
    // Update the field and go back to confirmation
    state.data[state.editingField] = validation.sanitized || value;
    state.status = 'confirming';
    delete state.editingField;
    
    await this.stateManager.setState(from, state);
    await this.showConfirmation(from, state);
  }

  /**
   * Handle processing errors
   */
  async handleProcessingError(from, error) {
    logger.error('Error processing WhatsApp message', { 
      error: error.message, 
      stack: error.stack, 
      from 
    });
    
    try {
      await this.sendMessage(from, 
        '❌ Error temporal. Tu progreso está guardado.\n\n' +
        'Por favor intenta en unos minutos o contacta soporte.'  
      );
    } catch (sendError) {
      logger.error('Failed to send error message', { error: sendError.message });
    }
  }

  /**
   * Handle messages when no active state exists
   */
  async handleContextBasedMessage(from, sanitizedMessage, context) {
    const msgLower = sanitizedMessage.toLowerCase().trim();
    
    // Check for commands first
    const command = this.commands[msgLower];
    if (command) {
      // For numbered options, we need to pass the message
      if (command === 'handleNumberedOption') {
        await this.handleNumberedOption(from, context, msgLower);
      } else {
        await this[command](from, context);
      }
      return;
    }
    
    // Handle based on user context
    if (context.status === 'PENDING_PAYMENT') {
      await this.handlePendingPaymentContext(from, sanitizedMessage, context);
      return;
    }
    
    if (context.status === 'INCOMPLETE_APPLICATION') {
      await this.handleIncompleteContext(from, sanitizedMessage, context);
      return;
    }
    
    if (context.status === 'INCOMPLETE_SESSION') {
      await this.handleIncompleteSessionContext(from, sanitizedMessage, context);
      return;
    }
    
    // Default: show welcome message
    await this.sendWelcomeMessage(from, context);
  }

  /**
   * Handle field collection process
   */
  async handleFieldCollection(from, sanitizedMessage, state) {
    const msgLower = sanitizedMessage.toLowerCase().trim();
    
    // Check if user typed a menu number (1-6) - offer to switch context
    if (/^[1-6]$/.test(msgLower)) {
      const menuOptions = {
        '1': 'Solicitar nuevo permiso',
        '2': 'Ver estado de mi solicitud',
        '3': 'Realizar un pago pendiente', 
        '4': 'Ver mis permisos anteriores',
        '5': 'Renovar un permiso',
        '6': 'Necesito ayuda'
      };
      
      const selectedOption = menuOptions[msgLower];
      const completedFields = Object.keys(state.data || {}).length;
      
      // If they selected option 1 and are already filling a form, continue
      if (msgLower === '1' && state.status === 'collecting') {
        await this.sendMessage(from,
          `📝 Ya estás llenando una solicitud nueva.\n\n` +
          `✅ Completaste ${completedFields} de ${this.fields.length} campos\n\n` +
          `Continúa con: ${this.fields[state.currentFieldIndex].prompt}\n\n` +
          `💡 Tip: Escribe /ayuda para ver comandos disponibles`
        );
        return;
      }
      
      // If they selected option 6 (help) while in a form
      if (msgLower === '6') {
        const currentField = this.fields[state.currentFieldIndex];
        const example = this.getFieldExample(currentField.type);
        await this.sendMessage(from,
          `📚 *AYUDA - ${currentField.label}*\n\n` +
          `${currentField.help || 'Ingresa el dato solicitado.'}\n` +
          `${example ? `\n${example}` : ''}\n\n` +
          `📋 Tu progreso: ${completedFields}/${this.fields.length} campos\n\n` +
          `💡 Comandos útiles:\n` +
          `• /atras - Regresar al campo anterior\n` +
          `• /estado - Ver tu progreso\n` +
          `• /pausa - Guardar y continuar después\n` +
          `• /cancelar - Cancelar solicitud\n\n` +
          `Para continuar, responde: ${currentField.prompt}`
        );
        return;
      }
      
      // For other options, confirm if they want to pause current form
      await this.sendMessage(from,
        `🤔 Veo que quieres: *${selectedOption}*\n\n` +
        `Pero tienes una solicitud en progreso (${completedFields}/${this.fields.length} campos).\n\n` +
        `*¿Qué prefieres hacer?*\n\n` +
        `✅ Escribe "continuar" para seguir con tu solicitud\n` +
        `⏸️ Escribe "pausa" para guardar y hacer otra cosa\n` +
        `❌ Escribe "cancelar" para cancelar tu solicitud`
      );
      
      state.pendingMenuOption = msgLower;
      await this.stateManager.setState(from, state);
      return;
    }
    
    // Handle response to menu option confirmation
    if (state.pendingMenuOption) {
      if (msgLower === 'continuar' || msgLower === 'seguir') {
        delete state.pendingMenuOption;
        await this.stateManager.setState(from, state);
        await this.sendMessage(from, 
          `✅ Perfecto, continuemos.\n\n${this.fields[state.currentFieldIndex].prompt}`
        );
        return;
      } else if (msgLower === 'pausa' || msgLower === 'guardar') {
        state.status = 'paused';
        state.pausedAt = Date.now();
        await this.stateManager.setState(from, state);
        await this.sendMessage(from,
          `⏸️ *Solicitud pausada*\n\n` +
          `✅ Tu progreso ha sido guardado (${Object.keys(state.data || {}).length}/${this.fields.length} campos)\n\n` +
          `Cuando regreses, podrás continuar donde quedaste.\n\n` +
          `Ahora, ¿qué necesitas?`
        );
        // Handle the menu option they selected
        await this.handleNumberedOption(from, await this.getUserContext(from), state.pendingMenuOption);
        return;
      } else if (msgLower === 'cancelar') {
        await this.cancelCurrent(from, await this.getUserContext(from));
        return;
      }
    }
    
    // Allow back/previous command
    if (msgLower === '/atras' || msgLower === 'atras' || msgLower === 'anterior') {
      if (state.currentFieldIndex > 0) {
        state.currentFieldIndex--;
        const previousField = this.fields[state.currentFieldIndex];
        const currentValue = state.data[previousField.key];
        await this.stateManager.setState(from, state);
        await this.sendMessage(from,
          `↩️ Regresando al campo anterior...\n\n` +
          `${previousField.prompt}\n\n` +
          `Valor actual: *${currentValue}*\n` +
          `(Escribe un nuevo valor para cambiarlo)`
        );
        return;
      } else {
        await this.sendMessage(from,
          `❌ Ya estás en el primer campo.\n\n` +
          `Continúa con: ${this.fields[state.currentFieldIndex].prompt}`
        );
        return;
      }
    }
    
    // Allow pause command
    if (msgLower === '/pausa' || msgLower === 'pausa') {
      state.status = 'paused';
      state.pausedAt = Date.now();
      const completedFields = Object.keys(state.data || {}).length;
      await this.stateManager.setState(from, state);
      await this.sendMessage(from,
        `⏸️ *Solicitud pausada*\n\n` +
        `✅ Tu progreso ha sido guardado (${completedFields}/${this.fields.length} campos)\n\n` +
        `Cuando regreses, solo escribe "hola" y podrás continuar donde quedaste.`
      );
      return;
    }
    
    // Allow specific commands during collection
    if (msgLower === '/cancelar') {
      await this.cancelCurrent(from, await this.getUserContext(from));
      return;
    } else if (msgLower === '/estado') {
      const completedFields = Object.keys(state.data || {}).length;
      const lastField = Object.keys(state.data || {}).pop();
      await this.sendMessage(from, 
        `📋 Estás completando una solicitud:\n\n` +
        `✅ Completados: ${completedFields} de ${this.fields.length} campos\n` +
        `📝 Último guardado: ${lastField || 'ninguno'}\n\n` +
        `Continúa con: ${this.fields[state.currentFieldIndex].prompt}`
      );
      return;
    } else if (msgLower === '/ayuda' || msgLower === 'ayuda' || msgLower === '?') {
      const currentField = this.fields[state.currentFieldIndex];
      const example = this.getFieldExample(currentField.type);
      await this.sendMessage(from, 
        `📚 *AYUDA - ${currentField.label}*\n\n` +
        `${currentField.help || 'Ingresa el dato solicitado.'}\n` +
        `${example ? `\n${example}` : ''}\n\n` +
        `📋 Tu progreso: ${Object.keys(state.data || {}).length}/${this.fields.length} campos\n\n` +
        `💡 Comandos disponibles:\n` +
        `• /atras - Regresar al campo anterior\n` +
        `• /estado - Ver tu progreso\n` +
        `• /pausa - Guardar y continuar después\n` +
        `• /cancelar - Cancelar solicitud\n` +
        `• /reset - Reiniciar todo\n\n` +
        `Para continuar, responde: ${currentField.prompt}`
      );
      return;
    }
    
    // Continue with field collection
    await this.processFieldInput(from, sanitizedMessage, state);
  }

  /**
   * Process field input during collection
   */
  async processFieldInput(from, sanitizedMessage, state) {
    // Extract and validate field with sanitization
    const currentField = this.fields[state.currentFieldIndex];
    const sanitizedValue = this.sanitizeFieldValue(sanitizedMessage, currentField.key);
    const value = this.extractField(sanitizedValue, currentField.type);
    
    if (!value) {
      const example = this.getFieldExample(currentField.type);
      const helpTip = this.getFieldHelpTip(currentField.type);
      await this.sendMessage(from, 
        `❌ *Formato inválido*\n\n` +
        `${example ? `${example}\n\n` : ''}` +
        `${helpTip ? `💡 Tip: ${helpTip}\n\n` : ''}` +
        `${currentField.prompt}\n\n` +
        `_Escribe "ayuda" para más información o "atras" para regresar_`
      );
      return;
    }
    
    const validation = this.validateField(currentField.key, value);
    if (!validation.isValid) {
      const example = this.getFieldExample(currentField.type);
      const helpTip = this.getFieldHelpTip(currentField.type);
      await this.sendMessage(from, 
        `❌ *${validation.error}*\n\n` +
        `${example ? `${example}\n\n` : ''}` +
        `${helpTip ? `💡 Tip: ${helpTip}\n\n` : ''}` +
        `${currentField.prompt}\n\n` +
        `_Escribe "ayuda" para más información o "atras" para regresar_`
      );
      return;
    }
    
    // Store validated value
    state.data[currentField.key] = validation.sanitized || value;
    state.lastActivity = Date.now();
    state.timeoutWarned = false; // Reset warning when user is active
    
    // Send success confirmation with the saved value
    await this.sendMessage(from, `✅ Guardado: *${validation.sanitized || value}*`);
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Move to next field
    state.currentFieldIndex++;
    
    // Check if we've collected all fields
    if (state.currentFieldIndex >= this.fields.length) {
      state.status = 'confirming';
      await this.stateManager.setState(from, state);
      await this.showConfirmation(from, state);
      return;
    }
    
    // Save updated state and continue
    await this.stateManager.setState(from, state);
    
    // Send next field prompt with enhanced progress indicator
    const nextField = this.fields[state.currentFieldIndex];
    const progressBar = this.createProgressBar(state.currentFieldIndex + 1, this.fields.length);
    const stepIndicator = `📍 *Paso ${state.currentFieldIndex + 1} de ${this.fields.length}*`;
    
    await this.sendMessage(from, 
      `${progressBar}\n` +
      `${stepIndicator}\n\n` +
      `${nextField.prompt}`
    );
  }

  /**
   * Handle resume confirmation
   */
  async handleResumeConfirmation(from, sanitizedMessage, state) {
    const msgLower = sanitizedMessage.toLowerCase().trim();
    
    if (msgLower === '1' || msgLower === 'si' || msgLower === 'sí' || msgLower === 'continuar') {
      // Resume the draft
      await this.resumeDraft(from, state.draftId);
    } else if (msgLower === '2' || msgLower === 'no' || msgLower === 'nuevo' || msgLower === 'nueva') {
      // Start new application
      await this.stateManager.clearState(from);
      await this.startNewApplication(from);
    } else {
      await this.sendMessage(from, 
        '❓ No entendí tu respuesta.\n\n' +
        'Escribe "1" para continuar donde quedaste o "2" para empezar una nueva solicitud.'
      );
    }
  }

  /**
   * Get user context for smart responses
   */
  async getUserContext(phoneNumber) {
    try {
      // First check if there's an active Redis session
      const stateKey = `wa:${phoneNumber}`;
      let redisState;
      try {
        const stateData = await redisClient.get(stateKey);
        if (stateData) {
          try {
            redisState = JSON.parse(stateData);
          } catch (parseError) {
            logger.error('Error parsing Redis state data', { error: parseError.message, phoneNumber });
            // Clear corrupted state
            await redisClient.del(stateKey);
            redisState = null;
          }
          // If we have an active session that's collecting or confirming
          if (redisState.status === 'collecting' || redisState.status === 'confirming') {
            // Calculate how many fields are complete
            const completedFields = Object.keys(redisState.data || {}).length;
            const totalFields = this.fields.length;
            
            return {
              status: 'INCOMPLETE_SESSION',
              phoneNumber,
              redisState,
              completedFields,
              totalFields,
              data: redisState.data
            };
          }
        }
      } catch (redisError) {
        logger.error('Redis error in getUserContext', { error: redisError.message });
      }
      
      // Find user by WhatsApp phone
      const userAccountService = require('./user-account.service');
      const user = await userAccountService.findByWhatsAppPhone(phoneNumber);
      
      if (!user) {
        return { status: 'NEW_USER', phoneNumber };
      }
      
      // Check for pending payments
      const applicationRepository = require('../../repositories/application.repository');
      const pendingPayments = await applicationRepository.findPendingPaymentByUserId(user.id);
      
      if (pendingPayments && pendingPayments.length > 0) {
        const mostRecent = pendingPayments[0];
        return {
          status: 'PENDING_PAYMENT',
          user,
          application: mostRecent,
          paymentLink: mostRecent.payment_link,
          amount: mostRecent.importe
        };
      }
      
      // Check for incomplete applications (drafts)
      const drafts = await this.findDraftApplications(user.id);
      if (drafts.length > 0) {
        return {
          status: 'INCOMPLETE_APPLICATION',
          user,
          draft: drafts[0],
          missingFields: this.getMissingFields(drafts[0])
        };
      }
      
      // Check for active permits
      const activePermits = await applicationRepository.findByUserId(user.id);
      const hasActivePermit = activePermits.some(app => 
        app.status === 'PERMIT_READY' && 
        new Date(app.fecha_vencimiento) > new Date()
      );
      
      if (hasActivePermit) {
        return {
          status: 'ACTIVE_PERMIT',
          user,
          permits: activePermits.filter(app => app.status === 'PERMIT_READY')
        };
      }
      
      return { status: 'RETURNING_USER', user };
    } catch (error) {
      logger.error('Error getting user context', { error: error.message });
      return { status: 'NEW_USER', phoneNumber };
    }
  }
  
  /**
   * Send contextual welcome message based on user status
   */
  async sendWelcomeMessage(from, context) {
    let message;
    
    switch (context?.status) {
      case 'INCOMPLETE_SESSION':
        message = `👋 ¡Hola de nuevo!

📝 Veo que estabas llenando una solicitud.
✅ Completaste ${context.completedFields} de ${context.totalFields} campos

*¿Qué deseas hacer?*

1️⃣ Continuar donde quedaste
2️⃣ Empezar solicitud nueva
3️⃣ Ver menú principal

*Escribe el número* de tu elección o "continuar" para seguir donde quedaste.`;
        break;
        
      case 'PENDING_PAYMENT':
        message = `👋 ¡Hola de nuevo!

💳 Tienes un pago pendiente de $${context.amount} MXN
📱 Folio: ${context.application.id}

🔗 *Link de pago:*
${context.paymentLink}

*¿Qué deseas hacer?*

1️⃣ Ver mi link de pago
2️⃣ Necesito ayuda con el pago
3️⃣ Ver menú principal

*Escribe el número* o "pagar" para continuar.`;
        break;
        
      case 'INCOMPLETE_APPLICATION':
        message = `👋 ¡Hola de nuevo!

Veo que tienes una solicitud sin terminar.
📋 Te faltan: ${context.missingFields.join(', ')}

*¿Qué deseas hacer?*

1️⃣ Continuar mi solicitud anterior
2️⃣ Empezar una nueva solicitud
3️⃣ Ver menú principal

*Escribe el número* o "continuar" para seguir.`;
        break;
        
      case 'ACTIVE_PERMIT':
        const permit = context.permits[0];
        message = `👋 ¡Bienvenido de vuelta!

✅ Tienes ${context.permits.length} permiso(s) activo(s)

*¿Qué deseas hacer?*

1️⃣ Ver mis permisos actuales
2️⃣ Solicitar nuevo permiso
3️⃣ Renovar un permiso
4️⃣ Ver menú completo

*Escribe el número* de tu elección o el comando que necesites.`;
        break;
        
      default:
        message = `🚗 *¡Bienvenido a Permisos Digitales!*

¡Hola! Soy tu asistente para obtener tu permiso de importación vehicular. 🤖

*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Ver estado de mi solicitud
3️⃣ Realizar un pago pendiente
4️⃣ Ver mis permisos anteriores
5️⃣ Renovar un permiso
6️⃣ Necesito ayuda

*Solo escribe el número* de la opción que necesitas.

💡 También puedes escribir directamente lo que necesitas, como "nuevo permiso" o "pagar".

💰 Costo: $150 MXN | ⏱️ Listo en 5-10 min`;
    }
    
    await this.sendMessage(from, message);
  }

  /**
   * Handle greeting and route appropriately
   */
  async handleGreeting(from, context) {
    await this.sendWelcomeMessage(from, context);
  }
  
  /**
   * Handle numbered menu options
   */
  async handleNumberedOption(from, context, message) {
    try {
      const number = message.trim();
      
      switch(number) {
        case '1':
          await this.startOrResumeApplication(from, context);
          break;
        case '2':
          await this.checkStatus(from, context);
          break;
        case '3':
          await this.getPaymentLinks(from, context);
          break;
        case '4':
          await this.listUserPermits(from, context);
          break;
        case '5':
          await this.renewPermit(from, context);
          break;
        case '6':
          await this.sendContextualHelp(from, context);
          break;
        default:
          await this.sendMessage(from, '❓ No entendí esa opción. Por favor escribe un número del 1 al 6.');
          await this.sendWelcomeMessage(from, context);
      }
    } catch (error) {
      logger.error('Error handling numbered option', { error: error.message, from });
      await this.sendMessage(from, '❌ Hubo un error. Por favor intenta de nuevo.');
    }
  }
  
  /**
   * Start or resume application based on context
   */
  async startOrResumeApplication(from, context) {
    if (context.status === 'INCOMPLETE_APPLICATION') {
      await this.sendMessage(from, 
        `📋 *Solicitud sin terminar*

Te faltan: ${context.missingFields.join(', ')}

*¿Qué deseas hacer?*

1️⃣ Continuar donde quedé
2️⃣ Empezar una nueva solicitud

*Escribe el número* o "continuar" para seguir donde quedaste.`
      );
      
      // Set state to wait for resume confirmation
      await redisClient.setex(`wa:${from}`, 3600, JSON.stringify({
        status: 'awaiting_resume_confirmation',
        draftId: context.draft.id
      }));
      return;
    }
    
    await this.startNewApplication(from);
  }
  
  /**
   * Check user's current status
   */
  async checkStatus(from, context) {
    if (context.status === 'NEW_USER' || context.status === 'INCOMPLETE_SESSION') {
      await this.sendMessage(from, 
        `🔍 *No encontré información*

No tienes solicitudes registradas con este número.

*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Ver menú principal

*Escribe el número* o "permiso" para comenzar.`
      );
      return;
    }
    
    if (!context.user || !context.user.id) {
      await this.sendMessage(from, 
        `❌ *Error temporal*

No pude obtener tu información en este momento.

*Intenta de nuevo* en unos minutos o contacta soporte escribiendo "ayuda".`
      );
      return;
    }
    
    const applicationRepository = require('../../repositories/application.repository');
    const applications = await applicationRepository.findByUserId(context.user.id);
    
    if (applications.length === 0) {
      await this.sendMessage(from, 
        `📋 *Sin solicitudes*

No tienes solicitudes registradas aún.

*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Ver menú principal

*Escribe el número* o "permiso" para comenzar.`
      );
      return;
    }
    
    let message = `📊 *Tu estado actual:*\n\n`;
    
    // Group by status
    const pending = applications.filter(a => ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT'].includes(a.status));
    const processing = applications.filter(a => ['PAYMENT_PROCESSING', 'GENERATING_PERMIT'].includes(a.status));
    const ready = applications.filter(a => a.status === 'PERMIT_READY' && new Date(a.fecha_vencimiento) > new Date());
    const expired = applications.filter(a => a.status === 'PERMIT_READY' && new Date(a.fecha_vencimiento) <= new Date());
    
    if (pending.length > 0) {
      message += `⏳ *Pagos pendientes:*\n`;
      pending.forEach(app => {
        message += `• ${app.marca} ${app.linea} - $${app.importe}\n`;
        if (app.payment_link) {
          message += `  💳 Pagar: ${app.payment_link}\n`;
        }
      });
      message += `\n`;
    }
    
    if (processing.length > 0) {
      message += `⚙️ *En proceso:*\n`;
      processing.forEach(app => {
        message += `• ${app.marca} ${app.linea} - Generando permiso...\n`;
      });
      message += `\n`;
    }
    
    if (ready.length > 0) {
      message += `✅ *Permisos activos:*\n`;
      ready.forEach(app => {
        const vencimiento = new Date(app.fecha_vencimiento).toLocaleDateString('es-MX');
        message += `• ${app.marca} ${app.linea} - Vence: ${vencimiento}\n`;
      });
      message += `\n`;
    }
    
    if (expired.length > 0) {
      message += `❌ *Permisos vencidos:*\n`;
      expired.forEach(app => {
        message += `• ${app.marca} ${app.linea} - Envía /renovar\n`;
      });
      message += `\n`;
    }
    
    // Add action options
    message += `*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Realizar un pago pendiente
3️⃣ Renovar un permiso
4️⃣ Ver menú principal

*Escribe el número* de tu elección.`;
    
    await this.sendMessage(from, message);
  }
  
  /**
   * Get payment links for pending payments
   */
  async getPaymentLinks(from, context) {
    if (context.status === 'NEW_USER' || !context.user) {
      await this.sendMessage(from, 
        `💳 *Sin pagos pendientes*

No tienes pagos registrados aún.

*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Ver menú principal

*Escribe el número* o "permiso" para comenzar.`
      );
      return;
    }
    
    const applicationRepository = require('../../repositories/application.repository');
    const pendingPayments = await applicationRepository.findPendingPaymentByUserId(context.user.id);
    
    if (!pendingPayments || pendingPayments.length === 0) {
      await this.sendMessage(from, 
        `🎉 *¡Excelente!*

No tienes pagos pendientes.

*¿Qué deseas hacer?*

1️⃣ Solicitar nuevo permiso
2️⃣ Ver estado de mis solicitudes
3️⃣ Ver menú principal

*Escribe el número* de tu elección.`
      );
      return;
    }
    
    let message = `💳 *Tus pagos pendientes:*\n\n`;
    
    pendingPayments.forEach((app, index) => {
      message += `${index + 1}. ${app.marca} ${app.linea}\n`;
      message += `   💵 Monto: $${app.importe} MXN\n`;
      message += `   🔗 ${app.payment_link}\n\n`;
    });
    
    // Add action options
    message += `*¿Necesitas ayuda?*

1️⃣ ¿Cómo pagar con tarjeta?
2️⃣ ¿Cómo pagar en OXXO?
3️⃣ Problemas con el pago
4️⃣ Ver menú principal

*Escribe el número* de tu elección.`;
    
    await this.sendMessage(from, message);
  }
  
  /**
   * Find draft applications
   */
  async findDraftApplications(userId) {
    const applicationRepository = require('../../repositories/application.repository');
    const allApplications = await applicationRepository.findByUserId(userId);
    
    // Filter for draft status or incomplete data
    return allApplications.filter(app => 
      app.status === 'DRAFT' || 
      (!app.numero_serie || !app.numero_motor || !app.domicilio)
    );
  }
  
  /**
   * Get missing fields from draft
   */
  getMissingFields(draft) {
    const required = ['nombre_completo', 'curp_rfc', 'domicilio', 'marca', 
                     'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo'];
    
    return required.filter(field => !draft[field]).map(field => {
      const fieldMap = {
        'nombre_completo': 'Nombre',
        'curp_rfc': 'CURP/RFC',
        'domicilio': 'Domicilio',
        'marca': 'Marca',
        'linea': 'Modelo',
        'color': 'Color',
        'numero_serie': 'VIN',
        'numero_motor': 'Motor',
        'ano_modelo': 'Año'
      };
      return fieldMap[field] || field;
    });
  }
  
  /**
   * Handle pending payment context
   */
  async handlePendingPaymentContext(from, message, context) {
    const msgLower = message.toLowerCase();
    
    if (msgLower === 'pagar' || msgLower === 'link' || msgLower === 'pago') {
      await this.getPaymentLinks(from, context);
    } else if (msgLower === 'nuevo' || msgLower === 'otra') {
      await this.startNewApplication(from);
    } else {
      await this.sendMessage(from, 
        `Tienes un pago pendiente. Opciones:\n\n` +
        `💳 Escribe "pagar" para ver el link\n` +
        `🆕 Escribe "nuevo" para otra solicitud\n` +
        `❓ Escribe /ayuda para más opciones`
      );
    }
  }
  
  /**
   * Handle incomplete application context
   */
  async handleIncompleteContext(from, message, context) {
    const msgLower = message.toLowerCase();
    
    if (msgLower === 'si' || msgLower === 'sí' || msgLower === '1') {
      await this.resumeApplication(from, context.draft);
    } else if (msgLower === 'no' || msgLower === '2') {
      await this.startNewApplication(from);
    } else {
      await this.sendMessage(from, 
        `Por favor responde:\n` +
        `1️⃣ o SI - Para continuar\n` +
        `2️⃣ o NO - Para empezar de nuevo`
      );
    }
  }
  
  /**
   * Handle incomplete session context (Redis session)
   */
  async handleIncompleteSessionContext(from, message, context) {
    const msgLower = message.toLowerCase();
    const stateKey = `wa:${from}`;
    
    if (msgLower === 'si' || msgLower === 'sí' || msgLower === '1') {
      // Continue with the existing session
      // Don't modify the state, just let it continue
      await this.sendMessage(from, 
        `🔄 Continuando tu solicitud...\n\n${this.fields[context.redisState.currentFieldIndex].prompt}`
      );
      
      // Remove the incomplete session flag from Redis to avoid re-triggering
      try {
        await redisClient.del(stateKey);
        await redisClient.setex(stateKey, 3600, JSON.stringify(context.redisState));
      } catch (error) {
        logger.error('Error restoring session state', { error: error.message });
      }
    } else if (msgLower === 'no' || msgLower === '2') {
      // Clear the old session
      try {
        await redisClient.del(stateKey);
      } catch (error) {
        logger.error('Error clearing Redis session', { error: error.message });
      }
      
      // Set a flag to indicate we're waiting to start new
      await redisClient.setex(stateKey, 3600, JSON.stringify({
        status: 'awaiting_new_start',
        clearedAt: new Date().toISOString()
      }));
      
      await this.sendMessage(from, '🗑️ Solicitud anterior eliminada.\n\n🆕 Envía /permiso para comenzar una nueva solicitud.');
    } else {
      // Set state to awaiting incomplete session response
      await redisClient.setex(stateKey, 3600, JSON.stringify({
        status: 'awaiting_incomplete_response',
        redisState: context.redisState
      }));
      
      await this.sendMessage(from, 
        `Por favor responde:\n` +
        `1️⃣ o SI - Para continuar\n` +
        `2️⃣ o NO - Para empezar de nuevo`
      );
    }
  }
  
  /**
   * Resume an incomplete application
   */
  async resumeApplication(from, draft) {
    const missingFields = this.getMissingFields(draft);
    const firstMissingField = this.fields.find(f => !draft[f.key]);
    
    if (!firstMissingField) {
      // All fields complete, go to confirmation
      const state = {
        status: 'confirming',
        data: draft,
        applicationId: draft.id
      };
      await redisClient.setex(`wa:${from}`, 3600, JSON.stringify(state));
      await this.sendConfirmation(from, draft);
      return;
    }
    
    // Resume from first missing field
    const fieldIndex = this.fields.findIndex(f => f.key === firstMissingField.key);
    const state = {
      status: 'collecting',
      currentFieldIndex: fieldIndex,
      data: draft,
      applicationId: draft.id,
      resumed: true,
      timestamp: Date.now(),
      lastActivity: Date.now()
    };
    
    await redisClient.setex(`wa:${from}`, 3600, JSON.stringify(state));
    await this.sendMessage(from, 
      `🔄 Continuando tu solicitud...\n\n${firstMissingField.prompt}`
    );
  }
  
  /**
   * Start new application
   */
  async startNewApplication(from) {
    const stateKey = `wa:${from}`;
    
    try {
      // Check for duplicate vehicles first
      const context = await this.getUserContext(from);
      if (context.user) {
        // User exists, let's be smarter about starting
        await this.sendMessage(from, 
          `👋 ¡Hola ${context.user.first_name}! Iniciemos tu nueva solicitud.\n\n` +
          `Si ya tienes los datos del vehículo, continuaremos rápidamente.`
        );
      }
      
      // First send requirements message
      const requirementsMessage = `¡Hola! 👋 Te ayudaré a tramitar tu permiso.

📋 *Necesitarás estos datos:*

De ti:
• Tu nombre completo
• CURP o RFC
• Dirección
• Correo electrónico

De tu vehículo:
• Marca y modelo
• Color
• VIN (está en el parabrisas)
• Número de motor
• Año

💡 Si no tienes algún dato a la mano, puedes buscarlo mientras avanzamos.

¡Empecemos! 🚀`;
      
      await this.sendMessage(from, requirementsMessage);
      
      // Wait a bit before starting questions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const state = {
        status: 'collecting',
        currentFieldIndex: 0,
        data: {},
        startedAt: new Date().toISOString(),
        timestamp: Date.now(),
        lastActivity: Date.now()
      };
      
      // Try to save to Redis with fallback to memory
      try {
        await redisClient.setex(stateKey, 3600, JSON.stringify(state));
      } catch (redisError) {
        logger.error('Redis error, using memory fallback', { error: redisError.message });
        await this.saveStateToMemory(stateKey, state);
      }
      
      const startMessage = `¡Perfecto! Comenzaremos con tus datos personales.

${this.fields[0].prompt}`;
      
      await this.sendMessage(from, startMessage);
      
    } catch (error) {
      logger.error('Error starting new application', { error: error.message, from });
      
      // Send user-friendly error message
      await this.sendMessage(from, 
        '❌ Hubo un problema al iniciar tu solicitud.\n\n' +
        '🔄 Por favor intenta de nuevo en unos momentos.\n\n' +
        'Si el problema persiste:\n' +
        '• Envía /reset para reiniciar\n' +
        '• Contacta soporte@permisosdigitales.com.mx'
      );
    }
  }

  /**
   * Extract field value based on type
   */
  extractField(message, type) {
    const cleaned = message.trim();
    
    switch (type) {
      case 'text':
        return cleaned.length > 1 ? cleaned : null;
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(cleaned) ? cleaned.toLowerCase() : null;
      
      case 'curp_rfc':
        const curpRfc = cleaned.toUpperCase().replace(/[\s\-\.]/g, '');
        // Website allows 10-50 characters, letters and numbers only
        return curpRfc.match(/^[A-Z0-9]{10,50}$/) ? curpRfc : null;
      
      case 'vin':
        const vin = cleaned.toUpperCase().replace(/[\s\-\.]/g, '');
        // Website allows 5-50 characters for numero_serie
        return vin.length >= 5 && vin.length <= 50 && vin.match(/^[A-Z0-9]+$/) ? vin : null;
      
      case 'numero_motor':
        const motor = cleaned.toUpperCase().replace(/[\s\-\.]/g, '');
        // Website allows 2-50 characters for numero_motor
        return motor.length >= 2 && motor.length <= 50 && motor.match(/^[A-Z0-9]+$/) ? motor : null;
      
      case 'year':
        const year = cleaned.replace(/\D/g, '');
        const yearNum = parseInt(year);
        return yearNum >= 1900 && yearNum <= new Date().getFullYear() + 2 ? year : null;
      
      case 'color':
        const colorLower = cleaned.toLowerCase();
        
        // Handle multi-color vehicles
        if (colorLower.includes('/') || colorLower.includes('\\')) {
          // Replace slashes with 'y' (and)
          const normalized = colorLower.replace(/[\/\\]/g, ' y ');
          // Capitalize first letter of each word, but keep 'y' lowercase
          return normalized.split(' ').map(word => {
            if (word === 'y') return 'y';
            return word.charAt(0).toUpperCase() + word.slice(1);
          }).join(' ');
        }
        
        // Check if it contains any known color
        const foundColor = this.colors.find(color => colorLower.includes(color));
        return foundColor ? foundColor.charAt(0).toUpperCase() + foundColor.slice(1) : cleaned;
      
      default:
        return cleaned;
    }
  }

  /**
   * Get field example text
   */
  getFieldExample(fieldType) {
    const examples = {
      curp_rfc: '📋 *Ejemplos válidos:*\nCURP: ABCD123456HDFGHI01\nRFC: ABCD880326A01',
      email: '📧 *Ejemplo:* juan.perez@gmail.com',
      numero_serie: '🔢 *Ejemplo VIN:* 1HGCM82633A123456\n_(17 caracteres alfanuméricos)_',
      numero_motor: '⚙️ *Ejemplo:* 52WVC10338',
      year: '📅 *Ejemplos:* 2020, 2023, 2025',
      color: '🎨 *Ejemplos:* Rojo, Negro, Blanco y Azul',
      text: '',
      vin: '🔢 *Ejemplo VIN:* 1HGCM82633A123456\n_(17 caracteres alfanuméricos)_'
    };
    return examples[fieldType] || '';
  }

  /**
   * Get helpful tips for field types
   */
  getFieldHelpTip(fieldType) {
    const tips = {
      curp_rfc: 'Sin espacios, guiones o puntos',
      email: 'Revisa que esté bien escrito',
      numero_serie: 'Lo encuentras en el parabrisas o puerta del conductor',
      numero_motor: 'Está en tu tarjeta de circulación',
      year: 'Solo 4 dígitos',
      color: 'Si tiene 2 colores, usa "y" entre ellos',
      vin: 'Revisa que sean exactamente 17 caracteres'
    };
    return tips[fieldType] || '';
  }

  /**
   * Create visual progress bar
   */
  createProgressBar(current, total) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.floor((current / total) * 10);
    const empty = 10 - filled;
    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}%`;
  }

  /**
   * Validate field value with security checks
   */
  validateField(field, value) {
    // Use secure validation from security utils
    const validation = securityUtils.validateFieldSecure(field, value);
    
    // If security utils handled it, return the result
    if (validation.error || validation.sanitized) {
      return validation;
    }
    
    // Additional field-specific validation not covered by security utils
    switch (field) {
      case 'domicilio':
        if (value.length < 5) {
          return { isValid: false, error: 'El domicilio debe tener al menos 5 caracteres' };
        }
        break;
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { isValid: false, error: 'Por favor ingresa un correo válido' };
        }
        break;
      
      case 'numero_serie':
        if (value.length < 5 || value.length > 50) {
          return { isValid: false, error: 'El número de serie debe tener entre 5 y 50 caracteres' };
        }
        break;
      
      case 'numero_motor':
        if (value.length < 2 || value.length > 50) {
          return { isValid: false, error: 'El número de motor debe tener entre 2 y 50 caracteres' };
        }
        break;
        
      case 'ano_modelo':
        const year = parseInt(value);
        if (year < 1900 || year > new Date().getFullYear() + 2) {
          return { isValid: false, error: 'Año inválido' };
        }
        break;
    }
    
    return { isValid: true };
  }

  /**
   * Send confirmation message
   */
  async sendConfirmation(from, data) {
    const message = `🎉 ¡Listo! Aquí está tu información:

👤 **TUS DATOS**
Nombre: ${data.nombre_completo}
CURP/RFC: ${data.curp_rfc}
Domicilio: ${data.domicilio}
Email: ${data.email}

🚗 **TU VEHÍCULO**
${data.marca} ${data.linea} - ${data.ano_modelo}
Color: ${data.color}
Serie (VIN): ${data.numero_serie}
Motor: ${data.numero_motor}

💳 **COSTO: $150.00 MXN**

¿Todo está correcto?

✅ *SI* - Proceder al pago
✏️ *Escribe qué cambiar* - nombre, curp, domicilio, email, marca, modelo, color, serie, motor, año
❌ *NO* - Cancelar y empezar de nuevo`;
    
    await this.sendMessage(from, message);
  }

  /**
   * Handle confirmation response
   */
  async handleConfirmation(from, message, state) {
    const response = message.toLowerCase().trim();
    const stateKey = `wa:${from}`;
    
    if (response === 'si' || response === 'sí') {
      // Create application and payment
      await this.createApplicationAndPayment(from, state.data);
      await redisClient.del(stateKey);
    } else if (response === 'no') {
      // Start over
      await this.startNewApplication(from);
    } else {
      // Check if user wants to edit a specific field
      const fieldMap = {
        'nombre': 'nombre_completo',
        'curp': 'curp_rfc',
        'rfc': 'curp_rfc',
        'domicilio': 'domicilio',
        'direccion': 'domicilio',
        'email': 'email',
        'correo': 'email',
        'marca': 'marca',
        'modelo': 'linea',
        'linea': 'linea',
        'color': 'color',
        'serie': 'numero_serie',
        'vin': 'numero_serie',
        'motor': 'numero_motor',
        'año': 'ano_modelo',
        'ano': 'ano_modelo'
      };
      
      const fieldToEdit = fieldMap[response];
      if (fieldToEdit) {
        // Set state to edit specific field
        state.status = 'editing_field';
        state.editingField = fieldToEdit;
        const fieldInfo = this.fields.find(f => f.key === fieldToEdit);
        
        try {
          await redisClient.setex(stateKey, 3600, JSON.stringify(state));
          await this.sendMessage(from, 
            `✏️ Editando: ${fieldToEdit}\n\n` +
            `Valor actual: ${state.data[fieldToEdit]}\n\n` +
            `${fieldInfo.prompt}`
          );
        } catch (error) {
          logger.error('Error saving edit state', { error: error.message });
          await this.sendMessage(from, '❌ Error al editar. Por favor intenta de nuevo.');
        }
      } else {
        await this.sendMessage(from, 
          '🤔 No entendí...\n\n' +
          'Puedes escribir:\n' +
          '• *SI* para continuar al pago\n' +
          '• *NO* para cancelar todo\n' +
          '• O el campo que quieres cambiar:\n' +
          '  nombre, curp, domicilio, email,\n' +
          '  marca, modelo, color, serie, motor, año'
        );
      }
    }
  }

  /**
   * Create application and payment link
   */
  async createApplicationAndPayment(from, data) {
    try {
      await this.sendMessage(from, '⏳ Creando tu solicitud...');
      
      // Check for duplicate vehicle first
      const context = await this.getUserContext(from);
      if (context.user) {
        const duplicate = await this.checkDuplicateApplication(context.user.id, data.numero_serie);
        if (duplicate.isDuplicate) {
          await this.handleDuplicateApplication(from, duplicate);
          return;
        }
      }
      
      // Create real application
      const permitApplicationService = require('./permit-application.service');
      const result = await permitApplicationService.createFromWhatsApp(from, data);
      
      const message = `✅ ¡Solicitud creada!

📱 Folio: ${result.applicationId}

💳 Paga aquí:
${result.paymentLink}

Una vez pagado, recibirás tu permiso en 5-10 minutos por este medio.`;
      
      await this.sendMessage(from, message);
      
    } catch (error) {
      logger.error('Error creating application', { error: error.message });
      await this.sendMessage(from, '❌ Hubo un error. Por favor intenta más tarde o contacta soporte.');
    }
  }

  /**
   * Send contextual help message
   */
  async sendContextualHelp(from, context) {
    let message = `📚 *CENTRO DE AYUDA*`;
    
    // Add context-specific help
    if (context.status === 'PENDING_PAYMENT') {
      message = `💳 *AYUDA - PAGO PENDIENTE*\n\n` +
                `Tienes un pago pendiente de $${context.amount}\n\n` +
                `*Opciones de pago:*\n` +
                `• Tarjeta de crédito/débito\n` +
                `• OXXO (se procesa en 1-4 horas)\n\n` +
                `*Link de pago:*\n${context.paymentLink}\n\n`;
    }
    
    message += `

🤖 *CÓMO USAR ESTE SERVICIO:*

Puedes comunicarte conmigo de 3 formas:

1️⃣ *Usando números del menú principal*
   Solo escribe el número (1, 2, 3, etc.)

2️⃣ *Escribiendo lo que necesitas*
   Ejemplos:
   • "nuevo permiso"
   • "quiero pagar"
   • "ver mi solicitud"
   • "necesito ayuda"

3️⃣ *Usando comandos (opcional)*
   • /permiso - Nueva solicitud
   • /estado - Ver estado
   • /pagar - Enlaces de pago
   • /mis-permisos - Ver permisos

💡 *CONSEJOS ÚTILES:*
• Ten tu CURP/RFC y datos del vehículo a la mano
• Para vehículos de varios colores, usa "y" (Ej: Rojo y Negro)
• Escribe "menu" o "hola" para ver las opciones principales
• Puedes cancelar en cualquier momento escribiendo "cancelar"

💰 *INFORMACIÓN DEL SERVICIO:*
• Costo: $150 MXN
• Validez: 30 días  
• Listo en: 5-10 minutos después del pago
• Pagos: Tarjeta o OXXO

📞 *SOPORTE:*
• Email: soporte@permisosdigitales.com.mx
• Horario: Lun-Vie 9:00-18:00

💬 Escribe "1" o "nuevo permiso" para comenzar.`;
    
    await this.sendMessage(from, message);
  }

  /**
   * Check for duplicate application
   */
  async checkDuplicateApplication(userId, vin) {
    const applicationRepository = require('../../repositories/application.repository');
    const existingApps = await applicationRepository.findByUserId(userId);
    
    const duplicate = existingApps.find(app => 
      app.numero_serie === vin && 
      ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING', 'GENERATING_PERMIT', 'PERMIT_READY'].includes(app.status)
    );
    
    if (duplicate) {
      return {
        isDuplicate: true,
        status: duplicate.status,
        applicationId: duplicate.id,
        paymentLink: duplicate.payment_link,
        marca: duplicate.marca,
        linea: duplicate.linea
      };
    }
    
    return { isDuplicate: false };
  }
  
  /**
   * Handle duplicate application
   */
  async handleDuplicateApplication(from, duplicate) {
    let message = `⚠️ Ya tienes una solicitud para este vehículo:\n\n` +
                  `🚗 ${duplicate.marca} ${duplicate.linea}\n`;
    
    switch (duplicate.status) {
      case 'AWAITING_PAYMENT':
      case 'AWAITING_OXXO_PAYMENT':
        message += `💳 Estado: Pago pendiente\n\n` +
                   `Link de pago:\n${duplicate.paymentLink}`;
        break;
      case 'PAYMENT_PROCESSING':
        message += `⚙️ Estado: Procesando pago...\n\n` +
                   `Tu permiso estará listo pronto.`;
        break;
      case 'GENERATING_PERMIT':
        message += `🖨️ Estado: Generando permiso...\n\n` +
                   `Te avisaremos cuando esté listo.`;
        break;
      case 'PERMIT_READY':
        message += `✅ Estado: Permiso listo\n\n` +
                   `Envía /mis-permisos para descargar.`;
        break;
    }
    
    await this.sendMessage(from, message);
  }
  
  /**
   * Handle payment confirmation (called by webhook)
   */
  async handlePaymentConfirmation(applicationId, phoneNumber) {
    await this.sendMessage(phoneNumber, 
      `✅ ¡Pago confirmado! 🎉\n\n` +
      `Tu permiso se está generando y estará listo en 5-10 minutos.\n\n` +
      `Te avisaré cuando esté listo para descargar. 📩`
    );
  }

  /**
   * Handle permit ready (called by generation service)
   */
  async handlePermitReady(applicationId, permitUrl, phoneNumber) {
    const message = `📄 ¡Tu permiso está listo!\n\n` +
                    `📥 Descárgalo aquí:\n${permitUrl}\n\n` +
                    `⏰ El enlace es válido por 48 horas.\n\n` +
                    `💡 Tip: Guarda el PDF en tu teléfono y en Google Drive.\n\n` +
                    `¿Necesitas ayuda? Estoy aquí 24/7 🤖`;
    
    await this.sendMessage(phoneNumber, message);
  }
  
  /**
   * Cancel current operation
   */
  async cancelCurrent(from) {
    const stateKey = `wa:${from}`;
    await redisClient.del(stateKey);
    await this.sendMessage(from, 
      `❌ Operación cancelada.\n\n` +
      `Comandos disponibles:\n` +
      `• /permiso - Nueva solicitud\n` +
      `• /estado - Ver tus solicitudes\n` +
      `• /ayuda - Ver más opciones`
    );
  }

  /**
   * Start permit application (alias for startNewApplication)
   */
  async startPermitApplication(from) {
    try {
      await this.startNewApplication(from);
    } catch (error) {
      logger.error('Error starting permit application', { error: error.message, from });
      await this.sendMessage(from, 
        '❌ Error al iniciar la solicitud.\n\n' +
        'Por favor intenta de nuevo o contacta soporte.'
      );
    }
  }

  /**
   * Send help message (alias for sendContextualHelp)
   */
  async sendHelp(from, context) {
    try {
      await this.sendContextualHelp(from, context);
    } catch (error) {
      logger.error('Error sending help', { error: error.message, from });
      // Send a basic help message as fallback
      await this.sendMessage(from, 
        '📚 *AYUDA RÁPIDA*\n\n' +
        '• /permiso - Nueva solicitud\n' +
        '• /estado - Ver solicitudes\n' +
        '• /pagar - Enlaces de pago\n' +
        '• /reset - Reiniciar conversación\n\n' +
        'Soporte: soporte@permisosdigitales.com.mx'
      );
    }
  }

  /**
   * Clear state from memory cache
   */
  clearStateFromMemory(stateKey) {
    try {
      if (this.memoryStateCache.has(stateKey)) {
        this.memoryStateCache.delete(stateKey);
        logger.info('Cleared state from memory cache', { stateKey });
      }
    } catch (error) {
      logger.error('Error clearing state from memory', { error: error.message, stateKey });
    }
  }
  
  /**
   * Save progress to database
   */
  async saveProgress(applicationId, data) {
    try {
      const applicationRepository = require('../../repositories/application.repository');
      await applicationRepository.update(applicationId, data);
      logger.info('Application progress saved', { applicationId });
    } catch (error) {
      logger.error('Error saving progress', { error: error.message, applicationId });
    }
  }
  
  /**
   * List user permits
   */
  async listUserPermits(from, context) {
    if (context.status === 'NEW_USER' || !context.user) {
      await this.sendMessage(from, `No tienes permisos registrados. Envía /permiso para iniciar.`);
      return;
    }
    
    const applicationRepository = require('../../repositories/application.repository');
    const permits = await applicationRepository.findByUserId(context.user.id);
    const activePermits = permits.filter(p => p.status === 'PERMIT_READY');
    
    if (activePermits.length === 0) {
      await this.sendMessage(from, `No tienes permisos activos. Envía /permiso para tramitar uno.`);
      return;
    }
    
    let message = `📋 *Tus permisos:*\n\n`;
    
    activePermits.forEach((permit, index) => {
      const vencimiento = new Date(permit.fecha_vencimiento);
      const hoy = new Date();
      const diasRestantes = Math.floor((vencimiento - hoy) / (1000 * 60 * 60 * 24));
      
      let statusEmoji = '✅';
      if (diasRestantes <= 0) statusEmoji = '❌';
      else if (diasRestantes <= 7) statusEmoji = '⚠️';
      
      message += `${index + 1}. ${statusEmoji} ${permit.marca} ${permit.linea}\n`;
      message += `   📝 Folio: ${permit.folio}\n`;
      message += `   📅 Vence: ${vencimiento.toLocaleDateString('es-MX')}\n`;
      
      if (diasRestantes > 0) {
        message += `   ⏳ Días restantes: ${diasRestantes}\n`;
      } else {
        message += `   ❌ VENCIDO - Envía /renovar\n`;
      }
      
      if (permit.permit_url) {
        message += `   📥 Descargar: ${permit.permit_url}\n`;
      }
      message += `\n`;
    });
    
    await this.sendMessage(from, message);
  }
  
  /**
   * Renew permit
   */
  async renewPermit(from, context) {
    await this.sendMessage(from, 
      `🔄 *Renovación de permisos*\n\n` +
      `Esta función estará disponible pronto.\n\n` +
      `Por ahora, puedes crear un nuevo permiso con /permiso`
    );
  }
  
  /**
   * Get status emoji
   */
  getStatusEmoji(status) {
    const emojis = {
      'DRAFT': '📝',
      'PAYMENT_PENDING': '💳',
      'AWAITING_PAYMENT': '⏳',
      'PAYMENT_PROCESSING': '⚙️',
      'GENERATING_PERMIT': '🖨️',
      'PERMIT_READY': '✅',
      'FAILED': '❌',
      'CANCELLED': '🚫'
    };
    return emojis[status] || '❓';
  }
  
  /**
   * Get status text in Spanish
   */
  getStatusText(status) {
    const texts = {
      'DRAFT': 'Borrador',
      'PAYMENT_PENDING': 'Pago pendiente',
      'AWAITING_PAYMENT': 'Esperando pago',
      'PAYMENT_PROCESSING': 'Procesando pago',
      'GENERATING_PERMIT': 'Generando permiso',
      'PERMIT_READY': 'Permiso listo',
      'FAILED': 'Error',
      'CANCELLED': 'Cancelado'
    };
    return texts[status] || status;
  }
  
  /**
   * Check rate limit for spam protection
   */
  async checkRateLimit(from) {
    const key = `rate:${from}`;
    const now = Date.now();
    
    // Clean old entries
    this.cleanRateLimiter();
    
    // Get current attempts
    const userRateData = this.rateLimiter.get(key) || { count: 0, windowStart: now };
    
    // Check if we're in the same window
    if (now - userRateData.windowStart > this.RATE_LIMIT_WINDOW) {
      // New window
      userRateData.count = 1;
      userRateData.windowStart = now;
    } else {
      // Same window
      userRateData.count++;
    }
    
    // Check limit
    if (userRateData.count > this.RATE_LIMIT_MAX) {
      logger.warn('Rate limit exceeded', { from, count: userRateData.count });
      
      // Only send notification once per window
      const notifyKey = `${from}:${userRateData.windowStart}`;
      if (!this.rateLimitNotified.has(notifyKey)) {
        await this.sendMessage(from, 
          '⏱️ Demasiados mensajes. Por favor espera un momento antes de continuar.\n\n' +
          '💡 Tip: Espera 1 minuto antes de enviar más mensajes.'
        );
        this.rateLimitNotified.set(notifyKey, true);
      }
      return false;
    }
    
    // Update rate limiter
    this.rateLimiter.set(key, userRateData);
    return true;
  }
  
  /**
   * Clean old rate limiter entries
   */
  cleanRateLimiter() {
    const now = Date.now();
    const rateLimiterBefore = this.rateLimiter.size;
    const rateLimitNotifiedBefore = this.rateLimitNotified.size;
    let rateLimiterCleaned = 0;
    let notificationsCleaned = 0;
    
    // Clean rate limiter entries (2x window = 2 minutes old)
    for (const [key, data] of this.rateLimiter.entries()) {
      if (now - data.windowStart > this.RATE_LIMIT_WINDOW * 2) {
        this.rateLimiter.delete(key);
        rateLimiterCleaned++;
      }
    }
    
    // Clean old notification entries
    for (const [key] of this.rateLimitNotified.entries()) {
      try {
        const windowStart = parseInt(key.split(':')[1]);
        if (isNaN(windowStart) || now - windowStart > this.RATE_LIMIT_WINDOW * 2) {
          this.rateLimitNotified.delete(key);
          notificationsCleaned++;
        }
      } catch (error) {
        // Delete malformed keys
        this.rateLimitNotified.delete(key);
        notificationsCleaned++;
      }
    }
    
    // Log cleanup if significant
    if (rateLimiterCleaned > 0 || notificationsCleaned > 0) {
      logger.info('Rate limiter cleanup completed', {
        rateLimiterEntries: { before: rateLimiterBefore, after: this.rateLimiter.size, cleaned: rateLimiterCleaned },
        notificationEntries: { before: rateLimitNotifiedBefore, after: this.rateLimitNotified.size, cleaned: notificationsCleaned }
      });
    }
  }
  
  /**
   * Cleanup method for graceful shutdown
   */
  cleanup() {
    if (this.rateLimiterCleanupInterval) {
      clearInterval(this.rateLimiterCleanupInterval);
      this.rateLimiterCleanupInterval = null;
      logger.info('Rate limiter cleanup interval cleared');
    }
    
    // Final cleanup
    this.cleanRateLimiter();
    
    // Cleanup health monitor
    if (this.healthMonitor) {
      this.healthMonitor.cleanup();
    }
    
    // Cleanup error recovery
    if (this.errorRecovery) {
      this.errorRecovery.cleanup();
    }
    
    // Cleanup state manager
    if (this.stateManager) {
      this.stateManager.cleanupExpiredEntries();
    }
    
    logger.info('WhatsApp service cleanup completed');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const processMemory = process.memoryUsage();
    
    return {
      process: {
        rss: Math.round(processMemory.rss / 1024 / 1024), // MB
        heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
        external: Math.round(processMemory.external / 1024 / 1024) // MB
      },
      service: {
        rateLimiter: this.rateLimiter.size,
        rateLimitNotified: this.rateLimitNotified.size,
        memoryStateCache: this.memoryStateCache.size,
        configInitialized: this._configInitialized,
        healthMonitorActive: !!this.healthMonitor
      },
      components: {
        stateManager: this.stateManager ? this.stateManager.getStatistics() : null,
        errorRecovery: this.errorRecovery ? this.errorRecovery.getStatistics() : null
      }
    };
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, this.MAX_INPUT_LENGTH);
  }
  
  /**
   * Sanitize field value based on field type
   */
  sanitizeFieldValue(value, fieldKey) {
    const maxLength = this.MAX_FIELD_LENGTHS[fieldKey] || this.MAX_INPUT_LENGTH;
    
    let sanitized = this.sanitizeInput(value);
    
    // Field-specific sanitization
    switch (fieldKey) {
      case 'email':
        sanitized = sanitized.toLowerCase();
        break;
      case 'curp_rfc':
      case 'numero_serie':
      case 'numero_motor':
        sanitized = sanitized.toUpperCase().replace(/[^A-Z0-9]/g, '');
        break;
      case 'ano_modelo':
        sanitized = sanitized.replace(/[^0-9]/g, '');
        break;
    }
    
    return sanitized.substring(0, maxLength);
  }
  
  /**
   * In-memory state fallback for Redis failures
   */
  
  async getStateFromMemory(key) {
    const cached = this.memoryStateCache.get(key);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      return cached.data;
    }
    return null;
  }
  
  async saveStateToMemory(key, data) {
    this.memoryStateCache.set(key, {
      data: JSON.stringify(data),
      timestamp: Date.now()
    });
    
    // Clean old entries
    if (this.memoryStateCache.size > 100) {
      const oldestKey = this.memoryStateCache.keys().next().value;
      this.memoryStateCache.delete(oldestKey);
    }
  }
  
  /**
   * Handle user opt-out request
   */
  async handleOptOut(from) {
    const client = await db.getPool().connect();
    
    try {
      const userAccountService = require('./user-account.service');
      const user = await userAccountService.findByWhatsAppPhone(from);
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        if (!user) {
          // Even if no user found, add to opt-out list
          await this.addToOptOutListWithClient(client, from, null, 'user_command');
        } else {
          // Update user record
          const updateQuery = `
            UPDATE users 
            SET whatsapp_opted_out = TRUE,
                whatsapp_optout_date = NOW(),
                whatsapp_phone = NULL,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, first_name`;
          
          const result = await client.query(updateQuery, [user.id]);
          const updatedUser = result.rows[0];
          
          // Add to opt-out list
          await this.addToOptOutListWithClient(client, from, user.id, 'user_command');
          
          // Log consent change
          await this.logConsentChangeWithClient(client, user.id, from, 'opted_out', {
            previous_state: { opted_out: false, phone: from },
            new_state: { opted_out: true, phone: null },
            source: 'whatsapp'
          });
        }
        
        // Commit database changes
        await client.query('COMMIT');
        
        // Clear Redis state after successful database commit
        try {
          const stateKey = `wa:${from}`;
          await redisClient.del(stateKey);
        } catch (redisError) {
          // Log but don't fail - Redis error is not critical
          logger.error('Error clearing Redis state after opt-out', { error: redisError.message, from });
        }
        
        logger.info(`User ${user?.id || 'unknown'} opted out via WhatsApp command`, { phone: from });
        
        // Send appropriate confirmation message
        if (!user) {
          await this.sendMessage(from, 
            '✅ Has sido dado de baja del servicio de WhatsApp.\n\n' +
            'Ya no recibirás más mensajes de Permisos Digitales.\n\n' +
            'Si cambias de opinión, puedes volver a activar el servicio desde nuestra página web.'
          );
        } else {
          await this.sendMessage(from, 
            `✅ ${user.first_name}, has sido dado de baja exitosamente.\n\n` +
            '🚫 Ya no recibirás notificaciones por WhatsApp.\n\n' +
            '📧 Seguirás recibiendo notificaciones importantes por correo electrónico.\n\n' +
            '💡 Puedes reactivar el servicio en cualquier momento desde tu perfil en:\n' +
            'https://permisosdigitales.com.mx/perfil\n\n' +
            'Gracias por usar Permisos Digitales.'
          );
        }
        
      } catch (error) {
        // Rollback on any error
        await client.query('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      logger.error('Error handling opt-out', { error: error.message, from });
      await this.sendMessage(from, 
        '❌ Hubo un error al procesar tu solicitud.\n\n' +
        'Por favor contacta a soporte@permisosdigitales.com.mx'
      );
    } finally {
      client.release();
    }
  }
  
  /**
   * Add phone number to opt-out list (with transaction support)
   */
  async addToOptOutListWithClient(client, phoneNumber, userId, source, reason = null) {
    try {
      const query = `
        INSERT INTO whatsapp_optout_list 
        (phone_number, user_id, opt_out_source, opt_out_reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
          updated_at = NOW(),
          opt_out_source = EXCLUDED.opt_out_source
      `;
      
      await client.query(query, [phoneNumber, userId, source, reason]);
      logger.info('Added to WhatsApp opt-out list', { phoneNumber, userId, source });
    } catch (error) {
      logger.error('Error adding to opt-out list', { error: error.message, phoneNumber });
      throw error;
    }
  }
  
  /**
   * Add phone number to opt-out list (standalone)
   */
  async addToOptOutList(phoneNumber, userId, source, reason = null) {
    try {
      const query = `
        INSERT INTO whatsapp_optout_list 
        (phone_number, user_id, opt_out_source, opt_out_reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
          updated_at = NOW(),
          opt_out_source = EXCLUDED.opt_out_source
      `;
      
      await db.query(query, [phoneNumber, userId, source, reason]);
      logger.info('Added to WhatsApp opt-out list', { phoneNumber, userId, source });
    } catch (error) {
      logger.error('Error adding to opt-out list', { error: error.message, phoneNumber });
      throw error;
    }
  }
  
  /**
   * Check if phone number is opted out
   */
  async isOptedOut(phoneNumber) {
    try {
      // Check opt-out list
      const optOutQuery = `
        SELECT id FROM whatsapp_optout_list 
        WHERE phone_number = $1 
        LIMIT 1
      `;
      const optOutResult = await db.query(optOutQuery, [phoneNumber]);
      
      if (optOutResult.rows.length > 0) {
        return true;
      }
      
      // Also check user record
      const userQuery = `
        SELECT id FROM users 
        WHERE whatsapp_phone = $1 
        AND whatsapp_opted_out = TRUE 
        LIMIT 1
      `;
      const userResult = await db.query(userQuery, [phoneNumber]);
      
      return userResult.rows.length > 0;
    } catch (error) {
      logger.error('Error checking opt-out status', { error: error.message, phoneNumber });
      return false;
    }
  }
  
  /**
   * Log consent change for audit trail (with transaction support)
   */
  async logConsentChangeWithClient(client, userId, phoneNumber, action, details) {
    try {
      const query = `
        INSERT INTO whatsapp_consent_audit
        (user_id, phone_number, action, previous_state, new_state, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await client.query(query, [
        userId,
        phoneNumber,
        action,
        JSON.stringify(details.previous_state || {}),
        JSON.stringify(details.new_state || {}),
        details.source || 'whatsapp'
      ]);
      
      logger.info('Logged WhatsApp consent change', { userId, action });
    } catch (error) {
      logger.error('Error logging consent change', { error: error.message, userId, action });
      // Re-throw in transaction context
      throw error;
    }
  }
  
  /**
   * Log consent change for audit trail (standalone)
   */
  async logConsentChange(userId, phoneNumber, action, details) {
    try {
      const query = `
        INSERT INTO whatsapp_consent_audit
        (user_id, phone_number, action, previous_state, new_state, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await db.query(query, [
        userId,
        phoneNumber,
        action,
        JSON.stringify(details.previous_state || {}),
        JSON.stringify(details.new_state || {}),
        details.source || 'whatsapp'
      ]);
      
      logger.info('Logged WhatsApp consent change', { userId, action });
    } catch (error) {
      logger.error('Error logging consent change', { error: error.message, userId, action });
      // Don't throw - this is audit logging
    }
  }

  /**
   * Send message with error handling
   */
  async sendMessage(to, message) {
    try {
      const config = this.getConfig();
      
      // Validate message
      if (!message || message.length > 4096) {
        throw new Error('Invalid message length');
      }
      
      // Normalize Mexican phone numbers: 521... -> 52...
      const normalizedTo = to.startsWith('521') && to.length === 13 ? '52' + to.substring(3) : to;
      
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedTo,
          type: 'text',
          text: { body: message }
        })
      });
      
      if (!response.ok) {
        let errorData = 'Unknown error';
        try {
          errorData = await response.text();
        } catch (e) {
          logger.error('Error reading error response', { error: e.message });
        }
        throw new Error(`WhatsApp API error: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      logger.info('WhatsApp message sent', { 
        originalTo: to, 
        normalizedTo: normalizedTo,
        messageId: data.messages[0].id 
      });
      return data;
    } catch (error) {
      logger.error('Error sending WhatsApp message', { 
        error: error.message,
        to,
        messageLength: message?.length 
      });
      throw error;
    }
  }
}

// Initialize configuration validation when module loads
try {
  SimpleWhatsAppService.validateConfig();
} catch (error) {
  logger.error('WhatsApp service configuration error', { error: error.message });
  // Don't crash the app if WhatsApp config is missing
}

module.exports = SimpleWhatsAppService;
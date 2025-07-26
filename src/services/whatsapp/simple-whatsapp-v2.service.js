const redisClient = require('../../utils/redis-client');
const logger = require('../../utils/logger');
const securityUtils = require('./security-utils');
const WhatsAppEnhancements = require('./whatsapp-enhancements');

class SimpleWhatsAppServiceV2 {
  constructor() {
    // WhatsApp configuration
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiUrl: `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
    };
    
    // Initialize enhancements
    this.enhancements = new WhatsAppEnhancements();
    
    // Redis state manager
    this.stateManager = {
      setState: async (phoneNumber, state) => {
        const stateKey = `wa:${phoneNumber}`;
        try {
          await redisClient.setex(stateKey, 3600, JSON.stringify(state));
        } catch (error) {
          logger.error('Redis setState error', { error: error.message });
          // Fallback to memory
          this.memoryStateCache.set(stateKey, state);
        }
      },
      
      getState: async (phoneNumber) => {
        const stateKey = `wa:${phoneNumber}`;
        try {
          const data = await redisClient.get(stateKey);
          return data ? JSON.parse(data) : null;
        } catch (error) {
          logger.error('Redis getState error', { error: error.message });
          // Fallback to memory
          return this.memoryStateCache.get(stateKey) || null;
        }
      },
      
      clearState: async (phoneNumber) => {
        const stateKey = `wa:${phoneNumber}`;
        try {
          await redisClient.del(stateKey);
        } catch (error) {
          logger.error('Redis clearState error', { error: error.message });
        }
        this.memoryStateCache.delete(stateKey);
      }
    };
    
    // Memory fallback cache
    this.memoryStateCache = new Map();
    
    // Health monitor
    this.healthMonitor = {
      recordSuccess: () => logger.info('WhatsApp message processed successfully'),
      recordError: (type, from) => logger.error('WhatsApp processing error', { type, from })
    };
    
    // Error recovery
    this.errorRecovery = {
      handleError: async (from, error, context) => {
        logger.error('WhatsApp error', { from, error: error.message, context });
        await this.sendMessage(from, 
          '❌ Ocurrió un error. Por favor intenta de nuevo o escribe "ayuda".'
        );
      }
    };
    
    // Natural language commands - NO SLASHES!
    this.commands = {
      // Greetings
      'hola': 'handleGreeting',
      'inicio': 'handleGreeting',
      'menu': 'handleGreeting',
      'menú': 'handleGreeting',
      'buenos dias': 'handleGreeting',
      'buenas tardes': 'handleGreeting',
      'buenas noches': 'handleGreeting',
      
      // Primary actions
      'permiso': 'startOrResumeApplication',
      'nuevo permiso': 'startOrResumeApplication',
      'solicitar': 'startOrResumeApplication',
      'tramitar': 'startOrResumeApplication',
      'quiero un permiso': 'startOrResumeApplication',
      
      // Status
      'estado': 'checkStatus',
      'mi solicitud': 'checkStatus',
      'como va': 'checkStatus',
      'status': 'checkStatus',
      'consultar': 'checkStatus',
      
      // Payment
      'pagar': 'getPaymentLinks',
      'pago': 'getPaymentLinks',
      'link': 'getPaymentLinks',
      'enlace': 'getPaymentLinks',
      
      // Help
      'ayuda': 'sendContextualHelp',
      'help': 'sendContextualHelp',
      'no entiendo': 'sendContextualHelp',
      'que hago': 'sendContextualHelp',
      'informacion': 'sendContextualHelp',
      
      // Cancel/Exit
      'cancelar': 'cancelCurrent',
      'salir': 'cancelCurrent',
      'terminar': 'cancelCurrent',
      'reset': 'cancelCurrent',
      'reiniciar': 'cancelCurrent',
      
      // Other
      'mis permisos': 'listUserPermits',
      'renovar': 'renewPermit',
      
      // Opt-out
      'stop': 'handleOptOut',
      'detener': 'handleOptOut',
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
        prompt: '📄 ¿Cuál es tu CURP o RFC?', 
        type: 'curp_rfc',
        help: 'Puedes usar CURP (18 caracteres) o RFC (13 caracteres). Lo encuentras en tu INE, acta de nacimiento o constancia del SAT.'
      },
      { 
        key: 'domicilio', 
        label: 'Domicilio',
        prompt: '🏠 ¿Cuál es tu domicilio completo?', 
        type: 'text',
        help: 'Ejemplo: Av. Reforma 123, Col. Centro, Monterrey, NL, 64000. Este será el domicilio que aparecerá en tu permiso.'
      },
      { 
        key: 'email', 
        label: 'Correo electrónico',
        prompt: '📧 ¿Cuál es tu correo electrónico?', 
        type: 'email',
        help: 'Asegúrate de escribirlo correctamente. Aquí recibirás tu permiso y el comprobante de pago. Ejemplo: juan.perez@gmail.com'
      },
      { 
        key: 'marca', 
        label: 'Marca del vehículo',
        prompt: '🚗 Ahora vamos con tu vehículo. ¿Qué marca es?', 
        type: 'text',
        help: 'La marca es el fabricante del vehículo. Ejemplos: Toyota, Nissan, Chevrolet, Ford, Volkswagen, Honda, Mazda.'
      },
      { 
        key: 'linea', 
        label: 'Modelo/Línea',
        prompt: '📋 ¿Qué modelo es?', 
        type: 'text',
        help: 'El modelo o línea es el nombre específico del vehículo. Lo encuentras en la parte trasera del auto o en tu tarjeta de circulación.'
      },
      { 
        key: 'color', 
        label: 'Color',
        prompt: '🎨 ¿De qué color es tu vehículo?', 
        type: 'color',
        help: 'Si tu vehículo tiene dos colores, escríbelos separados con "y". Ejemplo: Blanco y Azul, Gris y Negro.'
      },
      { 
        key: 'numero_serie', 
        label: 'Número de serie (VIN)',
        prompt: '🔢 ¿Cuál es el número de serie (VIN)?', 
        type: 'vin',
        help: 'El VIN tiene 17 caracteres (letras y números). Lo encuentras en el parabrisas del lado del conductor, en la puerta del conductor o en tu tarjeta de circulación.'
      },
      { 
        key: 'numero_motor', 
        label: 'Número de motor',
        prompt: '⚙️ ¿Cuál es el número de motor?', 
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
  }
  
  /**
   * Process incoming message
   */
  async processMessage(from, message) {
    const startTime = Date.now();
    
    try {
      // Initial validation and sanitization
      const sanitizedMessage = await this.validateAndSanitizeInput(from, message);
      if (!sanitizedMessage) return;
      
      // Check for button/list responses
      const buttonResponse = await this.handleInteractiveResponse(from, sanitizedMessage);
      if (buttonResponse) return;
      
      // Get current state
      const state = await this.stateManager.getState(from);
      const context = await this.getUserContext(from);
      
      // Check for natural language commands
      const command = this.enhancements.processNaturalCommand(sanitizedMessage);
      if (command) {
        await this.executeCommand(command, from, context);
        return;
      }
      
      // If user has active state, continue with form
      if (state) {
        await this.handleStatefulConversation(from, sanitizedMessage, state);
      } else {
        // No state - check what user wants
        await this.handleStatelessMessage(from, sanitizedMessage, context);
      }
      
      // Track success
      this.healthMonitor.recordSuccess('message_processing', from);
      
    } catch (error) {
      logger.error('Error processing message', { 
        error: error.message,
        from,
        message: message?.substring(0, 100)
      });
      
      this.healthMonitor.recordError('message_processing', from);
      await this.errorRecovery.handleError(from, error, { message });
    }
  }
  
  /**
   * Handle interactive button/list responses
   */
  async handleInteractiveResponse(from, message) {
    // Check if message is a button response ID
    const buttonResponses = {
      // Main menu
      'new_permit': () => this.startOrResumeApplication(from),
      'check_status': () => this.checkStatus(from),
      'pending_payment': () => this.getPaymentLinks(from),
      'my_permits': () => this.listUserPermits(from),
      'renew': () => this.renewPermit(from),
      'help': () => this.sendContextualHelp(from),
      
      // Confirmations
      'yes': () => this.handleYesResponse(from),
      'no': () => this.handleNoResponse(from),
      'for_me': () => this.handleForMeResponse(from),
      'for_other': () => this.handleForOtherResponse(from),
      
      // Field help
      'see_example': () => this.showFieldExample(from),
      'get_help': () => this.showFieldHelp(from),
      'skip_field': () => this.skipCurrentField(from),
      'go_back': () => this.goToPreviousField(from),
      'pause': () => this.pauseApplication(from)
    };
    
    const handler = buttonResponses[message];
    if (handler) {
      await handler();
      return true;
    }
    
    return false;
  }
  
  /**
   * Send welcome message with interactive menu
   */
  async sendWelcomeMessage(from, context) {
    try {
      const isReturning = context && context.user;
      const userName = isReturning ? context.user.first_name : '';
      
      if (isReturning) {
        // Ask who the permit is for
        await this.sendInteractiveMessage(from, 
          this.enhancements.createForWhomQuestion(userName)
        );
      } else {
        // Send interactive menu
        await this.sendInteractiveMessage(from, 
          this.enhancements.createWelcomeMenu(isReturning, userName)
        );
      }
    } catch (error) {
      // Fallback to text message if interactive fails
      logger.error('Interactive message failed, using text', { error: error.message });
      await this.sendTextWelcome(from, context);
    }
  }
  
  /**
   * Handle field collection with better UX
   */
  async handleFieldCollection(from, sanitizedMessage, state) {
    const msgLower = sanitizedMessage.toLowerCase().trim();
    
    // Natural language commands (no slashes!)
    if (msgLower === 'cancelar' || msgLower === 'salir') {
      await this.cancelCurrent(from);
      return;
    } else if (msgLower === 'estado' || msgLower === 'progreso') {
      await this.showProgress(from, state);
      return;
    } else if (msgLower === 'ayuda' || msgLower === '?') {
      await this.showFieldHelp(from, state);
      return;
    } else if (msgLower === 'atras' || msgLower === 'anterior' || msgLower === 'regresar') {
      await this.goToPreviousField(from, state);
      return;
    } else if (msgLower === 'pausa' || msgLower === 'guardar') {
      await this.pauseApplication(from, state);
      return;
    }
    
    // Process field input
    await this.processFieldInput(from, sanitizedMessage, state);
  }
  
  /**
   * Process field input with enhanced validation
   */
  async processFieldInput(from, sanitizedMessage, state) {
    const currentField = this.fields[state.currentFieldIndex];
    const sanitizedValue = this.sanitizeFieldValue(sanitizedMessage, currentField.key);
    const value = this.extractField(sanitizedValue, currentField.type);
    
    if (!value) {
      // Send interactive error message
      try {
        await this.sendInteractiveMessage(from,
          this.enhancements.createErrorMessage(currentField, 'format', sanitizedMessage)
        );
      } catch (error) {
        // Fallback to text
        await this.sendValidationError(from, currentField, 'format');
      }
      return;
    }
    
    const validation = this.validateField(currentField.key, value);
    if (!validation.isValid) {
      try {
        await this.sendInteractiveMessage(from,
          this.enhancements.createErrorMessage(currentField, 'validation', sanitizedMessage)
        );
      } catch (error) {
        // Fallback to text
        await this.sendValidationError(from, currentField, validation.error);
      }
      return;
    }
    
    // Store validated value
    state.data[currentField.key] = validation.sanitized || value;
    state.lastActivity = Date.now();
    
    // Send success confirmation
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
    
    // Send next field with interactive progress
    try {
      const nextField = this.fields[state.currentFieldIndex];
      await this.sendInteractiveMessage(from,
        this.enhancements.createProgressUpdate(
          state.currentFieldIndex + 1,
          this.fields.length,
          nextField
        )
      );
    } catch (error) {
      // Fallback to text
      await this.sendNextFieldPrompt(from, state);
    }
  }
  
  /**
   * Send message with interactive elements
   */
  async sendInteractiveMessage(to, interactiveConfig) {
    try {
      return await this.enhancements.sendInteractiveMessage(to, interactiveConfig, this.config);
    } catch (error) {
      logger.error('Failed to send interactive message', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Send plain text message
   */
  async sendMessage(to, message) {
    try {
      const normalizedTo = to.startsWith('521') && to.length === 13 ? '52' + to.substring(3) : to;
      
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
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
        const errorData = await response.text();
        throw new Error(`WhatsApp API error: ${errorData}`);
      }
      
      const result = await response.json();
      logger.info('WhatsApp message sent', {
        messageId: result.messages?.[0]?.id,
        to: normalizedTo
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        error: error.message,
        to
      });
      throw error;
    }
  }
  
  /**
   * Show contextual help
   */
  async sendContextualHelp(from, context) {
    const helpMessage = `📚 *AYUDA - Permisos Digitales*

*Comandos disponibles:*
✅ Escribe *"permiso"* - Nueva solicitud
📊 Escribe *"estado"* - Ver tus solicitudes  
💳 Escribe *"pagar"* - Enlaces de pago
📋 Escribe *"mis permisos"* - Ver permisos
❌ Escribe *"cancelar"* - Cancelar/reiniciar

*Durante el llenado:*
↩️ Escribe *"atras"* - Campo anterior
⏸️ Escribe *"pausa"* - Guardar progreso
❓ Escribe *"ayuda"* - Ver esta ayuda

💬 *Soporte:* soporte@permisosdigitales.com.mx
📞 *WhatsApp:* Este mismo número

_Responde con palabras naturales, no necesitas usar comandos especiales._`;

    await this.sendMessage(from, helpMessage);
  }
  
  // Copy all the helper methods from the original service...
  // (validateField, extractField, sanitizeFieldValue, etc.)
  
}

module.exports = SimpleWhatsAppServiceV2;
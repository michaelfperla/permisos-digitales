/**
 * Conversation Manager Service
 * Handles conversation state, context, and flow management
 * Inspired by chambabot's state management patterns
 */

const redisClient = require('../../utils/redis-client');
const { logger } = require('../../utils/logger');

class ConversationManagerService {
  constructor() {
    this.CONVERSATION_TTL = 86400; // 24 hours in seconds
    this.STATES = {
      IDLE: 'idle',
      COLLECTING_PERSONAL_INFO: 'collecting_personal_info',
      COLLECTING_VEHICLE_INFO: 'collecting_vehicle_info',
      CONFIRMING_DATA: 'confirming_data',
      AWAITING_PAYMENT: 'awaiting_payment',
      PROCESSING_PERMIT: 'processing_permit',
      COMPLETED: 'completed',
      ERROR: 'error'
    };
    
    this.COMMANDS = {
      START_PERMIT: '/permiso',
      HELP: '/ayuda',
      STATUS: '/estado',
      CANCEL: '/cancelar',
      RESTART: '/reiniciar'
    };
  }

  /**
   * Get or create conversation context
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Conversation context
   */
  async getConversation(phoneNumber) {
    const key = `whatsapp:conversation:${phoneNumber}`;
    
    try {
      const data = await redisClient.get(key);
      
      if (data) {
        return JSON.parse(data);
      }
      
      // Create new conversation
      return this.createNewConversation(phoneNumber);
    } catch (error) {
      logger.error('Error getting conversation', { error: error.message, phoneNumber });
      // Return new conversation as fallback
      return this.createNewConversation(phoneNumber);
    }
  }

  /**
   * Create a new conversation
   * @param {string} phoneNumber - User's phone number
   * @returns {Object} New conversation context
   */
  createNewConversation(phoneNumber) {
    return {
      phoneNumber,
      state: this.STATES.IDLE,
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      personalInfo: {},
      vehicleInfo: {},
      completedFields: [],
      messageHistory: [],
      attempts: {},
      metadata: {}
    };
  }

  /**
   * Update conversation context
   * @param {string} phoneNumber - User's phone number
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated conversation
   */
  async updateConversation(phoneNumber, updates) {
    const key = `whatsapp:conversation:${phoneNumber}`;
    
    try {
      const conversation = await this.getConversation(phoneNumber);
      
      // Merge updates
      const updatedConversation = {
        ...conversation,
        ...updates,
        lastMessageAt: new Date().toISOString()
      };
      
      // Save to Redis with TTL
      await redisClient.setex(
        key,
        this.CONVERSATION_TTL,
        JSON.stringify(updatedConversation)
      );
      
      return updatedConversation;
    } catch (error) {
      logger.error('Error updating conversation', { error: error.message, phoneNumber });
      throw error;
    }
  }

  /**
   * Add message to conversation history
   * @param {string} phoneNumber - User's phone number
   * @param {Object} message - Message object
   * @returns {Promise<void>}
   */
  async addMessageToHistory(phoneNumber, message) {
    const conversation = await this.getConversation(phoneNumber);
    
    // Keep only last 50 messages
    const messageHistory = [
      ...conversation.messageHistory.slice(-49),
      {
        ...message,
        timestamp: new Date().toISOString()
      }
    ];
    
    await this.updateConversation(phoneNumber, { messageHistory });
  }

  /**
   * Update conversation state
   * @param {string} phoneNumber - User's phone number
   * @param {string} newState - New state
   * @returns {Promise<Object>} Updated conversation
   */
  async updateState(phoneNumber, newState) {
    logger.info('Updating conversation state', { phoneNumber, newState });
    
    return await this.updateConversation(phoneNumber, {
      state: newState,
      stateChangedAt: new Date().toISOString()
    });
  }

  /**
   * Add completed field
   * @param {string} phoneNumber - User's phone number
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {string} category - 'personal' or 'vehicle'
   * @returns {Promise<void>}
   */
  async addCompletedField(phoneNumber, field, value, category) {
    const conversation = await this.getConversation(phoneNumber);
    
    // Update field value
    if (category === 'personal') {
      conversation.personalInfo[field] = value;
    } else if (category === 'vehicle') {
      conversation.vehicleInfo[field] = value;
    }
    
    // Mark as completed
    if (!conversation.completedFields.includes(field)) {
      conversation.completedFields.push(field);
    }
    
    await this.updateConversation(phoneNumber, {
      personalInfo: conversation.personalInfo,
      vehicleInfo: conversation.vehicleInfo,
      completedFields: conversation.completedFields
    });
  }

  /**
   * Check if all required fields are completed
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Completion status
   */
  async checkCompletion(phoneNumber) {
    const conversation = await this.getConversation(phoneNumber);
    
    const requiredPersonalFields = ['nombre_completo', 'curp_rfc', 'domicilio'];
    const requiredVehicleFields = ['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo'];
    
    const personalComplete = requiredPersonalFields.every(
      field => conversation.completedFields.includes(field)
    );
    
    const vehicleComplete = requiredVehicleFields.every(
      field => conversation.completedFields.includes(field)
    );
    
    return {
      personalComplete,
      vehicleComplete,
      allComplete: personalComplete && vehicleComplete,
      missingPersonal: requiredPersonalFields.filter(
        field => !conversation.completedFields.includes(field)
      ),
      missingVehicle: requiredVehicleFields.filter(
        field => !conversation.completedFields.includes(field)
      )
    };
  }

  /**
   * Get formatted application data
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Formatted application data
   */
  async getApplicationData(phoneNumber) {
    const conversation = await this.getConversation(phoneNumber);
    
    return {
      ...conversation.personalInfo,
      ...conversation.vehicleInfo,
      phone_number: phoneNumber,
      source: 'whatsapp'
    };
  }

  /**
   * Store application ID after creation
   * @param {string} phoneNumber - User's phone number
   * @param {number} applicationId - Application ID from database
   * @returns {Promise<void>}
   */
  async storeApplicationId(phoneNumber, applicationId) {
    await this.updateConversation(phoneNumber, {
      applicationId,
      metadata: {
        ...(await this.getConversation(phoneNumber)).metadata,
        applicationCreatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Store payment information
   * @param {string} phoneNumber - User's phone number
   * @param {Object} paymentInfo - Payment information
   * @returns {Promise<void>}
   */
  async storePaymentInfo(phoneNumber, paymentInfo) {
    const conversation = await this.getConversation(phoneNumber);
    
    await this.updateConversation(phoneNumber, {
      paymentInfo,
      metadata: {
        ...conversation.metadata,
        paymentLinkCreatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Clear conversation
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<void>}
   */
  async clearConversation(phoneNumber) {
    const key = `whatsapp:conversation:${phoneNumber}`;
    
    try {
      await redisClient.del(key);
      logger.info('Conversation cleared', { phoneNumber });
    } catch (error) {
      logger.error('Error clearing conversation', { error: error.message, phoneNumber });
    }
  }

  /**
   * Track field attempt (for error handling)
   * @param {string} phoneNumber - User's phone number
   * @param {string} field - Field name
   * @returns {Promise<number>} Attempt count
   */
  async trackFieldAttempt(phoneNumber, field) {
    const conversation = await this.getConversation(phoneNumber);
    
    conversation.attempts[field] = (conversation.attempts[field] || 0) + 1;
    
    await this.updateConversation(phoneNumber, {
      attempts: conversation.attempts
    });
    
    return conversation.attempts[field];
  }

  /**
   * Get conversation summary
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<string>} Formatted summary
   */
  async getConversationSummary(phoneNumber) {
    const conversation = await this.getConversation(phoneNumber);
    const completion = await this.checkCompletion(phoneNumber);
    
    const personal = conversation.personalInfo;
    const vehicle = conversation.vehicleInfo;
    
    let summary = '📋 **Resumen de tu solicitud:**\n\n';
    
    // Personal info
    summary += '**Información Personal:**\n';
    summary += personal.nombre_completo ? `✅ Nombre: ${personal.nombre_completo}\n` : '❌ Nombre: Pendiente\n';
    summary += personal.curp_rfc ? `✅ CURP/RFC: ${personal.curp_rfc}\n` : '❌ CURP/RFC: Pendiente\n';
    summary += personal.domicilio ? `✅ Domicilio: ${personal.domicilio}\n` : '❌ Domicilio: Pendiente\n';
    
    summary += '\n**Información del Vehículo:**\n';
    summary += vehicle.marca ? `✅ Marca: ${vehicle.marca}\n` : '❌ Marca: Pendiente\n';
    summary += vehicle.linea ? `✅ Línea: ${vehicle.linea}\n` : '❌ Línea: Pendiente\n';
    summary += vehicle.color ? `✅ Color: ${vehicle.color}\n` : '❌ Color: Pendiente\n';
    summary += vehicle.ano_modelo ? `✅ Año: ${vehicle.ano_modelo}\n` : '❌ Año: Pendiente\n';
    summary += vehicle.numero_serie ? `✅ No. Serie: ${vehicle.numero_serie}\n` : '❌ No. Serie: Pendiente\n';
    summary += vehicle.numero_motor ? `✅ No. Motor: ${vehicle.numero_motor}\n` : '❌ No. Motor: Pendiente\n';
    
    // Progress
    const totalFields = 9;
    const completedFields = conversation.completedFields.length;
    const progressPercentage = Math.round((completedFields / totalFields) * 100);
    
    summary += `\n📊 **Progreso:** ${completedFields}/${totalFields} campos (${progressPercentage}%)`;
    
    return summary;
  }

  /**
   * Check if message is a command
   * @param {string} message - User message
   * @returns {Object} Command info
   */
  parseCommand(message) {
    const normalizedMessage = message.trim().toLowerCase();
    
    for (const [key, command] of Object.entries(this.COMMANDS)) {
      if (normalizedMessage === command || normalizedMessage.startsWith(command + ' ')) {
        return {
          isCommand: true,
          command: key,
          args: normalizedMessage.replace(command, '').trim()
        };
      }
    }
    
    return {
      isCommand: false,
      command: null,
      args: null
    };
  }

  /**
   * Get deduplication key for webhook
   * @param {string} messageId - WhatsApp message ID
   * @returns {string} Redis key
   */
  getDeduplicationKey(messageId) {
    return `whatsapp:dedup:${messageId}`;
  }

  /**
   * Check if message was already processed
   * @param {string} messageId - WhatsApp message ID
   * @returns {Promise<boolean>} Whether message was processed
   */
  async isDuplicateMessage(messageId) {
    const key = this.getDeduplicationKey(messageId);
    
    try {
      const exists = await redisClient.get(key);
      
      if (exists) {
        return true;
      }
      
      // Mark as processed (TTL 1 hour)
      await redisClient.setex(key, 3600, '1');
      return false;
    } catch (error) {
      logger.error('Error checking duplicate message', { error: error.message, messageId });
      return false;
    }
  }
}

module.exports = ConversationManagerService;
/**
 * Permit Conversation Service
 * Orchestrates the permit application flow through WhatsApp
 */

const WhatsAppClientService = require('./whatsapp-client.service');
const ConversationManagerService = require('./conversation-manager.service');
const AIProcessorService = require('./ai-processor.service');
const applicationService = require('../application.service');
const stripeLinkService = require('./stripe-payment-link.service');
const { logger } = require('../../utils/logger');

class PermitConversationService {
  constructor() {
    this.whatsappClient = new WhatsAppClientService();
    this.conversationManager = new ConversationManagerService();
    this.aiProcessor = new AIProcessorService();
  }

  /**
   * Process incoming WhatsApp message
   * @param {Object} webhookData - WhatsApp webhook data
   * @returns {Promise<void>}
   */
  async processMessage(webhookData) {
    try {
      const { from, message, type } = this.extractMessageData(webhookData);
      
      // Check for duplicate message
      if (await this.conversationManager.isDuplicateMessage(message.id)) {
        logger.info('Duplicate message detected, skipping', { messageId: message.id });
        return;
      }
      
      // Mark message as read
      await this.whatsappClient.markAsRead(message.id);
      
      // Get conversation context
      const conversation = await this.conversationManager.getConversation(from);
      
      // Add message to history
      await this.conversationManager.addMessageToHistory(from, {
        type: 'user',
        content: type === 'text' ? message.text.body : '[Audio message]',
        messageType: type
      });
      
      // Process based on message type
      let processedMessage;
      if (type === 'audio') {
        processedMessage = await this.processAudioMessage(message);
      } else if (type === 'interactive') {
        processedMessage = message.interactive.button_reply.id;
      } else {
        processedMessage = message.text.body;
      }
      
      // Check for commands
      const commandResult = this.conversationManager.parseCommand(processedMessage);
      if (commandResult.isCommand) {
        await this.handleCommand(from, commandResult, conversation);
        return;
      }
      
      // Process message based on conversation state
      await this.processConversationFlow(from, processedMessage, conversation);
      
    } catch (error) {
      logger.error('Error processing WhatsApp message', { error: error.message });
      await this.sendErrorMessage(webhookData.from);
    }
  }

  /**
   * Extract message data from webhook
   */
  extractMessageData(webhookData) {
    const entry = webhookData.entry[0];
    const change = entry.changes[0];
    const value = change.value;
    const message = value.messages[0];
    
    return {
      from: message.from,
      message: message,
      type: message.type,
      timestamp: message.timestamp
    };
  }

  /**
   * Process audio message (voice notes)
   */
  async processAudioMessage(message) {
    try {
      // Download audio from WhatsApp
      const audioBuffer = await this.whatsappClient.downloadMedia(message.audio.id);
      
      // Here you would integrate with a speech-to-text service
      // For now, return a placeholder
      logger.info('Audio message received, transcription not implemented yet');
      return '[Audio transcription not available]';
    } catch (error) {
      logger.error('Error processing audio message', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle commands
   */
  async handleCommand(phoneNumber, commandResult, conversation) {
    const { command } = commandResult;
    
    switch (command) {
      case 'START_PERMIT':
        await this.startPermitApplication(phoneNumber, conversation);
        break;
      
      case 'HELP':
        await this.sendHelpMessage(phoneNumber);
        break;
      
      case 'STATUS':
        await this.sendStatusMessage(phoneNumber, conversation);
        break;
      
      case 'CANCEL':
        await this.cancelApplication(phoneNumber, conversation);
        break;
      
      case 'RESTART':
        await this.restartApplication(phoneNumber);
        break;
      
      default:
        await this.whatsappClient.sendTextMessage(
          phoneNumber,
          'Comando no reconocido. Envía /ayuda para ver los comandos disponibles.'
        );
    }
  }

  /**
   * Start permit application
   */
  async startPermitApplication(phoneNumber, conversation) {
    // Check if there's an active application
    if (conversation.state !== this.conversationManager.STATES.IDLE && 
        conversation.state !== this.conversationManager.STATES.COMPLETED) {
      const summary = await this.conversationManager.getConversationSummary(phoneNumber);
      
      await this.whatsappClient.sendInteractiveButtons(
        phoneNumber,
        `${summary}\n\n¿Qué deseas hacer?`,
        [
          { id: 'continue', title: 'Continuar' },
          { id: 'restart', title: 'Nueva solicitud' },
          { id: 'cancel', title: 'Cancelar' }
        ],
        'Solicitud en Proceso'
      );
      return;
    }
    
    // Start new application
    await this.conversationManager.updateState(
      phoneNumber,
      this.conversationManager.STATES.COLLECTING_PERSONAL_INFO
    );
    
    const welcomeMessage = `🚗 **¡Bienvenido a Permisos Digitales!**

Te ayudaré a tramitar tu permiso de circulación de manera rápida y sencilla.

📋 Necesitaré:
• Tus datos personales
• Información de tu vehículo

💰 Costo: $99.00 MXN
⏱️ Tiempo: 5-10 minutos después del pago

¿Comenzamos? Por favor, dime tu nombre completo.`;
    
    await this.whatsappClient.sendTextMessage(phoneNumber, welcomeMessage);
  }

  /**
   * Process conversation flow based on state
   */
  async processConversationFlow(phoneNumber, message, conversation) {
    const { state } = conversation;
    
    // Handle confirmation state
    if (state === this.conversationManager.STATES.CONFIRMING_DATA) {
      await this.handleConfirmation(phoneNumber, message, conversation);
      return;
    }
    
    // Extract data from message
    const extractionResult = await this.aiProcessor.extractPermitData(message, conversation);
    
    // Update conversation with extracted fields
    if (extractionResult.extractedFields && Object.keys(extractionResult.extractedFields).length > 0) {
      for (const [field, value] of Object.entries(extractionResult.extractedFields)) {
        const category = ['nombre_completo', 'curp_rfc', 'domicilio'].includes(field) ? 'personal' : 'vehicle';
        await this.conversationManager.addCompletedField(phoneNumber, field, value, category);
      }
    }
    
    // Check completion status
    const completion = await this.conversationManager.checkCompletion(phoneNumber);
    
    // Update state based on completion
    if (state === this.conversationManager.STATES.COLLECTING_PERSONAL_INFO && completion.personalComplete) {
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.COLLECTING_VEHICLE_INFO
      );
    } else if (state === this.conversationManager.STATES.COLLECTING_VEHICLE_INFO && completion.vehicleComplete) {
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.CONFIRMING_DATA
      );
      await this.sendConfirmation(phoneNumber, conversation);
      return;
    }
    
    // Generate and send response
    const response = await this.aiProcessor.generateResponse(conversation, extractionResult);
    await this.whatsappClient.sendTextMessage(phoneNumber, response);
  }

  /**
   * Send confirmation message
   */
  async sendConfirmation(phoneNumber, conversation) {
    const personal = conversation.personalInfo;
    const vehicle = conversation.vehicleInfo;
    
    const confirmationMessage = `📋 **CONFIRMACIÓN DE DATOS**

**Información Personal:**
• Nombre: ${personal.nombre_completo}
• CURP/RFC: ${personal.curp_rfc}
• Domicilio: ${personal.domicilio}

**Información del Vehículo:**
• ${vehicle.marca} ${vehicle.linea} ${vehicle.ano_modelo}
• Color: ${vehicle.color}
• No. Serie: ${vehicle.numero_serie}
• No. Motor: ${vehicle.numero_motor}

💰 **Costo: $99.00 MXN**

¿Todos los datos son correctos?`;
    
    await this.whatsappClient.sendInteractiveButtons(
      phoneNumber,
      confirmationMessage,
      [
        { id: 'confirm_yes', title: 'Sí, continuar' },
        { id: 'confirm_no', title: 'No, corregir' }
      ],
      'Confirmar Información'
    );
  }

  /**
   * Handle confirmation response
   */
  async handleConfirmation(phoneNumber, message, conversation) {
    const normalizedMessage = message.toLowerCase().trim();
    
    if (normalizedMessage === 'sí' || normalizedMessage === 'si' || 
        normalizedMessage === 'confirm_yes' || normalizedMessage.includes('continuar')) {
      // Create application and payment
      await this.createApplicationAndPayment(phoneNumber, conversation);
    } else if (normalizedMessage === 'no' || normalizedMessage === 'confirm_no' || 
               normalizedMessage.includes('corregir')) {
      // Go back to vehicle info state
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.COLLECTING_VEHICLE_INFO
      );
      
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        '¿Qué dato necesitas corregir? Puedes escribirlo directamente.\n\nEjemplo: "El color es azul" o "Mi CURP es XXXX"'
      );
    } else {
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        'Por favor responde "Sí" para continuar o "No" para corregir los datos.'
      );
    }
  }

  /**
   * Create application and payment link
   */
  async createApplicationAndPayment(phoneNumber, conversation) {
    try {
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.AWAITING_PAYMENT
      );
      
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        '⏳ Creando tu solicitud y preparando el enlace de pago...'
      );
      
      // Get application data
      const applicationData = await this.conversationManager.getApplicationData(phoneNumber);
      
      // Find or create user using WhatsApp user account service
      const userAccountService = require('./user-account.service');
      let user = await userAccountService.findByWhatsAppPhone(phoneNumber);

      if (!user) {
        // Create user with WhatsApp phone as primary identifier
        user = await userAccountService.createOrFindUser(
          phoneNumber,
          null, // No email provided in this flow
          applicationData.nombre_completo
        );
      }
      
      // Create application
      const application = await applicationService.createApplication({
        ...applicationData,
        user_id: user.id,
        importe: 99.00
      });
      
      // Store application ID in conversation
      await this.conversationManager.storeApplicationId(phoneNumber, application.id);
      
      // Create Stripe payment link using service that handles NULL emails
      const checkoutSession = await stripeLinkService.createCheckoutSession({
        applicationId: application.id,
        amount: 99.00,
        currency: 'MXN',
        customerEmail: null, // WhatsApp users can have NULL emails
        metadata: {
          application_id: application.id,
          phone_number: phoneNumber,
          source: 'whatsapp'
        }
      });
      
      const paymentLink = { url: checkoutSession.url };
      
      // Store payment info
      await this.conversationManager.storePaymentInfo(phoneNumber, {
        paymentLink: paymentLink.url,
        paymentLinkId: paymentLink.id
      });
      
      // Send payment message
      const paymentMessage = `✅ ¡Solicitud creada exitosamente!

📱 **Folio:** ${application.id}

💳 **Para completar tu trámite, realiza el pago aquí:**
${paymentLink.url}

Puedes pagar con:
• Tarjeta de crédito o débito
• Transferencia SPEI
• Pago en OXXO

Una vez confirmado el pago, recibirás tu permiso digital por este medio en 5-10 minutos.

¿Necesitas ayuda? Envía /ayuda`;
      
      await this.whatsappClient.sendTextMessage(phoneNumber, paymentMessage);
      
    } catch (error) {
      logger.error('Error creating application and payment', { error: error.message });
      
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.ERROR
      );
      
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        '❌ Hubo un error al crear tu solicitud. Por favor intenta nuevamente o contacta soporte.\n\nEnvía /reiniciar para intentar de nuevo.'
      );
    }
  }

  /**
   * Handle payment confirmation (webhook from payment service)
   */
  async handlePaymentConfirmation(applicationId, paymentStatus) {
    try {
      // Find conversation by application ID
      const application = await applicationService.getApplicationById(applicationId);
      if (!application) {
        logger.error('Application not found for payment confirmation', { applicationId });
        return;
      }
      
      // Get phone number from application metadata or user
      const user = await require('../user.service').findById(application.user_id);
      const phoneNumber = user.phone;
      
      if (!phoneNumber) {
        logger.error('Phone number not found for payment confirmation', { applicationId });
        return;
      }
      
      // Update conversation state
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.PROCESSING_PERMIT
      );
      
      // Send confirmation message
      const message = `✅ ¡Pago confirmado!

Tu permiso digital está siendo generado. Lo recibirás en este chat en unos minutos.

📱 Folio: ${applicationId}`;
      
      await this.whatsappClient.sendTextMessage(phoneNumber, message);
      
    } catch (error) {
      logger.error('Error handling payment confirmation', { error: error.message, applicationId });
    }
  }

  /**
   * Handle permit ready (webhook from permit service)
   */
  async handlePermitReady(applicationId, permitUrl) {
    try {
      // Find application
      const application = await applicationService.getApplicationById(applicationId);
      if (!application) {
        logger.error('Application not found for permit ready', { applicationId });
        return;
      }
      
      // Get phone number
      const user = await require('../user.service').findById(application.user_id);
      const phoneNumber = user.phone;
      
      if (!phoneNumber) {
        logger.error('Phone number not found for permit ready', { applicationId });
        return;
      }
      
      // Update conversation state
      await this.conversationManager.updateState(
        phoneNumber,
        this.conversationManager.STATES.COMPLETED
      );
      
      // Generate filename
      const filename = `Permiso_${application.id}_${application.marca}_${application.linea}.pdf`;
      
      // Send permit document
      await this.whatsappClient.sendDocument(
        phoneNumber,
        permitUrl,
        `📄 ¡Tu permiso digital está listo!\n\n⏰ Válido por 30 días\n📱 Guárdalo en tu teléfono\n\n¿Necesitas otro permiso? Envía /permiso`,
        filename
      );
      
      // Clear conversation after 1 hour
      setTimeout(() => {
        this.conversationManager.clearConversation(phoneNumber);
      }, 3600000);
      
    } catch (error) {
      logger.error('Error handling permit ready', { error: error.message, applicationId });
    }
  }

  /**
   * Send help message
   */
  async sendHelpMessage(phoneNumber) {
    const helpMessage = `📚 **AYUDA - Permisos Digitales**

**Comandos disponibles:**
/permiso - Iniciar nueva solicitud
/estado - Ver estado de tu solicitud
/ayuda - Ver este mensaje
/cancelar - Cancelar solicitud actual
/reiniciar - Comenzar de nuevo

**Preguntas frecuentes:**

❓ **¿Cuánto cuesta?**
El permiso tiene un costo de $99 MXN

❓ **¿Cuánto tarda?**
El permiso se genera en 5-10 minutos después del pago

❓ **¿Qué necesito?**
• Datos personales (nombre, CURP/RFC, domicilio)
• Datos del vehículo (marca, modelo, color, números de serie y motor)

❓ **¿Cómo pago?**
Aceptamos tarjetas de crédito/débito y pagos en OXXO

❓ **¿Por cuánto tiempo es válido?**
El permiso es válido por 30 días

¿Tienes otra pregunta? Escríbela directamente.`;
    
    await this.whatsappClient.sendTextMessage(phoneNumber, helpMessage);
  }

  /**
   * Send status message
   */
  async sendStatusMessage(phoneNumber, conversation) {
    if (conversation.state === this.conversationManager.STATES.IDLE) {
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        'No tienes ninguna solicitud activa.\n\nEnvía /permiso para iniciar una nueva solicitud.'
      );
      return;
    }
    
    const summary = await this.conversationManager.getConversationSummary(phoneNumber);
    const stateMessages = {
      [this.conversationManager.STATES.COLLECTING_PERSONAL_INFO]: 'Recopilando información personal',
      [this.conversationManager.STATES.COLLECTING_VEHICLE_INFO]: 'Recopilando información del vehículo',
      [this.conversationManager.STATES.CONFIRMING_DATA]: 'Esperando confirmación de datos',
      [this.conversationManager.STATES.AWAITING_PAYMENT]: 'Esperando pago',
      [this.conversationManager.STATES.PROCESSING_PERMIT]: 'Generando permiso',
      [this.conversationManager.STATES.COMPLETED]: 'Completado',
      [this.conversationManager.STATES.ERROR]: 'Error en el proceso'
    };
    
    const statusMessage = `${summary}\n\n📍 **Estado actual:** ${stateMessages[conversation.state] || conversation.state}`;
    
    await this.whatsappClient.sendTextMessage(phoneNumber, statusMessage);
  }

  /**
   * Cancel application
   */
  async cancelApplication(phoneNumber, conversation) {
    if (conversation.state === this.conversationManager.STATES.IDLE) {
      await this.whatsappClient.sendTextMessage(
        phoneNumber,
        'No hay ninguna solicitud activa para cancelar.'
      );
      return;
    }
    
    await this.whatsappClient.sendInteractiveButtons(
      phoneNumber,
      '¿Estás seguro que deseas cancelar tu solicitud actual?',
      [
        { id: 'cancel_yes', title: 'Sí, cancelar' },
        { id: 'cancel_no', title: 'No, continuar' }
      ],
      'Confirmar Cancelación'
    );
  }

  /**
   * Restart application
   */
  async restartApplication(phoneNumber) {
    await this.conversationManager.clearConversation(phoneNumber);
    await this.startPermitApplication(phoneNumber, { state: this.conversationManager.STATES.IDLE });
  }

  /**
   * Send error message
   */
  async sendErrorMessage(phoneNumber) {
    await this.whatsappClient.sendTextMessage(
      phoneNumber,
      '❌ Disculpa, hubo un error procesando tu mensaje. Por favor intenta nuevamente.\n\nSi el problema persiste, envía /ayuda'
    );
  }
}

module.exports = PermitConversationService;
/**
 * WhatsApp Business API Service
 * Handles WhatsApp message processing and responses
 */

const { logger } = require('../../utils/logger');
const openai = require('openai');
const twilio = require('twilio');

class WhatsAppService {
  constructor(config) {
    this.twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.twilioPhoneNumber = config.twilioPhoneNumber;
    
    // Initialize OpenAI for conversation processing
    this.openaiClient = new openai.OpenAI({
      apiKey: config.openaiApiKey
    });
    
    this.conversationPrompt = `You are a helpful assistant for Permisos Digitales that helps users obtain their vehicle circulation permits. 
    Guide users through providing the following information:
    
    Personal Information:
    - Full name (nombre_completo)
    - CURP or RFC (without spaces, dots or dashes)
    - Complete address (domicilio)
    
    Vehicle Information:
    - Brand (marca)
    - Model/Line (linea)
    - Color
    - VIN/Serial number (numero_serie - without spaces or dashes)
    - Engine number (numero_motor - without spaces or dashes)
    - Model year (ano_modelo - 4 digit year)
    
    Be friendly, clear, and guide them step by step. Validate inputs and ask for corrections if needed.
    Extract the information in a structured format when complete.`;
  }

  /**
   * Process incoming WhatsApp message
   * @param {Object} messageData - Incoming message data from webhook
   * @returns {Promise<Object>} Response to send back
   */
  async processMessage(messageData) {
    try {
      const { from, body, profileName } = messageData;
      
      logger.info('Processing WhatsApp message', {
        from,
        profileName,
        messageLength: body.length
      });

      // Get or create conversation context
      const conversationContext = await this.getConversationContext(from);
      
      // Process message with AI
      const aiResponse = await this.processWithAI(body, conversationContext);
      
      // Update conversation context
      await this.updateConversationContext(from, aiResponse.context);
      
      // Check if form is complete
      if (aiResponse.formComplete) {
        return await this.handleCompleteForm(from, aiResponse.formData);
      }
      
      // Send response back via WhatsApp
      await this.sendMessage(from, aiResponse.message);
      
      return {
        success: true,
        response: aiResponse.message
      };
    } catch (error) {
      logger.error('Error processing WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Process message with AI to extract information
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} AI response with extracted data
   */
  async processWithAI(message, context) {
    try {
      const messages = [
        { role: 'system', content: this.conversationPrompt },
        ...context.history,
        { role: 'user', content: message }
      ];

      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages,
        functions: [{
          name: 'extract_permit_data',
          description: 'Extract permit application data from conversation',
          parameters: {
            type: 'object',
            properties: {
              formComplete: { type: 'boolean' },
              formData: {
                type: 'object',
                properties: {
                  nombre_completo: { type: 'string' },
                  curp_rfc: { type: 'string' },
                  domicilio: { type: 'string' },
                  marca: { type: 'string' },
                  linea: { type: 'string' },
                  color: { type: 'string' },
                  numero_serie: { type: 'string' },
                  numero_motor: { type: 'string' },
                  ano_modelo: { type: 'string' }
                }
              },
              nextQuestion: { type: 'string' },
              validationErrors: { type: 'array', items: { type: 'string' } }
            }
          }
        }],
        function_call: { name: 'extract_permit_data' }
      });

      const functionCall = completion.choices[0].message.function_call;
      const extractedData = JSON.parse(functionCall.arguments);
      
      // Update conversation history
      context.history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: completion.choices[0].message.content || extractedData.nextQuestion }
      );

      return {
        message: extractedData.nextQuestion || completion.choices[0].message.content,
        formComplete: extractedData.formComplete,
        formData: extractedData.formData,
        context: {
          ...context,
          history: context.history.slice(-10), // Keep last 10 messages
          currentData: { ...context.currentData, ...extractedData.formData }
        }
      };
    } catch (error) {
      logger.error('Error processing with AI:', error);
      throw error;
    }
  }

  /**
   * Handle complete form submission
   * @param {string} phoneNumber - User's phone number
   * @param {Object} formData - Complete form data
   * @returns {Promise<Object>} Payment link and next steps
   */
  async handleCompleteForm(phoneNumber, formData) {
    try {
      // Create application in database
      const applicationService = require('../application.service');
      const userService = require('../user.service');
      
      // Get or create user by phone number
      const user = await userService.findOrCreateByPhone(phoneNumber);
      
      // Create application with form data
      const application = await applicationService.createApplication({
        ...formData,
        user_id: user.id
      });
      
      // Generate Stripe payment link
      const stripeService = require('../stripe-payment.service');
      const paymentLink = await stripeService.createPaymentLink({
        amount: 150.00,
        currency: 'MXN',
        metadata: {
          application_id: application.id,
          phone_number: phoneNumber
        },
        success_url: `${process.env.FRONTEND_URL}/payment-success?id=${application.id}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`
      });
      
      // Send payment link via WhatsApp
      const message = `¡Excelente! He registrado tu solicitud de permiso.

📋 Resumen de tu solicitud:
• Vehículo: ${formData.marca} ${formData.linea} ${formData.ano_modelo}
• Color: ${formData.color}
• Titular: ${formData.nombre_completo}

💳 Para completar tu solicitud, realiza el pago de $150.00 MXN en el siguiente enlace:
${paymentLink.url}

Una vez confirmado el pago, recibirás tu permiso digital en aproximadamente 5-10 minutos.

¿Tienes alguna pregunta?`;

      await this.sendMessage(phoneNumber, message);
      
      // Store payment link in context for follow-up
      await this.updateConversationContext(phoneNumber, {
        applicationId: application.id,
        paymentLink: paymentLink.url,
        stage: 'payment_pending'
      });
      
      return {
        success: true,
        response: message,
        applicationId: application.id,
        paymentLink: paymentLink.url
      };
    } catch (error) {
      logger.error('Error handling complete form:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message
   * @param {string} to - Recipient phone number
   * @param {string} message - Message to send
   * @returns {Promise<Object>} Twilio response
   */
  async sendMessage(to, message) {
    try {
      const response = await this.twilioClient.messages.create({
        body: message,
        from: `whatsapp:${this.twilioPhoneNumber}`,
        to: `whatsapp:${to}`
      });
      
      logger.info('WhatsApp message sent', {
        to,
        messageId: response.sid,
        status: response.status
      });
      
      return response;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Get conversation context from Redis
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Conversation context
   */
  async getConversationContext(phoneNumber) {
    const redisClient = require('../../utils/redis-client');
    const key = `whatsapp:conversation:${phoneNumber}`;
    
    try {
      const context = await redisClient.get(key);
      if (context) {
        return JSON.parse(context);
      }
      
      // Initialize new conversation
      return {
        phoneNumber,
        startedAt: new Date().toISOString(),
        history: [],
        currentData: {},
        stage: 'collecting_info'
      };
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      return {
        phoneNumber,
        startedAt: new Date().toISOString(),
        history: [],
        currentData: {},
        stage: 'collecting_info'
      };
    }
  }

  /**
   * Update conversation context in Redis
   * @param {string} phoneNumber - User's phone number
   * @param {Object} context - Updated context
   * @returns {Promise<void>}
   */
  async updateConversationContext(phoneNumber, context) {
    const redisClient = require('../../utils/redis-client');
    const key = `whatsapp:conversation:${phoneNumber}`;
    
    try {
      // Store for 24 hours
      await redisClient.setex(key, 86400, JSON.stringify(context));
    } catch (error) {
      logger.error('Error updating conversation context:', error);
    }
  }

  /**
   * Handle payment confirmation webhook
   * @param {Object} paymentData - Payment confirmation data
   * @returns {Promise<void>}
   */
  async handlePaymentConfirmation(paymentData) {
    try {
      const { applicationId, phoneNumber } = paymentData.metadata;
      
      // Get conversation context
      const context = await this.getConversationContext(phoneNumber);
      
      // Send confirmation message
      const message = `✅ ¡Pago confirmado!

Tu permiso digital está siendo generado. Recibirás el enlace de descarga en unos minutos.

Gracias por usar Permisos Digitales. 🚗`;

      await this.sendMessage(phoneNumber, message);
      
      // Update context
      await this.updateConversationContext(phoneNumber, {
        ...context,
        stage: 'payment_confirmed',
        paymentConfirmedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling payment confirmation:', error);
    }
  }

  /**
   * Handle permit ready notification
   * @param {Object} permitData - Permit ready data
   * @returns {Promise<void>}
   */
  async handlePermitReady(permitData) {
    try {
      const { applicationId, permitUrl, phoneNumber } = permitData;
      
      const message = `📄 ¡Tu permiso digital está listo!

Descárgalo aquí: ${permitUrl}

⏰ Este enlace es válido por 48 horas.

💡 Tip: Guarda el PDF en tu teléfono para tenerlo siempre disponible.

¿Necesitas ayuda adicional? Escríbeme "AYUDA"`;

      await this.sendMessage(phoneNumber, message);
      
      // Update context
      const context = await this.getConversationContext(phoneNumber);
      await this.updateConversationContext(phoneNumber, {
        ...context,
        stage: 'completed',
        permitUrl,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling permit ready:', error);
    }
  }
}

module.exports = WhatsAppService;
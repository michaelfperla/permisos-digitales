/**
 * Simple WhatsApp Service for Permisos Digitales
 * Uses numbered options instead of slash commands for better UX
 */

const { logger } = require('../../utils/logger');
const db = require('../../db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const privacyAuditService = require('../privacy-audit.service');
const navigationManager = require('./navigation-manager');
const emailService = require('../email.service');
const { getGreeting, getTimezoneName } = require('../../utils/mexican-timezones');
const { PaymentFees } = require('../../constants/payment.constants');
const redisClient = require('../../utils/redis-client');
const axios = require('axios');
const whatsappMonitoringService = require('../whatsapp-monitoring.service');

class SimpleWhatsAppService {
  constructor() {
    // Core configuration
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiUrl: null // Set in initialize()
    };
    
    // Simple rate limiting
    this.rateLimiter = new Map();
    this.RATE_LIMIT = 20; // messages per minute
    this.RATE_WINDOW = 60000; // 1 minute
    
    // Session management using Redis (via existing StateManager)
    const StateManager = require('./state-manager');
    this.stateManager = new StateManager();
    
    // Enhanced state management with migration adapter
    const StateMigrationAdapter = require('./state-migration-adapter');
    this.migrationAdapter = new StateMigrationAdapter(this.stateManager);
    
    // Privacy settings
    this.PRIVACY_VERSION = process.env.PRIVACY_POLICY_VERSION || '1.0';
    
    // Assistant personalities
    this.assistants = {
      sophia: {
        name: 'Sophia',
        emoji: '👩‍💼',
        style: 'warm_professional' // Cálida y eficiente
      },
      diego: {
        name: 'Diego', 
        emoji: '👨‍💼',
        style: 'friendly_expert' // Amigable y conocedor
      }
    };
    
    // Track which assistant each user gets
    this.userAssistants = new Map();
    
    // Campos del formulario agrupados para mejor UX
    this.fieldGroups = {
      personal: {
        title: 'DATOS PERSONALES',
        emoji: '📝',
        fields: [
          { key: 'nombre_completo', label: 'Nombre completo', prompt: 'Ingrese su nombre completo (nombre y apellidos):\nEjemplo: Juan Carlos Pérez González 👤' },
          { key: 'curp_rfc', label: 'CURP o RFC', prompt: 'Ingrese su CURP o RFC:\nEjemplo CURP: PERJ850124HDFRZN01 🆔\nEjemplo RFC: PERJ850124X91 📄' },
          { key: 'email', label: 'Correo electrónico', prompt: 'Ingrese su correo electrónico:\nEjemplo: juan.perez@gmail.com 📧' }
        ]
      },
      vehicle: {
        title: 'INFORMACIÓN DEL VEHÍCULO',
        emoji: '🚗',
        fields: [
          { key: 'marca', label: 'Marca', prompt: 'Marca del vehículo:\nEjemplo: Toyota, Nissan, Ford 🚙' },
          { key: 'linea', label: 'Modelo', prompt: 'Modelo o línea del vehículo:\nEjemplo: Corolla, Sentra, F-150 🚗' },
          { key: 'color', label: 'Color', prompt: 'Color del vehículo:\nEjemplo: Blanco, Azul y Rojo 🎨' },
          { key: 'ano_modelo', label: 'Año', prompt: 'Año del vehículo:\nEjemplo: 2020, 2018, 2015 📅' }
        ]
      },
      details: {
        title: 'DATOS TÉCNICOS Y DOMICILIO',
        emoji: '📋',
        fields: [
          { key: 'numero_serie', label: 'Número de serie (VIN)', prompt: 'Número de serie (VIN) - consulte su factura:\nEjemplo: 1HGBH41JXMN109186 🔧' },
          { key: 'numero_motor', label: 'Número de motor', prompt: 'Número de motor - consulte su factura:\nEjemplo: 4G15-MN123456 ⚙️' },
          { key: 'domicilio', label: 'Domicilio', prompt: 'Domicilio completo:\nEjemplo: Calle Juárez 123, Centro, Guadalajara, Jalisco 📍' }
        ]
      }
    };
    
    // Flatten fields for backward compatibility
    this.fields = Object.values(this.fieldGroups).flatMap(group => group.fields);
    
    // Menu options for easier understanding
    this.menuOptions = {
      main: {
        '1': 'nuevo_permiso',
        '2': 'ver_estado',
        '3': 'privacidad',
        '4': 'ayuda'
      },
      mainWithRenewal: {
        '1': 'nuevo_permiso',
        '2': 'renovar_permiso',
        '3': 'ver_estado',
        '4': 'privacidad',
        '5': 'ayuda'
      },
      privacy: {
        '1': 'exportar_datos',
        '2': 'eliminar_datos',
        '3': 'no_mensajes',
        '4': 'menu_principal'
      },
      yesNo: {
        '1': 'si',
        '2': 'no',
        'si': 'si',
        'sí': 'si',
        'no': 'no'
      }
    };
  }

  /**
   * Initialize service
   */
  async initialize() {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      throw new Error('WhatsApp configuration missing');
    }
    
    this.config.apiUrl = `https://graph.facebook.com/v23.0/${this.config.phoneNumberId}/messages`;
    
    // Set up TTL cleanup for userAssistants to prevent memory leak
    this.cleanupInterval = setInterval(() => {
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      let cleaned = 0;
      
      for (const [phone, data] of this.userAssistants.entries()) {
        // Handle both old format (direct assistant object) and new format (with timestamp)
        const timestamp = data.timestamp || 0; // Old format has no timestamp, treat as expired
        if (timestamp < thirtyMinutesAgo) {
          this.userAssistants.delete(phone);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} expired user assistant assignments`);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    logger.info('Servicio WhatsApp inicializado');
  }

  /**
   * Get or assign assistant for user
   */
  getAssistantForUser(from) {
    // Check if user already has an assistant
    if (this.userAssistants.has(from)) {
      const data = this.userAssistants.get(from);
      // Return the assistant object if stored in old format
      if (data.name) {
        return data;
      }
      // Return the assistant from new format
      return data.assistant;
    }
    
    // Assign alternating assistants based on phone number hash
    const hash = crypto.createHash('md5').update(from).digest('hex');
    const usesSophia = parseInt(hash.charAt(0), 16) % 2 === 0;
    
    const assistant = usesSophia ? this.assistants.sophia : this.assistants.diego;
    
    // Store with timestamp for TTL cleanup
    this.userAssistants.set(from, {
      assistant,
      timestamp: Date.now()
    });
    
    return assistant;
  }
  
  /**
   * Get time-based greeting
   */
  getTimeBasedGreeting(phoneNumber = null) {
    // If phone number provided, use timezone-aware greeting
    if (phoneNumber) {
      return getGreeting(phoneNumber);
    }
    
    // Fallback to server time (Central Mexico)
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /**
   * Process incoming message
   */
  async processMessage(from, message, messageId = null) {
    try {
      // Enhanced logging for Meta review
      logger.info('⚙️ [PROCESSING] Starting message processing', {
        from,
        originalMessage: message,
        timestamp: new Date().toISOString()
      });

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

      // Check rate limit
      if (!this.checkRateLimit(from)) {
        logger.info('⚠️ [RATE LIMIT] Message ignored due to rate limit', { from });
        return; // Silently ignore if rate limited
      }
      
      // Sanitize input
      const sanitized = this.sanitizeInput(message);
      logger.info('🔒 [SANITIZED] Message sanitized', {
        from,
        sanitized,
        originalLength: message.length,
        sanitizedLength: sanitized.length
      });
      
      // Get or create session state first
      const state = await this.stateManager.getState(from) || {};
      
      // Log state for debugging permit_downloaded issue
      logger.info('State retrieved for processing', {
        from,
        message: sanitized.substring(0, 20),
        stateStatus: state?.status || 'none',
        hasState: !!state
      });
      
      // Parse navigation commands
      const navCommand = navigationManager.parseNavigationCommand(sanitized);
      
      // Skip navigation command handling if we're collecting data and it's "atras"
      if (navCommand && navCommand.type === 'navigation') {
        // If we're collecting data, let the collection handler process "back" commands
        if (state.status === 'collecting' && navCommand.command === 'back') {
          // Let it fall through to handleDataCollection
        } else {
          return await this.handleNavigationCommand(from, navCommand.command);
        }
      }
      
      // Only check for links if we're not collecting data
      if (state.status !== 'collecting' && state.status !== 'editing_field') {
        // Extract and handle links
        const links = navigationManager.extractLinks(sanitized);
        if (links.length > 0) {
          return await this.handleLinks(from, links);
        }
      }
      
      // Check for priority commands before state processing
      const normalized = sanitized.toLowerCase().trim();
      
      // Handle renewal commands with priority (work regardless of state)
      if (normalized === 'renovar' || normalized === 'renovación' || normalized === 'renewal') {
        return await this.handleRenewalFlow(from);
      }
      
      // Check for renewal with specific permit ID (e.g., "renovar 123")
      const renewalMatch = sanitized.match(/^renovar\s+(\d+)$/i);
      if (renewalMatch) {
        const permitId = parseInt(renewalMatch[1]);
        return await this.handleRenewalFlow(from, permitId);
      }
      
      // Check for numbered field editing (e.g., "1 Toyota", "3 Azul")
      const fieldEditMatch = sanitized.match(/^(\d+)\s+(.+)$/);
      if (fieldEditMatch) {
        const fieldNumber = parseInt(fieldEditMatch[1]);
        const newValue = fieldEditMatch[2].trim();
        return await this.handleQuickFieldEdit(from, fieldNumber, newValue);
      }
      
      // Smart single number handling - WITH PROPER CONTEXT CHECK
      if (state.status === 'renewal_field_selection' || state.status === 'renewal_field_input') {
        const singleNumberMatch = sanitized.match(/^(\d+)$/);
        if (singleNumberMatch) {
          const fieldNumber = parseInt(singleNumberMatch[1]);
          if (fieldNumber >= 1 && fieldNumber <= 9) {
            return await this.handleRenewalFieldSelectionFromReminder(from, fieldNumber);
          }
        }
      }
      
      // Handle menu command with ABSOLUTE priority
      if (normalized === 'menu' || normalized === 'menú' || normalized === 'inicio') {
        // FORCE clear everything - nuclear option
        await this.stateManager.clearState(from);
        // Clear assistant assignment to start fresh
        if (this.userAssistants.has(from)) {
          this.userAssistants.delete(from);
        }
        return await this.showMainMenu(from);
      }
      
      // Handle help command with priority
      if (normalized === 'ayuda' || normalized === 'help' || normalized === 'soporte') {
        return await this.sendHelp(from);
      }
      
      // Handle status command with priority
      if (normalized === 'estado' || normalized === 'status' || normalized === 'mis-permisos') {
        return await this.checkStatus(from);
      }
      
      // Handle edit renewal command with priority
      if (normalized === 'editar' || normalized === 'edit' || normalized === 'cambiar') {
        return await this.handleEditRenewal(from);
      }

      // EMERGENCY FIX: Temporarily disabled enhanced state management (breaking production flows)
      // TODO: Fix enhanced system offline and re-enable after thorough testing
      // const enhancedResult = await this.migrationAdapter.processInputWithContext(from, sanitized, state);
      // if (enhancedResult.useEnhancedSystem) {
      //   return await this.handleEnhancedInput(from, enhancedResult);
      // }

      // Handle based on current state
      switch (state.status) {
        case 'showing_menu':
          return await this.handleMenuSelection(from, sanitized, state);
        case 'showing_conversational_menu':
          return await this.handleConversationalMenu(from, sanitized, state);
        case 'showing_privacy_menu':
          return await this.handlePrivacyMenuSelection(from, sanitized, state);
        case 'awaiting_privacy_consent':
          return await this.handlePrivacyConsent(from, sanitized, state);
        case 'awaiting_privacy_consent_after_viewing':
          return await this.handlePrivacyConsentAfterViewing(from, sanitized, state);
        case 'collecting':
          return await this.handleDataCollection(from, sanitized, state);
        case 'confirming':
          return await this.handleConfirmation(from, sanitized, state);
        case 'editing_field':
          return await this.handleFieldEdit(from, sanitized, state);
        case 'resume_prompt':
          return await this.handleResumePrompt(from, sanitized, state);
        case 'save_progress_prompt':
          return await this.handleSaveProgressPrompt(from, sanitized, state);
        // Removed payment_method_selection - now goes directly to application creation
        case 'quick_actions_menu':
          // Check if it's a greeting first
          if (this.isGreeting(sanitized)) {
            state.status = 'idle';
            await this.stateManager.setState(from, state);
            return await this.handleGreeting(from);
          }
          return await this.handleQuickActions(from, sanitized, state);
        case 'payment_help_menu':
          return await this.handlePaymentHelp(from, sanitized, state);
        case 'awaiting_create_from_status':
          return await this.handleCreateFromStatus(from, sanitized, state);
        case 'awaiting_folio_selection':
          return await this.handleFolioSelection(from, sanitized, state);
        case 'draft_status_menu':
          return await this.handleDraftStatusMenu(from, sanitized, state);
        case 'awaiting_active_app_decision':
          return await this.handleActiveAppDecision(from, sanitized, state);
        case 'draft_continuation_menu':
          return await this.handleDraftContinuationMenu(from, sanitized, state);
        case 'no_draft_menu':
          return await this.handleNoDraftMenu(from, sanitized, state);
        case 'rate_limit_options':
          return await this.handleRateLimitOptions(from, sanitized, state);
        case 'managing_applications':
          return await this.handleManagingApplications(from, sanitized, state);
        case 'permit_delivered':
          return await this.handlePermitDeliveredResponse(from, sanitized, state);
        case 'permit_downloaded':
          return await this.handlePermitDownloadedResponse(from, sanitized, state);
        case 'renewal_selection':
          return await this.handleRenewalSelection(from, sanitized, state);
        case 'renewal_confirmation':
          return await this.handleRenewalConfirmation(from, sanitized, state);
        case 'renewal_direct_edit':
          return await this.handleRenewalDirectEdit(from, sanitized, state);
        case 'renewal_sequential_edit':
          return await this.handleRenewalSequentialEdit(from, sanitized, state);
        case 'renewal_field_selection':
          return await this.handleRenewalFieldSelection(from, sanitized, state);
        case 'renewal_edit_selection':
          return await this.handleRenewalEditSelection(from, sanitized, state);
        case 'renewal_field_editing':
          return await this.handleRenewalFieldEditing(from, sanitized, state);
        case 'renewal_field_input':
          return await this.handleRenewalFieldInput(from, sanitized, state);
        case 'renewal_payment':
          // Renewal payment uses same logic as regular payment
          return await this.handleMenuSelection(from, sanitized, state);
        default:
          // Check for greetings only when not in an active state
          if (this.isGreeting(sanitized)) {
            return await this.handleGreeting(from);
          }
          return await this.showMainMenu(from);
      }
      
    } catch (error) {
      logger.error('Error al procesar mensaje', { error: error.message, from });
      await this.sendMessage(from, '❌ Hubo un error. Por favor intenta de nuevo o visita:\n\n🌐 permisosdigitales.com.mx');
    }
  }

  /**
   * Check if message is a greeting
   */
  isGreeting(message) {
    const greetings = [
      'hola', 'hi', 'hello', 'buenas', 'buenos días', 'buenos dias',
      'buenas tardes', 'buenas noches', 'buen día', 'buen dia',
      'que tal', 'qué tal', 'saludos', 'hey', 'ola', 'alo', 'aló'
    ];
    
    const normalized = message.toLowerCase().trim();
    return greetings.some(greeting => normalized.includes(greeting));
  }

  /**
   * Handle greeting messages
   */
  async handleGreeting(from) {
    // Get assistant and time-based greeting
    const assistant = this.getAssistantForUser(from);
    const timeGreeting = this.getTimeBasedGreeting(from);
    const state = await this.stateManager.getState(from) || {};
    
    if (state.pendingPayment) {
      // User has pending payment - single consolidated message
      const message = assistant.name === 'Sophia' ? 
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 💜\n\n` +
        `Tu permiso está casi listo, solo falta el pago 😊\n\n` +
        `💳 *LINK DE PAGO:*\n${state.pendingPayment.link}\n\n` +
        `📱 *Folio:* ${state.pendingPayment.applicationId}\n\n` +
        `¿Necesitas ayuda? Escribe "ayuda" 💬` :
        
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 🚗\n\n` +
        `Tu permiso está a un paso de estar listo 💪\n\n` +
        `💳 *LINK DE PAGO:*\n${state.pendingPayment.link}\n\n` +
        `📱 *Folio:* ${state.pendingPayment.applicationId}\n\n` +
        `¿Necesitas apoyo? Escribe "ayuda" 🤝`;
      
      await this.sendMessage(from, message);
    } else if (state.draftData) {
      // User has saved draft - single message
      const progress = Math.round((state.draftField / this.fields.length) * 100);
      const message = assistant.name === 'Sophia' ? 
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 💜\n\n` +
        `¡Qué bien que regresas! Tienes un permiso ${progress}% completado 📊\n\n` +
        `¿Seguimos donde nos quedamos?\n\n` +
        `✨ Escribe "sí" para continuar\n` +
        `🆕 Escribe "nuevo" para empezar de cero` :
        
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 🚗\n\n` +
        `¡Genial que volviste! Ya llevamos ${progress}% de tu permiso 💪\n\n` +
        `¿Le seguimos o empezamos de nuevo?\n\n` +
        `✨ Escribe "sí" para continuar\n` +
        `🆕 Escribe "nuevo" para empezar de cero`;
      
      await this.sendMessage(from, message);
      
      state.status = 'resume_prompt';
      await this.stateManager.setState(from, state);
    } else {
      // Just show the main menu
      return await this.showMainMenu(from);
    }
  }

  /**
   * Check for renewable permits
   */
  async checkRenewablePermits(userId) {
    const query = `
      SELECT 
        id, folio, marca, linea, color, ano_modelo,
        fecha_expedicion, fecha_vencimiento, status,
        EXTRACT(DAY FROM fecha_vencimiento - NOW()) as days_until_expiration
      FROM permit_applications
      WHERE user_id = $1 
        AND status IN ('PERMIT_READY', 'COMPLETED')
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento BETWEEN (NOW() - INTERVAL '30 days') AND (NOW() + INTERVAL '7 days')
      ORDER BY fecha_vencimiento ASC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Check if a permit is eligible for renewal
   */
  async isEligibleForRenewal(permitId, userId) {
    const permit = await this.getPermitById(permitId, userId);
    if (!permit || !['PERMIT_READY', 'COMPLETED'].includes(permit.status)) return false;
    
    const expirationDate = new Date(permit.fecha_vencimiento);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
    
    // Eligible if expires in 7 days or expired within last 30 days
    return daysUntilExpiration <= 7 && daysUntilExpiration > -30;
  }

  /**
   * Get permit by ID for renewal
   */
  async getPermitById(permitId, userId) {
    const query = `
      SELECT * FROM permit_applications 
      WHERE id = $1 AND user_id = $2
    `;
    const result = await db.query(query, [permitId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Show main menu
   */
  async showMainMenu(from) {
    // Get assistant and time-based greeting
    const assistant = this.getAssistantForUser(from);
    const timeGreeting = this.getTimeBasedGreeting(from);
    const currentState = await this.stateManager.getState(from) || {};
    
    // Check for renewable permits
    const user = await this.findOrCreateUser(from);
    const renewablePermits = await this.checkRenewablePermits(user.id);
    const hasRenewablePermits = renewablePermits.length > 0;
    
    let messages;
    
    let menuMessage;
    
    // Check for expiring soon
    const expiringSoon = renewablePermits.filter(p => 
      p.days_until_expiration >= 0 && p.days_until_expiration <= 3
    );
    
    if (currentState.draftData && currentState.draftField !== undefined) {
      // User has saved draft
      const progress = Math.round((currentState.draftField / this.fields.length) * 100);
      
      menuMessage = assistant.name === 'Sophia' ?
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 👩‍💼\n\n` +
        `Veo que tienes una solicitud ${progress}% completada 📝\n\n` +
        `🏛️ *PERMISOS DIGITALES*\n` +
        `⏱️ Proceso: 5 minutos • 💵 Costo: $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)}\n` +
        `📅 *Duración del permiso: 30 días*\n\n` +
        `📋 *¿QUÉ DESEAS HACER?*\n\n` +
        `1️⃣ Continuar solicitud guardada\n` +
        `2️⃣ Ver mis solicitudes\n` +
        `3️⃣ Opciones de privacidad\n` +
        `4️⃣ Ayuda y soporte\n` +
        `5️⃣ Nueva solicitud (eliminar guardada)\n\n` +
        `💜 Responde con el número de tu elección` :
        
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 👨‍💼\n\n` +
        `Tienes un permiso ${progress}% listo 🚗\n\n` +
        `🏛️ *PERMISOS DIGITALES*\n` +
        `⏱️ Solo 5 minutos • 💵 $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n` +
        `📅 *Duración del permiso: 30 días*\n\n` +
        `🚗 *¿QUÉ NECESITAS HOY?*\n\n` +
        `1️⃣ Continuar solicitud pausada\n` +
        `2️⃣ Consultar mis solicitudes\n` +
        `3️⃣ Opciones de privacidad\n` +
        `4️⃣ Ayuda técnica\n` +
        `5️⃣ Empezar de nuevo\n\n` +
        `🔧 Escribe el número de la opción`;
    } else {
      // Regular menu with personality and dynamic renewal options
      let alertSection = '';
      if (expiringSoon.length > 0) {
        alertSection = `⚠️ *ATENCIÓN: Tienes ${expiringSoon.length} permiso(s) por vencer*\n\n`;
      }
      
      let menuOptions = '';
      let optionNumber = 1;
      const menuMapping = {};
      
      menuOptions += `${optionNumber}️⃣ Nuevo permiso de circulación\n`;
      menuMapping[optionNumber++] = 'nuevo_permiso';
      
      if (hasRenewablePermits) {
        menuOptions += `${optionNumber}️⃣ Renovar permiso existente ♻️\n`;
        if (expiringSoon.length > 0) {
          menuOptions += `   ⚠️ ${expiringSoon.length} por vencer\n`;
        }
        menuMapping[optionNumber++] = 'renovar_permiso';
      }
      
      menuOptions += `${optionNumber}️⃣ Consultar mis solicitudes\n`;
      menuMapping[optionNumber++] = 'ver_estado';
      
      menuOptions += `${optionNumber}️⃣ Opciones de privacidad\n`;
      menuMapping[optionNumber++] = 'privacidad';
      
      menuOptions += `${optionNumber}️⃣ Ayuda técnica\n`;
      menuMapping[optionNumber++] = 'ayuda';
      
      menuMessage = assistant.name === 'Sophia' ?
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 👩‍💼\n\n` +
        alertSection +
        `Estoy aquí para ayudarte a obtener tu *permiso para circular sin placas por 30 días* para auto 🚗, pick up 🚛 o motocicleta 🏍 particulares.\n\n` +
        `🏛️ *PERMISOS DIGITALES*\n` +
        `⏱️ Proceso: 5 minutos • 💵 Costo: $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)}\n` +
        `📅 *Duración del permiso: 30 días*\n\n` +
        `📋 *¿EN QUÉ PUEDO AYUDARTE?*\n\n` +
        menuOptions + `\n` +
        `💜 Responde con el número de tu elección` :
        
        `${assistant.emoji} ¡${timeGreeting}! Soy ${assistant.name} 👨‍💼\n\n` +
        alertSection +
        `Te ayudo a obtener tu *permiso para circular sin placas por 30 días* para auto 🚗, pick up 🚛 o motocicleta 🏍 particulares.\n\n` +
        `🏛️ *PERMISOS DIGITALES*\n` +
        `⏱️ Solo 5 minutos • 💵 $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n` +
        `📅 *Duración del permiso: 30 días*\n\n` +
        `🚗 *¿QUÉ NECESITAS HOY?*\n\n` +
        menuOptions + `\n` +
        `🔧 Escribe el número de la opción`;
        
      // Store dynamic menu mapping
      currentState.menuMapping = menuMapping;
    }
    
    await this.sendMessage(from, menuMessage);
    
    const state = {
      status: 'showing_menu',
      timestamp: Date.now(),
      // Preserve draft data
      draftData: currentState.draftData,
      draftField: currentState.draftField,
      // Add renewal information
      menuMapping: currentState.menuMapping,
      renewablePermits: renewablePermits,
      hasRenewablePermits: hasRenewablePermits
    };
    await this.stateManager.setState(from, state);
    
    // Push to navigation history
    navigationManager.pushNavigation(from, {
      state: 'MAIN_MENU',
      title: 'Menú Principal',
      data: state
    });
  }

  /**
   * Handle conversational menu
   */
  async handleConversationalMenu(from, input, state) {
    const normalized = input.toLowerCase().trim();
    
    // Handle numbered options using dynamic menu mapping
    const optionNumber = parseInt(normalized);
    if (!isNaN(optionNumber) && state.menuMapping && state.menuMapping[optionNumber]) {
      const action = state.menuMapping[optionNumber];
      
      switch (action) {
        case 'nuevo_permiso':
          return await this.startApplication(from);
        case 'renovar_permiso':
          return await this.handleRenewalFlow(from);
        case 'ver_estado':
          return await this.checkStatus(from);
        case 'privacidad':
          return await this.showPrivacyMenu(from);
        case 'ayuda':
          return await this.showHelp(from);
        default:
          break;
      }
    }
    
    // REMOVED: Broken fallback logic that had wrong option mappings
    // This was causing "2" to trigger status instead of renewal when renewal was available
    
    // Also handle text variations for backward compatibility
    if (normalized === 'sí' || normalized === 'si' || normalized === 'yes' || 
        normalized === '✅' || normalized === 'dale' || normalized === 'ok') {
      return await this.startApplication(from);
    }
    
    // Handle status check
    if (normalized === 'estado' || normalized === 'status' || normalized === '📋') {
      return await this.checkStatus(from);
    }
    
    // Handle help
    if (normalized === 'ayuda' || normalized === 'help' || normalized === '❓') {
      return await this.showHelp(from);
    }
    
    // Handle privacy
    if (normalized.includes('privacidad') || normalized.includes('privacy')) {
      return await this.showPrivacyMenu(from);
    }
    
    // Handle renewal commands
    if (normalized === 'renovar' || normalized === 'renovación' || normalized === 'renewal') {
      return await this.handleRenewalFlow(from);
    }
    
    // Check for renewal with specific permit ID (e.g., "renovar 123")
    const renewalMatch = input.match(/^renovar\s+(\d+)$/i);
    if (renewalMatch) {
      const permitId = parseInt(renewalMatch[1]);
      return await this.handleRenewalFlow(from, permitId);
    }
    
    // Handle opt-out commands
    if (normalized === 'stop' || normalized === 'baja' || normalized === 'unsubscribe' || 
        normalized === 'no más' || normalized === 'no mas' || normalized === 'cancelar notificaciones') {
      return await this.handleOptOut(from);
    }
    
    // Handle re-subscription commands
    if (normalized === 'start' || normalized === 'suscribir' || normalized === 'subscribe' || 
        normalized === 'recordatorios' || normalized === 'notificaciones') {
      return await this.handleOptIn(from);
    }
    
    // Didn't understand - warm professional response with personality
    const assistant = this.getAssistantForUser(from);
    const errorMessage = assistant.name === 'Sophia' ? 
      `💜 No entendí tu respuesta. Por favor elige una opción:\n\n` +
      `1️⃣ Solicitar nuevo permiso\n` +
      `2️⃣ Ver mis solicitudes\n` +
      `3️⃣ Continuar solicitud guardada\n` +
      `4️⃣ Ayuda y soporte\n\n` +
      `🌟 Escribe solo el número de la opción` :
      
      `🔧 Opción no válida. Escoge una de estas:\n\n` +
      `1️⃣ Nuevo permiso de circulación\n` +
      `2️⃣ Consultar mis solicitudes\n` +
      `3️⃣ Continuar solicitud pausada\n` +
      `4️⃣ Ayuda técnica\n\n` +
      `⚡ Solo necesito el número, ¡así de fácil!`;
      
    await this.sendMessage(from, errorMessage);
  }

  /**
   * Handle main menu selection
   */
  async handleMenuSelection(from, selection, state) {
    // Check for greetings first
    if (this.isGreeting(selection)) {
      return await this.handleGreeting(from);
    }
    
    const hasDraft = state.draftData && state.draftField !== undefined;
    const selectedNum = selection.trim();
    
    // Handle special case for option 5 when draft exists
    if (hasDraft && selectedNum === '5') {
      // Delete draft and start new
      delete state.draftData;
      delete state.draftField;
      await this.stateManager.clearState(from);
      return await this.startApplication(from);
    }
    
    // Handle draft scenario for option 1
    if (hasDraft && selectedNum === '1') {
      // Continue with draft
      state.status = 'resume_prompt';
      await this.stateManager.setState(from, state);
      return await this.handleResumePrompt(from, '1', state);
    }
    
    // CRITICAL FIX: Use dynamic mapping if available
    let option;
    if (state.menuMapping && state.menuMapping[selectedNum]) {
      option = state.menuMapping[selectedNum];
    } else {
      // Fallback to static menu only if no dynamic mapping
      option = this.menuOptions.main[selectedNum];
    }
    
    if (!option) {
      const maxOption = state.menuMapping 
        ? Object.keys(state.menuMapping).length 
        : (hasDraft ? '5' : '4');
      await this.sendMessage(from, 
        `❌ Por favor responde solo con un número del 1 al ${maxOption}.`
      );
      return;
    }
    
    // Clear state for new permit/renewal to prevent contamination
    if (option === 'nuevo_permiso' || option === 'renovar_permiso') {
      await this.stateManager.clearState(from);
    }
    
    switch (option) {
      case 'nuevo_permiso':
        return await this.startApplication(from);
      case 'renovar_permiso':
        return await this.handleRenewalFlow(from);
      case 'ver_estado':
        return await this.checkStatus(from);
      case 'privacidad':
        return await this.showPrivacyMenu(from);
      case 'ayuda':
        return await this.showHelp(from);
    }
  }

  /**
   * Show privacy menu
   */
  async showPrivacyMenu(from) {
    const state = {
      status: 'showing_privacy_menu',
      timestamp: Date.now()
    };
    await this.stateManager.setState(from, state);
    
    // Push to navigation history
    navigationManager.pushNavigation(from, {
      state: 'PRIVACY_MENU',
      title: 'Opciones de Privacidad',
      data: state
    });
    
    await this.sendMessage(from, 
      `🔐 *OPCIONES DE PRIVACIDAD*\n\n` +
      `1️⃣ Exportar mis datos\n` +
      `2️⃣ Eliminar mis datos\n` +
      `3️⃣ No recibir más mensajes\n` +
      `4️⃣ Volver al menú principal\n\n` +
      `📄 Política de privacidad:\n` +
      `https://permisosdigitales.com.mx/politica-de-privacidad\n\n` +
      `Responde con el número de tu elección (1-4)`
    );
  }

  /**
   * Handle privacy menu selection
   */
  async handlePrivacyMenuSelection(from, selection, state) {
    const option = this.menuOptions.privacy[selection.trim()];
    
    if (!option) {
      await this.sendMessage(from, 
        `❌ Por favor responde solo con un número del 1 al 4.`
      );
      return;
    }
    
    switch (option) {
      case 'exportar_datos':
        return await this.handleDataExport(from);
      case 'eliminar_datos':
        return await this.handleDataDeletion(from);
      case 'no_mensajes':
        return await this.handleOptOut(from);
      case 'menu_principal':
        return await this.showMainMenu(from);
    }
  }

  /**
   * Start new application
   */
  async startApplication(from) {
    // CRITICAL: Ensure complete state reset to prevent contamination
    await this.stateManager.clearState(from);
    
    // Generate unique session ID for tracking
    const sessionId = crypto.randomBytes(8).toString('hex');
    
    // Check for existing application
    const user = await this.findOrCreateUser(from);
    
    // Check rate limits first
    const recentApps = await this.countRecentApplications(user.id);
    
    // Daily limit check - friendly message
    if (recentApps.today >= 3) {
      const assistant = this.getAssistantForUser(from);
      const message = assistant.name === 'Sophia' ? 
        `🛡️ *PROTECCIÓN INTELIGENTE*\n\n` +
        `💜 He notado que ya tienes solicitudes activas hoy.\n\n` +
        `Para mantener un servicio eficiente, procesamos máximo 3 permisos diarios por persona.\n\n` +
        `🌟 *MI RECOMENDACIÓN:*\n` +
        `Completemos el pago de alguna solicitud anterior para evitar duplicados innecesarios.\n\n` +
        `📋 Escribe "estado" para ver tus solicitudes pendientes` :
        
        `🛡️ *LÍMITE DIARIO ALCANZADO*\n\n` +
        `🔧 Ya tienes varias solicitudes activas hoy.\n\n` +
        `Para que todos puedan usar el servicio eficientemente, manejamos hasta 3 permisos diarios.\n\n` +
        `⚡ *TUS OPCIONES:*\n\n` +
        `1️⃣ Ver y gestionar mis solicitudes\n` +
        `2️⃣ Completar pago pendiente\n` +
        `3️⃣ Volver al menú principal`;
        
      await this.sendMessage(from, message);
      
      const newState = { status: 'rate_limit_options' };
      await this.stateManager.setState(from, newState);
      return;
    }
    
    // Weekly limit check
    if (recentApps.week >= 10) {
      await this.sendMessage(from, 
        `⚠️ *LÍMITE SEMANAL ALCANZADO*\n\n` +
        `Has creado 10 solicitudes esta semana.\n\n` +
        `Este límite existe para prevenir el uso indebido del sistema.\n\n` +
        `Escribe *2* para ver tus solicitudes.`
      );
      await this.stateManager.clearState(from);
      return;
    }
    
    // Anti-abuse check - limit unpaid applications instead of time-based cooldown
    const unpaidCount = await this.checkUnpaidApplicationCount(user.id);
    if (unpaidCount >= 3) {
      await this.sendMessage(from, 
        `⚠️ *LÍMITE DE SOLICITUDES*\n\n` +
        `Tienes ${unpaidCount} solicitudes pendientes de pago.\n\n` +
        `Para crear una nueva solicitud, primero:\n` +
        `• Completa el pago de una solicitud existente, o\n` +
        `• Cancela una solicitud anterior\n\n` +
        `Escribe "2" para ver tus solicitudes pendientes.`
      );
      await this.stateManager.clearState(from);
      return;
    }
    
    // Quick succession check - prevent rapid-fire applications (5 minutes)
    const minutesSinceLastApp = await this.checkLastApplicationTime(user.id);
    if (minutesSinceLastApp < 5) {
      const waitTime = Math.ceil(5 - minutesSinceLastApp);
      await this.sendMessage(from, 
        `⏱️ *ESPERA UN MOMENTO*\n\n` +
        `Por favor espera ${waitTime} minuto${waitTime > 1 ? 's' : ''} antes de crear otra solicitud.\n\n` +
        `Esto evita solicitudes duplicadas accidentales.`
      );
      await this.stateManager.clearState(from);
      return;
    }
    
    const hasActiveApp = await this.checkActiveApplication(user.id);
    
    if (hasActiveApp) {
      // Show active application info
      let message = `⚠️ Ya tienes una solicitud en proceso.\n\n`;
      
      message += `📱 Folio: ${hasActiveApp.id}\n`;
      message += `💰 Monto pendiente: $${hasActiveApp.importe || PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n`;
      message += `📅 Creada: ${new Date(hasActiveApp.created_at).toLocaleDateString('es-MX')}\n\n`;
      
      message += `¿Qué deseas hacer?\n\n`;
      message += `1️⃣ Ver estado de mis solicitudes\n`;
      message += `2️⃣ Cancelar esta solicitud y crear una nueva\n`;
      message += `3️⃣ Volver al menú principal`;
      
      await this.sendMessage(from, message);
      
      // Set state to handle the response
      const state = {
        status: 'awaiting_active_app_decision',
        activeApplication: hasActiveApp,
        timestamp: Date.now()
      };
      await this.stateManager.setState(from, state);
      return;
    }
    
    // Check for saved draft data
    const currentState = await this.stateManager.getState(from) || {};
    if (currentState.draftData && currentState.draftField !== undefined) {
      // User has saved progress, ask if they want to continue
      const fieldsCompleted = currentState.draftField;
      const totalFields = this.fields.length;
      
      await this.sendMessage(from, 
        `📋 *SOLICITUD GUARDADA ENCONTRADA*\n\n` +
        `Tienes una solicitud guardada con ${fieldsCompleted} de ${totalFields} campos completados.\n\n` +
        `¿Quieres continuar donde te quedaste?\n\n` +
        `1️⃣ Sí, continuar\n` +
        `2️⃣ No, empezar de nuevo`
      );
      
      currentState.status = 'resume_prompt';
      await this.stateManager.setState(from, currentState);
      return;
    }
    
    // Push to navigation history
    navigationManager.pushNavigation(from, {
      state: 'NEW_APPLICATION',
      title: 'Nueva Solicitud',
      data: { userId: user.id }
    });
    
    // Get assistant for personalized messages
    const assistant = this.getAssistantForUser(from);
    
    // Professional privacy consent - single message
    const privacyConsent = `🔒 *AVISO DE PRIVACIDAD*\n\n` +
                          `Para procesar su solicitud, requerimos:\n\n` +
                          `📝 *Datos personales:*\n` +
                          `• Nombre completo y CURP\n` +
                          `• Correo electrónico\n\n` +
                          `🚗 *Datos del vehículo:*\n` +
                          `• Marca, modelo y año\n` +
                          `• Número de serie y motor\n` +
                          `• *Tipo de vehículo (auto, pick up, motocicleta)*\n\n` +
                          `📍 *Domicilio completo*\n\n` +
                          `*Sus datos están protegidos y solo los usamos para generar tu permiso oficial.*\n\n` +
                          `¿Acepta continuar?\n\n` +
                          `1️⃣ Sí, acepto\n` +
                          `2️⃣ Ver política completa\n` +
                          `3️⃣ No acepto`;
    
    await this.sendMessage(from, privacyConsent);
    
    await this.stateManager.setState(from, {
      status: 'awaiting_privacy_consent',
      userId: user.id,
      userEmail: user.account_email, // Can be null for WhatsApp users
      hasTempEmail: false, // No more placeholder emails
      startedAt: new Date()
    });
  }

  /**
   * Handle privacy consent
   */
  async handlePrivacyConsent(from, response, state) {
    const normalized = response.toLowerCase().trim();
    const assistant = this.getAssistantForUser(from);
    
    // Handle numeric options first
    if (normalized === '1') {
      // Accept consent - proceed with form collection directly
      // Log consent
      await privacyAuditService.logConsent(
        state.userId,
        'data_processing',
        true,
        { 
          version: this.PRIVACY_VERSION,
          source: 'whatsapp',
          phoneNumber: from
        }
      );
      
      // Start data collection with groups
      state.status = 'collecting';
      state.currentField = 0;
      state.currentGroup = 'personal';
      state.currentGroupIndex = 0;
      state.data = {};
      
      // Pre-fill email if user already has one
      if (state.userEmail) {
        state.data.email = state.userEmail;
      }
      
      await this.stateManager.setState(from, state);
      
      // Preserve form data in navigation
      navigationManager.preserveState(from, 'form_data', state.data);
      navigationManager.pushNavigation(from, {
        state: 'FORM_FILLING',
        title: 'Llenando Formulario',
        data: { step: 1, total: this.fields.length }
      });
      
      // Start with first group introduction and first field
      const firstGroup = this.fieldGroups.personal;
      const firstField = firstGroup.fields[0];
      
      // Calculate total fields user will see
      const emailSkipped = state.userEmail && state.data.email;
      const totalFieldsForUser = emailSkipped ? this.fields.length - 1 : this.fields.length;
      
      const assistant = this.getAssistantForUser(from);
      const welcomeMessage = assistant.name === 'Sophia' ? 
        `✅ *CONSENTIMIENTO ACEPTADO*\n\n` +
        `💜 ¡Perfecto! Ahora recopilemos tus datos paso a paso.\n\n` +
        `📝 *PASO 1: DATOS PERSONALES*\n\n` +
        `${firstField.prompt}\n\n` +
        `(Campo 1 de ${totalFieldsForUser})` :
        
        `✅ *CONSENTIMIENTO ACEPTADO*\n\n` +
        `🔧 ¡Excelente! Vamos por tus datos, será rápido.\n\n` +
        `📝 *PASO 1: INFORMACIÓN PERSONAL*\n\n` +
        `${firstField.prompt}\n\n` +
        `(Campo 1 de ${totalFieldsForUser})`;
      
      await this.sendMessage(from, welcomeMessage);
      return;
    }
    
    if (normalized === '2') {
      // Show privacy policy info
      await this.sendMessage(from, 
        `📋 *POLÍTICA DE PRIVACIDAD*\n\n` +
        `✅ Tus datos están protegidos por ley\n` +
        `🔒 Solo los usamos para generar tu permiso\n` +
        `🗑️ Puedes eliminarlos cuando quieras\n` +
        `📧 No enviamos spam ni vendemos información\n\n` +
        `Más detalles: permisosdigitales.com.mx/politica-de-privacidad\n\n` +
        `¿Continuamos?\n\n` +
        `1️⃣ Sí, acepto\n` +
        `3️⃣ No acepto`
      );
      
      // Change state to indicate user has viewed policy
      state.status = 'awaiting_privacy_consent_after_viewing';
      await this.stateManager.setState(from, state);
      return;
    }
    
    if (normalized === '3') {
      // User rejected - clear state
      await this.stateManager.clearState(from);
      await this.sendMessage(from, 
        `❌ *Proceso cancelado*\n\n` +
        `Entendemos su decisión. Si cambia de opinión, puede escribir "permiso" para comenzar nuevamente.\n\n` +
        `Gracias por contactarnos.`
      );
      return;
    }
    
    // Invalid option - show menu again
    await this.sendMessage(from, 
      `Opción no válida. Por favor seleccione:\n\n` +
      `1️⃣ Sí, acepto\n` +
      `2️⃣ Ver política completa\n` +
      `3️⃣ No acepto`
    );
    return;
    
    // Legacy fallback code (unreachable now, but kept for reference)
    /*
    const rejectionWords = ['no', 'cancelar', 'cancel', 'salir', 'exit', 'detener', 'stop', 'nunca', 'jamás'];
    const isRejection = rejectionWords.some(word => normalized.includes(word));
    
    // Check for info request (legacy support)
    const infoWords = ['info', 'información', 'detalles', 'más', 'política', 'privacidad', '📄'];
    const wantsInfo = infoWords.some(word => normalized.includes(word));
    */
  }

  /**
   * Handle privacy consent after user has viewed the policy
   */
  async handlePrivacyConsentAfterViewing(from, response, state) {
    const normalized = response.toLowerCase().trim();
    const assistant = this.getAssistantForUser(from);
    
    if (normalized === '1') {
      // Accept consent - proceed with form collection directly
      // Log consent
      await privacyAuditService.logConsent(
        state.userId,
        'data_processing',
        true,
        { 
          version: this.PRIVACY_VERSION,
          source: 'whatsapp',
          phoneNumber: from
        }
      );
      
      // Start data collection with groups
      state.status = 'collecting';
      state.currentField = 0;
      state.currentGroup = 'personal';
      state.currentGroupIndex = 0;
      state.data = {};
      
      // Pre-fill email if user already has one
      if (state.userEmail) {
        state.data.email = state.userEmail;
      }
      
      await this.stateManager.setState(from, state);
      
      // Preserve form data in navigation
      navigationManager.preserveState(from, 'form_data', state.data);
      navigationManager.pushNavigation(from, {
        state: 'FORM_FILLING',
        title: 'Llenando Formulario',
        data: { step: 1, total: this.fields.length }
      });
      
      // Start with first group introduction and first field
      const firstGroup = this.fieldGroups.personal;
      const firstField = firstGroup.fields[0];
      
      // Calculate total fields user will see
      const emailSkipped = state.userEmail && state.data.email;
      const totalFieldsForUser = emailSkipped ? this.fields.length - 1 : this.fields.length;
      
      const welcomeMessage = assistant.name === 'Sophia' ? 
        `✅ *CONSENTIMIENTO ACEPTADO*\n\n` +
        `💜 ¡Perfecto! Ahora recopilemos tus datos paso a paso.\n\n` +
        `📝 *PASO 1: DATOS PERSONALES*\n\n` +
        `${firstField.prompt}\n\n` +
        `(Campo 1 de ${totalFieldsForUser})` :
        
        `✅ *CONSENTIMIENTO ACEPTADO*\n\n` +
        `🔧 ¡Excelente! Vamos por tus datos, será rápido.\n\n` +
        `📝 *PASO 1: INFORMACIÓN PERSONAL*\n\n` +
        `${firstField.prompt}\n\n` +
        `(Campo 1 de ${totalFieldsForUser})`;
      
      await this.sendMessage(from, welcomeMessage);
      return;
    }
    
    if (normalized === '3') {
      // User rejected - clear state
      await this.stateManager.clearState(from);
      const rejectMessage = assistant.name === 'Sophia' ? 
        `❌ *Proceso cancelado*\n\n` +
        `💜 *Sophia:* "Entiendo tu decisión. Si cambias de opinión, estaré aquí"\n\n` +
        `Escribe cualquier mensaje para volver al menú principal.` :
        
        `❌ *Proceso cancelado*\n\n` +
        `🔧 *Diego:* "Sin problema. Si luego quieres tu permiso, me avisas"\n\n` +
        `Escribe cualquier mensaje para regresar al menú.`;
        
      await this.sendMessage(from, rejectMessage);
      return;
    }
    
    // Invalid option
    const errorMessage = assistant.name === 'Sophia' ? 
      `💜 Por favor selecciona una opción válida:\n\n` +
      `1️⃣ Sí, acepto\n` +
      `3️⃣ No acepto` :
      
      `🔧 Opción no válida. Elige:\n\n` +
      `1️⃣ Sí, acepto\n` +
      `3️⃣ No acepto`;
      
    await this.sendMessage(from, errorMessage);
  }

  /**
   * Handle data collection
   */
  async handleDataCollection(from, value, state) {
    const fieldIndex = state.currentField || 0;
    const field = this.fields[fieldIndex];
    
    // Store current form data for navigation
    navigationManager.preserveState(from, 'form_data', state.data);
    
    // Check for help command
    if (value.toLowerCase() === 'ayuda' || value.toLowerCase() === 'help') {
      await this.showHelp(from);
      // After showing help, remind them of the current field
      setTimeout(async () => {
        await this.sendFieldPrompt(from, field, fieldIndex);
      }, 1000);
      return;
    }
    
    // Check if user wants to go back
    if (value.toLowerCase() === 'atras' || value.toLowerCase() === 'atrás' || value.toLowerCase() === 'back') {
      if (fieldIndex > 0) {
        // Go back to previous field
        state.currentField = fieldIndex - 1;
        
        // Skip email field if going backwards and it's pre-filled
        const prevField = this.fields[state.currentField];
        if (prevField.key === 'email' && state.data.email && state.userEmail) {
          state.currentField = Math.max(0, state.currentField - 1);
        }
        
        await this.stateManager.setState(from, state);
        const fieldToShow = this.fields[state.currentField];
        await this.sendMessage(from, `↩️ Regresando al campo anterior...`);
        await this.sendFieldPrompt(from, fieldToShow, state.currentField, state);
        return;
      } else {
        await this.sendMessage(from, `↩️ Ya estás en el primer campo. Escribe "0" para cancelar.`);
        return;
      }
    }
    
    // Check if user wants to cancel
    if (value.toLowerCase() === 'cancelar' || value === '0') {
      // Ask if they want to save progress
      state.status = 'save_progress_prompt';
      await this.stateManager.setState(from, state);
      
      await this.sendMessage(from, 
        `⏸️ ¿Quieres guardar tu progreso para continuar después?\n\n` +
        `1️⃣ Sí, guardar\n` +
        `2️⃣ No, borrar todo`
      );
      return;
    }
    
    // Validate input
    const validation = this.validateField(field.key, value);
    if (!validation.valid) {
      const assistant = this.getAssistantForUser(from);
      
      // Send error message
      await this.sendMessage(from, validation.error);
      return;
    }
    
    // Store value
    state.data[field.key] = validation.value;
    
    // Get assistant for personalized responses
    const assistant = this.getAssistantForUser(from);
    
    // Special feedback for color normalization
    let savedMessage = '';
    if (field.key === 'color' && value.includes('/')) {
      savedMessage = `✅ Color guardado como: *${validation.value}*`;
    } else {
      // Personalized success messages
      savedMessage = `✅ Información guardada`;
    }
    
    // Move to next field
    if (fieldIndex < this.fields.length - 1) {
      state.currentField = fieldIndex + 1;
      
      // Skip email field ONLY if we have a real email from the user (not asking them to provide one)
      const nextField = this.fields[state.currentField];
      if (nextField.key === 'email' && state.data.email && state.userEmail) {
        state.currentField++;
      }
      
      await this.stateManager.setState(from, state);
      
      const fieldToShow = this.fields[state.currentField];
      await this.sendFieldPrompt(from, fieldToShow, state.currentField, state);
    } else {
      // All fields collected - show confirmation
      state.status = 'confirming';
      await this.stateManager.setState(from, state);
      await this.showConfirmation(from, state);
    }
  }

  /**
   * Show confirmation with numbered fields for easy editing
   */
  async showConfirmation(from, state) {
    // Push to navigation history
    navigationManager.pushNavigation(from, {
      state: 'CONFIRMATION',
      title: 'Confirmación de Datos',
      data: { formData: state.data }
    });
    
    let message = `📋 *CONFIRMACIÓN DE DATOS*\n\n`;
    
    // Build fields array, excluding email if it was pre-filled
    const fieldsToShow = [];
    for (let i = 0; i < this.fields.length; i++) {
      const field = this.fields[i];
      // Skip showing email in confirmation if it was pre-filled
      if (field.key === 'email' && state.userEmail && state.data.email === state.userEmail) {
        continue;
      }
      fieldsToShow.push({
        field: field,
        originalIndex: i,
        value: state.data[field.key]
      });
    }
    
    // Show numbered list
    for (let i = 0; i < fieldsToShow.length; i++) {
      const item = fieldsToShow[i];
      const number = i + 1;
      message += `${number}. *${item.field.label}:* ${item.value}\n`;
    }
    
    message += `\n¿Los datos son correctos?\n\n`;
    message += `✅ Escribe *SI* para continuar\n`;
    message += `📝 Escribe el número del campo a corregir (1-${fieldsToShow.length})\n`;
    message += `❌ Escribe *NO* o *0* para cancelar`;
    
    // Store fields mapping for editing
    state.confirmationFields = fieldsToShow;
    await this.stateManager.setState(from, state);
    
    await this.sendMessage(from, message);
  }

  /**
   * Handle confirmation response
   */
  async handleConfirmation(from, response, state) {
    const normalized = response.toLowerCase().trim();
    
    // Check if user confirms
    if (normalized === 'si' || normalized === 'sí') {
      // Go directly to creating the application
      await this.createApplication(from, state);
      return;
    }
    
    // Check if user wants to cancel
    if (normalized === 'no' || normalized === '0') {
      await this.stateManager.clearState(from);
      await this.sendMessage(from, 
        `❌ Proceso cancelado.\n\n` +
        `Escribe cualquier mensaje para volver al menú principal.`
      );
      return;
    }
    
    // Check if user wants to edit a field by number
    const fieldNumber = parseInt(response);
    const fieldsToShow = state.confirmationFields || [];
    
    if (fieldNumber >= 1 && fieldNumber <= fieldsToShow.length) {
      const fieldInfo = fieldsToShow[fieldNumber - 1];
      const field = fieldInfo.field;
      const originalIndex = fieldInfo.originalIndex;
      
      state.status = 'editing_field';
      state.editingField = originalIndex;
      await this.stateManager.setState(from, state);
      
      await this.sendMessage(from, 
        `📝 *Editando ${field.label}*\n\n` +
        `Valor actual: ${state.data[field.key]}\n\n` +
        field.prompt
      );
      return;
    }
    
    // Invalid response
    await this.sendMessage(from, 
      `❌ Respuesta no válida.\n\n` +
      `✅ Escribe *SI* para continuar\n` +
      `📝 Escribe el número del campo a corregir (1-${fieldsToShow.length})\n` +
      `❌ Escribe *NO* o *0* para cancelar`
    );
  }

  /**
   * Handle field editing
   */
  async handleFieldEdit(from, value, state) {
    const field = this.fields[state.editingField];
    
    // Validate input
    const validation = this.validateField(field.key, value);
    if (!validation.valid) {
      await this.sendMessage(from, `❌ ${validation.error}\n\nIntenta de nuevo.`);
      return;
    }
    
    // Update value
    state.data[field.key] = validation.value;
    state.status = 'confirming';
    delete state.editingField;
    await this.stateManager.setState(from, state);
    
    // Show confirmation again
    await this.showConfirmation(from, state);
  }

  /**
   * Handle save progress prompt
   */
  async handleSaveProgressPrompt(from, response, state) {
    const selection = response.trim();
    
    if (selection === '1') {
      // Save as draft
      state.draftData = state.data || {};
      state.draftField = state.currentField || 0;
      state.draftUserEmail = state.userEmail; // Preserve userEmail for counting
      state.status = 'draft_saved';
      await this.stateManager.setState(from, state);
      
      await this.sendMessage(from, 
        `✅ Tu progreso ha sido guardado.\n\n` +
        `Puedes continuar en cualquier momento escribiendo "hola".\n\n` +
        `⏰ Tu sesión guardada expirará en 24 horas.`
      );
    } else if (selection === '2') {
      // Clear everything
      await this.stateManager.clearState(from);
      await this.sendMessage(from, 
        `🗑️ Tu progreso ha sido eliminado.\n\n` +
        `Escribe cualquier mensaje para volver al menú principal.`
      );
    } else {
      await this.sendMessage(from, 
        `Por favor responde:\n\n` +
        `1️⃣ Sí, guardar\n` +
        `2️⃣ No, borrar todo`
      );
    }
  }

  /**
   * Handle resume prompt
   */
  async handleResumePrompt(from, response, state) {
    const selection = response.trim();
    
    if (selection === '1') {
      // Resume from draft
      state.status = 'collecting';
      state.data = state.draftData || {};
      state.currentField = state.draftField || 0;
      state.userEmail = state.draftUserEmail; // Restore userEmail for field counting
      delete state.draftData;
      delete state.draftField;
      delete state.draftUserEmail;
      await this.stateManager.setState(from, state);
      
      // Show next field to collect
      if (state.currentField < this.fields.length) {
        const field = this.fields[state.currentField];
        
        // Calculate total fields user will see (same logic as sendFieldPrompt)
        const emailSkipped = state.userEmail && state.data.email;
        const totalFieldsForUser = emailSkipped ? this.fields.length - 1 : this.fields.length;
        
        // Calculate user-facing field number
        let userFieldNumber = state.currentField + 1;
        if (emailSkipped && state.currentField > 2) { // Email is field index 2
          userFieldNumber = state.currentField; // Adjust because we skip email
        }
        
        await this.sendMessage(from, `✅ Continuando donde te quedaste...`);
        await this.sendFieldPrompt(from, field, state.currentField, state);
      } else {
        // All fields already collected, show confirmation
        state.status = 'confirming';
        await this.stateManager.setState(from, state);
        await this.showConfirmation(from, state);
      }
    } else if (selection === '2') {
      // Start fresh
      await this.stateManager.clearState(from);
      await this.showMainMenu(from);
    } else {
      await this.sendMessage(from, 
        `Por favor responde:\n\n` +
        `1️⃣ Sí, continuar\n` +
        `2️⃣ No, empezar de nuevo`
      );
    }
  }

  /**
   * Handle draft continuation option
   */
  async handleDraftContinuation(from) {
    const state = await this.stateManager.getState(from) || {};
    const assistant = this.getAssistantForUser(from);
    
    if (state.draftData) {
      // User has a draft - show continuation options
      const progress = Math.round((state.draftField / this.fields.length) * 100);
      const message = assistant.name === 'Sophia' ? 
        `💜 ¡Perfecto! Tienes un permiso ${progress}% completado.\n\n` +
        `🌟 *OPCIONES PARA TU SOLICITUD GUARDADA:*\n\n` +
        `1️⃣ Continuar donde me quedé\n` +
        `2️⃣ Ver qué datos ya completé\n` +
        `3️⃣ Empezar una nueva solicitud\n` +
        `4️⃣ Eliminar solicitud guardada\n\n` +
        `💜 Sophia: "¿Qué prefieres hacer?"` :
        
        `🔧 ¡Excelente! Ya tienes ${progress}% de tu permiso listo.\n\n` +
        `⚡ *¿QUÉ QUIERES HACER?*\n\n` +
        `1️⃣ Seguir llenando datos\n` +
        `2️⃣ Revisar lo que ya puse\n` +
        `3️⃣ Mejor empezar de cero\n` +
        `4️⃣ Borrar solicitud guardada\n\n` +
        `🚗 Diego: "Te recomiendo continuar para terminar rápido"`;
        
      await this.sendMessage(from, message);
      state.status = 'draft_continuation_menu';
      await this.stateManager.setState(from, state);
    } else {
      // No draft found
      const message = assistant.name === 'Sophia' ? 
        `💜 No tienes ninguna solicitud guardada actualmente.\n\n` +
        `🌟 *¿QUÉ TE GUSTARÍA HACER?*\n\n` +
        `1️⃣ Solicitar nuevo permiso\n` +
        `2️⃣ Ver mis solicitudes existentes\n` +
        `3️⃣ Volver al menú principal\n\n` +
        `💜 Sophia: "¡Empecemos tu trámite!"` :
        
        `🔧 No hay solicitudes guardadas en este momento.\n\n` +
        `⚡ *OPCIONES DISPONIBLES:*\n\n` +
        `1️⃣ Crear nuevo permiso\n` +
        `2️⃣ Consultar mis solicitudes\n` +
        `3️⃣ Regresar al menú\n\n` +
        `🚗 Diego: "¡Hagamos tu permiso ahora mismo!"`;
        
      await this.sendMessage(from, message);
      state.status = 'no_draft_menu';
      await this.stateManager.setState(from, state);
    }
  }

  /**
   * Handle draft continuation menu responses
   */
  async handleDraftContinuationMenu(from, response, state) {
    const assistant = this.getAssistantForUser(from);
    
    switch (response.trim()) {
      case '1':
        // Continue from draft
        return await this.handleResumePrompt(from, '1', state);
      case '2':
        // Show draft preview
        return await this.showDraftPreview(from, state);
      case '3':
        // Start new application
        await this.stateManager.clearState(from);
        return await this.startApplication(from);
      case '4':
        // Delete draft
        return await this.confirmDraftDeletion(from, state);
      default:
        const errorMsg = assistant.name === 'Sophia' ? 
          `💜 Por favor elige una opción válida (1-4):\n\n` +
          `1️⃣ Continuar donde me quedé\n` +
          `2️⃣ Ver qué datos ya completé\n` +
          `3️⃣ Empezar una nueva solicitud\n` +
          `4️⃣ Eliminar solicitud guardada` :
          
          `🔧 Opción no válida. Elige 1, 2, 3 o 4:\n\n` +
          `1️⃣ Seguir llenando datos\n` +
          `2️⃣ Revisar lo que ya puse\n` +
          `3️⃣ Mejor empezar de cero\n` +
          `4️⃣ Borrar solicitud guardada`;
          
        await this.sendMessage(from, errorMsg);
    }
  }

  /**
   * Handle rate limit options menu
   */
  async handleRateLimitOptions(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Show status with management options
        state.status = 'managing_applications';
        await this.stateManager.setState(from, state);
        return await this.showStatusWithManagement(from);
        
      case '2':
        // Find pending payment and show it
        const apps = await this.getUserApplications(from);
        const pendingApp = apps.find(app => app.payment_status === 'pending');
        
        if (pendingApp) {
          // Get payment link from Stripe if we have the order ID
          if (pendingApp.payment_processor_order_id) {
            await this.sendMessage(from, 
              `💳 *PAGO PENDIENTE*\n\n` +
              `📱 Folio: ${pendingApp.id}\n` +
              `🚗 Vehículo: ${pendingApp.vehicle_brand} ${pendingApp.vehicle_model}\n` +
              `💰 Costo: $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n\n` +
              `🔗 Link de pago:\nhttps://permisosdigitales.com.mx/pago/${pendingApp.payment_processor_order_id}`
            );
          } else {
            // No payment link available
            await this.sendMessage(from,
              `⚠️ Hay una solicitud pendiente pero no se encontró el link de pago.\n\n` +
              `Por favor contacta a soporte o crea una nueva solicitud.`
            );
          }
        } else {
          return await this.checkStatus(from);
        }
        break;
        
      case '3':
        state.status = 'idle';
        await this.stateManager.setState(from, state);
        return await this.showMainMenu(from);
        
      default:
        await this.sendMessage(from, 
          `Por favor selecciona una opción:\n\n` +
          `1️⃣ Ver y gestionar mis solicitudes\n` +
          `2️⃣ Completar pago pendiente\n` +
          `3️⃣ Volver al menú principal`
        );
    }
  }

  /**
   * Show status with management options
   */
  async showStatusWithManagement(from) {
    const apps = await this.getUserApplications(from);
    if (!apps || apps.length === 0) {
      await this.sendMessage(from, 
        `📋 No tienes solicitudes registradas.\n\n` +
        `Escribe "1" para crear una nueva.`
      );
      return;
    }
    
    // Show recent applications with delete option for unpaid ones
    let message = `📋 *TUS SOLICITUDES*\n\n`;
    const recentApps = apps.slice(0, 5);
    let hasUnpaid = false;
    
    recentApps.forEach((app, index) => {
      const statusEmoji = app.payment_status === 'pending' ? '⏳' : 
                         app.payment_status === 'paid' ? '✅' : '🚫';
      
      message += `${index + 1}. Folio: ${app.id}\n`;
      message += `   📅 ${new Date(app.created_at).toLocaleDateString('es-MX')}\n`;
      message += `   🚗 ${app.vehicle_brand} ${app.vehicle_model}\n`;
      message += `   ${statusEmoji} ${app.payment_status === 'pending' ? 'Esperando pago' : 
                      app.payment_status === 'paid' ? 'Pagado' : 'Cancelado'}\n\n`;
      
      if (app.payment_status === 'pending') {
        hasUnpaid = true;
      }
    });
    
    if (hasUnpaid) {
      message += `⚡ *OPCIONES:*\n\n`;
      message += `Para CANCELAR una solicitud sin pagar, escribe:\n`;
      message += `"cancelar [número de folio]"\n\n`;
      message += `Ejemplo: cancelar 59\n\n`;
      message += `Escribe "menu" para volver al menú principal.`;
    } else {
      message += `Escribe cualquier mensaje para volver al menú.`;
    }
    
    await this.sendMessage(from, message);
  }

  /**
   * Handle managing applications state
   */
  async handleManagingApplications(from, response, state) {
    const normalized = response.toLowerCase().trim();
    
    // Check for cancel command
    if (normalized.startsWith('cancelar ')) {
      const folioStr = normalized.replace('cancelar ', '').trim();
      const folio = parseInt(folioStr);
      
      if (!isNaN(folio)) {
        try {
          // Get user first
          const user = await this.findOrCreateUser(from);
          
          // Cancel the application
          const result = await db.query(
            `UPDATE permit_applications 
             SET status = 'CANCELLED', 
                 updated_at = NOW() 
             WHERE id = $1 
               AND user_id = $2 
               AND status = 'AWAITING_PAYMENT'
             RETURNING id`,
            [folio, user.id]
          );
          
          if (result.rows.length > 0) {
            await this.sendMessage(from, 
              `✅ *SOLICITUD CANCELADA*\n\n` +
              `Folio ${folio} ha sido cancelado exitosamente.\n\n` +
              `Ahora puedes crear una nueva solicitud si lo deseas.\n\n` +
              `Escribe "menu" para volver al menú principal.`
            );
            
            // Clear pending payment from state if it matches
            if (state.pendingPayment && state.pendingPayment.applicationId === folio) {
              delete state.pendingPayment;
              await this.stateManager.setState(from, state);
            }
          } else {
            await this.sendMessage(from, 
              `❌ No se pudo cancelar el folio ${folio}.\n\n` +
              `Verifica que:\n` +
              `- El número de folio sea correcto\n` +
              `- La solicitud esté pendiente de pago\n` +
              `- La solicitud sea tuya\n\n` +
              `Intenta de nuevo o escribe "menu" para salir.`
            );
          }
        } catch (error) {
          logger.error('Error cancelling application', { error: error.message, folio, from });
          await this.sendMessage(from, 
            `❌ Hubo un error al cancelar. Por favor intenta más tarde.`
          );
        }
      } else {
        await this.sendMessage(from, 
          `❌ Formato incorrecto.\n\n` +
          `Escribe: cancelar [folio]\n` +
          `Ejemplo: cancelar 59`
        );
      }
    } else if (normalized === 'menu' || normalized === 'menú') {
      state.status = 'idle';
      await this.stateManager.setState(from, state);
      return await this.showMainMenu(from);
    } else {
      // Show status again
      return await this.showStatusWithManagement(from);
    }
  }

  /**
   * Handle no draft menu responses
   */
  async handleNoDraftMenu(from, response, state) {
    const assistant = this.getAssistantForUser(from);
    
    switch (response.trim()) {
      case '1':
        // Create new permit
        return await this.startApplication(from);
      case '2':
        // Check status
        return await this.checkStatus(from);
      case '3':
        // Back to main menu
        return await this.showMainMenu(from);
      default:
        const errorMsg = assistant.name === 'Sophia' ? 
          `💜 Por favor selecciona 1, 2 o 3:\n\n` +
          `1️⃣ Solicitar nuevo permiso\n` +
          `2️⃣ Ver mis solicitudes existentes\n` +
          `3️⃣ Volver al menú principal` :
          
          `🔧 Elige una opción válida (1-3):\n\n` +
          `1️⃣ Crear nuevo permiso\n` +
          `2️⃣ Consultar mis solicitudes\n` +
          `3️⃣ Regresar al menú`;
          
        await this.sendMessage(from, errorMsg);
    }
  }

  /**
   * Show help
   */
  async showHelp(from) {
    // Get current state to provide contextual help
    const state = await this.stateManager.getState(from) || {};
    
    // Check if user has a pending payment
    if (state.pendingPayment) {
      await this.sendMessage(from, 
        `💳 *AYUDA - PAGO PENDIENTE*\n\n` +
        `Tienes un pago pendiente:\n` +
        `📱 Folio: ${state.pendingPayment.applicationId}\n` +
        `💰 Monto: $99.00 MXN\n\n` +
        `*Opciones de pago:*\n` +
        `• Tarjeta de crédito/débito\n` +
        `• OXXO (validación en 4-24 horas)\n\n` +
        `*¿Problemas con el pago?*\n` +
        `1️⃣ Reenviar link por email\n` +
        `2️⃣ Generar nuevo link\n` +
        `3️⃣ Contactar soporte\n\n` +
        `📧 contacto@permisosdigitales.com.mx\n` +
        `💬 WhatsApp: +52 55 4943 0313`
      );
      
      state.status = 'payment_help_menu';
      await this.stateManager.setState(from, state);
      return;
    }
    
    // Check if user is in the middle of filling a form
    if (state.status === 'collecting' && state.currentField !== undefined) {
      const field = this.fields[state.currentField];
      await this.sendMessage(from, 
        `📝 *AYUDA - LLENADO DE FORMULARIO*\n\n` +
        `Estás en el paso ${state.currentField + 1} de ${this.fields.length}\n` +
        `Campo actual: *${field.label}*\n\n` +
        `*Consejos:*\n` +
        this.getFieldHelp(field.key) + `\n\n` +
        `*Opciones:*\n` +
        `• Escribe tu respuesta para continuar\n` +
        `• Escribe *0* para cancelar y guardar progreso\n\n` +
        `¿Necesitas más ayuda?\n` +
        `📧 contacto@permisosdigitales.com.mx\n` +
        `💬 WhatsApp: +52 55 4943 0313`
      );
      return;
    }
    
    // Default help message
    await this.sendMessage(from, 
      `📚 *AYUDA*\n\n` +
      `*¿Cómo funciona?*\n` +
      `1. Elige "Nuevo permiso" del menú\n` +
      `2. Acepta el aviso de privacidad\n` +
      `3. Proporciona los datos solicitados\n` +
      `4. Confirma la información\n` +
      `5. Realiza el pago\n` +
      `6. Recibe tu permiso por email\n\n` +
      `*Tiempo de proceso:* 5-10 minutos\n` +
      `*Costo:* $99.00 MXN\n` +
      `*Validez:* 30 días\n\n` +
      `¿Necesitas más ayuda?\n` +
      `📧 contacto@permisosdigitales.com.mx\n` +
      `💬 WhatsApp: +52 55 4943 0313\n\n` +
      `Escribe cualquier mensaje para volver al menú.`
    );
    
    await this.stateManager.clearState(from);
  }

  /**
   * Handle payment method selection
   * @deprecated - Now we always offer both payment methods in Stripe Checkout
   */
  // async handlePaymentMethodSelection(from, response, state) {
  //   const selection = response.trim();
  //   
  //   if (selection === '1' || selection === '2') {
  //     // Store payment preference
  //     state.paymentMethod = selection === '1' ? 'card' : 'oxxo';
  //     await this.stateManager.setState(from, state);
  //     
  //     // Create application with selected payment method
  //     return await this.createApplication(from, state);
  //   } else {
  //     await this.sendMessage(from, 
  //       `Por favor responde:\n\n` +
  //       `1️⃣ Tarjeta (inmediato)\n` +
  //       `2️⃣ OXXO (paga en tienda)`
  //     );
  //   }
  // }

  /**
   * Get contextual help for a specific field
   */
  getFieldHelp(fieldKey) {
    const helpTexts = {
      'nombre_completo': '• Escribe tu nombre completo tal como aparece en tu identificación\n• Ejemplo: Juan Pérez García',
      'curp_rfc': '• CURP: 18 caracteres\n• RFC: 12-13 caracteres\n• Ejemplo CURP: ABCD123456HEFGHI01\n• Ejemplo RFC: ABCD123456XYZ',
      'domicilio': '• Incluye calle, número, colonia, ciudad y código postal\n• Ejemplo: Av. Reforma 123, Col. Centro, CDMX, 06000',
      'email': '• Correo válido donde recibirás tu permiso\n• Ejemplo: usuario@ejemplo.com',
      'marca': '• Marca del vehículo\n• Ejemplos: Toyota, Nissan, Chevrolet, etc.',
      'linea': '• Modelo o línea del vehículo\n• Ejemplos: Corolla, Sentra, Aveo, etc.',
      'color': '• Color principal del vehículo\n• Si tiene varios colores, sepáralos con "y"\n• Ejemplo: Blanco y Negro',
      'numero_serie': '• VIN o número de serie del vehículo\n• Generalmente 17 caracteres\n• Lo encuentras en la tarjeta de circulación',
      'numero_motor': '• Número de motor del vehículo\n• Lo encuentras en la tarjeta de circulación',
      'ano_modelo': '• Año del modelo del vehículo\n• Ejemplo: 2020, 2021, 2022'
    };
    
    return helpTexts[fieldKey] || '• Ingresa la información solicitada';
  }

  /**
   * Handle direct creation from status check
   */
  async handleCreateFromStatus(from, response, state) {
    if (response.trim() === '1') {
      // User wants to create a new application
      // Don't clear state - let startApplication handle draft checking
      return await this.startApplication(from);
    } else {
      // Any other response goes back to menu
      // Only clear the special status, preserve drafts
      state.status = 'idle';
      await this.stateManager.setState(from, state);
      return await this.showMainMenu(from);
    }
  }

  /**
   * Handle folio selection from status view
   */
  async handleFolioSelection(from, response, state) {
    const input = response.trim().toLowerCase();
    
    // Check if user wants to go back to menu
    if (input === 'menu' || input === 'inicio' || input === 'menú') {
      await this.stateManager.clearState(from);
      return await this.showMainMenu(from);
    }
    
    // Check if input is a number (folio)
    const folioNumber = parseInt(input);
    if (!isNaN(folioNumber) && state.availablePermits) {
      const permit = state.availablePermits.find(p => p.id === folioNumber);
      
      if (permit) {
        // Handle based on permit status
        if (permit.status === 'PERMIT_READY') {
          // Generate download link
          await this.sendPermitDownloadLink(from, folioNumber);
          // Don't clear state here - sendPermitDownloadLink sets permit_downloaded state
          return;
        } else if (permit.status === 'AWAITING_PAYMENT' && permit.payment_processor_order_id) {
          // Show payment link
          await this.sendMessage(from,
            `💳 *PAGO PENDIENTE - Folio ${folioNumber}*\n\n` +
            `💰 Costo: $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n\n` +
            `🔗 Link de pago:\nhttps://permisosdigitales.com.mx/pago/${permit.payment_processor_order_id}\n\n` +
            `📱 O paga directamente aquí:\nhttps://checkout.stripe.com/c/pay/${permit.payment_processor_order_id}\n\n` +
            `Escribe "menu" para volver al menú principal`
          );
          // Clear state for non-PERMIT_READY statuses
          await this.stateManager.clearState(from);
        } else {
          await this.sendMessage(from,
            `ℹ️ Folio ${folioNumber}: ${this.getStatusMessage(permit.status)}\n\n` +
            `Escribe "menu" para volver al menú principal`
          );
          // Clear state for non-PERMIT_READY statuses
          await this.stateManager.clearState(from);
        }
      } else {
        await this.sendMessage(from,
          `❌ No se encontró el folio ${folioNumber} en tu lista.\n\n` +
          `Por favor verifica el número o escribe "menu" para volver.`
        );
      }
    } else {
      // Invalid input
      await this.sendMessage(from,
        `❌ Por favor escribe un número de folio válido o "menu" para volver.`
      );
    }
  }

  /**
   * Get friendly status message
   */
  getStatusMessage(status) {
    switch (status) {
      case 'AWAITING_PAYMENT': return '⏳ Esperando pago';
      case 'PENDING':
      case 'PROCESSING': return '⚙️ Procesando';
      case 'PERMIT_READY': return '✅ Permiso listo para descargar';
      case 'COMPLETED': return '✅ Completado';
      case 'FAILED': return '❌ Fallido';
      case 'CANCELLED': return '🚫 Cancelado';
      case 'EXPIRED': return '⏰ Expirado';
      default: return status;
    }
  }

  /**
   * Send permit download link
   */
  async sendPermitDownloadLink(from, folioNumber) {
    try {
      // Get the application data
      const user = await this.findOrCreateUser(from);
      const appResult = await db.query(
        `SELECT * FROM permit_applications WHERE id = $1 AND user_id = $2`,
        [folioNumber, user.id]
      );
      
      if (appResult.rows.length === 0) {
        await this.sendMessage(from,
          `❌ No se encontró el permiso con folio ${folioNumber}.`
        );
        return;
      }
      
      const app = appResult.rows[0];
      
      // Generate a clean download URL for all PDFs
      const axios = require('axios');
      
      try {
        // Call our internal API to generate a clean download link
        const apiUrl = process.env.API_URL || 'https://api.permisosdigitales.com.mx';
        const response = await axios.post(`${apiUrl}/permits/generate-link`, {
          applicationId: app.id,
          folioNumber: app.folio || folioNumber
        });
        
        if (!response.data.success) {
          throw new Error('Failed to generate download link');
        }
        
        const downloadUrl = response.data.url;
        
        // Send a professional, clean message with the single download link
        await this.sendMessage(from,
          `✅ *PERMISO LISTO - Folio ${folioNumber}*\n\n` +
          `📦 *TODOS TUS DOCUMENTOS EN UN ÚNICO ENLACE*\n\n` +
          `🔗 *Descarga aquí:*\n${downloadUrl}\n\n` +
          `📄 *Incluye:*\n` +
          `• Permiso Digital\n` +
          `• Certificado\n` +
          `• Placas en Proceso\n` +
          `• Recomendaciones\n\n` +
          `⏰ *Válido por:* 30 días\n` +
          `🔒 *Enlace seguro:* Expira en 48 horas\n\n` +
          `💡 *Tip:* Al tocar el enlace se descargará un archivo ZIP con todos tus documentos.\n\n` +
          `🔗 *OPCIONES RÁPIDAS:*\n` +
          `1️⃣ Reenviar por email\n` +
          `2️⃣ Nuevo permiso\n` +
          `3️⃣ Menú principal`
        );
        
        // Log the clean URL generation
        logger.info('Clean permit download URL generated', {
          folioNumber,
          applicationId: app.id,
          folio: app.folio,
          url: downloadUrl
        });
        
        // Set simple state for quick actions
        const newState = {
          status: 'permit_downloaded',
          lastAction: 'download',
          permitData: {
            folioNumber,
            downloadUrl,
            email: app.email || user.account_email
          },
          timestamp: Date.now()
        };
        
        // Log state being set
        logger.info('Setting permit_downloaded state', {
          from,
          status: 'permit_downloaded',
          folioNumber
        });
        
        await this.stateManager.setState(from, newState);
        
        // Verify state was set
        const verifyState = await this.stateManager.getState(from);
        logger.info('State verification after setting', {
          from,
          stateStatus: verifyState?.status,
          stateSet: verifyState?.status === 'permit_downloaded'
        });
        
      } catch (urlError) {
        logger.error('Error generating download URLs', { 
          error: urlError.message, 
          folioNumber,
          applicationId: app.id,
          folio: app.folio,
          stack: urlError.stack 
        });
        
        // Fallback to web link
        await this.sendMessage(from,
          `✅ *PERMISO LISTO - Folio ${folioNumber}*\n\n` +
          `🌐 *Descarga desde la web:*\nhttps://permisosdigitales.com.mx/permits\n\n` +
          `Ingresa con tu email y contraseña para descargar tu permiso.\n\n` +
          `Si olvidaste tu contraseña, puedes recuperarla en la página.\n\n` +
          `Escribe "menu" para volver al menú principal`
        );
      }
      
    } catch (error) {
      logger.error('Error sending permit download link', { error: error.message, folioNumber });
      await this.sendMessage(from,
        `❌ Hubo un error al obtener el enlace de descarga.\n\n` +
        `Por favor intenta más tarde o visita:\nhttps://permisosdigitales.com.mx/permits`
      );
    }
  }

  /**
   * Handle decision when user has active application
   */
  async handleActiveAppDecision(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Show all applications
        await this.stateManager.clearState(from);
        return await this.checkStatus(from);
        
      case '2':
        // Cancel current and create new
        if (state.activeApplication && state.activeApplication.id) {
          try {
            // Update the application status to CANCELLED
            const cancelQuery = `
              UPDATE permit_applications 
              SET status = 'CANCELLED', 
                  updated_at = NOW()
              WHERE id = $1 AND user_id = $2
            `;
            const user = await this.findOrCreateUser(from);
            await db.query(cancelQuery, [state.activeApplication.id, user.id]);
            
            // Cancel ALL old unpaid applications for this user
            const cancelledCount = await this.cancelOldUnpaidApplications(user.id);
            
            await this.sendMessage(from, 
              `✅ ${cancelledCount > 1 ? `${cancelledCount} solicitudes anteriores canceladas` : 'Solicitud anterior cancelada'}.\n\n` +
              `Creando nueva solicitud...`
            );
            
            // Clear state and start new application
            await this.stateManager.clearState(from);
            return await this.startApplication(from);
            
          } catch (error) {
            logger.error('Error al cancelar solicitud', { error: error.message });
            await this.sendMessage(from, 
              `❌ Error al cancelar la solicitud anterior.\n\n` +
              `Por favor intenta más tarde.`
            );
            return await this.showMainMenu(from);
          }
        }
        break;
        
      case '3':
        // Back to main menu
        await this.stateManager.clearState(from);
        return await this.showMainMenu(from);
        
      default:
        await this.sendMessage(from, 
          `Por favor elige una opción:\n\n` +
          `1️⃣ Ver todas mis solicitudes\n` +
          `2️⃣ Cancelar y crear nueva\n` +
          `3️⃣ Volver al menú principal`
        );
    }
  }

  /**
   * Handle draft status menu
   */
  async handleDraftStatusMenu(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Continue filling the draft
        state.status = 'resume_prompt';
        await this.stateManager.setState(from, state);
        return await this.handleResumePrompt(from, '1', state);
        
      case '2':
        // Show completed permits
        // Remove draft from state temporarily to show only completed
        const draftData = state.draftData;
        const draftField = state.draftField;
        delete state.draftData;
        delete state.draftField;
        await this.stateManager.setState(from, state);
        
        // Call checkStatus again without draft
        await this.checkStatus(from);
        
        // Restore draft data
        state.draftData = draftData;
        state.draftField = draftField;
        await this.stateManager.setState(from, state);
        break;
        
      case '3':
        // Delete draft and start new
        delete state.draftData;
        delete state.draftField;
        state.status = 'idle';
        await this.stateManager.setState(from, state);
        
        await this.sendMessage(from, 
          `🗑️ Tu borrador ha sido eliminado.\n\n` +
          `¿Quieres crear una nueva solicitud?\n\n` +
          `1️⃣ Sí, empezar de nuevo\n` +
          `2️⃣ No, volver al menú`
        );
        
        state.status = 'awaiting_create_from_status';
        await this.stateManager.setState(from, state);
        break;
        
      case '4':
        // Back to main menu
        return await this.showMainMenu(from);
        
      default:
        await this.sendMessage(from, 
          `Por favor responde con un número del 1 al 4:\n\n` +
          `1️⃣ Continuar llenando\n` +
          `2️⃣ Ver permisos completados\n` +
          `3️⃣ Eliminar borrador\n` +
          `4️⃣ Volver al menú`
        );
    }
  }

  /**
   * Create application and payment
   */
  async createApplication(from, state) {
    try {
      await this.sendMessage(from, '⏳ Creando tu solicitud...');
      
      // Create application (using existing service)
      const permitApplicationService = require('./permit-application.service');
      const result = await permitApplicationService.createFromWhatsApp(from, state.data);
      
      // Get the user that was created/found during application creation
      const userAccountService = require('./user-account.service');
      const user = await userAccountService.findByWhatsAppPhone(this.normalizePhoneNumber(from));
      
      // Log data access with correct user ID
      if (user && user.id) {
        await privacyAuditService.logDataAccess(
          user.id,
          'whatsapp-bot',
          'application_creation',
          ['personal_data', 'vehicle_data']
        );
        
        // Update state with correct user ID for future reference
        state.userId = user.id;
      }
      
      // Create short URL for payment link
      const urlShortener = require('./url-shortener.service');
      const shortUrl = await urlShortener.createShortUrl(result.paymentLink, result.applicationId);
      
      // Store payment info in state for quick actions
      state.pendingPayment = {
        applicationId: result.applicationId,
        link: shortUrl,
        originalLink: result.paymentLink,
        createdAt: Date.now()
      };
      state.status = 'payment_sent';
      await this.stateManager.setState(from, state);
      
      await this.sendMessage(from, 
        `✅ ¡Solicitud creada!\n\n` +
        `📱 Folio: ${result.applicationId}\n\n` +
        `💳 Para completar tu trámite, realiza el pago:\n${result.paymentLink}\n\n` +
        `💰 Costo: $${PaymentFees.DEFAULT_PERMIT_FEE.toFixed(2)} MXN\n\n` +
        `📍 Opciones de pago:\n` +
        `• 💳 Tarjeta (validación en 5-10 minutos)\n` +
        `• 🏪 OXXO (validación en 4-24 horas)\n\n` +
        `🔗 *OPCIONES RÁPIDAS:*\n` +
        `1️⃣ Reenviar link por email\n` +
        `2️⃣ Ver estado del pago\n` +
        `3️⃣ Nuevo permiso\n` +
        `4️⃣ Menú principal`
      );
      
      state.status = 'quick_actions_menu';
      await this.stateManager.setState(from, state);
      
    } catch (error) {
      logger.error('Error al crear solicitud', { error: error.message });
      
      // Check if it's an email-related error
      if (error.message && error.message.includes('correo')) {
        // Email already exists or invalid
        await this.sendMessage(from, 
          `❌ ${error.message}\n\n` +
          `Por favor intenta con:\n` +
          `1️⃣ Un correo diferente\n` +
          `2️⃣ Acceder con tu cuenta existente en permisosdigitales.com.mx\n` +
          `3️⃣ Contactar soporte: contacto@permisosdigitales.com.mx\n\n` +
          `Escribe *cancelar* para volver a empezar.`
        );
        
        // Clear the state so user can try again
        await this.stateManager.clearState(from);
      } else {
        // Generic error
        await this.sendMessage(from, 
          `❌ Hubo un error al crear tu solicitud.\n\n` +
          `Por favor intenta en:\n` +
          `🌐 permisosdigitales.com.mx\n\n` +
          `O contacta a soporte:\n` +
          `📧 contacto@permisosdigitales.com.mx\n` +
        `💬 WhatsApp: +52 55 4943 0313`
        );
      }
    }
  }

  /**
   * Handle quick actions after payment link sent
   */
  async handleQuickActions(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Reenviar link por email
        if (state.data && state.data.email && state.pendingPayment) {
          try {
            // Create email content
            const emailHtml = `
              <h2>Tu link de pago - Permiso de Circulación</h2>
              <p>Hola ${state.data.nombre_completo || 'Usuario'},</p>
              <p>Aquí está tu link de pago para completar tu solicitud de permiso:</p>
              <p><strong>Folio:</strong> ${state.pendingPayment.applicationId}</p>
              <p><strong>Costo:</strong> $99.00 MXN</p>
              <p><a href="${state.pendingPayment.originalLink || state.pendingPayment.link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Pagar ahora</a></p>
              <p>El link te llevará a una página segura donde podrás pagar con tarjeta de crédito/débito o generar un código para pagar en OXXO.</p>
              <p><strong>Tiempos de procesamiento:</strong></p>
              <ul>
                <li>Pago con tarjeta: Validación en 5-10 minutos</li>
                <li>Pago en OXXO: Validación en 4-24 horas</li>
              </ul>
              <p>Recibirás tu permiso por correo electrónico y WhatsApp cuando esté listo.</p>
              <p>Si tienes alguna pregunta, responde a este correo o contáctanos por WhatsApp.</p>
              <p>Saludos,<br>Equipo de Permisos Digitales</p>
            `;
            
            const emailText = `
              Tu link de pago - Permiso de Circulación
              
              Hola ${state.data.nombre_completo || 'Usuario'},
              
              Aquí está tu link de pago para completar tu solicitud de permiso:
              
              Folio: ${state.pendingPayment.applicationId}
              Costo: $99.00 MXN
              
              Link de pago: ${state.pendingPayment.originalLink || state.pendingPayment.link}
              
              El link te llevará a una página segura donde podrás pagar con tarjeta de crédito/débito o generar un código para pagar en OXXO.
              
              Tiempos de procesamiento:
              - Pago con tarjeta: Validación en 5-10 minutos
              - Pago en OXXO: Validación en 4-24 horas
              
              Recibirás tu permiso por correo electrónico y WhatsApp cuando esté listo.
              
              Saludos,
              Equipo de Permisos Digitales
            `;
            
            // Send the email
            await emailService.sendEmail(
              state.data.email,
              'Link de pago - Permiso de Circulación',
              emailHtml,
              emailText
            );
            
            await this.sendMessage(from, 
              `📧 Enviando link de pago a: ${state.data.email}...\n\n` +
              `✅ ¡Listo! Revisa tu correo.\n\n` +
              `Si no lo ves, revisa tu carpeta de spam.`
            );
          } catch (error) {
            logger.error('Error sending payment link email', { error: error.message, email: state.data.email });
            await this.sendMessage(from, 
              `❌ Hubo un problema al enviar el email. Por favor intenta más tarde o contacta a soporte.`
            );
          }
        } else {
          await this.sendMessage(from, 
            `❌ No se pudo enviar el email. Por favor contacta a soporte.`
          );
        }
        break;
        
      case '2':
        // Ver estado del pago
        return await this.checkPaymentStatus(from, state.pendingPayment.applicationId);
        
      case '3':
        // Nuevo permiso
        await this.stateManager.clearState(from);
        return await this.startApplication(from);
        
      case '4':
        // Menú principal
        await this.stateManager.clearState(from);
        return await this.showMainMenu(from);
        
      default:
        await this.sendMessage(from, 
          `Por favor elige una opción:\n\n` +
          `1️⃣ Reenviar link por email\n` +
          `2️⃣ Ver estado del pago\n` +
          `3️⃣ Nuevo permiso\n` +
          `4️⃣ Menú principal`
        );
    }
  }

  /**
   * Handle payment help menu
   */
  async handlePaymentHelp(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Reenviar link por email
        if (state.pendingPayment && state.data && state.data.email) {
          await this.sendMessage(from, 
            `📧 Enviando link a: ${state.data.email}...\n\n` +
            `✅ ¡Enviado! Revisa tu correo.`
          );
        }
        break;
        
      case '2':
        // Generar nuevo link
        await this.sendMessage(from, 
          `🔄 Generando nuevo link de pago...\n\n` +
          `✅ Nuevo link: ${state.pendingPayment.link}\n\n` +
          `Este link reemplaza al anterior.`
        );
        break;
        
      case '3':
        // Contactar soporte
        await this.sendMessage(from, 
          `📞 *CONTACTO DE SOPORTE*\n\n` +
          `📧 Email: contacto@permisosdigitales.com.mx\n` +
          `💬 WhatsApp: Este mismo número\n\n` +
          `Horario: Lunes a Viernes 9:00 - 18:00\n\n` +
          `Por favor incluye tu folio: ${state.pendingPayment.applicationId}`
        );
        break;
        
      default:
        return await this.showHelp(from);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(from, applicationId) {
    try {
      // This would check the actual payment status
      await this.sendMessage(from, 
        `🔍 Verificando estado del pago...\n\n` +
        `📱 Folio: ${applicationId}\n` +
        `⏳ Estado: Esperando pago\n\n` +
        `El pago aún no ha sido procesado.\n\n` +
        `Escribe cualquier mensaje para volver al menú.`
      );
      
      // Clear state so next message goes back to main menu
      await this.stateManager.clearState(from);
      
    } catch (error) {
      logger.error('Error al verificar estado del pago', { error: error.message });
      await this.sendMessage(from, 
        `❌ Error al verificar el estado. Intenta más tarde.`
      );
    }
  }

  /**
   * Check application status
   */
  async checkStatus(from) {
    try {
      const user = await this.findOrCreateUser(from);
      const state = await this.stateManager.getState(from) || {};
      
      logger.info('Verificando estado para usuario', { 
        phoneNumber: from, 
        userId: user.id,
        stateUserId: state.userId,
        hasDraft: !!state.draftData 
      });
      
      // Push to navigation history
      navigationManager.pushNavigation(from, {
        state: 'STATUS_CHECK',
        title: 'Estado de Solicitud',
        data: { userId: user.id }
      });
      
      // First check for saved drafts
      if (state.draftData && state.draftField !== undefined) {
        const progress = Math.round((state.draftField / this.fields.length) * 100);
        const progressBar = this.getProgressBar(state.draftField, this.fields.length);
        
        await this.sendMessage(from,
          `📊 *ESTADO DE TUS SOLICITUDES*\n\n` +
          `📝 *Solicitud en Borrador*\n` +
          `   ├ Progreso: ${progressBar} ${progress}%\n` +
          `   ├ Campos completados: ${state.draftField}/${this.fields.length}\n` +
          `   └ Guardado automáticamente\n\n` +
          `¿Qué deseas hacer?\n\n` +
          `1️⃣ Continuar llenando solicitud\n` +
          `2️⃣ Ver permisos completados\n` +
          `3️⃣ Eliminar borrador y empezar de nuevo\n` +
          `4️⃣ Volver al menú\n\n` +
          `Responde con el número (1-4)`
        );
        
        state.status = 'draft_status_menu';
        await this.stateManager.setState(from, state);
        return;
      }
      
      // Check for recent applications (last 30 days)
      const recentQuery = `
        SELECT 
          a.id, 
          a.status, 
          a.created_at, 
          a.payment_processor_order_id,
          a.fecha_expedicion,
          a.fecha_vencimiento,
          a.marca,
          a.linea,
          a.color,
          a.ano_modelo,
          a.importe,
          a.folio,
          a.nombre_completo,
          a.curp_rfc,
          a.domicilio,
          a.numero_serie,
          a.numero_motor
        FROM permit_applications a
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT 5
      `;
      const result = await db.query(recentQuery, [user.id]);
      
      if (result.rows.length === 0) {
        // Check if user has any historical permits by user ID
        const historyQuery = `
          SELECT COUNT(*) as count
          FROM permit_applications
          WHERE user_id = $1
        `;
        const historyResult = await db.query(historyQuery, [user.id]);
        
        if (historyResult.rows[0].count > 0) {
          await this.sendMessage(from, 
            `📋 Encontramos ${historyResult.rows[0].count} permiso(s) asociados a tu cuenta.\n\n` +
            `Sin embargo, estos permisos son anteriores a los últimos 30 días.\n\n` +
            `Escribe *1* para crear una nueva solicitud o cualquier otra cosa para volver al menú.`
          );
        } else {
          await this.sendMessage(from, 
            `❓ No tienes solicitudes registradas.\n\n` +
            `Escribe *1* para crear tu primera solicitud o cualquier otra cosa para volver al menú.`
          );
        }
        
        // Set special state to handle "1" directly, but preserve draft data
        state.status = 'awaiting_create_from_status';
        // Preserve draft data if it exists
        if (state.draftData) {
          state.draftData = state.draftData;
          state.draftField = state.draftField;
        }
        await this.stateManager.setState(from, state);
        return;
      }
      
      // Show status of recent applications
      let message = `📋 *HISTORIAL DE SOLICITUDES*\n\n`;
      
      for (let i = 0; i < Math.min(3, result.rows.length); i++) {
        const app = result.rows[i];
        const createdDate = new Date(app.created_at).toLocaleDateString('es-MX');
        
        message += `${i + 1}. *Folio:* ${app.id}\n`;
        message += `   📅 Fecha: ${createdDate}\n`;
        message += `   🚗 Vehículo: ${app.marca} ${app.linea} ${app.ano_modelo}\n`;
        message += `   🎨 Color: ${app.color}\n`;
        message += `   📊 Estado: `;
        
        switch (app.status) {
          case 'AWAITING_PAYMENT':
            message += `⏳ Esperando pago`;
            break;
          case 'PENDING':
          case 'PROCESSING':
            message += `⚙️ Procesando`;
            break;
          case 'PERMIT_READY':
            message += `✅ *PERMISO LISTO*`;
            // Add download action hint
            message += `\n   📥 *Acción:* Escribe ${app.id} para descargar`;
            
            // Check if eligible for renewal
            if (app.fecha_vencimiento) {
              const now = new Date();
              const vencimiento = new Date(app.fecha_vencimiento);
              const diasRestantes = Math.ceil((vencimiento - now) / (1000 * 60 * 60 * 24));
              
              if (diasRestantes <= 7 && diasRestantes > -30) {
                if (diasRestantes > 0) {
                  message += `\n   ⚠️ Vence en ${diasRestantes} días`;
                } else {
                  message += `\n   ⚠️ Venció hace ${Math.abs(diasRestantes)} días`;
                }
                message += `\n   ♻️ *Renovar:* Escribe "renovar ${app.id}"`;
              }
            }
            break;
          case 'COMPLETED':
            const now = new Date();
            const vencimiento = new Date(app.fecha_vencimiento);
            const diasRestantes = Math.ceil((vencimiento - now) / (1000 * 60 * 60 * 24));
            
            if (vencimiento > now) {
              message += `✅ Vigente (${diasRestantes} días restantes)`;
              
              // Add renewal option if expiring soon
              if (diasRestantes <= 7) {
                message += `\n   ♻️ *Acción:* Escribe "renovar ${app.id}" para renovar`;
              }
            } else {
              const diasVencido = Math.abs(diasRestantes);
              message += `❌ Vencido hace ${diasVencido} días`;
              
              // Add renewal option if expired within 30 days
              if (diasVencido <= 30) {
                message += `\n   ♻️ *Acción:* Escribe "renovar ${app.id}" para renovar`;
              }
            }
            break;
          case 'FAILED':
            message += `❌ Fallido`;
            break;
          case 'CANCELLED':
            message += `🚫 Cancelado`;
            break;
          case 'EXPIRED':
            message += `⏰ Expirado`;
            break;
          default:
            message += app.status;
        }
        message += `\n\n`;
      }
      
      if (result.rows.length > 3) {
        message += `📌 Mostrando las 3 solicitudes más recientes de ${result.rows.length} total.\n\n`;
      }
      
      // Add login instructions
      message += `🌐 *ACCESO A TU CUENTA EN LÍNEA*\n`;
      message += `Ingresa a permisosdigitales.com.mx con:\n`;
      message += `• Tu número de teléfono o correo electrónico\n`;
      message += `• Si olvidaste tu contraseña, puedes restablecerla en la página de inicio de sesión\n\n`;
      
      // Check for pending payment
      const pendingApp = result.rows.find(app => app.status === 'AWAITING_PAYMENT');
      if (pendingApp) {
        message += `💳 *PAGO PENDIENTE*\n`;
        message += `Folio ${pendingApp.id} requiere pago de $99.00 MXN\n\n`;
      }
      
      // Check if any permit is ready for download
      const readyPermits = result.rows.filter(app => app.status === 'PERMIT_READY');
      if (readyPermits.length > 0) {
        message += `💡 *OPCIONES DISPONIBLES:*\n`;
        message += `• Escribe el número de folio para acciones\n`;
        message += `• Escribe "menu" para volver al menú principal\n`;
        
        // Set state to handle folio responses
        state.status = 'awaiting_folio_selection';
        state.availablePermits = result.rows.map(p => ({ 
          id: p.id, 
          status: p.status,
          payment_processor_order_id: p.payment_processor_order_id 
        }));
        await this.stateManager.setState(from, state);
      } else {
        message += `\n🔙 Escribe "menu" o cualquier mensaje para volver`;
      }
      
      await this.sendMessage(from, message);
      
      // Only clear state if we're not waiting for folio selection
      if (!readyPermits.length) {
        await this.stateManager.clearState(from);
      }
      
    } catch (error) {
      logger.error('Error al consultar estado', { error: error.message, from });
      await this.sendMessage(from, 
        `❌ Hubo un error al consultar tu historial.\n\n` +
        `Intenta en: 🌐 permisosdigitales.com.mx\n\n` +
        `Regresando al menú principal...`
      );
      await this.stateManager.clearState(from);
      // Show main menu after a short delay
      setTimeout(async () => {
        await this.showMainMenu(from);
      }, 1000);
    }
  }

  /**
   * Handle response after permit delivery notification
   */
  async handlePermitDeliveredResponse(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Start new application
        await this.stateManager.clearState(from);
        return await this.startApplication(from);
        
      case '2':
        // Show main menu
        await this.stateManager.clearState(from);
        return await this.showMainMenu(from);
        
      default:
        // Check if it's a greeting
        if (this.isGreeting(response)) {
          await this.stateManager.clearState(from);
          return await this.handleGreeting(from);
        }
        
        // Invalid response - show options again
        await this.sendMessage(from, 
          `Por favor elige una opción:\n\n` +
          `1️⃣ Iniciar nueva solicitud\n` +
          `2️⃣ Ver menú principal\n\n` +
          `Responde con 1 o 2`
        );
        break;
    }
  }

  /**
   * Handle response after permit downloaded
   */
  async handlePermitDownloadedResponse(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Resend by email
        if (state.permitData && state.permitData.email) {
          try {
            const emailService = require('../email.service');
            await emailService.sendEmail(
              state.permitData.email,
              `Permiso de Circulación - Folio ${state.permitData.folioNumber}`,
              `<h2>Tu Permiso de Circulación está Listo 🎉</h2>
              <p>Hola,</p>
              <p><strong>Folio:</strong> ${state.permitData.folioNumber}<br>
              <strong>Validez:</strong> 30 días</p>
              
              <h3>📥 Descarga tu permiso (archivo ZIP con todos los documentos):</h3>
              <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                <strong>Enlace directo de descarga:</strong><br>
                <a href="${state.permitData.downloadUrl}" style="color: #007bff; font-size: 16px; word-break: break-all;">${state.permitData.downloadUrl}</a><br>
                <em style="color: #666; font-size: 14px;">💡 Tip: Si el enlace no descarga automáticamente, haz clic derecho y selecciona "Guardar enlace como..."</em>
              </p>
              
              <p style="color: #dc3545;"><strong>⏰ IMPORTANTE:</strong> Este enlace expira en 48 horas. Descarga y guarda tu permiso ahora.</p>
              
              <h3>🌐 Acceso alternativo desde el portal web:</h3>
              <p style="background-color: #e8f4fd; padding: 15px; border-radius: 5px;">
                <strong>Portal:</strong> <a href="https://permisosdigitales.com.mx/permits">https://permisosdigitales.com.mx/permits</a><br><br>
                <strong>Para iniciar sesión usa:</strong><br>
                • <strong>Teléfono:</strong> Tu número de WhatsApp<br>
                • <strong>Contraseña temporal:</strong> La que recibiste por WhatsApp al crear tu solicitud<br>
                <em style="color: #666;">Si no recuerdas tu contraseña, usa la opción "Olvidé mi contraseña" en la página de inicio de sesión.</em>
              </p>
              
              <h3>¿Necesitas ayuda?</h3>
              <p style="background-color: #fff3cd; padding: 15px; border-radius: 5px;">
                📧 Envía un correo a <a href="mailto:contacto@permisosdigitales.com.mx">contacto@permisosdigitales.com.mx</a> con:<br>
                • Tu número de folio: <strong>${state.permitData.folioNumber}</strong><br>
                • Tu número de teléfono registrado<br>
                • Tu nombre completo<br><br>
                Te responderemos en menos de 24 horas.
              </p>
              
              <p>Gracias por usar Permisos Digitales.<br>
              <strong>Equipo de Permisos Digitales</strong></p>`,
              `Tu Permiso de Circulación - Folio ${state.permitData.folioNumber}\n\n` +
              `DESCARGA DIRECTA:\n${state.permitData.downloadUrl}\n` +
              `(Si no descarga automáticamente, copia y pega el enlace en tu navegador)\n\n` +
              `ACCESO WEB:\nhttps://permisosdigitales.com.mx/permits\n` +
              `Usa tu número de teléfono y la contraseña temporal que recibiste por WhatsApp.\n\n` +
              `¿NECESITAS AYUDA?\n` +
              `Envía un correo a contacto@permisosdigitales.com.mx con:\n` +
              `- Folio: ${state.permitData.folioNumber}\n` +
              `- Tu teléfono registrado\n` +
              `- Tu nombre completo\n\n` +
              `El enlace expira en 48 horas.\n\nEquipo de Permisos Digitales`
            );
            
            await this.sendMessage(from,
              `✅ *Permiso enviado a:* ${state.permitData.email}\n\n` +
              `Revisa tu bandeja de entrada o carpeta de spam.\n\n` +
              `Escribe "menu" para volver al menú principal.`
            );
          } catch (error) {
            logger.error('Error resending permit email', { error: error.message });
            await this.sendMessage(from,
              `❌ No se pudo enviar el email. Por favor intenta más tarde.\n\n` +
              `Puedes descargar tu permiso desde:\nhttps://permisosdigitales.com.mx/permits`
            );
          }
        } else {
          await this.sendMessage(from,
            `❌ No se encontró email asociado.\n\n` +
            `Puedes descargar tu permiso desde:\nhttps://permisosdigitales.com.mx/permits`
          );
        }
        await this.stateManager.clearState(from);
        break;
        
      case '2':
        // Start new application
        await this.stateManager.clearState(from);
        return await this.startApplication(from);
        
      case '3':
        // Show main menu
        await this.stateManager.clearState(from);
        return await this.showMainMenu(from);
        
      default:
        // Check if it's a greeting
        if (this.isGreeting(response)) {
          await this.stateManager.clearState(from);
          return await this.handleGreeting(from);
        }
        
        // Show options again
        await this.sendMessage(from,
          `Por favor elige una opción:\n\n` +
          `1️⃣ Reenviar por email\n` +
          `2️⃣ Nuevo permiso\n` +
          `3️⃣ Menú principal`
        );
        break;
    }
  }

  // Privacy compliance methods remain the same but with better UX
  async handleDataExport(from) {
    try {
      const user = await this.findOrCreateUser(from);
      
      await this.sendMessage(from, '⏳ Preparando tus datos...');
      
      // Log data access for audit
      await privacyAuditService.logDataAccess(
        user.id,
        from,
        'data_export',
        ['personal_data', 'applications', 'payments'],
        { source: 'whatsapp', requestedBy: 'user' }
      );
      
      // Get user data
      const userData = await this.gatherUserDataForExport(user.id);
      
      // Create secure download link
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const downloadUrl = `https://api.permisosdigitales.com.mx/privacy/export/${downloadToken}`;
      
      // Store token in database for 24 hours (Meta compliance-friendly)
      const insertQuery = `
        INSERT INTO privacy_export_tokens 
        (token, user_id, export_data, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
        RETURNING id, expires_at
      `;
      
      await db.query(insertQuery, [
        downloadToken,
        user.id,
        JSON.stringify({ userId: user.id, data: userData })
      ]);
      
      await this.sendMessage(from, 
        `📊 *TUS DATOS ESTÁN LISTOS*\n\n` +
        `Hemos preparado un archivo con toda tu información:\n\n` +
        `📥 Descarga aquí:\n${downloadUrl}\n\n` +
        `⏰ Este enlace expirará en 24 horas.\n\n` +
        `El archivo incluye:\n` +
        `• Información personal\n` +
        `• Historial de solicitudes\n` +
        `• Registros de pagos\n\n` +
        `Escribe cualquier mensaje para volver al menú.`
      );
      
      await this.stateManager.clearState(from);
      
    } catch (error) {
      logger.error('Error al exportar datos', { error: error.message, from });
      await this.sendMessage(from, 
        `❌ Hubo un error al exportar tus datos.\n\n` +
        `Intenta en: 🌐 permisosdigitales.com.mx\n\n` +
        `O contacta a soporte:\n` +
        `📧 contacto@permisosdigitales.com.mx\n\n` +
        `Regresando al menú principal...`
      );
      await this.stateManager.clearState(from);
      // Show main menu after a short delay
      setTimeout(async () => {
        await this.showMainMenu(from);
      }, 1500);
    }
  }

  async handleOptOut(from) {
    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      const user = await this.findOrCreateUser(from);
      
      // Check if already opted out
      const checkQuery = `
        SELECT 1 FROM whatsapp_optout_list 
        WHERE phone_number = $1
      `;
      const existing = await client.query(checkQuery, [from]);
      
      if (existing.rows.length > 0) {
        await this.sendMessage(from, 
          `✅ Ya estás dado de baja del servicio WhatsApp.\n\n` +
          `Escribe cualquier mensaje para volver al menú.`
        );
        await this.stateManager.clearState(from);
        return;
      }
      
      // Add to opt-out list - check which columns exist
      const columnCheckQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_optout_list' 
        AND column_name IN ('opt_out_reason', 'reason')
      `;
      const columnResult = await client.query(columnCheckQuery);
      
      let insertQuery;
      const hasReasonColumn = columnResult.rows.some(row => row.column_name === 'opt_out_reason' || row.column_name === 'reason');
      
      if (hasReasonColumn) {
        const reasonColumnName = columnResult.rows[0].column_name;
        insertQuery = `
          INSERT INTO whatsapp_optout_list (phone_number, user_id, ${reasonColumnName}, opt_out_source, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `;
        await client.query(insertQuery, [from, user.id, 'user_request', 'whatsapp']);
      } else {
        // Table doesn't have reason column
        insertQuery = `
          INSERT INTO whatsapp_optout_list (phone_number, user_id, opt_out_source, created_at)
          VALUES ($1, $2, $3, NOW())
        `;
        await client.query(insertQuery, [from, user.id, 'whatsapp']);
      }
      
      // Update user preferences if column exists
      const userColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'whatsapp_notifications'
      `);
      
      if (userColumnCheck.rows.length > 0) {
        await client.query(
          `UPDATE users SET whatsapp_notifications = false WHERE id = $1`,
          [user.id]
        );
      }
      
      // Log the opt-out
      await privacyAuditService.logDataModification(
        user.id,
        from,
        'whatsapp_notifications',
        'true',
        'false',
        { reason: 'user_optout', source: 'whatsapp' }
      );
      
      await client.query('COMMIT');
      
      await this.sendMessage(from, 
        `✅ *BAJA COMPLETADA*\n\n` +
        `Has sido dado de baja del servicio WhatsApp.\n\n` +
        `• No recibirás más mensajes promocionales\n` +
        `• Tus datos personales se mantienen seguros\n` +
        `• Puedes seguir usando la web para tus permisos\n\n` +
        `Si cambias de opinión, puedes reactivar el servicio en cualquier momento.\n\n` +
        `Gracias por usar Permisos Digitales.`
      );
      
      await this.stateManager.clearState(from);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al procesar baja', { error: error.message, from });
      await this.sendMessage(from, 
        `❌ Hubo un error al procesar tu solicitud.\n\n` +
        `Regresando al menú principal...`
      );
      await this.stateManager.clearState(from);
      // Show main menu after a short delay
      setTimeout(async () => {
        await this.showMainMenu(from);
      }, 1500);
    } finally {
      client.release();
    }
  }

  async handleDataDeletion(from) {
    try {
      const user = await this.findOrCreateUser(from);
      
      // Check for active permits
      const activePermitsQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications
        WHERE user_id = $1
        AND status = 'COMPLETED'
        AND fecha_vencimiento > NOW()
      `;
      const result = await db.query(activePermitsQuery, [user.id]);
      
      if (result.rows[0].count > 0) {
        await this.sendMessage(from, 
          `⚠️ *NO PODEMOS ELIMINAR TUS DATOS*\n\n` +
          `Tienes ${result.rows[0].count} permiso(s) activo(s).\n\n` +
          `Por requisitos legales, debemos mantener los datos mientras tengas permisos vigentes.\n\n` +
          `Podrás solicitar la eliminación una vez que expiren.\n\n` +
          `Escribe cualquier mensaje para volver al menú.`
        );
        await this.stateManager.clearState(from);
        return;
      }
      
      // Create deletion request with proper SQL syntax
      const insertQuery = `
        INSERT INTO data_deletion_requests
        (user_id, requested_by, request_source, scheduled_date, status)
        VALUES ($1, $2, 'whatsapp', NOW() + INTERVAL '30 days', 'pending')
        RETURNING id, scheduled_date
      `;
      const deletion = await db.query(insertQuery, [user.id, from]);
      
      // Log the request
      await privacyAuditService.scheduleDataDeletion(user.id, from, 30);
      
      const scheduledDate = new Date(deletion.rows[0].scheduled_date);
      const formattedDate = scheduledDate.toLocaleDateString('es-MX');
      
      await this.sendMessage(from, 
        `📋 *SOLICITUD DE ELIMINACIÓN REGISTRADA*\n\n` +
        `ID de solicitud: #${deletion.rows[0].id}\n` +
        `Fecha programada: ${formattedDate}\n\n` +
        `Tu solicitud será procesada en 30 días.\n\n` +
        `⚠️ Esto incluirá:\n` +
        `• Todos tus datos personales\n` +
        `• Historial de permisos\n` +
        `• Información de pagos\n\n` +
        `Si cambias de opinión, contacta a soporte antes de la fecha programada.\n\n` +
        `Escribe cualquier mensaje para volver al menú.`
      );
      
      await this.stateManager.clearState(from);
      
    } catch (error) {
      logger.error('Error al procesar eliminación de datos', { error: error.message, from });
      await this.sendMessage(from, 
        `❌ Hubo un error al procesar tu solicitud.\n\n` +
        `Por favor contacta a soporte:\n` +
        `📧 contacto@permisosdigitales.com.mx\n\n` +
        `Regresando al menú principal...`
      );
      await this.stateManager.clearState(from);
      // Show main menu after a short delay
      setTimeout(async () => {
        await this.showMainMenu(from);
      }, 1500);
    }
  }

  // All other methods remain the same (checkRateLimit, validateField, sendMessage, etc.)
  // ... [rest of the methods from simple-whatsapp.service.js]
  
  /**
   * Check rate limit
   */
  checkRateLimit(from) {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(from) || { count: 0, window: now };
    
    // Reset if outside window
    if (now - userLimit.window > this.RATE_WINDOW) {
      userLimit.count = 1;
      userLimit.window = now;
    } else {
      userLimit.count++;
    }
    
    this.rateLimiter.set(from, userLimit);
    
    // Clean old entries periodically
    if (this.rateLimiter.size > 1000) {
      const cutoff = now - this.RATE_WINDOW;
      for (const [key, data] of this.rateLimiter.entries()) {
        if (data.window < cutoff) {
          this.rateLimiter.delete(key);
        }
      }
    }
    
    return userLimit.count <= this.RATE_LIMIT;
  }

  /**
   * Validate field with empathetic error messages
   */
  validateField(fieldKey, value) {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: '🤔 Parece que no escribiste nada... ¿Lo intentas de nuevo?' };
    }
    
    // Handle multi-line input - replace newlines with spaces and normalize
    const normalized = value.replace(/\s+/g, ' ').trim();
    
    switch (fieldKey) {
      case 'nombre_completo':
        // Name validation - should contain at least first and last name
        if (normalized.length < 2) {
          return { valid: false, error: `📝 El nombre parece muy corto. Por favor ingresa tu nombre completo (nombre y apellidos).` };
        }
        
        // Check if it's just a number
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `📝 Necesito tu nombre completo, no un número.\n\nEjemplo: Juan Pérez González` };
        }
        
        // Check if it contains at least two words (name and surname)
        const words = normalized.split(/\s+/).filter(word => word.length > 0);
        if (words.length < 2) {
          return { valid: false, error: `📝 Por favor ingresa tu nombre y apellidos completos.\n\nEjemplo: María García López` };
        }
        
        // Check for valid name characters (letters, spaces, common accents, apostrophes, hyphens)
        if (!/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s'-]+$/.test(normalized)) {
          return { valid: false, error: `📝 El nombre solo puede contener letras, espacios y caracteres como ñ, acentos.\n\nEjemplo: José María Hernández-Vázquez` };
        }
        
        // Check maximum length
        if (normalized.length > 100) {
          return { valid: false, error: `📝 El nombre parece muy largo. ¿Podrías usar solo tu nombre y apellidos principales?` };
        }
        
        return { valid: true, value: normalized };
      
      case 'marca':
        // Car brand validation - flexible but catches obvious garbage
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `🚗 La marca no puede ser solo números.\n\nEjemplo: Toyota, Nissan, Ford` };
        }
        
        // Check for excessive special characters or random strings
        if (!/^[a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s-]+$/.test(normalized)) {
          return { valid: false, error: `🚗 La marca solo puede contener letras, números, espacios y guiones.\n\nEjemplo: Mercedes-Benz, Volkswagen` };
        }
        
        // Check for reasonable length and structure
        if (normalized.length < 2) {
          return { valid: false, error: `🚗 La marca parece muy corta.\n\nEjemplo: Ford, BMW, KIA` };
        }
        
        if (normalized.length > 30) {
          return { valid: false, error: `🚗 El nombre de la marca parece muy largo. ¿Podrías usar el nombre común?\n\nEjemplo: Chevrolet en lugar de General Motors Chevrolet` };
        }
        
        // Check for too many repeated characters (like random strings)
        if (/(.)\1{4,}/.test(normalized)) {
          return { valid: false, error: `🚗 Por favor verifica la marca del vehículo.\n\nEjemplo: Honda, Toyota, Nissan` };
        }
        
        return { valid: true, value: normalized };
      
      case 'linea':
        // Car model validation - flexible but catches garbage
        if (/^\d+$/.test(normalized) && normalized.length < 4) {
          return { valid: false, error: `🚗 El modelo no puede ser solo números cortos.\n\nEjemplo: Corolla, Sentra, Civic` };
        }
        
        // Allow alphanumeric models but catch random strings
        if (!/^[a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s-]+$/.test(normalized)) {
          return { valid: false, error: `🚗 El modelo solo puede contener letras, números, espacios y guiones.\n\nEjemplo: Focus, X-Trail, Serie-3` };
        }
        
        if (normalized.length < 2) {
          return { valid: false, error: `🚗 El modelo parece muy corto.\n\nEjemplo: Rio, Golf, Fit` };
        }
        
        if (normalized.length > 40) {
          return { valid: false, error: `🚗 El nombre del modelo parece muy largo. ¿Podrías usar el nombre común?` };
        }
        
        // Check for excessive random characters
        if (/(.)\1{4,}/.test(normalized)) {
          return { valid: false, error: `🚗 Por favor verifica el modelo del vehículo.\n\nEjemplo: Aveo, March, Tsuru` };
        }
        
        return { valid: true, value: normalized };
        
      case 'color':
        // Color validation - flexible but catches obvious garbage
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `🎨 El color no puede ser solo números.\n\nEjemplo: Blanco, Azul, Rojo` };
        }
        
        // Allow color names and combinations (including slashes that will be converted)
        if (!/^[a-záéíóúñA-ZÁÉÍÓÚÑ\s,y\/-]+$/.test(normalized)) {
          return { valid: false, error: `🎨 El color solo puede contener letras y separadores.\n\nEjemplo: Rojo/Negro, Azul y Blanco` };
        }
        
        if (normalized.length < 3) {
          return { valid: false, error: `🎨 El color parece muy corto.\n\nEjemplo: Azul, Rojo, Verde` };
        }
        
        if (normalized.length > 50) {
          return { valid: false, error: `🎨 La descripción del color es muy larga. ¿Podrías simplificarla?` };
        }
        
        // Check for repeated nonsense characters
        if (/(.)\1{3,}/.test(normalized)) {
          return { valid: false, error: `🎨 Por favor verifica el color del vehículo.\n\nEjemplo: Blanco, Negro, Plata` };
        }
        
        // Sanitize color to prevent issues with slashes (keep existing logic)
        const sanitizedColor = normalized.replace(/\//g, ' y ');
        return { valid: true, value: sanitizedColor };
      
      case 'domicilio':
        // Address validation - flexible but catches random strings
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `🏠 El domicilio no puede ser solo números.\n\nEjemplo: Calle 5 de Mayo 23, Centro` };
        }
        
        // Allow addresses with various characters
        if (!/^[a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s.,#-]+$/.test(normalized)) {
          return { valid: false, error: `🏠 El domicilio contiene caracteres no válidos.\n\nEjemplo: Av. Juárez #123, Col. Centro` };
        }
        
        if (normalized.length < 10) {
          return { valid: false, error: `🏠 El domicilio parece incompleto. Incluye calle, número y colonia.\n\nEjemplo: Calle Morelos 45, Centro` };
        }
        
        if (normalized.length > 200) {
          return { valid: false, error: `🏠 El domicilio es muy largo. ¿Podrías usar la forma más simple?` };
        }
        
        // Check for excessive repeated characters (random strings)
        if (/(.)\1{4,}/.test(normalized)) {
          return { valid: false, error: `🏠 Por favor verifica tu domicilio.\n\nEjemplo: Av. Reforma 123, Col. Centro, Ciudad` };
        }
        
        // Check that it has at least some structure (numbers and letters)
        if (!/\d/.test(normalized)) {
          return { valid: false, error: `🏠 El domicilio debe incluir al menos un número.\n\nEjemplo: Calle Hidalgo 25, Centro` };
        }
        
        return { valid: true, value: normalized };
        
      case 'curp_rfc':
        // CURP/RFC validation with garbage data prevention
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `📝 CURP/RFC no puede ser solo números.\n\nEjemplo RFC: ABCD123456XYZ\nEjemplo CURP: ABCD123456HDFXYZ01` };
        }
        
        if (!/^[A-Z0-9]{12,18}$/.test(normalized.toUpperCase())) {
          const length = normalized.length;
          if (length < 12) {
            return { valid: false, error: `📝 Formato incorrecto. El RFC debe tener 12-13 caracteres y el CURP 18 caracteres.\n\nEjemplo RFC: ABCD123456XYZ\nEjemplo CURP: ABCD123456HDFXYZ01` };
          } else if (length > 18) {
            return { valid: false, error: `📏 Creo que son muchos caracteres... Revisa que no hayas puesto espacios.` };
          } else {
            return { valid: false, error: `🤷 Algo no cuadra... Asegúrate de usar solo letras y números.\n\nEjemplo: ABCD123456HDFXYZ01` };
          }
        }
        
        // Check for repeated nonsense characters
        if (/(.)\1{4,}/.test(normalized)) {
          return { valid: false, error: `📝 Por favor verifica tu CURP/RFC.\n\nEjemplo: ABCD123456HDFXYZ01` };
        }
        
        return { valid: true, value: normalized.toUpperCase() };
        
      case 'email':
        // Email validation with garbage data prevention
        if (/^\d+$/.test(normalized)) {
          return { valid: false, error: `📧 Email no puede ser solo números.\n\nEjemplo: maria@gmail.com` };
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          if (!normalized.includes('@')) {
            return { valid: false, error: `📧 Le falta el @ a tu correo\n\nEjemplo: maria@gmail.com` };
          } else if (!normalized.includes('.')) {
            return { valid: false, error: `📧 Le falta el punto (.) después del @\n\nEjemplo: juan@hotmail.com` };
          } else {
            return { valid: false, error: `📧 Formato de correo incorrecto.\n\nDebe ser como: nombre@correo.com` };
          }
        }
        
        // Check for repeated nonsense characters
        if (/(.)\1{4,}/.test(normalized)) {
          return { valid: false, error: `📧 Por favor verifica tu email.\n\nEjemplo: juan@correo.com` };
        }
        
        return { valid: true, value: normalized.toLowerCase() };
        
      case 'ano_modelo':
        // Year validation with garbage data prevention
        const year = parseInt(normalized);
        const currentYear = new Date().getFullYear();
        
        // Check for non-numeric garbage
        if (!/^\d{4}$/.test(normalized)) {
          return { valid: false, error: `📅 El año debe ser de 4 dígitos.\n\nEjemplo: ${currentYear - 2}` };
        }
        
        if (isNaN(year)) {
          return { valid: false, error: `📅 Solo necesito el número del año\n\nEjemplo: ${currentYear - 2}` };
        } else if (year < 1900) {
          return { valid: false, error: `🚗 ¿Un clásico? Por favor verifica el año...` };
        } else if (year > currentYear + 1) {
          return { valid: false, error: `🔮 ¡Ese carro es del futuro! Verifica el año por favor...` };
        }
        return { valid: true, value: year.toString() };
        
      case 'numero_serie':
      case 'numero_motor':
        // Serial/engine number validation
        if (/^\d+$/.test(normalized) && normalized.length < 8) {
          return { valid: false, error: `🔍 Solo números muy cortos no suelen ser correctos. Revisa tu tarjeta de circulación.\n\nEjemplo: AB1234567890` };
        }
        
        // Explicitly check for spaces or newlines
        if (/\s/.test(normalized)) {
          return { valid: false, error: `🔍 No puede contener espacios o saltos de línea. Escríbelo todo junto.\n\nEjemplo: ABC123456789` };
        }
        
        // Allow alphanumeric but catch random strings - also allow hyphens which are common
        if (!/^[A-Z0-9-]+$/i.test(normalized)) {
          return { valid: false, error: `🔍 Solo puede contener letras, números y guiones (sin espacios).\n\nEjemplo: ABC123456789 o 4G15-MN123456` };
        }
        
        if (normalized.length < 5) {
          return { valid: false, error: `🔍 Parece muy corto... Revisa en tu tarjeta de circulación, generalmente tiene más caracteres.` };
        }
        
        if (normalized.length > 25) {
          return { valid: false, error: `🔍 Parece muy largo. ¿Podrías verificar en tu tarjeta de circulación?` };
        }
        
        // Check for excessive repeated characters
        if (/(.)\1{5,}/.test(normalized)) {
          return { valid: false, error: `🔍 Por favor verifica el número en tu tarjeta de circulación.\n\nEjemplo: ABC123456789` };
        }
        
        // Check for too many consecutive vowels or consonants (likely garbage)
        if (/[aeiouAEIOU]{4,}|[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{6,}/.test(normalized)) {
          return { valid: false, error: `🔍 Por favor verifica el número. Parece tener un formato inusual.\n\nEjemplo: ABC123456789` };
        }
        
        return { valid: true, value: normalized.toUpperCase() };
        
      default:
        if (normalized.length === 0) {
          return { valid: false, error: '✍️ No olvides escribir algo...' };
        } else if (normalized.length > 500) {
          return { valid: false, error: '📝 Uy, es mucho texto... ¿Podrías resumirlo un poco?' };
        }
        return { valid: true, value: normalized };
    }
  }

  /**
   * Normalize phone number to WhatsApp format
   */
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digit characters
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    
    // Handle various Mexican phone formats
    if (cleaned.length === 10) {
      // Local number without country code: XXXXXXXXXX -> 52XXXXXXXXXX
      cleaned = '52' + cleaned;
    } else if (cleaned.startsWith('1') && cleaned.length === 11) {
      // Mobile number without country code: 1XXXXXXXXXX -> 52XXXXXXXXXX
      cleaned = '52' + cleaned.substring(1);
    } else if (cleaned.startsWith('521') && cleaned.length === 13) {
      // WhatsApp format with mobile prefix: 521XXXXXXXXXX (keep as is for WhatsApp API)
      // This is the correct format for Mexican mobile numbers in WhatsApp
      cleaned = cleaned;
    } else if (cleaned.startsWith('52') && cleaned.length === 13 && cleaned[2] === '1') {
      // Another variation: 521XXXXXXXXXX (keep as is for WhatsApp API)
      cleaned = cleaned;
    } else if (cleaned.startsWith('52') && cleaned.length === 12) {
      // Standard international format: 52XXXXXXXXXX (keep as is)
      // This is our target format
    }
    
    // Validate final format: should be 52XXXXXXXXXX (12 digits) or 521XXXXXXXXXX (13 digits for mobile)
    if (!/^52\d{10}$/.test(cleaned) && !/^521\d{10}$/.test(cleaned)) {
      logger.warn('Normalización de teléfono resultó en formato inválido', { 
        original: phoneNumber, 
        cleaned,
        length: cleaned.length 
      });
      // Return the best attempt rather than throwing error
      return cleaned;
    }
    
    logger.debug('Phone number normalized', { 
      original: phoneNumber, 
      normalized: cleaned,
      format: `+${cleaned.substring(0,2)}-${cleaned.substring(2,12)}`
    });
    
    return cleaned;
  }

  /**
   * Create visual progress bar
   */
  getProgressBar(current, total) {
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Send message via WhatsApp API
   */
  async sendMessage(to, message) {
    try {
      // Normalize the recipient phone number
      const normalizedTo = this.normalizePhoneNumber(to);
      
      // Enhanced logging for Meta review
      logger.info('📤 [OUTGOING] Preparing WhatsApp message', {
        to: normalizedTo,
        messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        messageLength: message.length,
        timestamp: new Date().toISOString()
      });
      
      const requestBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: { body: message }
      };
      
      logger.info('🌐 [API CALL] Calling WhatsApp Business API', {
        url: this.config.apiUrl,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer [REDACTED]',
          'Content-Type': 'application/json'
        },
        body: requestBody
      });
      
      const response = await axios.post(this.config.apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      const messageId = data.messages[0].id;

      logger.info('✅ [SUCCESS] WhatsApp message sent', {
        to: normalizedTo,
        messageId,
        status: 'sent',
        timestamp: new Date().toISOString()
      });

      // Log outgoing message for monitoring
      try {
        const userContext = await this.getUserContext(normalizedTo);
        await whatsappMonitoringService.logOutgoingMessage({
          messageId,
          to: normalizedTo,
          messageType: 'text',
          content: message,
          timestamp: new Date().toISOString(),
          status: 'sent',
          userContext
        });
      } catch (monitoringError) {
        logger.error('Error logging outgoing message for monitoring:', monitoringError);
        // Don't fail the main process if monitoring fails
      }
      
    } catch (error) {
      // Log detailed error information for debugging
      const errorDetails = {
        message: error.message,
        to,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        headers: error.response?.headers
      };
      
      logger.error('Error al enviar mensaje', errorDetails);
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
        userId: user?.id || null,
        userName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null,
        userEmail: user?.account_email || null,
        state: state.status || null,
        intent: state.intent || null,
        applicationId: state.applicationId || null,
        hasConsent: !!user?.whatsapp_consent_date,
        consentDate: user?.whatsapp_consent_date || null,
        sessionId: state.sessionId || null
      };
    } catch (error) {
      logger.error('Error getting user context for monitoring:', error);
      return {
        userId: null,
        userName: null,
        userEmail: null,
        state: null,
        intent: null,
        applicationId: null,
        hasConsent: false,
        consentDate: null,
        sessionId: null
      };
    }
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';

    return input
      .trim()
      .substring(0, 500) // Max length
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .normalize('NFC'); // Unicode normalization
  }

  /**
   * Helper methods for user and application management
   */
  async findOrCreateUser(phoneNumber, email = null) {
    // Normalize phone number for consistent storage
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    // Generate phone variations to check
    const phoneVariations = [
      normalizedPhone,                                    // 52XXXXXXXXXX
      '521' + normalizedPhone.substring(2),              // 521XXXXXXXXXX
      normalizedPhone.substring(2),                       // XXXXXXXXXX
      '+' + normalizedPhone,                              // +52XXXXXXXXXX
      '+521' + normalizedPhone.substring(2)              // +521XXXXXXXXXX
    ];
    
    logger.info('Buscando usuario con variaciones de teléfono', { 
      original: phoneNumber,
      normalized: normalizedPhone,
      variations: phoneVariations 
    });
    
    // Try to find existing user with any phone variation
    const searchQuery = `
      SELECT DISTINCT u.*
      FROM users u
      WHERE u.whatsapp_phone = ANY($1::text[])
         OR u.phone = ANY($1::text[])
         OR u.whatsapp_phone LIKE '%' || $2
         OR u.phone LIKE '%' || $2
         ${email ? 'OR u.account_email = $3' : ''}
      ORDER BY u.created_at ASC
      LIMIT 1
    `;
    
    const params = email 
      ? [phoneVariations, normalizedPhone.substring(2), email]
      : [phoneVariations, normalizedPhone.substring(2)];
    
    const searchResult = await db.query(searchQuery, params);
    
    if (searchResult.rows.length > 0) {
      const user = searchResult.rows[0];
      logger.info('Usuario existente encontrado', { 
        userId: user.id,
        foundBy: user.whatsapp_phone === normalizedPhone ? 'whatsapp_phone' : 
                 user.phone === normalizedPhone ? 'phone' : 'variation',
        hasEmail: !!user.account_email
      });
      
      // Update whatsapp_phone if missing or different
      if (!user.whatsapp_phone || user.whatsapp_phone !== normalizedPhone) {
        await db.query(
          'UPDATE users SET whatsapp_phone = $1 WHERE id = $2',
          [normalizedPhone, user.id]
        );
        logger.info('Teléfono WhatsApp del usuario actualizado', { userId: user.id, phone: normalizedPhone });
      }
      
      // Update email if provided and user doesn't have one
      if (email && !user.account_email) {
        await db.query(
          'UPDATE users SET account_email = $1 WHERE id = $2',
          [email, user.id]
        );
        logger.info('Email del usuario actualizado', { userId: user.id, email });
      }
      
      return user;
    }
    
    // No existing user found - create new one
    logger.info('Creando nuevo usuario', { phone: normalizedPhone, email: email || 'none' });

    // Email is optional for WhatsApp users - they can provide it later for delivery
    const userEmail = email && email.trim() !== '' ? email : null;
    
    // Check if source column exists
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'source'
    `);
    
    const hasSourceColumn = columnCheck.rows.length > 0;
    
    const createQuery = hasSourceColumn ? `
      INSERT INTO users (whatsapp_phone, account_email, password_hash, created_at, source)
      VALUES ($1, $2, $3, NOW(), 'whatsapp')
      RETURNING *
    ` : `
      INSERT INTO users (whatsapp_phone, account_email, password_hash, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    // Generate a placeholder password hash for WhatsApp users (they don't use password auth)
    const placeholderPassword = `whatsapp_user_${normalizedPhone}_${Date.now()}`;
    const passwordHash = await bcrypt.hash(placeholderPassword, 10);
    
    const createParams = [normalizedPhone, userEmail, passwordHash];
    const createResult = await db.query(createQuery, createParams);
    
    logger.info('Nuevo usuario creado', { 
      userId: createResult.rows[0].id,
      phone: normalizedPhone,
      email 
    });
    
    return createResult.rows[0];
  }

  async checkActiveApplication(userId) {
    const query = `
      SELECT id, created_at, folio, importe, payment_processor_order_id
      FROM permit_applications
      WHERE user_id = $1
      AND status = 'AWAITING_PAYMENT'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async countRecentApplications(userId) {
    const query = `
      SELECT 
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as week,
        MIN(created_at) as oldest_today
      FROM permit_applications
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '7 days'
    `;
    const result = await db.query(query, [userId]);
    return {
      today: parseInt(result.rows[0].today || 0),
      week: parseInt(result.rows[0].week || 0),
      oldestToday: result.rows[0].oldest_today
    };
  }

  /**
   * Get user applications
   */
  async getUserApplications(from) {
    const user = await this.findOrCreateUser(from);
    
    const query = `
      SELECT 
        a.id, 
        a.status, 
        a.created_at, 
        a.payment_processor_order_id,
        a.fecha_expedicion,
        a.fecha_vencimiento,
        a.marca as vehicle_brand,
        a.linea as vehicle_model,
        a.color,
        a.ano_modelo,
        a.importe,
        a.folio,
        a.nombre_completo,
        a.curp_rfc,
        a.domicilio,
        a.numero_serie,
        a.numero_motor,
        CASE 
          WHEN a.status = 'AWAITING_PAYMENT' THEN 'pending'
          WHEN a.status IN ('PROCESSING', 'COMPLETED') THEN 'paid'
          ELSE 'cancelled'
        END as payment_status
      FROM permit_applications a
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
    `;
    
    const result = await db.query(query, [user.id]);
    return result.rows;
  }

  async checkLastApplicationTime(userId) {
    const query = `
      SELECT created_at
      FROM permit_applications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    if (result.rows.length > 0) {
      const lastTime = new Date(result.rows[0].created_at);
      const now = new Date();
      const minutesDiff = (now - lastTime) / (1000 * 60);
      return minutesDiff;
    }
    return Infinity; // No previous applications
  }

  async checkUnpaidApplicationCount(userId) {
    const query = `
      SELECT COUNT(*) as count
      FROM permit_applications
      WHERE user_id = $1
        AND status = 'AWAITING_PAYMENT'
        AND created_at > NOW() - INTERVAL '7 days'
    `;
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count) || 0;
  }

  async cancelOldUnpaidApplications(userId, excludeId = null) {
    try {
      let query;
      let params;
      
      if (excludeId) {
        query = `
          UPDATE permit_applications 
          SET status = 'CANCELLED', 
              updated_at = NOW()
          WHERE user_id = $1 
          AND status = 'AWAITING_PAYMENT'
          AND id != $2
          RETURNING id
        `;
        params = [userId, excludeId];
      } else {
        query = `
          UPDATE permit_applications 
          SET status = 'CANCELLED', 
              updated_at = NOW()
          WHERE user_id = $1 
          AND status = 'AWAITING_PAYMENT'
          RETURNING id
        `;
        params = [userId];
      }
      
      const result = await db.query(query, params);
      
      if (result.rows.length > 0) {
        logger.info('Solicitudes antiguas sin pagar canceladas', {
          userId,
          cancelledCount: result.rows.length,
          cancelledIds: result.rows.map(r => r.id)
        });
      }
      
      return result.rows.length;
    } catch (error) {
      logger.error('Error al cancelar solicitudes antiguas', { error: error.message, userId });
      return 0;
    }
  }

  async gatherUserDataForExport(userId) {
    try {
      // Get user info
      const userQuery = `
        SELECT id, first_name, last_name, email, phone, whatsapp_phone, 
               created_at, privacy_consent_date, privacy_consent_version
        FROM users WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      
      if (!userResult.rows[0]) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Get applications - using only existing columns
      const appsQuery = `
        SELECT id, status, created_at, fecha_expedicion, fecha_vencimiento,
               nombre_completo, curp_rfc, domicilio, marca, linea, color,
               numero_serie, numero_motor, ano_modelo,
               payment_processor_order_id, importe, folio
        FROM permit_applications WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const appsResult = await db.query(appsQuery, [userId]);
      
      // Get payment events
      const paymentsQuery = `
        SELECT pe.id, pe.event_type, pe.event_data, pe.created_at, pe.amount
        FROM payment_events pe
        JOIN permit_applications pa ON pe.application_id = pa.id
        WHERE pa.user_id = $1
        ORDER BY pe.created_at DESC
      `;
      const paymentsResult = await db.query(paymentsQuery, [userId]);
      
      // Get WhatsApp interaction logs - check if table exists first
      let whatsappLogsResult = { rows: [] };
      try {
        const tableExistsQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'whatsapp_notifications'
          )
        `;
        const tableExists = await db.query(tableExistsQuery);
        
        if (tableExists.rows[0].exists) {
          const whatsappLogsQuery = `
            SELECT 
              wn.id,
              wn.notification_type,
              wn.message_content,
              wn.status,
              wn.sent_at,
              wn.created_at
            FROM whatsapp_notifications wn
            WHERE wn.user_id = $1
            ORDER BY wn.created_at DESC
            LIMIT 100
          `;
          whatsappLogsResult = await db.query(whatsappLogsQuery, [userId]);
        }
      } catch (e) {
        logger.warn('No se pudieron obtener logs de WhatsApp', { error: e.message });
      }
      
      // Get privacy consent history - check if table exists first
      let consentHistory = [];
      try {
        const tableCheck = await db.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'whatsapp_consent_audit'
          )
        `);
        
        if (tableCheck.rows[0].exists) {
          const consentQuery = `
            SELECT 
              action,
              created_at
            FROM whatsapp_consent_audit
            WHERE user_id = $1
            ORDER BY created_at DESC
          `;
          const consentResult = await db.query(consentQuery, [userId]);
          consentHistory = consentResult.rows;
        }
      } catch (e) {
        // Table might not exist in production yet
        logger.warn('No se pudo obtener historial de auditoría de consentimiento', { error: e.message });
      }
      
      // Get opt-out status
      const optOutQuery = `
        SELECT 
          opted_out_at,
          opt_out_source
        FROM whatsapp_optout_list
        WHERE phone_number = $1 OR user_id = $2
        LIMIT 1
      `;
      let optOutStatus = null;
      try {
        const optOutResult = await db.query(optOutQuery, [user.whatsapp_phone, userId]);
        optOutStatus = optOutResult.rows[0];
      } catch (e) {
        logger.warn('No se pudo obtener estado de baja', { error: e.message });
      }
      
      return {
        user: {
          ...user,
          // Remove sensitive fields
          password_hash: undefined,
          reset_token: undefined,
          verification_token: undefined
        },
        applications: appsResult.rows.map(app => ({
          ...app,
          // Format dates for readability
          created_at: new Date(app.created_at).toISOString(),
          fecha_expedicion: app.fecha_expedicion ? new Date(app.fecha_expedicion).toISOString() : null,
          fecha_vencimiento: app.fecha_vencimiento ? new Date(app.fecha_vencimiento).toISOString() : null
        })),
        payments: paymentsResult.rows.map(payment => ({
          ...payment,
          created_at: new Date(payment.created_at).toISOString(),
          // Parse event_data if it's a string
          event_data: typeof payment.event_data === 'string' ? JSON.parse(payment.event_data) : payment.event_data
        })),
        whatsappLogs: whatsappLogsResult.rows.map(log => ({
          ...log,
          created_at: new Date(log.created_at).toISOString(),
          sent_at: log.sent_at ? new Date(log.sent_at).toISOString() : null
        })),
        privacyInfo: {
          consentHistory,
          optOutStatus,
          dataRetentionDays: 90,
          lastExportRequest: new Date().toISOString()
        },
        exportDate: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error al recopilar datos del usuario para exportar', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Handle navigation commands
   */
  async handleNavigationCommand(from, command) {
    try {
      const state = await this.stateManager.getState(from) || {};
      
      switch (command) {
        case 'home':
        case 'menu':
          // Save progress if user is in the middle of filling a form
          if (state.status === 'collecting' && state.data) {
            state.draftData = state.data;
            state.draftField = state.currentField || 0;
            await this.stateManager.setState(from, state);
            
            await this.sendMessage(from, 
              `💾 Tu progreso ha sido guardado automáticamente.\n\n` +
              `Podrás continuar donde te quedaste cuando regreses.`
            );
            
            // Small delay before showing menu
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Navigate to main menu without clearing state
          navigationManager.navigateToHome(from);
          return await this.showMainMenu(from);
          
        case 'back':
          const backEntry = navigationManager.navigateBack(from);
          if (backEntry) {
            return await this.navigateToState(from, backEntry);
          } else {
            await this.sendMessage(from, 
              `↩️ No hay página anterior disponible.\n\n` +
              `Escribe *menu* para ir al menú principal.`
            );
          }
          break;
          
        case 'forward':
          const forwardEntry = navigationManager.navigateForward(from);
          if (forwardEntry) {
            return await this.navigateToState(from, forwardEntry);
          } else {
            await this.sendMessage(from, 
              `↪️ No hay página siguiente disponible.`
            );
          }
          break;
          
        case 'help':
          // Show help without changing state
          await this.showNavigationHelp(from);
          // Remind current context after a delay
          setTimeout(async () => {
            const current = navigationManager.getCurrentNavigation(from);
            if (current) {
              await this.sendMessage(from, 
                `\n📍 Estás en: ${current.title}\n\n` +
                `Continúa con tu actividad o escribe *menu* para el menú principal.`
              );
            }
          }, 2000);
          break;
          
        case 'commands':
          await this.showAllCommands(from);
          break;
          
        case 'status':
          // Don't clear state when checking status
          return await this.checkStatus(from);
          
        case 'privacy':
          return await this.showPrivacyMenu(from);
          
        case 'exit':
        case 'cancel':
          await this.stateManager.clearState(from);
          navigationManager.clearHistory(from);
          await this.sendMessage(from, 
            `👋 Sesión terminada.\n\n` +
            `Gracias por usar Permisos Digitales.\n` +
            `Escribe cualquier palabra para comenzar de nuevo.`
          );
          break;
          
        default:
          await this.sendMessage(from, 
            `❓ Comando no reconocido: ${command}\n\n` +
            `Escribe *ayuda* para ver los comandos disponibles.`
          );
      }
    } catch (error) {
      logger.error('Error al procesar comando de navegación', { error: error.message, from, command });
      await this.sendMessage(from, '❌ Error al procesar el comando. Intenta de nuevo.');
    }
  }

  /**
   * Navigate to a specific state from navigation history
   */
  async navigateToState(from, navigationEntry) {
    const { state, data } = navigationEntry;
    
    // Restore preserved state if available
    if (data && data.preservedStateKey) {
      const preserved = navigationManager.getPreservedState(from, data.preservedStateKey);
      if (preserved) {
        await this.stateManager.setState(from, preserved);
      }
    }
    
    // Navigate based on state
    switch (state) {
      case 'MAIN_MENU':
        return await this.showMainMenu(from);
      case 'PRIVACY_MENU':
        return await this.showPrivacyMenu(from);
      case 'NEW_APPLICATION':
        return await this.startApplication(from);
      case 'FORM_FILLING':
        // Restore form state and continue
        const formData = navigationManager.getPreservedState(from, 'form_data');
        if (formData) {
          const currentState = await this.stateManager.getState(from) || {};
          currentState.data = formData;
          currentState.status = 'collecting';
          currentState.currentField = data.step - 1;
          await this.stateManager.setState(from, currentState);
          
          const field = this.fields[currentState.currentField];
          await this.sendFieldPrompt(from, field, currentState.currentField);
        }
        break;
      case 'CONFIRMATION':
        // Restore confirmation state
        if (data && data.formData) {
          const currentState = await this.stateManager.getState(from) || {};
          currentState.data = data.formData;
          currentState.status = 'confirming';
          await this.stateManager.setState(from, currentState);
          await this.showConfirmation(from, currentState);
        }
        break;
      case 'STATUS_CHECK':
        return await this.checkStatus(from);
      default:
        return await this.showMainMenu(from);
    }
  }

  /**
   * Handle links in messages
   */
  async handleLinks(from, links) {
    if (links.length === 1) {
      const link = links[0];
      
      // Check if it's our privacy policy
      if (link.includes('permisosdigitales.com.mx/politica-de-privacidad')) {
        await this.sendMessage(from, 
          `📄 *POLÍTICA DE PRIVACIDAD*\n\n` +
          `Puedes ver nuestra política completa en:\n` +
          `${link}\n\n` +
          `También puedes acceder a opciones de privacidad escribiendo *3* en el menú principal.`
        );
      } else if (link.includes('permisosdigitales.com.mx')) {
        await this.sendMessage(from, 
          `🌐 *SITIO WEB DETECTADO*\n\n` +
          `Para acceder a nuestro sitio web, visita:\n` +
          `${link}\n\n` +
          `Aquí en WhatsApp también puedo ayudarte. Escribe *menu* para ver las opciones.`
        );
      } else {
        await this.sendMessage(from, 
          `🔗 *ENLACE DETECTADO*\n\n` +
          `Has compartido este enlace:\n` +
          `${link}\n\n` +
          `Si necesitas ayuda con algo específico, escribe *menu* para ver las opciones disponibles.`
        );
      }
    } else {
      await this.sendMessage(from, 
        `🔗 *MÚLTIPLES ENLACES DETECTADOS*\n\n` +
        `Has compartido ${links.length} enlaces. Si necesitas ayuda específica, por favor comparte un enlace a la vez.\n\n` +
        `Escribe *menu* para ver las opciones disponibles.`
      );
    }
  }

  /**
   * Show navigation help
   */
  async showNavigationHelp(from) {
    await this.sendMessage(from, 
      `🧭 *COMANDOS DE NAVEGACIÓN*\n\n` +
      `Puedes usar estos comandos en cualquier momento:\n\n` +
      `🏠 *menu* o *inicio* - Ir al menú principal\n` +
      `↩️ *atrás* o *regresar* - Página anterior\n` +
      `↪️ *adelante* o *siguiente* - Página siguiente\n` +
      `❓ *ayuda* - Mostrar esta ayuda\n` +
      `📊 *estado* - Ver estado de tu solicitud\n` +
      `🔐 *privacidad* - Opciones de privacidad\n` +
      `🚪 *salir* o *cancelar* - Terminar sesión\n\n` +
      `💡 También puedes escribir números (1-4) para seleccionar opciones del menú.`
    );
  }

  /**
   * Show all available commands
   */
  async showAllCommands(from) {
    await this.sendMessage(from, 
      `📚 *TODOS LOS COMANDOS DISPONIBLES*\n\n` +
      `*Navegación:*\n` +
      `• menu, inicio, home\n` +
      `• atrás, regresar, back\n` +
      `• adelante, siguiente, forward\n` +
      `• ayuda, help, ?\n` +
      `• salir, exit, cancelar\n\n` +
      `*Funciones:*\n` +
      `• estado, status\n` +
      `• privacidad, privacy\n` +
      `• comandos\n\n` +
      `*Durante el formulario:*\n` +
      `• Puedes escribir el nombre del campo para editarlo\n` +
      `• Ejemplo: "email" para cambiar tu correo\n\n` +
      `💡 Tip: Los comandos funcionan con o sin caracteres especiales.\n` +
      `Ejemplo: menu, ayuda, estado (también: !menu, #ayuda)`
    );
  }

  /**
   * Update form filling to include navigation and personality
   */
  async sendFieldPrompt(from, field, fieldIndex, state) {
    // Calculate actual fields user will see (excluding pre-filled email)
    const emailSkipped = state.userEmail && state.data.email;
    const totalFieldsForUser = emailSkipped ? this.fields.length - 1 : this.fields.length;
    
    // Calculate user-facing field number (sequential, not skipping)
    let userFieldNumber = fieldIndex + 1;
    if (emailSkipped && fieldIndex > 2) { // Email is field index 2
      userFieldNumber = fieldIndex; // Adjust because we skip email
    }
    
    // Field prompt already includes examples, just add step counter
    const prompt = `${field.prompt}\n\n*Paso ${userFieldNumber} de ${totalFieldsForUser}*`;
    
    await this.sendMessage(from, prompt);
    
    // Update state with last field
    state.lastFieldKey = field.key;
    await this.stateManager.setState(from, state);
  }

  /**
   * Handle permit ready notification from permit generation service
   * Sends download links to the user via WhatsApp
   * @param {string} applicationId - Application ID
   * @param {string} permitUrl - S3 presigned URL for the permit PDF
   * @param {string} phoneNumber - WhatsApp phone number
   */
  async handlePermitReady(applicationId, permitUrl, phoneNumber) {
    try {
      logger.info('Handling permit ready notification', {
        applicationId,
        phoneNumber: phoneNumber ? phoneNumber.substring(0, 6) + '****' : 'not provided',
        hasPermitUrl: !!permitUrl
      });

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      // Get or assign assistant for consistency
      const assistant = this.getAssistantForUser(normalizedPhone);
      
      // Try to get user info to check if they need login credentials
      let loginCredentialsMessage = '';
      try {
        const applicationRepository = require('../../repositories/application.repository');
        const userRepository = require('../../repositories/user.repository');
        const db = require('../../db');
        
        // Get application data to find user
        const appData = await applicationRepository.getApplicationForGeneration(applicationId);
        
        if (appData && appData.user_id) {
          // Get user details
          const user = await userRepository.findById(appData.user_id);
          
          // Check if this is a WhatsApp user who might benefit from web access
          // We identify them by: 1) having whatsapp_phone, 2) source = 'whatsapp'
          if (user && user.whatsapp_phone && user.source === 'whatsapp') {
            // Check if they have an email (no more placeholder emails)
            const hasRealEmail = user.account_email && user.account_email.includes('@');
            
            if (hasRealEmail) {
              // Check if we already sent them credentials before
              // Use a simple check: see if this is their first successful permit
              const permitCountResult = await db.query(
                `SELECT COUNT(*) as count FROM permit_applications 
                 WHERE user_id = $1 AND status = 'PERMIT_READY'`,
                [user.id]
              );
              
              const isFirstPermit = permitCountResult.rows[0].count === '0' || permitCountResult.rows[0].count === '1';
              
              // Only send credentials on first permit completion
              if (isFirstPermit) {
                // Generate temporary password
                
                // Generate strong but user-friendly password with guaranteed uniqueness
                const words = [
                  'Solar', 'Luna', 'Cielo', 'Mar', 'Monte', 'Rio', 'Viento', 'Fuego', 'Tierra', 'Agua',
                  'Nube', 'Rayo', 'Arena', 'Coral', 'Valle', 'Bosque', 'Estrella', 'Lago', 'Flor', 'Aurora'
                ];
                const word1 = words[Math.floor(Math.random() * words.length)];
                const word2 = words[Math.floor(Math.random() * words.length)];
                const num1 = Math.floor(Math.random() * 900) + 100;
                const num2 = Math.floor(Math.random() * 900) + 100;
                
                // Add 3 random uppercase letters for uniqueness (17,576 combinations)
                const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const letter1 = letters[Math.floor(Math.random() * letters.length)];
                const letter2 = letters[Math.floor(Math.random() * letters.length)];
                const letter3 = letters[Math.floor(Math.random() * letters.length)];
                
                const temporaryPassword = `${word1}-${num1}-${word2}-${num2}-${letter1}${letter2}${letter3}`;
                
                // Update user's password
                const passwordHash = await bcrypt.hash(temporaryPassword, 10);
                await userRepository.update(user.id, { 
                  password_hash: passwordHash
                });
                
                // Add login credentials to message
                loginCredentialsMessage = `\n\n🔐 *ACCESO A TU CUENTA EN LÍNEA (OPCIONAL):*\n` +
                  `Ahora puedes acceder a tu cuenta en:\n` +
                  `🌐 permisosdigitales.com.mx\n\n` +
                  (user.account_email ? `📧 *Email:* ${user.account_email}\n` : '') +
                  `📱 *Con tu WhatsApp:* Tu número de 10 dígitos\n` +
                  `🔑 *Contraseña temporal:* ${temporaryPassword}\n\n` +
                  `Beneficios de tu cuenta:\n` +
                  `• Ver historial de permisos\n` +
                  `• Descargar permisos anteriores\n` +
                  `• Renovar fácilmente\n\n` +
                  `Te recomendamos guardar estos datos para futuros accesos.`;
                
                logger.info('Generated login credentials for WhatsApp user', {
                  userId: user.id,
                  applicationId,
                  isFirstPermit: true
                });
              }
            }
          }
        }
      } catch (error) {
        // Don't fail the main flow if credential generation fails
        logger.error('Error generating login credentials', {
          error: error.message,
          applicationId
        });
      }
      
      // Generate clean download URL for all PDFs
      let downloadUrl = permitUrl; // Default to S3 URL if clean URL generation fails
      try {
        const axios = require('axios');
        const apiUrl = process.env.API_URL || 'https://api.permisosdigitales.com.mx';
        
        // Get application folio
        const appQuery = 'SELECT folio FROM permit_applications WHERE id = $1';
        const appResult = await db.query(appQuery, [applicationId]);
        const folioNumber = appResult.rows[0]?.folio || applicationId;
        
        const response = await axios.post(`${apiUrl}/permits/generate-link`, {
          applicationId,
          folioNumber
        });
        
        if (response.data.success) {
          downloadUrl = response.data.url;
          logger.info('Generated clean download URL for permit ready notification', {
            applicationId,
            folioNumber,
            url: downloadUrl
          });
        }
      } catch (urlError) {
        logger.error('Failed to generate clean URL, using S3 URL', {
          error: urlError.message,
          applicationId
        });
      }
      
      // Get actual permit folio from application data
      let permitFolio = applicationId; // Fallback to application ID
      try {
        const applicationRepository = require('../../repositories/application.repository');
        const appData = await applicationRepository.getApplicationForGeneration(applicationId);
        if (appData && appData.folio) {
          permitFolio = appData.folio;
          logger.info('Using actual permit folio for WhatsApp notification', {
            applicationId,
            folio: permitFolio
          });
        }
      } catch (error) {
        logger.warn('Could not fetch permit folio, using application ID', {
          applicationId,
          error: error.message
        });
      }

      // Create the message with download link
      const message = `🎉 *¡TU PERMISO ESTÁ LISTO!*\n\n` +
        `${assistant.emoji} Hola, soy ${assistant.name}.\n\n` +
        `Tu permiso de circulación está listo para descargar:\n\n` +
        `📄 *Folio:* ${permitFolio}\n` +
        `⏰ *Válido por:* 30 días\n\n` +
        `📥 *DESCARGA TODOS TUS DOCUMENTOS:*\n${downloadUrl}\n\n` +
        `📦 *Incluye:*\n` +
        `• Permiso Digital\n` +
        `• Certificado\n` +
        `• Placas en Proceso\n` +
        `• Recomendaciones\n\n` +
        `💡 *Importante:*\n` +
        `• Este enlace expira en 48 horas\n` +
        `• Se descargará un archivo ZIP con todos los documentos\n` +
        `• También lo enviamos a tu email` +
        loginCredentialsMessage + `\n\n` +
        `¿Necesitas otro permiso?\n` +
        `Escribe *1* para iniciar nueva solicitud\n` +
        `Escribe *2* para ver el menú principal`;
      
      // Send the message
      await this.sendMessage(normalizedPhone, message);
      
      // Clear any existing state for this user
      await this.stateManager.clearState(normalizedPhone);
      
      // Set a simple state to handle their response
      const state = {
        status: 'permit_delivered',
        lastPermitId: applicationId,
        timestamp: Date.now()
      };
      await this.stateManager.setState(normalizedPhone, state);
      
      logger.info('Permit ready notification sent successfully', {
        applicationId,
        phoneNumber: normalizedPhone.substring(0, 6) + '****'
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error handling permit ready notification', {
        error: error.message,
        stack: error.stack,
        applicationId,
        phoneNumber: phoneNumber ? phoneNumber.substring(0, 6) + '****' : 'not provided'
      });
      
      // Try to send a fallback message if possible
      if (phoneNumber) {
        try {
          const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
          await this.sendMessage(normalizedPhone, 
            `✅ Tu permiso está listo (Folio: ${applicationId})\n\n` +
            `Por favor revisa tu correo electrónico para descargarlo.\n\n` +
            `Si necesitas ayuda, escribe *ayuda*`
          );
        } catch (fallbackError) {
          logger.error('Failed to send fallback message', { 
            error: fallbackError.message,
            applicationId 
          });
        }
      }
      
      throw error;
    }
  }

  /**
   * Check rate limiting for renewal attempts
   */
  async checkRenewalRateLimit(from) {
    const { createRenewalError } = require('../../utils/renewal-errors');
    const key = `renewal_rate_limit:${from}`;
    const maxAttempts = 10; // Increased for testing
    const windowMs = 10 * 60 * 1000; // 10 minutes (reduced for testing)
    
    try {
      const currentCount = await redisClient.get(key);
      
      if (currentCount && parseInt(currentCount) >= maxAttempts) {
        const ttl = await redisClient.ttl(key);
        const minutesRemaining = Math.ceil(ttl / 60);
        
        // Create specific rate limit error with user-friendly message
        const userMessage = `⚠️ *LÍMITE DE RENOVACIONES ALCANZADO*\n\n` +
          `Has alcanzado el límite de ${maxAttempts} intentos de renovación por hora.\n\n` +
          `⏰ Intenta de nuevo en ${minutesRemaining} minutos.\n\n` +
          `Si necesitas ayuda urgente, escribe "ayuda"`;
          
        throw createRenewalError('rate_limit', new Error(`Rate limit exceeded: ${minutesRemaining} minutes remaining`));
      }
      
      // Increment counter
      const newCount = parseInt(currentCount || 0) + 1;
      await redisClient.setex(key, Math.floor(windowMs / 1000), newCount);
      
      logger.info(`Renewal rate limit check passed for ${from}`, {
        phone: from,
        attempts: newCount,
        maxAttempts
      });
      
      return true;
    } catch (error) {
      if (error.name && error.name.includes('Renewal')) {
        throw error; // Re-throw renewal errors
      }
      
      logger.error('Redis rate limit check failed, allowing request', { error: error.message, from });
      return true; // Allow on Redis failure
    }
  }

  /**
   * Handle renewal flow - main entry point
   */
  /**
   * Handle edit renewal flow - user wants to edit permit details before renewal
   */
  async handleEditRenewal(from) {
    try {
      const user = await this.findOrCreateUser(from);
      const renewablePermits = await this.checkRenewablePermits(user.id);
      
      if (renewablePermits.length === 0) {
        await this.sendMessage(from,
          '❌ *NO HAY PERMISOS PARA EDITAR*\n\n' +
          'Los permisos se pueden renovar:\n' +
          '• 7 días antes de vencer\n' +
          '• Hasta 30 días después de vencidos\n\n' +
          'Escribe "1" para crear un nuevo permiso o "menu" para volver al menú.'
        );
        return;
      }
      
      if (renewablePermits.length === 1) {
        // Auto-select and start editing
        return await this.startRenewalEditing(from, renewablePermits[0]);
      } else {
        // Show selection list for editing
        return await this.showEditablePermitsList(from, renewablePermits);
      }
      
    } catch (error) {
      logger.error('Error en flujo de edición de renovación', { error: error.message, from });
      await this.sendMessage(from, 
        '❌ Hubo un error al procesar tu solicitud de edición.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  async handleRenewalFlow(from, permitId = null, directRenewal = false) {
    const { getUserFriendlyMessage } = require('../../utils/renewal-errors');
    
    try {
      // Check rate limiting first
      try {
        await this.checkRenewalRateLimit(from);
      } catch (error) {
        if (error.name === 'RenewalRateLimitError') {
          await this.sendMessage(from, error.userMessage);
          // Clear state when rate limited to prevent confusion
          await this.stateManager.clearState(from);
          return;
        }
        throw error; // Re-throw other errors
      }
      
      const user = await this.findOrCreateUser(from);
      
      // If no permitId, show list of renewable permits
      if (!permitId) {
        const renewablePermits = await this.checkRenewablePermits(user.id);
        
        if (renewablePermits.length === 0) {
          await this.sendMessage(from,
            '❌ *NO HAY PERMISOS PARA RENOVAR*\n\n' +
            'Los permisos se pueden renovar:\n' +
            '• 7 días antes de vencer\n' +
            '• Hasta 30 días después de vencidos\n\n' +
            'Escribe "1" para crear un nuevo permiso o "menu" para volver al menú.'
          );
          return;
        }
        
        if (renewablePermits.length === 1) {
          // Auto-select if only one
          permitId = renewablePermits[0].id;
        } else {
          // Show selection list
          return await this.showRenewablePermitsList(from, renewablePermits);
        }
      }
      
      // Validate permit eligibility
      const isEligible = await this.isEligibleForRenewal(permitId, user.id);
      if (!isEligible) {
        await this.sendMessage(from, 
          '❌ Este permiso no es elegible para renovación.\n\n' +
          'Escribe "menu" para ver opciones o "estado" para verificar tus solicitudes.'
        );
        return;
      }
      
      // Get the permit details for renewal
      const originalPermit = await this.getPermitById(permitId, user.id);
      if (!originalPermit) {
        await this.sendMessage(from, 
          '❌ No encontré ese permiso en tu cuenta.\n\n' +
          'Escribe "menu" para ver opciones.'
        );
        return;
      }
      
      // If directRenewal is true, create application immediately (for special cases)
      if (directRenewal) {
        return await this.createDirectRenewal(from, originalPermit, user);
      } else {
        // Show renewal confirmation with permit details and edit options
        return await this.showRenewalConfirmation(from, originalPermit);
      }
      
    } catch (error) {
      logger.error('Error en flujo de renovación', { error: error.message, from });
      await this.sendMessage(from, 
        '❌ Hubo un error al procesar tu renovación.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  /**
   * Show list of renewable permits for selection
   */
  async showRenewablePermitsList(from, renewablePermits) {
    let message = '♻️ *PERMISOS RENOVABLES*\n\n';
    
    renewablePermits.forEach((permit, index) => {
      const daysText = permit.days_until_expiration >= 0 
        ? `vence en ${permit.days_until_expiration} días`
        : `venció hace ${Math.abs(permit.days_until_expiration)} días`;
      
      message += `${index + 1}. *Folio:* ${permit.folio || permit.id}\n`;
      message += `   🚗 ${permit.marca} ${permit.linea} ${permit.color}\n`;
      message += `   📅 ${daysText}\n\n`;
    });
    
    message += 'Escribe el número del permiso a renovar (1-' + renewablePermits.length + ')';
    await this.sendMessage(from, message);
    
    // Set state for selection
    const state = {
      status: 'renewal_selection',
      renewablePermits: renewablePermits,
      timestamp: Date.now()
    };
    await this.stateManager.setState(from, state);
  }

  /**
   * Show renewal confirmation with existing data
   */
  async showRenewalConfirmation(from, originalPermit) {
    // Format expiration info
    const expirationDate = new Date(originalPermit.fecha_vencimiento);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
    let expirationText = '';
    
    if (daysUntilExpiration > 0) {
      expirationText = `⚠️ Vence en ${daysUntilExpiration} días`;
    } else if (daysUntilExpiration === 0) {
      expirationText = '⚠️ Vence hoy';
    } else {
      expirationText = `❌ Venció hace ${Math.abs(daysUntilExpiration)} días`;
    }
    
    // Show data summary for confirmation with numbered fields for direct editing
    await this.sendMessage(from,
      `♻️ *RENOVACIÓN DE PERMISO*\n\n` +
      `📋 Folio actual: ${originalPermit.folio || originalPermit.id}\n` +
      `${expirationText}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📝 *DATOS REGISTRADOS:*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ Nombre: ${originalPermit.nombre_completo}\n` +
      `2️⃣ CURP/RFC: ${originalPermit.curp_rfc}\n` +
      `3️⃣ Email: ${originalPermit.email}\n` +
      `4️⃣ Domicilio: ${originalPermit.domicilio}\n\n` +
      `5️⃣ Marca: ${originalPermit.marca}\n` +
      `6️⃣ Modelo: ${originalPermit.linea}\n` +
      `7️⃣ Color: ${originalPermit.color}\n` +
      `8️⃣ Año: ${originalPermit.ano_modelo}\n` +
      `9️⃣ No. Serie: ${this.maskSerialNumber(originalPermit.numero_serie)}\n` +
      `🔟 No. Motor: ${this.maskSerialNumber(originalPermit.numero_motor)}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ Escribe *"ok"* para renovar con estos datos\n` +
      `✏️ Escribe *1-10* para editar ese campo\n` +
      `🔄 Escribe *"todo"* para revisar todos los campos\n` +
      `❌ Escribe *"no"* para cancelar renovación`
    );
    
    // Set state for renewal confirmation
    const state = {
      status: 'renewal_confirmation',
      originalPermitId: originalPermit.id,
      renewalData: originalPermit,
      timestamp: Date.now()
    };
    await this.stateManager.setState(from, state);
  }

  /**
   * Helper function to mask sensitive data
   */
  maskSerialNumber(value) {
    if (!value || value.length < 8) return value;
    const visibleChars = 4;
    const masked = value.substring(0, visibleChars) + '...' + value.substring(value.length - visibleChars);
    return masked;
  }

  /**
   * Handle renewal confirmation responses - NEW STREAMLINED UX
   */
  async handleRenewalConfirmation(from, response, state) {
    const input = response.trim().toLowerCase();
    
    // Field mapping for direct editing
    const fieldMap = {
      1: { key: 'nombre_completo', label: 'Nombre completo', example: 'Juan Carlos Pérez González' },
      2: { key: 'curp_rfc', label: 'CURP/RFC', example: 'PERJ850124HDFRZN01' },
      3: { key: 'email', label: 'Email', example: 'juan.perez@gmail.com' },
      4: { key: 'domicilio', label: 'Domicilio', example: 'Calle Juárez 123, Centro, Guadalajara, Jalisco' },
      5: { key: 'marca', label: 'Marca', example: 'Toyota' },
      6: { key: 'linea', label: 'Modelo', example: 'Corolla' },
      7: { key: 'color', label: 'Color', example: 'Azul' },
      8: { key: 'ano_modelo', label: 'Año', example: '2020' },
      9: { key: 'numero_serie', label: 'Número de serie (VIN)', example: '1HGBH41JXMN109186' },
      10: { key: 'numero_motor', label: 'Número de motor', example: '4G15-MN123456' }
    };
    
    // Check for direct field number input (1-10)
    const fieldNumber = parseInt(input);
    if (!isNaN(fieldNumber) && fieldNumber >= 1 && fieldNumber <= 10) {
      return await this.startDirectFieldEdit(from, state, fieldMap[fieldNumber]);
    }
    
    // Handle confirmation commands
    if (input === 'ok' || input === 'si' || input === 'sí' || input === 'confirmar') {
      return await this.processRenewal(from, state);
    }
    
    // Handle sequential edit mode
    if (input === 'todo' || input === 'revisar' || input === 'editar todo') {
      return await this.startSequentialEdit(from, state, fieldMap);
    }
    
    // Handle cancellation
    if (input === 'no' || input === 'cancelar' || input === 'cancel') {
      await this.stateManager.clearState(from);
      return await this.sendMessage(from, 
        '❌ Renovación cancelada.\n\n' +
        'Escribe "menu" para ver opciones.'
      );
    }
    
    // Invalid input - show help
    await this.sendMessage(from,
      '❓ No entendí tu respuesta. Opciones disponibles:\n\n' +
      '✅ *"ok"* - Renovar con estos datos\n' +
      '✏️ *1-10* - Editar campo específico\n' +
      '🔄 *"todo"* - Revisar todos los campos\n' +
      '❌ *"no"* - Cancelar renovación'
    );
  }

  /**
   * Start direct field edit - NEW STREAMLINED UX
   */
  async startDirectFieldEdit(from, state, fieldInfo) {
    const currentValue = state.renewalData[fieldInfo.key] || 'No especificado';
    
    await this.sendMessage(from,
      `✏️ *EDITAR ${fieldInfo.label.toUpperCase()}*\n\n` +
      `📋 *Valor actual:* ${currentValue}\n\n` +
      `💡 *Ejemplo:* ${fieldInfo.example}\n\n` +
      `📝 Escribe el nuevo valor para *${fieldInfo.label}*:\n\n` +
      `❌ Escribe "cancelar" para volver atrás`
    );
    
    // Set state for direct field editing
    const newState = {
      ...state,
      status: 'renewal_direct_edit',
      editingField: fieldInfo,
      editData: { ...state.renewalData } // Copy for editing
    };
    await this.stateManager.setState(from, newState);
  }

  /**
   * Start sequential edit mode - edit all fields one by one
   */
  async startSequentialEdit(from, state, fieldMap) {
    await this.sendMessage(from,
      `🔄 *MODO REVISIÓN COMPLETA*\n\n` +
      `Te voy a preguntar por cada campo.\n` +
      `• Presiona Enter para mantener el valor actual\n` +
      `• Escribe nuevo valor para cambiarlo\n` +
      `• Escribe "cancelar" para salir\n\n` +
      `Comenzamos...`
    );
    
    // Start with field 1
    setTimeout(async () => {
      const firstField = fieldMap[1];
      const currentValue = state.renewalData[firstField.key] || 'No especificado';
      
      await this.sendMessage(from,
        `1️⃣ *${firstField.label.toUpperCase()}*\n\n` +
        `📋 Actual: ${currentValue}\n` +
        `💡 Ejemplo: ${firstField.example}\n\n` +
        `📝 Nuevo valor (o Enter para mantener):`
      );
      
      const newState = {
        ...state,
        status: 'renewal_sequential_edit',
        editData: { ...state.renewalData },
        fieldMap: fieldMap,
        currentFieldIndex: 1,
        totalFields: 10
      };
      await this.stateManager.setState(from, newState);
    }, 1000);
  }

  /**
   * Process renewal - create new application with existing data
   */
  async processRenewal(from, state) {
    const renewalData = state.renewalData;
    const user = await this.findOrCreateUser(from);
    
    try {
      // Call the application controller directly instead of HTTP to bypass auth
      const applicationController = require('../../controllers/application.controller');
      
      // Create a mock request object with the user session
      const mockReq = {
        params: { id: state.originalPermitId },
        session: { userId: user.id },
        body: { userId: user.id }
      };
      
      const mockRes = {
        status: function(code) { 
          this.statusCode = code; 
          return this; 
        },
        json: function(data) { 
          this.data = data; 
          return this; 
        }
      };
      
      // Call renewal directly
      await applicationController.renewApplication(mockReq, mockRes, (error) => {
        if (error) throw error;
      });
      
      const result = mockRes.data;
      
      if (!result.success || !result.paymentLink) {
        throw new Error('Invalid renewal response from API');
      }
      
      const newApplication = result.data;
      const paymentLink = result.paymentLink;
      
      // Create short URL for payment link
      const urlShortener = require('./url-shortener.service');
      const shortUrl = await urlShortener.createShortUrl(paymentLink, newApplication.id);
      
      // Store payment info in state
      const newState = {
        status: 'renewal_payment',
        pendingPayment: {
          applicationId: newApplication.id,
          link: shortUrl || paymentLink,
          originalLink: paymentLink,
          amount: result.payment.amount,
          timestamp: Date.now()
        },
        isRenewal: true,
        originalPermitId: state.originalPermitId
      };
      await this.stateManager.setState(from, newState);
      
      // Send payment message with correct amount
      await this.sendMessage(from,
        `✅ *RENOVACIÓN LISTA PARA PAGO*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📱 *Nuevo Folio:* ${newApplication.folio || newApplication.id}\n` +
        `💰 *Costo:* $${result.payment.amount.toFixed(2)} ${result.payment.currency}\n` +
        `⏱️ *Tiempo:* 5 minutos después del pago\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `💳 *LINK DE PAGO:*\n${shortUrl || paymentLink}\n\n` +
        `📌 *Opciones de pago:*\n` +
        `• Tarjeta de crédito/débito (inmediato)\n` +
        `• OXXO (confirmación en 1-4 horas)\n\n` +
        `💡 *Tip:* Guarda este mensaje para pagar más tarde\n\n` +
        `¿Necesitas ayuda? Escribe "ayuda"`
      );
      
      logger.info('Renewal processed successfully', {
        originalPermitId: state.originalPermitId,
        newApplicationId: newApplication.id,
        userId: user.id
      });
      
    } catch (error) {
      const { getUserFriendlyMessage } = require('../../utils/renewal-errors');
      
      logger.error('Error processing renewal', { 
        error: error.message, 
        from,
        originalPermitId: state.originalPermitId,
        stack: error.stack,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Parse API error response for better user messaging
      let userMessage = '❌ Hubo un error al procesar la renovación.\n\n';
      
      // Handle axios errors
      if (error.response) {
        const status = error.response.status;
        if (status === 429) {
          userMessage = '⚠️ *LÍMITE DE RENOVACIONES ALCANZADO*\n\n' +
                       'Has alcanzado el límite de intentos de renovación por hora.\n\n' +
                       '⏰ Intenta de nuevo en 60 minutos.\n\n' +
                       'Si necesitas ayuda urgente, escribe "ayuda"';
        } else if (status === 400) {
          userMessage = '❌ *NO SE PUEDE RENOVAR*\n\n' +
                       'Este permiso no cumple con los requisitos para renovación:\n\n' +
                       '• Solo se puede renovar 7 días antes del vencimiento\n' +
                       '• Hasta 30 días después del vencimiento\n' +
                       '• Cada permiso solo se puede renovar una vez\n\n' +
                       'Escribe "estado" para ver tus permisos actuales.';
        } else if (status === 402) {
          userMessage = '💳 *ERROR DE PAGO*\n\n' +
                       'No pudimos crear la sesión de pago.\n\n' +
                       'Por favor, inténtalo nuevamente en unos minutos.\n\n' +
                       'Si el problema persiste, escribe "ayuda"';
        }
      } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('timeout')) {
        userMessage = '🔧 *PROBLEMA TÉCNICO TEMPORAL*\n\n' +
                     'Tenemos problemas técnicos temporales.\n\n' +
                     'Por favor, inténtalo nuevamente en unos minutos.\n\n' +
                     'Tu información está segura.';
      } else {
        // Generic error with helpful suggestions
        userMessage = '❌ *ERROR INESPERADO*\n\n' +
                     'Ocurrió un error inesperado al procesar tu renovación.\n\n' +
                     '🔄 *Qué puedes hacer:*\n' +
                     '• Intenta nuevamente en 5 minutos\n' +
                     '• Verifica tu conexión a internet\n' +
                     '• Escribe "ayuda" para contactar soporte\n\n' +
                     '💡 Tu información está segura y no se perdió.';
      }
      
      await this.sendMessage(from, userMessage);
    }
  }

  /**
   * Handle direct field edit input - NEW STREAMLINED UX
   */
  async handleRenewalDirectEdit(from, input, state) {
    const sanitized = input.trim();
    
    // Handle cancellation
    if (sanitized.toLowerCase() === 'cancelar') {
      // Return to renewal confirmation
      return await this.showRenewalConfirmation(from, state.renewalData);
    }
    
    // Update the field value
    const fieldInfo = state.editingField;
    state.editData[fieldInfo.key] = sanitized;
    
    // Validate the field (use existing validation if available)
    const validationResult = await this.validateRenewalField(fieldInfo.key, sanitized);
    if (!validationResult.valid) {
      return await this.sendMessage(from,
        `❌ ${validationResult.error}\n\n` +
        `💡 Ejemplo válido: ${fieldInfo.example}\n\n` +
        `📝 Intenta de nuevo:`
      );
    }
    
    // Update successful - save and return to confirmation
    state.renewalData = { ...state.renewalData, ...state.editData };
    
    await this.sendMessage(from,
      `✅ *${fieldInfo.label}* actualizado correctamente\n\n` +
      `Regresando a la confirmación...`
    );
    
    // Return to renewal confirmation with updated data
    setTimeout(async () => {
      await this.showRenewalConfirmation(from, state.renewalData);
    }, 1000);
  }

  /**
   * Handle sequential edit input - edit all fields one by one
   */
  async handleRenewalSequentialEdit(from, input, state) {
    const sanitized = input.trim();
    
    // Handle cancellation
    if (sanitized.toLowerCase() === 'cancelar') {
      return await this.showRenewalConfirmation(from, state.renewalData);
    }
    
    const currentField = state.fieldMap[state.currentFieldIndex];
    
    // If not empty, update the field
    if (sanitized !== '') {
      const validationResult = await this.validateRenewalField(currentField.key, sanitized);
      if (!validationResult.valid) {
        return await this.sendMessage(from,
          `❌ ${validationResult.error}\n\n` +
          `💡 Ejemplo: ${currentField.example}\n\n` +
          `📝 Intenta de nuevo (o Enter para mantener actual):`
        );
      }
      state.editData[currentField.key] = sanitized;
    }
    
    // Move to next field
    state.currentFieldIndex++;
    
    // Check if done
    if (state.currentFieldIndex > state.totalFields) {
      // Update renewal data and return to confirmation
      state.renewalData = { ...state.renewalData, ...state.editData };
      
      await this.sendMessage(from,
        `✅ *REVISIÓN COMPLETA*\n\n` +
        `Todos los campos han sido revisados.\n` +
        `Regresando a la confirmación...`
      );
      
      setTimeout(async () => {
        await this.showRenewalConfirmation(from, state.renewalData);
      }, 1000);
      return;
    }
    
    // Show next field
    const nextField = state.fieldMap[state.currentFieldIndex];
    const currentValue = state.editData[nextField.key] || 'No especificado';
    
    await this.sendMessage(from,
      `${state.currentFieldIndex}️⃣ *${nextField.label.toUpperCase()}*\n\n` +
      `📋 Actual: ${currentValue}\n` +
      `💡 Ejemplo: ${nextField.example}\n\n` +
      `📝 Nuevo valor (o Enter para mantener):`
    );
    
    // Update state
    await this.stateManager.setState(from, state);
  }

  /**
   * Validate renewal field input
   */
  async validateRenewalField(fieldKey, value) {
    // Use existing field validation logic
    try {
      switch (fieldKey) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { valid: false, error: 'Formato de email inválido' };
          }
          break;
        case 'curp_rfc':
          if (value.length < 10 || value.length > 18) {
            return { valid: false, error: 'CURP debe tener 18 caracteres, RFC 10-13' };
          }
          break;
        case 'ano_modelo':
          const year = parseInt(value);
          const currentYear = new Date().getFullYear();
          if (isNaN(year) || year < 1980 || year > currentYear + 1) {
            return { valid: false, error: `Año debe ser entre 1980 y ${currentYear + 1}` };
          }
          break;
        // Add more validations as needed
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Error de validación' };
    }
  }

  /**
   * Start renewal field update flow
   */
  async startRenewalUpdate(from, state) {
    state.status = 'renewal_field_selection';
    await this.stateManager.setState(from, state);
    
    await this.sendMessage(from,
      `✏️ *ACTUALIZAR INFORMACIÓN*\n\n` +
      `¿Qué necesitas actualizar?\n\n` +
      `1️⃣ Un campo específico\n` +
      `2️⃣ Datos personales completos\n` +
      `3️⃣ Datos del vehículo completos\n` +
      `4️⃣ Todo (hacer solicitud nueva)\n\n` +
      `Responde con el número (1-4)`
    );
  }

  /**
   * Handle renewal permit selection
   */
  async handleRenewalSelection(from, response, state) {
    const selection = parseInt(response.trim());
    
    // Handle different state structures - Express service uses 'permits', Standard uses 'renewablePermits'
    const permitsList = state.renewablePermits || state.permits;
    
    if (!permitsList || !Array.isArray(permitsList)) {
      logger.error('Invalid permits list in renewal selection', { 
        from, 
        state: state ? { status: state.status, hasRenewablePermits: !!state.renewablePermits, hasPermits: !!state.permits } : null 
      });
      await this.sendMessage(from, '❌ Error en la sesión. Escribe "menu" para reiniciar.');
      return;
    }
    
    if (isNaN(selection) || selection < 1 || selection > permitsList.length) {
      await this.sendMessage(from, 
        `Por favor elige un número válido entre 1 y ${permitsList.length}`
      );
      return;
    }
    
    const selectedPermit = permitsList[selection - 1];
    
    // Get full permit details and proceed to confirmation
    const user = await this.findOrCreateUser(from);
    const originalPermit = await this.getPermitById(selectedPermit.id, user.id);
    
    if (!originalPermit) {
      await this.sendMessage(from, 
        '❌ Error al cargar los datos del permiso.\n\n' +
        'Escribe "menu" para volver al menú.'
      );
      return;
    }
    
    // Show renewal confirmation
    await this.showRenewalConfirmation(from, originalPermit);
  }

  /**
   * Handle renewal field selection for updates
   */
  async handleRenewalFieldSelection(from, response, state) {
    const selection = response.trim();
    
    switch (selection) {
      case '1':
        // Single field update - show field list
        await this.showRenewalFieldList(from, state);
        break;
        
      case '2':
        // Update all personal data
        await this.sendMessage(from, 
          '✏️ *ACTUALIZAR DATOS PERSONALES*\n\n' +
          'Esta función estará disponible pronto.\n\n' +
          'Por ahora puedes:\n' +
          '• Usar opción 1 para actualizar campos específicos\n' +
          '• Usar opción 4 para hacer una solicitud nueva\n\n' +
          'Escribe "1" para campos específicos o "4" para solicitud nueva.'
        );
        break;
        
      case '3':
        // Update all vehicle data
        await this.sendMessage(from, 
          '✏️ *ACTUALIZAR DATOS DEL VEHÍCULO*\n\n' +
          'Esta función estará disponible pronto.\n\n' +
          'Por ahora puedes:\n' +
          '• Usar opción 1 para actualizar campos específicos\n' +
          '• Usar opción 4 para hacer una solicitud nueva\n\n' +
          'Escribe "1" para campos específicos o "4" para solicitud nueva.'
        );
        break;
        
      case '4':
        // Start fresh application
        await this.stateManager.clearState(from);
        await this.sendMessage(from,
          '🔄 Iniciando nueva solicitud...\n\n' +
          'Esto te permitirá actualizar toda la información.'
        );
        setTimeout(async () => {
          await this.startApplication(from);
        }, 1000);
        break;
        
      default:
        await this.sendMessage(from, 
          'Por favor elige una opción del 1 al 4:\n\n' +
          '1️⃣ Un campo específico\n' +
          '2️⃣ Datos personales completos\n' +
          '3️⃣ Datos del vehículo completos\n' +
          '4️⃣ Todo (hacer solicitud nueva)'
        );
    }
  }

  /**
   * Show list of fields for renewal update
   */
  async showRenewalFieldList(from, state) {
    const fields = {
      'nombre': 'Nombre completo',
      'curp': 'CURP/RFC',
      'email': 'Email',
      'domicilio': 'Domicilio',
      'marca': 'Marca del vehículo',
      'linea': 'Modelo/Línea',
      'color': 'Color',
      'ano': 'Año',
      'serie': 'Número de serie',
      'motor': 'Número de motor'
    };
    
    let message = '📝 *CAMPOS DISPONIBLES*\n\n';
    message += 'Escribe la palabra clave del campo:\n\n';
    
    for (const [key, label] of Object.entries(fields)) {
      const currentValue = this.getFieldValue(state.renewalData, key);
      message += `• *${key}* - ${label}\n`;
      message += `  Actual: ${this.truncateValue(currentValue)}\n\n`;
    }
    
    message += 'O escribe "cancelar" para volver atrás.';
    
    state.status = 'renewal_single_field';
    await this.stateManager.setState(from, state);
    await this.sendMessage(from, message);
  }

  /**
   * Get field value from renewal data
   */
  getFieldValue(renewalData, key) {
    const fieldMap = {
      'nombre': 'nombre_completo',
      'curp': 'curp_rfc',
      'email': 'email',
      'domicilio': 'domicilio',
      'marca': 'marca',
      'linea': 'linea',
      'color': 'color',
      'ano': 'ano_modelo',
      'serie': 'numero_serie',
      'motor': 'numero_motor'
    };
    
    const dbField = fieldMap[key] || key;
    return renewalData[dbField] || 'No definido';
  }

  /**
   * Truncate value for display
   */
  truncateValue(value) {
    if (!value) return 'No definido';
    if (value.length > 30) {
      return value.substring(0, 27) + '...';
    }
    return value;
  }

  /**
   * Handle renewal edit selection (user selects which permit to edit)
   */
  async handleRenewalEditSelection(from, response, state) {
    const selection = parseInt(response.trim());
    
    if (isNaN(selection) || selection < 1 || selection > state.renewablePermits.length) {
      await this.sendMessage(from, 
        `Por favor elige un número válido entre 1 y ${state.renewablePermits.length}`
      );
      return;
    }
    
    const selectedPermit = state.renewablePermits[selection - 1];
    
    // Get full permit details and start editing
    const user = await this.findOrCreateUser(from);
    const originalPermit = await this.getPermitById(selectedPermit.id, user.id);
    
    if (!originalPermit) {
      await this.sendMessage(from, 
        '❌ Error al cargar los datos del permiso.\n\n' +
        'Escribe "menu" para volver al menú.'
      );
      return;
    }
    
    // Start editing this permit
    await this.startRenewalEditing(from, originalPermit);
  }

  /**
   * Handle renewal field editing (user is editing specific fields)
   */
  async handleRenewalFieldEditing(from, response, state) {
    const input = response.toLowerCase().trim();
    
    // Handle cancel
    if (input === 'cancelar' || input === 'cancel' || input === 'menu') {
      await this.stateManager.clearState(from);
      return await this.showMainMenu(from);
    }
    
    // Handle renovar - proceed with edited data
    if (input === 'renovar' || input === 'renewal') {
      const user = await this.findOrCreateUser(from);
      return await this.createEditedRenewal(from, state.originalPermit, state.editData, user);
    }
    
    // Handle field selection
    const fieldMap = {
      'marca': 'marca',
      'linea': 'linea', 
      'modelo': 'linea',
      'color': 'color',
      'año': 'ano_modelo',
      'ano': 'ano_modelo',
      'motor': 'numero_motor',
      'serie': 'numero_serie',
      'nombre': 'nombre_completo'
    };
    
    const fieldKey = fieldMap[input];
    
    if (fieldKey) {
      // Start editing this field
      await this.sendMessage(from,
        `✏️ *EDITANDO: ${input.toUpperCase()}*\n\n` +
        `📝 *Valor actual:* ${state.editData[fieldKey] || 'No definido'}\n\n` +
        `💡 Escribe el nuevo valor:\n\n` +
        `🔙 O escribe "atras" para volver.`
      );
      
      // Update state to handle field input
      state.status = 'renewal_field_input';
      state.currentField = fieldKey;
      state.currentFieldName = input;
      await this.stateManager.setState(from, state);
      
    } else {
      await this.sendMessage(from,
        '❌ Campo no reconocido.\n\n' +
        'Campos disponibles:\n' +
        '• *marca* - Marca del vehículo\n' +
        '• *linea* - Línea/modelo\n' +
        '• *color* - Color del vehículo\n' +
        '• *año* - Año del modelo\n' +
        '• *motor* - Número de motor\n' +
        '• *serie* - Número de serie\n' +
        '• *nombre* - Nombre completo\n\n' +
        'Escribe el nombre del campo o "cancelar".'
      );
    }
  }

  /**
   * Handle renewal field input (user is entering new field value)
   */
  async handleRenewalFieldInput(from, response, state) {
    const input = response.trim();
    
    // Handle back navigation
    if (input.toLowerCase() === 'atras' || input.toLowerCase() === 'back') {
      // Go back to field selection
      state.status = 'renewal_field_editing';
      delete state.currentField;
      delete state.currentFieldName;
      await this.stateManager.setState(from, state);
      
      return await this.startRenewalEditing(from, state.originalPermit);
    }
    
    // Validate and update the field
    const fieldKey = state.currentField;
    const fieldName = state.currentFieldName;
    
    // Basic validation
    if (!input || input.length < 1) {
      await this.sendMessage(from,
        '❌ Por favor ingresa un valor válido.\n\n' +
        `✏️ *Editando:* ${fieldName}\n` +
        `📝 *Valor actual:* ${state.editData[fieldKey] || 'No definido'}\n\n` +
        'Escribe el nuevo valor o "atras" para volver.'
      );
      return;
    }
    
    // Update the field
    state.editData[fieldKey] = input;
    
    await this.sendMessage(from,
      `✅ *CAMPO ACTUALIZADO*\n\n` +
      `📝 *${fieldName.toUpperCase()}:* ${input}\n\n` +
      `🔧 ¿Quieres cambiar otro campo?\n\n` +
      `• Escribe el número del campo a cambiar\n` +
      `• O escribe *"renovar"* para proceder al pago\n` +
      `• O escribe *"cancelar"* para salir`
    );
    
    // Go back to field editing state
    state.status = 'renewal_field_editing';
    delete state.currentField;
    delete state.currentFieldName;
    await this.stateManager.setState(from, state);
  }

  /**
   * Handle quick field editing from renewal reminders (e.g., "1 Toyota")
   */
  async handleQuickFieldEdit(from, fieldNumber, newValue) {
    try {
      const user = await this.findOrCreateUser(from);
      const renewablePermits = await this.checkRenewablePermits(user.id);
      
      if (renewablePermits.length === 0) {
        await this.sendMessage(from,
          '❌ *NO HAY PERMISOS PARA EDITAR*\n\n' +
          'Los permisos se pueden renovar:\n' +
          '• 7 días antes de vencer\n' +
          '• Hasta 30 días después de vencidos\n\n' +
          'Escribe "menu" para volver al menú.'
        );
        return;
      }
      
      // Auto-select the first renewable permit
      const permit = renewablePermits[0];
      
      // Map field numbers to field keys (without email)
      const fieldMap = {
        1: 'nombre_completo',
        2: 'curp_rfc', 
        3: 'marca',
        4: 'linea',
        5: 'color',
        6: 'ano_modelo',
        7: 'numero_serie',
        8: 'numero_motor',
        9: 'domicilio'
      };
      
      const fieldKey = fieldMap[fieldNumber];
      
      if (!fieldKey) {
        await this.sendMessage(from,
          `❌ Número de campo inválido: ${fieldNumber}\n\n` +
          'Campos disponibles:\n' +
          '1. Nombre completo\n' +
          '2. CURP o RFC\n' +
          '3. Marca\n' +
          '4. Modelo\n' +
          '5. Color\n' +
          '6. Año\n' +
          '7. Número de serie (VIN)\n' +
          '8. Número de motor\n' +
          '9. Domicilio\n\n' +
          'Ejemplo: *3 Toyota* para cambiar la marca'
        );
        return;
      }
      
      // Get field labels for confirmation
      const fieldLabels = {
        'nombre_completo': 'Nombre completo',
        'curp_rfc': 'CURP o RFC',
        'marca': 'Marca',
        'linea': 'Modelo',
        'color': 'Color',
        'ano_modelo': 'Año',
        'numero_serie': 'Número de serie (VIN)',
        'numero_motor': 'Número de motor',
        'domicilio': 'Domicilio'
      };
      
      // Create edited permit data
      const editedData = { ...permit };
      editedData[fieldKey] = newValue;
      
      // Send confirmation and proceed to create renewal
      await this.sendMessage(from,
        `✅ *CAMPO ACTUALIZADO*\n\n` +
        `📝 *${fieldLabels[fieldKey]}:* ${newValue}\n\n` +
        `🔄 Creando renovación con el cambio...\n\n` +
        `⏳ Un momento...`
      );
      
      // Create renewal with edited data
      return await this.createEditedRenewal(from, permit, editedData, user);
      
    } catch (error) {
      logger.error('Error in quick field edit:', error);
      await this.sendMessage(from,
        '❌ Hubo un error al procesar tu edición.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  /**
   * Handle renewal field selection from reminder (single number input like "1")
   */
  async handleRenewalFieldSelectionFromReminder(from, fieldNumber) {
    try {
      const user = await this.findOrCreateUser(from);
      const renewablePermits = await this.checkRenewablePermits(user.id);
      
      if (renewablePermits.length === 0) {
        await this.sendMessage(from,
          '❌ *NO HAY PERMISOS PARA RENOVAR*\n\n' +
          'Los permisos se pueden renovar:\n' +
          '• 7 días antes de vencer\n' +
          '• Hasta 30 días después de vencidos\n\n' +
          'Escribe "menu" para volver al menú.'
        );
        return;
      }
      
      // Auto-select the first renewable permit
      const permit = renewablePermits[0];
      
      // Map field numbers to field keys and labels
      const fieldMap = {
        1: { key: 'nombre_completo', label: 'Nombre completo', example: 'Juan Carlos Pérez González' },
        2: { key: 'curp_rfc', label: 'CURP o RFC', example: 'PERJ850124HDFRZN01' },
        3: { key: 'marca', label: 'Marca', example: 'Toyota' },
        4: { key: 'linea', label: 'Modelo', example: 'Corolla' },
        5: { key: 'color', label: 'Color', example: 'Azul' },
        6: { key: 'ano_modelo', label: 'Año', example: '2020' },
        7: { key: 'numero_serie', label: 'Número de serie (VIN)', example: '1HGBH41JXMN109186' },
        8: { key: 'numero_motor', label: 'Número de motor', example: '4G15-MN123456' },
        9: { key: 'domicilio', label: 'Domicilio', example: 'Calle Juárez 123, Centro, Guadalajara, Jalisco' }
      };
      
      const fieldInfo = fieldMap[fieldNumber];
      
      if (!fieldInfo) {
        await this.sendMessage(from,
          `❌ Número de campo inválido: ${fieldNumber}\n\n` +
          'Campos disponibles para editar:\n' +
          '1. Nombre completo\n' +
          '2. CURP o RFC\n' +
          '3. Marca\n' +
          '4. Modelo\n' +
          '5. Color\n' +
          '6. Año\n' +
          '7. Número de serie (VIN)\n' +
          '8. Número de motor\n' +
          '9. Domicilio\n\n' +
          'Responde con el número del campo (1-9) que quieres cambiar.'
        );
        return;
      }
      
      const currentValue = permit[fieldInfo.key] || 'No especificado';
      
      // Show current value and request new value
      await this.sendMessage(from,
        `✏️ *EDITAR ${fieldInfo.label.toUpperCase()}*\n\n` +
        `📋 *Valor actual:* ${currentValue}\n\n` +
        `💡 *Ejemplo:* ${fieldInfo.example}\n\n` +
        `📝 Escribe el nuevo valor para *${fieldInfo.label}*:\n\n` +
        `❌ Escribe "cancelar" para salir`
      );
      
      // Set state for field editing
      const state = {
        status: 'renewal_field_input',
        originalPermitId: permit.id,
        renewalData: permit,
        currentField: fieldInfo.key,
        currentFieldName: fieldInfo.label,
        editData: { ...permit }, // Copy permit data for editing
        timestamp: Date.now()
      };
      await this.stateManager.setState(from, state);
      
    } catch (error) {
      logger.error('Error in renewal field selection:', error);
      await this.sendMessage(from,
        '❌ Hubo un error al procesar tu selección.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  /**
   * Handle opt-out request
   */
  async handleOptOut(from) {
    try {
      const notificationService = require('../whatsapp-notification-preferences.service');
      const user = await notificationService.disableNotificationsByPhone(from);
      
      if (user) {
        await this.sendMessage(from,
          `✅ *NOTIFICACIONES DESACTIVADAS*\n\n` +
          `${user.nombre_completo ? user.nombre_completo.split(' ')[0] : 'Usuario'}, ` +
          `has dejado de recibir recordatorios automáticos de renovación.\n\n` +
          `📋 *Aún puedes usar:*\n` +
          `• *estado* - Ver mis permisos\n` +
          `• *renovar* - Renovar permiso manualmente\n` +
          `• *nuevo* - Solicitar permiso nuevo\n\n` +
          `🔔 *Para reactivar recordatorios:*\n` +
          `Escribe *recordatorios*\n\n` +
          `✨ Seguimos aquí para ayudarte cuando nos necesites.`
        );
      } else {
        await this.sendMessage(from,
          `✅ *NOTIFICACIONES DESACTIVADAS*\n\n` +
          `No recibirás más recordatorios automáticos.\n\n` +
          `🔔 *Para reactivar:* Escribe *recordatorios*`
        );
      }
      
      logger.info('User opted out of WhatsApp notifications', { phone: from });
    } catch (error) {
      logger.error('Error handling opt-out:', error);
      await this.sendMessage(from,
        '❌ Error al procesar tu solicitud. Inténtalo nuevamente.'
      );
    }
  }

  /**
   * Handle opt-in request
   */
  async handleOptIn(from) {
    try {
      const user = await this.findOrCreateUser(from);
      const notificationService = require('../whatsapp-notification-preferences.service');
      await notificationService.enableNotifications(user.id, from);
      
      const name = user.nombre_completo ? user.nombre_completo.split(' ')[0] : 'Usuario';
      
      await this.sendMessage(from,
        `🔔 *RECORDATORIOS ACTIVADOS*\n\n` +
        `¡Perfecto ${name}! Has reactivado los recordatorios automáticos.\n\n` +
        `📅 *Recibirás notificaciones:*\n` +
        `• 7 días antes del vencimiento\n` +
        `• 3 días antes (urgente)\n` +
        `• 1 día antes (último aviso)\n` +
        `• El día del vencimiento\n` +
        `• Durante el período de gracia\n\n` +
        `⚡ *Renovación express:* Solo 30 segundos\n` +
        `💰 *Costo:* $99 MXN\n\n` +
        `🚫 *Para desactivar:* Escribe *stop*\n\n` +
        `¿Necesitas algo más? Escribe *ayuda*`
      );
      
      logger.info('User opted in to WhatsApp notifications', { 
        userId: user.id, 
        phone: from 
      });
    } catch (error) {
      logger.error('Error handling opt-in:', error);
      await this.sendMessage(from,
        '❌ Error al activar recordatorios. Inténtalo nuevamente.'
      );
    }
  }

  /**
   * Create direct renewal - skip confirmation and go straight to payment
   */
  async createDirectRenewal(from, originalPermit, user) {
    try {
      // Create renewal application immediately using original permit data
      const applicationService = require('../application.service');
      const stripePaymentLinkService = require('./stripe-payment-link.service');
      const { PaymentFees } = require('../../constants/payment.constants');
      
      const renewalData = {
        user_id: user.id,
        nombre_completo: originalPermit.nombre_completo,
        curp_rfc: originalPermit.curp_rfc,
        domicilio: originalPermit.domicilio,
        marca: originalPermit.marca,
        linea: originalPermit.linea,
        color: originalPermit.color,
        ano_modelo: originalPermit.ano_modelo,
        numero_motor: originalPermit.numero_motor,
        numero_serie: originalPermit.numero_serie,
        renewed_from_id: originalPermit.id,
        whatsapp_phone: from
      };
      
      // createApplicationWithOxxo returns { application, payment }
      const result = await applicationService.createApplicationWithOxxo(renewalData, renewalData.user_id);
      const application = result.application;
      
      // Create Stripe checkout session
      const checkoutSession = await stripePaymentLinkService.createCheckoutSession({
        applicationId: application.id,
        amount: PaymentFees.RENEWAL_FEE || 99,
        currency: 'MXN',
        customerEmail: user.account_email,
        metadata: {
          renewal: true,
          original_application_id: originalPermit.id,
          source: 'whatsapp_renewal'
        },
        successUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-success?session_id={CHECKOUT_SESSION_ID}&renewal=true`,
        cancelUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-cancelled?renewal=true`
      });

      // Update application with payment session ID
      const applicationRepository = require('../../repositories/application.repository');
      await applicationRepository.updateApplication(
        application.id, 
        { payment_processor_order_id: checkoutSession.id }
      );
      
      // Send success message with payment link
      await this.sendMessage(from,
        `✅ *RENOVACIÓN CREADA EXITOSAMENTE*\n\n` +
        `📋 *Nuevo Folio:* ${application.id}\n` +
        `🔄 *Renovación de:* ${originalPermit.folio || originalPermit.id}\n` +
        `🚗 *Vehículo:* ${originalPermit.marca} ${originalPermit.linea}\n` +
        `🎨 *Color:* ${originalPermit.color}\n\n` +
        `💳 *PROCEDER AL PAGO ($99 MXN):*\n` +
        `${checkoutSession.url}\n\n` +
        `⏰ *Link válido por:* 24 horas\n` +
        `📱 *Tu folio:* ${application.id}\n\n` +
        `Una vez completado el pago, tu permiso estará listo en 1-2 horas. ¡Gracias! 🚗✨`
      );
      
      // Clear any existing state
      await this.stateManager.clearState(from);
      
      logger.info('Direct renewal created successfully', {
        userId: user.id,
        originalPermitId: originalPermit.id,
        newApplicationId: application.id,
        checkoutSessionId: checkoutSession.id,
        from
      });
      
    } catch (error) {
      logger.error('Error creating direct renewal:', error);
      await this.sendMessage(from,
        '❌ Hubo un error al crear tu renovación.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  /**
   * Create renewal with edited data
   */
  async createEditedRenewal(from, originalPermit, editedData, user) {
    try {
      // Create renewal application with edited data
      const applicationService = require('../application.service');
      const stripePaymentLinkService = require('./stripe-payment-link.service');
      const { PaymentFees } = require('../../constants/payment.constants');
      
      const renewalData = {
        user_id: user.id,
        nombre_completo: editedData.nombre_completo || originalPermit.nombre_completo,
        curp_rfc: editedData.curp_rfc || originalPermit.curp_rfc,
        domicilio: editedData.domicilio || originalPermit.domicilio,
        marca: editedData.marca || originalPermit.marca,
        linea: editedData.linea || originalPermit.linea,
        color: editedData.color || originalPermit.color,
        ano_modelo: editedData.ano_modelo || originalPermit.ano_modelo,
        numero_motor: editedData.numero_motor || originalPermit.numero_motor,
        numero_serie: editedData.numero_serie || originalPermit.numero_serie,
        renewed_from_id: originalPermit.id,
        whatsapp_phone: from
      };
      
      // createApplicationWithOxxo returns { application, payment }
      const result = await applicationService.createApplicationWithOxxo(renewalData, renewalData.user_id);
      const application = result.application;
      
      // Create Stripe checkout session
      const checkoutSession = await stripePaymentLinkService.createCheckoutSession({
        applicationId: application.id,
        amount: PaymentFees.RENEWAL_FEE || 99,
        currency: 'MXN',
        customerEmail: user.account_email,
        metadata: {
          renewal: true,
          original_application_id: originalPermit.id,
          source: 'whatsapp_renewal_edited'
        },
        successUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-success?session_id={CHECKOUT_SESSION_ID}&renewal=true`,
        cancelUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-cancelled?renewal=true`
      });

      // Update application with payment session ID
      const applicationRepository = require('../../repositories/application.repository');
      await applicationRepository.updateApplication(
        application.id, 
        { payment_processor_order_id: checkoutSession.id }
      );
      
      // Send success message with updated details and payment link
      await this.sendMessage(from,
        `✅ *RENOVACIÓN CON CAMBIOS CREADA*\n\n` +
        `📋 *Nuevo Folio:* ${application.id}\n` +
        `🔄 *Renovación de:* ${originalPermit.folio || originalPermit.id}\n\n` +
        `📝 *DATOS ACTUALIZADOS:*\n` +
        `🚗 *Vehículo:* ${renewalData.marca} ${renewalData.linea}\n` +
        `🎨 *Color:* ${renewalData.color}\n` +
        `📅 *Año:* ${renewalData.ano_modelo}\n` +
        `⚙️ *Motor:* ${renewalData.numero_motor}\n` +
        `🔢 *Serie:* ${renewalData.numero_serie}\n\n` +
        `💳 *PROCEDER AL PAGO ($99 MXN):*\n` +
        `${checkoutSession.url}\n\n` +
        `⏰ *Link válido por:* 24 horas\n` +
        `📱 *Tu folio:* ${application.id}\n\n` +
        `Una vez completado el pago, tu permiso estará listo en 1-2 horas. ¡Gracias! 🚗✨`
      );
      
      // Clear state
      await this.stateManager.clearState(from);
      
      logger.info('Edited renewal created successfully', {
        userId: user.id,
        originalPermitId: originalPermit.id,
        newApplicationId: application.id,
        editedFields: Object.keys(editedData),
        checkoutSessionId: checkoutSession.id,
        from
      });
      
    } catch (error) {
      logger.error('Error creating edited renewal:', error);
      await this.sendMessage(from,
        '❌ Hubo un error al crear tu renovación con los cambios.\n\n' +
        'Por favor intenta de nuevo o escribe "ayuda" para soporte.'
      );
    }
  }

  /**
   * Show list of permits that can be edited for renewal
   */
  async showEditablePermitsList(from, renewablePermits) {
    let message = '✏️ *SELECCIONA PERMISO PARA EDITAR*\n\n';
    
    renewablePermits.forEach((permit, index) => {
      const daysText = permit.days_until_expiration >= 0 
        ? `vence en ${permit.days_until_expiration} días`
        : `venció hace ${Math.abs(permit.days_until_expiration)} días`;
      
      message += `${index + 1}. *Folio:* ${permit.folio || permit.id}\n`;
      message += `   🚗 ${permit.marca} ${permit.linea} ${permit.color}\n`;
      message += `   📅 ${daysText}\n\n`;
    });
    
    message += 'Escribe el número del permiso a editar (1-' + renewablePermits.length + ')';
    await this.sendMessage(from, message);
    
    // Set state for editing selection
    const state = {
      status: 'renewal_edit_selection',
      renewablePermits: renewablePermits,
      timestamp: Date.now()
    };
    await this.stateManager.setState(from, state);
  }

  /**
   * Start renewal editing flow for a specific permit
   */
  async startRenewalEditing(from, permit) {
    try {
      // Show current permit details and ask what to edit
      await this.sendMessage(from,
        `✏️ *EDITAR PERMISO PARA RENOVACIÓN*\n\n` +
        `📋 *Datos Actuales:*\n` +
        `• *Folio:* ${permit.folio || permit.id}\n` +
        `• *Nombre:* ${permit.nombre_completo}\n` +
        `• *Marca:* ${permit.marca}\n` +
        `• *Línea:* ${permit.linea}\n` +
        `• *Color:* ${permit.color}\n` +
        `• *Año:* ${permit.ano_modelo}\n` +
        `• *Motor:* ${permit.numero_motor}\n` +
        `• *Serie:* ${permit.numero_serie}\n\n` +
        `🔧 *¿QUÉ DESEAS CAMBIAR?*\n\n` +
        `1️⃣ *marca* - Marca del vehículo\n` +
        `2️⃣ *linea* - Línea/modelo\n` +
        `3️⃣ *color* - Color del vehículo\n` +
        `4️⃣ *año* - Año del modelo\n` +
        `5️⃣ *motor* - Número de motor\n` +
        `6️⃣ *serie* - Número de serie\n` +
        `7️⃣ *nombre* - Nombre completo\n\n` +
        `Escribe el nombre del campo que quieres cambiar.`
      );
      
      // Set state for field editing
      const state = {
        status: 'renewal_field_editing',
        originalPermit: permit,
        editData: { ...permit }, // Copy original data for editing
        timestamp: Date.now()
      };
      await this.stateManager.setState(from, state);
      
    } catch (error) {
      logger.error('Error starting renewal editing:', error);
      await this.sendMessage(from,
        '❌ Error al iniciar edición. Intenta de nuevo.'
      );
    }
  }

  /**
   * Handle input processed through enhanced state management system
   * This method bridges the new enhanced system with existing handlers
   */
  async handleEnhancedInput(from, enhancedResult) {
    try {
      const { routingResult, enhancedState } = enhancedResult;
      
      // Convert enhanced routing result to actionable response
      const actionResult = await this.migrationAdapter.handleEnhancedRoutingResult(
        from, 
        routingResult, 
        enhancedState
      );

      logger.info('Processing enhanced action result', {
        from: from.substring(0, 6) + '****',
        action: actionResult.action,
        routingType: routingResult.type
      });

      // Execute the appropriate action based on enhanced routing
      switch (actionResult.action) {
        case 'renewal_field_selection':
          // This handles Angel's case: typing "1" to select field to edit
          await this.handleEnhancedRenewalFieldSelection(from, actionResult.fieldNumber, actionResult.enhancedState);
          break;

        case 'menu_selection':
          // Convert to legacy menu selection
          const legacyState = { status: 'showing_menu', data: actionResult.enhancedState.data };
          await this.handleMenuSelection(from, actionResult.option.toString(), legacyState);
          break;

        case 'form_input':
          // Handle form text input with context
          await this.handleEnhancedFormInput(from, actionResult.text, actionResult.enhancedState);
          break;

        case 'global_command':
          // Handle global commands like menu, ayuda
          await this.handleEnhancedGlobalCommand(from, actionResult.command, actionResult.enhancedState);
          break;

        case 'context_command':
          // Handle context-specific commands
          await this.handleEnhancedContextCommand(from, actionResult.command, actionResult.enhancedState);
          break;

        case 'invalid_input':
          // Send user-friendly error message with valid options
          await this.sendMessage(from, actionResult.message);
          break;

        default:
          // Fallback to legacy system
          logger.info('Falling back to legacy system', {
            from: from.substring(0, 6) + '****',
            action: actionResult.action
          });
          
          // Convert enhanced state back to legacy and continue with legacy processing
          await this.migrationAdapter.syncEnhancedToLegacy(from, actionResult.enhancedState);
          return false; // Indicate fallback to caller
      }

      // Sync enhanced state back to legacy for backward compatibility
      await this.migrationAdapter.syncEnhancedToLegacy(from, actionResult.enhancedState);
      
      return true; // Successfully handled

    } catch (error) {
      logger.error('Error handling enhanced input', {
        error: error.message,
        from: from.substring(0, 6) + '****'
      });
      
      // Fallback to main menu on error
      await this.showMainMenu(from);
      return false;
    }
  }

  /**
   * Handle renewal field selection through enhanced system (Angel's case)
   */
  async handleEnhancedRenewalFieldSelection(from, fieldNumber, enhancedState) {
    try {
      // Get the permit data from enhanced state
      const permit = enhancedState.data.permit || enhancedState.data.editData;
      
      if (!permit) {
        await this.sendMessage(from, '❌ No se encontraron datos del permiso para editar.');
        return await this.showMainMenu(from);
      }

      // Map field numbers to permit fields (matching existing system)
      const fieldMap = {
        1: { key: 'marca', label: 'Marca del vehículo', example: 'Toyota, Nissan, Ford' },
        2: { key: 'linea', label: 'Línea/modelo', example: 'Corolla, Sentra, F-150' },
        3: { key: 'color', label: 'Color del vehículo', example: 'Blanco, Azul y Rojo' },
        4: { key: 'ano_modelo', label: 'Año del modelo', example: '2020, 2018, 2015' },
        5: { key: 'numero_motor', label: 'Número de motor', example: '4G15-MN123456' },
        6: { key: 'numero_serie', label: 'Número de serie (VIN)', example: '1HGBH41JXMN109186' },
        7: { key: 'nombre_completo', label: 'Nombre completo', example: 'Juan Carlos Pérez González' },
        8: { key: 'email', label: 'Correo electrónico', example: 'juan.perez@gmail.com' },
        9: { key: 'domicilio', label: 'Domicilio', example: 'Calle Juárez 123, Centro, Guadalajara, Jalisco' }
      };

      const field = fieldMap[fieldNumber];
      if (!field) {
        await this.sendMessage(from, 
          '❌ Número de campo inválido. Escribe un número del 1 al 9.\n\n' +
          'Escribe "renovar" para ver las opciones disponibles.'
        );
        return;
      }

      // Show current value and ask for new value
      const currentValue = permit[field.key] || 'No especificado';
      await this.sendMessage(from,
        `✏️ **EDITAR ${field.label.toUpperCase()}**\n\n` +
        `📋 **Valor actual:** ${currentValue}\n\n` +
        `💡 **Ejemplo:** ${field.example}\n\n` +
        `Escribe el nuevo valor para **${field.label}**:\n\n` +
        `❌ Escribe "cancelar" para salir`
      );

      // Update enhanced state for field editing
      const updatedState = await this.migrationAdapter.enhancedStateManager.createState(
        'form', 
        'renewal_edit', 
        {
          ...enhancedState.data,
          currentField: field.key,
          currentFieldName: field.label,
          permit: permit
        }
      );

      // Save enhanced state
      await this.migrationAdapter.enhancedStateManager.setState(from, updatedState);

      // Also update legacy state for backward compatibility
      const legacyState = {
        status: 'renewal_field_input',
        currentField: field.key,
        currentFieldName: field.label,
        permit: permit,
        editData: permit,
        timestamp: Date.now()
      };
      await this.stateManager.setState(from, legacyState);

    } catch (error) {
      logger.error('Error in enhanced renewal field selection', {
        error: error.message,
        from: from.substring(0, 6) + '****',
        fieldNumber
      });
      
      await this.sendMessage(from, '❌ Error al seleccionar campo. Intenta de nuevo.');
      await this.showMainMenu(from);
    }
  }

  /**
   * Handle form input through enhanced system
   */
  async handleEnhancedFormInput(from, text, enhancedState) {
    // Delegate to existing form handlers based on context
    if (enhancedState.context === 'renewal_edit') {
      const legacyState = {
        status: 'renewal_field_input',
        currentField: enhancedState.data.currentField,
        permit: enhancedState.data.permit,
        editData: enhancedState.data.permit,
        timestamp: Date.now()
      };
      return await this.handleRenewalFieldInput(from, text, legacyState);
    }
    
    // Fallback to legacy form handling
    const legacyState = { status: 'collecting', data: enhancedState.data };
    return await this.handleDataCollection(from, text, legacyState);
  }

  /**
   * Handle global commands through enhanced system
   */
  async handleEnhancedGlobalCommand(from, command, enhancedState) {
    switch (command) {
      case 'menu':
      case 'menú':
      case 'inicio':
        await this.migrationAdapter.enhancedStateManager.clearState(from);
        return await this.showMainMenu(from);
        
      case 'ayuda':
        return await this.sendHelp(from);
        
      default:
        return await this.showMainMenu(from);
    }
  }

  /**
   * Handle context-specific commands through enhanced system
   */
  async handleEnhancedContextCommand(from, command, enhancedState) {
    switch (command) {
      case 'renovar':
        return await this.handleRenewalFlow(from);
        
      case 'estado':
        return await this.checkStatus(from);
        
      case 'cancelar':
      case 'cancel':
        await this.migrationAdapter.enhancedStateManager.clearState(from);
        return await this.showMainMenu(from);
        
      default:
        return await this.showMainMenu(from);
    }
  }

}

module.exports = SimpleWhatsAppService;
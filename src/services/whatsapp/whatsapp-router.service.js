/**
 * WhatsApp Router Service
 * Intelligently routes messages between Express (FB ads) and Standard (organic) services
 */

const { logger } = require('../../utils/logger');
const ExpressWhatsAppService = require('./express-whatsapp.service');
const SimpleWhatsAppService = require('./simple-whatsapp.service');

class WhatsAppRouterService {
  constructor() {
    this.expressService = new ExpressWhatsAppService();
    this.standardService = new SimpleWhatsAppService();
    
    // Initialize standard service (express service doesn't need initialization)
    if (this.standardService.initialize) {
      this.standardService.initialize();
    }
    
    // Track routing decisions for analytics
    this.routingStats = {
      express: 0,
      standard: 0,
      lastReset: Date.now()
    };
    
    // Reset stats every hour
    setInterval(() => {
      const total = this.routingStats.express + this.routingStats.standard;
      if (total > 0) {
        logger.info('WhatsApp routing stats', {
          express: this.routingStats.express,
          standard: this.routingStats.standard,
          expressPercent: Math.round((this.routingStats.express / total) * 100)
        });
      }
      this.routingStats = { express: 0, standard: 0, lastReset: Date.now() };
    }, 60 * 60 * 1000);
  }

  /**
   * Route incoming message to appropriate service
   */
  async routeMessage(from, message, webhookData = null) {
    try {
      // Extract messageId from webhookData if available
      let messageId = null;
      if (webhookData && webhookData.entry && webhookData.entry[0] &&
          webhookData.entry[0].changes && webhookData.entry[0].changes[0] &&
          webhookData.entry[0].changes[0].value && webhookData.entry[0].changes[0].value.messages &&
          webhookData.entry[0].changes[0].value.messages[0]) {
        messageId = webhookData.entry[0].changes[0].value.messages[0].id;
      }

      // Check if user is already in a session with Express service
      const StateManager = require('./state-manager');
      const stateManager = new StateManager();
      const currentState = await stateManager.getState(from);

      // If user has Express service state, keep them in Express
      if (currentState && (currentState.source === 'express' || currentState.source === 'whatsapp_express_renewal')) {
        this.routingStats.express++;
        logger.info('Routing to Express service', { from, trigger: 'existing_express_session', source: currentState.source });
        return await this.expressService.handleMessage(from, message, messageId);
      }

      const shouldUseExpress = this.shouldUseExpressService(from, message, webhookData);

      if (shouldUseExpress) {
        this.routingStats.express++;
        logger.info('Routing to Express service', { from, trigger: 'high_intent_message' });
        return await this.expressService.handleMessage(from, message, messageId);
      } else {
        this.routingStats.standard++;
        logger.info('Routing to Standard service', { from, trigger: 'organic_or_complex' });
        return await this.standardService.processMessage(from, message, messageId);
      }

    } catch (error) {
      logger.error('Error in WhatsApp routing', { error: error.message, from, message });

      // Fallback to standard service on error
      this.routingStats.standard++;
      return await this.standardService.processMessage(from, message);
    }
  }

  /**
   * Determine if message should use Express service
   * PHASE 1: Route everything to Express for testing
   */
  shouldUseExpressService(from, message, webhookData) {
    // PHASE 1 TESTING: Route everything to Express service
    // This replaces the complex routing logic temporarily
    return true;
    
    /* ORIGINAL ROUTING LOGIC - TEMPORARILY DISABLED
    const normalizedMessage = message.toLowerCase().trim();
    
    // 1. High-intent keywords (likely from FB ads or renewal flow)
    const highIntentKeywords = [
      'permiso', 'urgente', 'necesito', 'ayuda', 'ocupo', 'quiero',
      'tramitar', 'placas', 'circulacion', 'circulación', 'renovar', 'renovación'
    ];
    
    const hasHighIntentKeyword = highIntentKeywords.some(keyword => 
      normalizedMessage.includes(keyword)
    );
    
    // 1.5. Check for numeric selections (likely part of form flow)
    const isNumericSelection = /^[1-9]\d*$/.test(normalizedMessage) && parseInt(normalizedMessage) <= 10;
    
    // 2. Message looks like FB ad click-to-chat
    const looksFBGenerated = [
      'necesito mi permiso urgente', 'ocupo ayuda con mi permiso',
      'quiero tramitar mi permiso', 'ayuda con permiso', 'permiso sin placas'
    ].some(pattern => normalizedMessage.includes(pattern.toLowerCase()));
    
    // 3. Check for organic/returning user patterns (use Standard service)
    const organicPatterns = [
      'hola', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches',
      'menu', 'menú', 'estado', 'cancelar', 'ayuda tecnica', 'privacidad'
    ];
    
    const isOrganic = organicPatterns.some(pattern => 
      normalizedMessage === pattern || normalizedMessage.startsWith(pattern)
    );
    
    // 4. Message is too generic (likely greeting)
    const isGenericGreeting = normalizedMessage.length < 5 || 
      ['hi', 'hey', 'hola', '?', '??'].includes(normalizedMessage);
    
    // Decision logic
    if (isOrganic || isGenericGreeting) {
      return false; // Use Standard service
    }
    
    if (hasHighIntentKeyword || looksFBGenerated || isNumericSelection) {
      return true; // Use Express service
    }
    
    // Default to Express for unknown patterns (assume high intent)
    return true;
    END ORIGINAL ROUTING LOGIC */
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return {
      ...this.routingStats,
      uptime: Date.now() - this.routingStats.lastReset,
      total: this.routingStats.express + this.routingStats.standard
    };
  }

  /**
   * Force route to Express service (for testing)
   */
  async forceExpressRoute(from, message, messageId = null) {
    this.routingStats.express++;
    logger.info('Force routing to Express service', { from });
    return await this.expressService.handleMessage(from, message, messageId);
  }

  /**
   * Force route to Standard service (for testing)
   */
  async forceStandardRoute(from, message, messageId = null) {
    this.routingStats.standard++;
    logger.info('Force routing to Standard service', { from });
    return await this.standardService.processMessage(from, message, messageId);
  }
}

module.exports = WhatsAppRouterService;
/**
 * Enhanced State Manager for WhatsApp Service
 * Implements context-based state management with clear navigation
 */

const { logger } = require('../../utils/logger');
const redisClient = require('../../utils/redis-client');

class EnhancedStateManager {
  constructor() {
    this.CACHE_TTL = 24 * 60 * 60; // 24 hours
    this.STATE_PREFIX = 'wa_enhanced_state:';
    
    // Define valid state types and their contexts
    this.VALID_STATES = {
      idle: [],
      menu: ['main', 'privacy', 'quick_actions', 'renewal', 'draft', 'status'],
      form: ['new_permit', 'renewal_edit', 'privacy_consent', 'field_edit'],
      confirmation: ['permit_data', 'renewal_data', 'privacy_acceptance', 'payment'],
      status: ['checking', 'managing', 'selecting'],
      help: ['general', 'form_help', 'payment_help'],
      error: ['validation', 'system', 'rate_limit'],
      notification: ['permit_ready', 'reminder', 'delivery']
    };
    
    // Define expected inputs for each state-context combination
    this.EXPECTED_INPUTS = {
      'menu:main': ['1', '2', '3', '4', '5'],
      'menu:privacy': ['1', '2', '3'],
      'menu:renewal': ['1', '2', '3'],
      'form:new_permit': ['text', 'back', 'save', 'help'],
      'form:renewal_edit': ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'renovar', 'cancelar'],
      'confirmation:permit_data': ['1', '2', '3', 'confirmar', 'editar'],
      'status:checking': ['1', '2', '3', 'crear', 'renovar'],
      'help:general': ['menu', 'back', 'continue']
    };

    // Define user-friendly breadcrumbs
    this.BREADCRUMB_LABELS = {
      'menu:main': '🏠 Menú Principal',
      'menu:privacy': '🔒 Privacidad',
      'menu:renewal': '♻️ Renovación',
      'form:new_permit': '📝 Nuevo Permiso',
      'form:renewal_edit': '✏️ Editar Renovación',
      'confirmation:permit_data': '✅ Confirmación',
      'status:checking': '📊 Estado',
      'help:general': '❓ Ayuda'
    };
  }

  /**
   * Create a new enhanced state
   */
  createState(type, context = null, data = {}) {
    // Validate state type
    if (!this.VALID_STATES[type]) {
      throw new Error(`Invalid state type: ${type}`);
    }

    // Validate context if provided
    if (context && !this.VALID_STATES[type].includes(context)) {
      throw new Error(`Invalid context '${context}' for state type '${type}'`);
    }

    const stateKey = context ? `${type}:${context}` : type;
    
    return {
      type,
      context,
      stateKey,
      data: { ...data },
      history: [],
      expectedInputs: this.EXPECTED_INPUTS[stateKey] || [],
      timestamp: Date.now(),
      returnTo: null,
      breadcrumb: this.BREADCRUMB_LABELS[stateKey] || `${type}${context ? ':' + context : ''}`
    };
  }

  /**
   * Set enhanced state for a user
   */
  async setState(phoneNumber, stateData) {
    try {
      const key = `${this.STATE_PREFIX}${phoneNumber}`;
      
      // Add navigation history if state is changing
      const currentState = await this.getState(phoneNumber);
      if (currentState && currentState.stateKey !== stateData.stateKey) {
        stateData.history = [...(currentState.history || []), currentState.stateKey].slice(-5); // Keep last 5 states
      }

      const serializedState = JSON.stringify(stateData);
      await redisClient.setex(key, this.CACHE_TTL, serializedState);
      
      logger.info('Enhanced state set successfully', {
        phoneNumber: phoneNumber.substring(0, 6) + '****',
        stateType: stateData.type,
        context: stateData.context,
        breadcrumb: stateData.breadcrumb,
        historyLength: stateData.history.length
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to set enhanced state', {
        error: error.message,
        phoneNumber: phoneNumber.substring(0, 6) + '****'
      });
      return false;
    }
  }

  /**
   * Get enhanced state for a user
   */
  async getState(phoneNumber) {
    try {
      const key = `${this.STATE_PREFIX}${phoneNumber}`;
      const serializedState = await redisClient.get(key);
      
      if (!serializedState) {
        return null;
      }
      
      const state = JSON.parse(serializedState);
      
      // Validate state structure
      if (!state.type || !this.VALID_STATES[state.type]) {
        logger.warn('Invalid state structure found, clearing', {
          phoneNumber: phoneNumber.substring(0, 6) + '****',
          stateType: state.type
        });
        await this.clearState(phoneNumber);
        return null;
      }
      
      return state;
    } catch (error) {
      logger.error('Failed to get enhanced state', {
        error: error.message,
        phoneNumber: phoneNumber.substring(0, 6) + '****'
      });
      return null;
    }
  }

  /**
   * Clear state for a user
   */
  async clearState(phoneNumber) {
    try {
      const key = `${this.STATE_PREFIX}${phoneNumber}`;
      await redisClient.del(key);
      
      logger.info('Enhanced state cleared', {
        phoneNumber: phoneNumber.substring(0, 6) + '****'
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to clear enhanced state', {
        error: error.message,
        phoneNumber: phoneNumber.substring(0, 6) + '****'
      });
      return false;
    }
  }

  /**
   * Navigate back to previous state
   */
  async navigateBack(phoneNumber) {
    try {
      const currentState = await this.getState(phoneNumber);
      if (!currentState || !currentState.history || currentState.history.length === 0) {
        // No history, go to main menu
        return this.createState('menu', 'main');
      }

      const previousStateKey = currentState.history[currentState.history.length - 1];
      const [type, context] = previousStateKey.split(':');
      
      // Create new state with shortened history
      const newState = this.createState(type, context || null, currentState.data);
      newState.history = currentState.history.slice(0, -1);
      
      return newState;
    } catch (error) {
      logger.error('Failed to navigate back', {
        error: error.message,
        phoneNumber: phoneNumber.substring(0, 6) + '****'
      });
      // Fallback to main menu
      return this.createState('menu', 'main');
    }
  }

  /**
   * Check if input is valid for current state
   */
  isValidInput(state, input) {
    if (!state || !state.expectedInputs) {
      return false;
    }

    const normalizedInput = input.toLowerCase().trim();
    
    // Check exact matches
    if (state.expectedInputs.includes(normalizedInput)) {
      return true;
    }

    // Check type-based inputs
    if (state.expectedInputs.includes('text') && normalizedInput.length > 0) {
      return true;
    }

    // Check number ranges for menu options
    if (state.type === 'menu' && /^\d+$/.test(normalizedInput)) {
      const num = parseInt(normalizedInput);
      const maxOption = Math.max(...state.expectedInputs.filter(i => /^\d+$/.test(i)).map(i => parseInt(i)));
      return num >= 1 && num <= maxOption;
    }

    return false;
  }

  /**
   * Get user-friendly state description
   */
  getStateDescription(state) {
    if (!state) {
      return '❓ Estado desconocido';
    }

    let description = state.breadcrumb;
    
    if (state.history && state.history.length > 0) {
      const historyBreadcrumbs = state.history.map(stateKey => 
        this.BREADCRUMB_LABELS[stateKey] || stateKey
      ).join(' → ');
      description = `${historyBreadcrumbs} → ${description}`;
    }

    return description;
  }

  /**
   * Create help state that preserves current context
   */
  async createHelpState(phoneNumber, helpType = 'general') {
    const currentState = await this.getState(phoneNumber);
    const helpState = this.createState('help', helpType);
    
    if (currentState) {
      helpState.returnTo = currentState;
    }
    
    return helpState;
  }

  /**
   * Return from help to previous state
   */
  async returnFromHelp(phoneNumber) {
    const currentState = await this.getState(phoneNumber);
    
    if (currentState && currentState.type === 'help' && currentState.returnTo) {
      return currentState.returnTo;
    }
    
    // Fallback to main menu
    return this.createState('menu', 'main');
  }

  /**
   * Get migration mapping from old states to new enhanced states
   */
  getMigrationMapping() {
    return {
      // Menu states
      'showing_menu': { type: 'menu', context: 'main' },
      'showing_conversational_menu': { type: 'menu', context: 'main' },
      'showing_privacy_menu': { type: 'menu', context: 'privacy' },
      'quick_actions_menu': { type: 'menu', context: 'quick_actions' },
      
      // Form states
      'collecting': { type: 'form', context: 'new_permit' },
      'editing_field': { type: 'form', context: 'field_edit' },
      'awaiting_privacy_consent': { type: 'form', context: 'privacy_consent' },
      'renewal_field_input': { type: 'form', context: 'renewal_edit' },
      
      // Confirmation states
      'confirming': { type: 'confirmation', context: 'permit_data' },
      'renewal_confirmation': { type: 'confirmation', context: 'renewal_data' },
      
      // Status states
      'managing_applications': { type: 'status', context: 'managing' },
      'awaiting_folio_selection': { type: 'status', context: 'selecting' },
      
      // Renewal states → menu with renewal context
      'renewal_selection': { type: 'menu', context: 'renewal' },
      'renewal_field_selection': { type: 'menu', context: 'renewal' },
      
      // Error states
      'rate_limit_options': { type: 'error', context: 'rate_limit' },
      
      // Notification states
      'permit_delivered': { type: 'notification', context: 'delivery' },
      'permit_downloaded': { type: 'notification', context: 'delivery' }
    };
  }
}

module.exports = EnhancedStateManager;
/**
 * State Migration Adapter for WhatsApp Service
 * Provides gradual migration from old state system to enhanced state management
 */

const { logger } = require('../../utils/logger');
const EnhancedStateManager = require('./enhanced-state-manager');
const InputRouter = require('./input-router');

class StateMigrationAdapter {
  constructor(legacyStateManager) {
    this.legacyStateManager = legacyStateManager;
    this.enhancedStateManager = new EnhancedStateManager();
    this.inputRouter = new InputRouter(this.enhancedStateManager);
    
    // Track which users are using the new system
    this.newSystemUsers = new Set();
    
    // Enable migration for specific use cases
    this.MIGRATION_ENABLED_FOR = {
      renewal: true,        // Angel's case - renewal flow
      field_editing: true,  // Field editing from reminders
      menu_navigation: false, // Keep legacy for now
      form_filling: false   // Keep legacy for now
    };
    
    logger.info('State Migration Adapter initialized', {
      migrationEnabled: this.MIGRATION_ENABLED_FOR
    });
  }

  /**
   * Process input with context-aware routing for specific scenarios
   */
  async processInputWithContext(from, input, currentState) {
    try {
      // Check if this scenario should use the new system
      const shouldUseMigration = this.shouldUseMigration(from, input, currentState);
      
      if (!shouldUseMigration) {
        // Use legacy processing
        return { useEnhancedSystem: false };
      }

      // Convert legacy state to enhanced state if needed
      const enhancedState = await this.convertLegacyToEnhanced(from, currentState);
      
      // Route input through new system
      const routingResult = await this.inputRouter.routeInput(from, input, enhancedState);
      
      logger.info('Enhanced routing result', {
        from: from.substring(0, 6) + '****',
        input: input.length > 20 ? input.substring(0, 20) + '...' : input,
        resultType: routingResult.type,
        useEnhanced: true
      });

      return {
        useEnhancedSystem: true,
        routingResult,
        enhancedState
      };

    } catch (error) {
      logger.error('Error in enhanced input processing, falling back to legacy', {
        error: error.message,
        from: from.substring(0, 6) + '****'
      });
      
      return { useEnhancedSystem: false };
    }
  }

  /**
   * Determine if this scenario should use the new enhanced system
   */
  shouldUseMigration(from, input, currentState) {
    // Check for renewal-related scenarios (Angel's case)
    if (this.MIGRATION_ENABLED_FOR.renewal) {
      // If user is in renewal flow
      if (currentState?.status?.includes('renewal')) {
        return true;
      }
      
      // If input is renewal-related
      if (/^(renovar|renewal|renovación)$/i.test(input.trim())) {
        return true;
      }
      
      // If it's a single number and user might be in renewal context
      if (/^\d+$/.test(input.trim()) && currentState?.status === 'renewal_field_selection') {
        return true;
      }
    }

    // Check for field editing scenarios  
    if (this.MIGRATION_ENABLED_FOR.field_editing) {
      // If user is editing fields from renewal reminders
      if (currentState?.status === 'renewal_field_input' || 
          currentState?.status === 'renewal_field_editing') {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert legacy state to enhanced state format
   */
  async convertLegacyToEnhanced(from, legacyState) {
    if (!legacyState || !legacyState.status) {
      return this.enhancedStateManager.createState('menu', 'main');
    }

    // Get migration mapping
    const migrationMap = this.enhancedStateManager.getMigrationMapping();
    const mapping = migrationMap[legacyState.status];

    if (mapping) {
      // Create enhanced state from mapping
      const enhancedState = this.enhancedStateManager.createState(
        mapping.type, 
        mapping.context, 
        legacyState.data || {}
      );

      // Preserve important legacy data
      if (legacyState.currentField) {
        enhancedState.data.currentField = legacyState.currentField;
      }
      if (legacyState.permit) {
        enhancedState.data.permit = legacyState.permit;
      }
      if (legacyState.editData) {
        enhancedState.data.editData = legacyState.editData;
      }

      return enhancedState;
    }

    // Fallback: try to infer state from legacy status
    return this.inferEnhancedState(legacyState);
  }

  /**
   * Infer enhanced state from legacy state when no direct mapping exists
   */
  inferEnhancedState(legacyState) {
    const status = legacyState.status;

    // Renewal states
    if (status.includes('renewal')) {
      if (status.includes('field')) {
        return this.enhancedStateManager.createState('form', 'renewal_edit', legacyState.data);
      }
      return this.enhancedStateManager.createState('menu', 'renewal', legacyState.data);
    }

    // Menu states
    if (status.includes('menu')) {
      return this.enhancedStateManager.createState('menu', 'main', legacyState.data);
    }

    // Form states
    if (status === 'collecting' || status.includes('editing')) {
      return this.enhancedStateManager.createState('form', 'new_permit', legacyState.data);
    }

    // Confirmation states
    if (status === 'confirming') {
      return this.enhancedStateManager.createState('confirmation', 'permit_data', legacyState.data);
    }

    // Default fallback
    return this.enhancedStateManager.createState('menu', 'main');
  }

  /**
   * Handle enhanced routing result and convert back to legacy actions if needed
   */
  async handleEnhancedRoutingResult(from, routingResult, enhancedState) {
    switch (routingResult.type) {
      case 'renewal_field_selection':
        return {
          action: 'renewal_field_selection',
          fieldNumber: routingResult.fieldNumber,
          enhancedState
        };

      case 'menu_selection':
        return {
          action: 'menu_selection',
          option: routingResult.option,
          context: routingResult.context,
          enhancedState
        };

      case 'form_text_input':
        return {
          action: 'form_input',
          text: routingResult.text,
          context: routingResult.context,
          enhancedState
        };

      case 'global_command':
        return {
          action: 'global_command',
          command: routingResult.command,
          preserveState: routingResult.shouldPreserveState,
          enhancedState
        };

      case 'context_command':
        return {
          action: 'context_command',
          command: routingResult.command,
          context: routingResult.context,
          enhancedState
        };

      case 'invalid_input':
        return {
          action: 'invalid_input',
          message: this.inputRouter.getInvalidInputMessage(routingResult),
          enhancedState
        };

      default:
        return {
          action: 'fallback_to_legacy',
          enhancedState
        };
    }
  }

  /**
   * Sync enhanced state back to legacy state for backward compatibility
   */
  async syncEnhancedToLegacy(from, enhancedState) {
    try {
      // Convert enhanced state back to legacy format
      const legacyState = this.convertEnhancedToLegacy(enhancedState);
      
      // Save to legacy state manager
      await this.legacyStateManager.setState(from, legacyState);
      
      logger.info('Synced enhanced state to legacy', {
        from: from.substring(0, 6) + '****',
        legacyStatus: legacyState.status,
        enhancedType: enhancedState.type,
        enhancedContext: enhancedState.context
      });

    } catch (error) {
      logger.error('Failed to sync enhanced state to legacy', {
        error: error.message,
        from: from.substring(0, 6) + '****'
      });
    }
  }

  /**
   * Convert enhanced state back to legacy format
   */
  convertEnhancedToLegacy(enhancedState) {
    // Reverse mapping from enhanced to legacy
    const reverseMap = {
      'menu:main': 'showing_menu',
      'menu:renewal': 'renewal_selection', 
      'form:renewal_edit': 'renewal_field_input',
      'form:new_permit': 'collecting',
      'confirmation:permit_data': 'confirming',
      'status:managing': 'managing_applications'
    };

    const legacyStatus = reverseMap[enhancedState.stateKey] || 'showing_menu';

    return {
      status: legacyStatus,
      data: enhancedState.data,
      timestamp: enhancedState.timestamp,
      // Preserve important legacy fields
      currentField: enhancedState.data.currentField,
      permit: enhancedState.data.permit,
      editData: enhancedState.data.editData
    };
  }

  /**
   * Enable migration for a specific user (for testing)
   */
  enableMigrationForUser(phoneNumber) {
    this.newSystemUsers.add(phoneNumber);
    logger.info('Enabled enhanced state management for user', {
      user: phoneNumber.substring(0, 6) + '****'
    });
  }

  /**
   * Disable migration for a specific user (rollback)
   */
  disableMigrationForUser(phoneNumber) {
    this.newSystemUsers.delete(phoneNumber);
    logger.info('Disabled enhanced state management for user', {
      user: phoneNumber.substring(0, 6) + '****'
    });
  }
}

module.exports = StateMigrationAdapter;
/**
 * Input Router for WhatsApp Service
 * Handles context-aware input processing and disambiguation
 */

const { logger } = require('../../utils/logger');

class InputRouter {
  constructor(enhancedStateManager) {
    this.stateManager = enhancedStateManager;
    
    // Define priority commands that work in specific contexts
    this.PRIORITY_COMMANDS = {
      // Global commands (work everywhere)
      global: ['menu', 'menú', 'inicio', 'ayuda', 'help', 'soporte'],
      
      // Context-specific commands
      form: ['save', 'guardar', 'back', 'atras', 'cancel', 'cancelar'],
      renewal: ['renovar', 'renewal', 'renovación'],
      status: ['estado', 'status', 'mis-permisos']
    };

    // Define command aliases
    this.COMMAND_ALIASES = {
      'menú': 'menu',
      'inicio': 'menu',
      'help': 'ayuda',
      'soporte': 'ayuda',
      'atras': 'back',
      'cancelar': 'cancel',
      'guardar': 'save',
      'renewal': 'renovar',
      'renovación': 'renovar',
      'status': 'estado',
      'mis-permisos': 'estado'
    };
  }

  /**
   * Route input based on current state context
   */
  async routeInput(from, input, currentState) {
    try {
      const sanitizedInput = this.sanitizeInput(input);
      const normalizedInput = sanitizedInput.toLowerCase().trim();

      logger.info('Routing input with context', {
        from: from.substring(0, 6) + '****',
        input: sanitizedInput.length > 50 ? sanitizedInput.substring(0, 50) + '...' : sanitizedInput,
        stateType: currentState?.type || 'none',
        stateContext: currentState?.context || 'none',
        breadcrumb: currentState?.breadcrumb || 'none'
      });

      // Step 1: Check for global priority commands first
      const globalCommand = this.checkGlobalCommands(normalizedInput);
      if (globalCommand) {
        return {
          type: 'global_command',
          command: globalCommand,
          shouldPreserveState: globalCommand === 'ayuda'
        };
      }

      // Step 2: If no state, direct to main menu
      if (!currentState) {
        return {
          type: 'no_state',
          action: 'show_main_menu'
        };
      }

      // Step 3: Check for context-specific priority commands
      const contextCommand = this.checkContextCommands(normalizedInput, currentState);
      if (contextCommand) {
        return {
          type: 'context_command',
          command: contextCommand,
          context: currentState.context
        };
      }

      // Step 4: Validate input against expected inputs for current state
      if (!this.stateManager.isValidInput(currentState, sanitizedInput)) {
        return {
          type: 'invalid_input',
          expectedInputs: currentState.expectedInputs,
          stateDescription: this.stateManager.getStateDescription(currentState)
        };
      }

      // Step 5: Route to appropriate handler based on state
      return await this.routeByState(from, sanitizedInput, normalizedInput, currentState);

    } catch (error) {
      logger.error('Error in input routing', {
        error: error.message,
        from: from.substring(0, 6) + '****'
      });
      
      return {
        type: 'error',
        message: 'Error procesando tu mensaje. Escribe "menu" para volver al menú principal.'
      };
    }
  }

  /**
   * Check for global priority commands
   */
  checkGlobalCommands(normalizedInput) {
    // Normalize command aliases
    const command = this.COMMAND_ALIASES[normalizedInput] || normalizedInput;
    
    if (this.PRIORITY_COMMANDS.global.includes(command)) {
      return command;
    }
    
    return null;
  }

  /**
   * Check for context-specific commands
   */
  checkContextCommands(normalizedInput, currentState) {
    const command = this.COMMAND_ALIASES[normalizedInput] || normalizedInput;
    
    // Check form commands
    if (currentState.type === 'form' && this.PRIORITY_COMMANDS.form.includes(command)) {
      return command;
    }
    
    // Check renewal commands
    if ((currentState.context === 'renewal' || currentState.context === 'renewal_edit') && 
        this.PRIORITY_COMMANDS.renewal.includes(command)) {
      return command;
    }
    
    // Check status commands
    if (this.PRIORITY_COMMANDS.status.includes(command)) {
      return command;
    }
    
    return null;
  }

  /**
   * Route input based on current state type
   */
  async routeByState(from, sanitizedInput, normalizedInput, currentState) {
    switch (currentState.type) {
      case 'menu':
        return this.routeMenuInput(sanitizedInput, normalizedInput, currentState);
        
      case 'form':
        return this.routeFormInput(sanitizedInput, normalizedInput, currentState);
        
      case 'confirmation':
        return this.routeConfirmationInput(sanitizedInput, normalizedInput, currentState);
        
      case 'status':
        return this.routeStatusInput(sanitizedInput, normalizedInput, currentState);
        
      case 'help':
        return this.routeHelpInput(sanitizedInput, normalizedInput, currentState);
        
      case 'error':
        return this.routeErrorInput(sanitizedInput, normalizedInput, currentState);
        
      case 'notification':
        return this.routeNotificationInput(sanitizedInput, normalizedInput, currentState);
        
      default:
        return {
          type: 'unknown_state',
          action: 'show_main_menu'
        };
    }
  }

  /**
   * Route menu input with number disambiguation
   */
  routeMenuInput(sanitizedInput, normalizedInput, currentState) {
    // For menu states, numbers always mean menu options
    if (/^\d+$/.test(normalizedInput)) {
      const optionNumber = parseInt(normalizedInput);
      
      return {
        type: 'menu_selection',
        option: optionNumber,
        context: currentState.context,
        maxOptions: this.getMaxMenuOptions(currentState.context)
      };
    }

    // Handle text commands specific to menu context
    if (currentState.context === 'main') {
      const mainMenuCommands = {
        'nuevo': 1,
        'permiso': 1,
        'renovar': 2,
        'estado': 3,
        'privacidad': 4,
        'ayuda': 5
      };
      
      if (mainMenuCommands[normalizedInput]) {
        return {
          type: 'menu_selection',
          option: mainMenuCommands[normalizedInput],
          context: 'main'
        };
      }
    }

    return {
      type: 'unrecognized_menu_input',
      context: currentState.context
    };
  }

  /**
   * Route form input with context awareness
   */
  routeFormInput(sanitizedInput, normalizedInput, currentState) {
    // For renewal edit forms, numbers 1-9 mean field selection
    if (currentState.context === 'renewal_edit' && /^[1-9]$/.test(normalizedInput)) {
      return {
        type: 'renewal_field_selection',
        fieldNumber: parseInt(normalizedInput)
      };
    }

    // For other forms, treat as text input
    return {
      type: 'form_text_input',
      text: sanitizedInput,
      context: currentState.context,
      fieldInfo: currentState.data.currentField || null
    };
  }

  /**
   * Route confirmation input
   */
  routeConfirmationInput(sanitizedInput, normalizedInput, currentState) {
    // Numbers in confirmation context mean confirmation options
    if (/^\d+$/.test(normalizedInput)) {
      return {
        type: 'confirmation_option',
        option: parseInt(normalizedInput),
        context: currentState.context
      };
    }

    // Common confirmation commands
    const confirmationCommands = {
      'confirmar': 'confirm',
      'confirm': 'confirm',
      'si': 'confirm',
      'yes': 'confirm',
      'editar': 'edit',
      'edit': 'edit',
      'cambiar': 'edit',
      'no': 'cancel',
      'cancelar': 'cancel',
      'cancel': 'cancel'
    };

    if (confirmationCommands[normalizedInput]) {
      return {
        type: 'confirmation_command',
        command: confirmationCommands[normalizedInput],
        context: currentState.context
      };
    }

    return {
      type: 'unrecognized_confirmation_input',
      context: currentState.context
    };
  }

  /**
   * Route status input
   */
  routeStatusInput(sanitizedInput, normalizedInput, currentState) {
    if (/^\d+$/.test(normalizedInput)) {
      return {
        type: 'status_option',
        option: parseInt(normalizedInput),
        context: currentState.context
      };
    }

    return {
      type: 'status_command',
      command: normalizedInput,
      context: currentState.context
    };
  }

  /**
   * Route help input
   */
  routeHelpInput(sanitizedInput, normalizedInput, currentState) {
    const helpCommands = ['continue', 'continuar', 'back', 'atras', 'menu'];
    
    if (helpCommands.includes(normalizedInput)) {
      return {
        type: 'help_navigation',
        command: normalizedInput,
        helpType: currentState.context
      };
    }

    return {
      type: 'help_query',
      query: sanitizedInput,
      helpType: currentState.context
    };
  }

  /**
   * Route error input
   */
  routeErrorInput(sanitizedInput, normalizedInput, currentState) {
    return {
      type: 'error_recovery',
      input: sanitizedInput,
      errorContext: currentState.context
    };
  }

  /**
   * Route notification input
   */
  routeNotificationInput(sanitizedInput, normalizedInput, currentState) {
    return {
      type: 'notification_response',
      response: sanitizedInput,
      notificationType: currentState.context
    };
  }

  /**
   * Get maximum menu options for context
   */
  getMaxMenuOptions(context) {
    const maxOptions = {
      'main': 5,
      'privacy': 3,
      'renewal': 3,
      'quick_actions': 4,
      'draft': 3,
      'status': 4
    };
    
    return maxOptions[context] || 5;
  }

  /**
   * Sanitize input for processing
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove excessive whitespace and normalize
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Get user-friendly error message for invalid input
   */
  getInvalidInputMessage(routingResult) {
    const { expectedInputs, stateDescription } = routingResult;
    
    let message = `❌ **Entrada no válida**\n\n`;
    message += `📍 **Ubicación actual:** ${stateDescription}\n\n`;
    
    if (expectedInputs && expectedInputs.length > 0) {
      message += `**Opciones válidas:**\n`;
      
      // Format expected inputs nicely
      const numberedOptions = expectedInputs.filter(input => /^\d+$/.test(input));
      const textOptions = expectedInputs.filter(input => !/^\d+$/.test(input));
      
      if (numberedOptions.length > 0) {
        message += `• Números: ${numberedOptions.join(', ')}\n`;
      }
      
      if (textOptions.length > 0) {
        message += `• Comandos: ${textOptions.map(opt => `"${opt}"`).join(', ')}\n`;
      }
    }
    
    message += `\n💡 **Ayuda:** Escribe "ayuda" en cualquier momento\n`;
    message += `🏠 **Menú:** Escribe "menu" para volver al inicio`;
    
    return message;
  }
}

module.exports = InputRouter;
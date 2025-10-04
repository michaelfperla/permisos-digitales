/**
 * Navigation Manager for WhatsApp Bot
 * Handles navigation history, state preservation, and universal commands
 */

const { logger } = require('../../utils/logger');

class NavigationManager {
  constructor() {
    // Store navigation history per user
    this.userNavigationHistory = new Map();
    // Store preserved states per user
    this.preservedStates = new Map();
    // Maximum history entries per user
    this.maxHistorySize = 50;
    // Cleanup inactive users after 24 hours
    this.inactivityTimeout = 24 * 60 * 60 * 1000;
  }

  /**
   * Initialize navigation for a user
   */
  initializeUser(userId) {
    if (!this.userNavigationHistory.has(userId)) {
      this.userNavigationHistory.set(userId, {
        history: [],
        currentIndex: -1,
        lastActivity: Date.now()
      });
    }
    if (!this.preservedStates.has(userId)) {
      this.preservedStates.set(userId, new Map());
    }
  }

  /**
   * Push a new navigation entry
   */
  pushNavigation(userId, navigationEntry) {
    this.initializeUser(userId);
    
    const userNav = this.userNavigationHistory.get(userId);
    
    // If we're not at the end of history, remove forward entries
    if (userNav.currentIndex < userNav.history.length - 1) {
      userNav.history = userNav.history.slice(0, userNav.currentIndex + 1);
    }
    
    // Add new entry
    userNav.history.push({
      ...navigationEntry,
      timestamp: Date.now()
    });
    
    // Maintain max history size
    if (userNav.history.length > this.maxHistorySize) {
      userNav.history.shift();
    } else {
      userNav.currentIndex++;
    }
    
    userNav.lastActivity = Date.now();
    
    logger.info('Navigation pushed', {
      userId,
      state: navigationEntry.state,
      title: navigationEntry.title
    });
  }

  /**
   * Navigate back in history
   */
  navigateBack(userId) {
    const userNav = this.userNavigationHistory.get(userId);
    if (!userNav || userNav.currentIndex <= 0) {
      return null;
    }
    
    userNav.currentIndex--;
    userNav.lastActivity = Date.now();
    
    const entry = userNav.history[userNav.currentIndex];
    logger.info('Navigated back', { userId, to: entry.state });
    
    return entry;
  }

  /**
   * Navigate forward in history
   */
  navigateForward(userId) {
    const userNav = this.userNavigationHistory.get(userId);
    if (!userNav || userNav.currentIndex >= userNav.history.length - 1) {
      return null;
    }
    
    userNav.currentIndex++;
    userNav.lastActivity = Date.now();
    
    const entry = userNav.history[userNav.currentIndex];
    logger.info('Navigated forward', { userId, to: entry.state });
    
    return entry;
  }

  /**
   * Get current navigation entry
   */
  getCurrentNavigation(userId) {
    const userNav = this.userNavigationHistory.get(userId);
    if (!userNav || userNav.currentIndex < 0) {
      return null;
    }
    
    return userNav.history[userNav.currentIndex];
  }

  /**
   * Get navigation breadcrumbs
   */
  getBreadcrumbs(userId, maxItems = 3) {
    const userNav = this.userNavigationHistory.get(userId);
    if (!userNav || userNav.history.length === 0) {
      return [];
    }
    
    const startIndex = Math.max(0, userNav.currentIndex - maxItems + 1);
    const endIndex = userNav.currentIndex + 1;
    
    return userNav.history
      .slice(startIndex, endIndex)
      .map(entry => entry.title || entry.state);
  }

  /**
   * Preserve state data for a user
   */
  preserveState(userId, stateKey, data) {
    this.initializeUser(userId);
    
    const userStates = this.preservedStates.get(userId);
    userStates.set(stateKey, {
      data,
      timestamp: Date.now()
    });
    
    logger.debug('State preserved', { userId, stateKey });
  }

  /**
   * Retrieve preserved state
   */
  getPreservedState(userId, stateKey) {
    const userStates = this.preservedStates.get(userId);
    if (!userStates) {
      return null;
    }
    
    const preserved = userStates.get(stateKey);
    return preserved ? preserved.data : null;
  }

  /**
   * Clear preserved state
   */
  clearPreservedState(userId, stateKey = null) {
    const userStates = this.preservedStates.get(userId);
    if (!userStates) {
      return;
    }
    
    if (stateKey) {
      userStates.delete(stateKey);
    } else {
      userStates.clear();
    }
  }

  /**
   * Check if user can navigate back
   */
  canNavigateBack(userId) {
    const userNav = this.userNavigationHistory.get(userId);
    return userNav && userNav.currentIndex > 0;
  }

  /**
   * Check if user can navigate forward
   */
  canNavigateForward(userId) {
    const userNav = this.userNavigationHistory.get(userId);
    return userNav && userNav.currentIndex < userNav.history.length - 1;
  }

  /**
   * Clear navigation history for a user
   */
  clearHistory(userId) {
    this.userNavigationHistory.delete(userId);
    this.preservedStates.delete(userId);
    logger.info('Navigation history cleared', { userId });
  }

  /**
   * Navigate to home/main menu
   */
  navigateToHome(userId) {
    this.pushNavigation(userId, {
      state: 'MAIN_MENU',
      title: 'Menú Principal',
      data: {}
    });
    
    return {
      state: 'MAIN_MENU',
      title: 'Menú Principal',
      data: {}
    };
  }

  /**
   * Parse navigation commands from message
   */
  parseNavigationCommand(message) {
    const lowerMessage = message.toLowerCase().trim();
    
    // Navigation commands
    const navigationCommands = {
      'inicio': 'home',
      'home': 'home',
      'menu': 'menu',
      'menú': 'menu',
      'menu principal': 'menu',
      'atras': 'back',
      'atrás': 'back',
      'regresar': 'back',
      'volver': 'back',
      'back': 'back',
      'adelante': 'forward',
      'siguiente': 'forward',
      'forward': 'forward',
      'ayuda': 'help',
      'help': 'help',
      '?': 'help',
      'comandos': 'commands',
      'salir': 'exit',
      'exit': 'exit',
      'cancelar': 'cancel',
      'cancel': 'cancel',
      'estado': 'status',
      'status': 'status',
      'privacidad': 'privacy',
      'privacy': 'privacy',
      'politica de privacidad': 'privacy',
      'política de privacidad': 'privacy'
    };
    
    // Check for exact command match
    if (navigationCommands[lowerMessage]) {
      return {
        type: 'navigation',
        command: navigationCommands[lowerMessage]
      };
    }
    
    // Check for commands with prefixes
    const commandPrefixes = ['/', '!', '#'];
    for (const prefix of commandPrefixes) {
      if (lowerMessage.startsWith(prefix)) {
        const command = lowerMessage.substring(1);
        if (navigationCommands[command]) {
          return {
            type: 'navigation',
            command: navigationCommands[command]
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract and parse links from message
   */
  extractLinks(message) {
    const links = [];
    
    // Common URL patterns
    const urlPatterns = [
      // Full URLs with protocol
      /https?:\/\/[^\s<]+/gi,
      // URLs without protocol
      /(?:www\.)[^\s<]+/gi,
      // Domain-like patterns
      /[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s<]*)?/gi
    ];
    
    for (const pattern of urlPatterns) {
      const matches = message.match(pattern) || [];
      links.push(...matches);
    }
    
    // Remove duplicates and clean up
    const uniqueLinks = [...new Set(links)].map(link => {
      // Add protocol if missing
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return link.startsWith('www.') ? `https://${link}` : `https://${link}`;
      }
      return link;
    });
    
    return uniqueLinks;
  }

  /**
   * Format navigation context for display
   */
  formatNavigationContext(userId) {
    const breadcrumbs = this.getBreadcrumbs(userId);
    const canGoBack = this.canNavigateBack(userId);
    const canGoForward = this.canNavigateForward(userId);
    
    let context = '';
    
    // Add breadcrumbs
    if (breadcrumbs.length > 0) {
      context += `📍 ${breadcrumbs.join(' > ')}\n`;
    }
    
    // Add navigation hints
    const hints = [];
    if (canGoBack) hints.push('↩️ "atrás"');
    hints.push('🏠 "menu"');
    hints.push('❓ "ayuda"');
    
    if (hints.length > 0) {
      context += `\n💡 Comandos: ${hints.join(' | ')}`;
    }
    
    return context;
  }

  /**
   * Cleanup inactive users
   */
  cleanupInactiveUsers() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, userNav] of this.userNavigationHistory.entries()) {
      if (now - userNav.lastActivity > this.inactivityTimeout) {
        this.clearHistory(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('Cleaned up inactive navigation histories', { count: cleanedCount });
    }
  }

  /**
   * Get navigation statistics
   */
  getStats() {
    return {
      activeUsers: this.userNavigationHistory.size,
      preservedStates: this.preservedStates.size,
      totalHistoryEntries: Array.from(this.userNavigationHistory.values())
        .reduce((sum, nav) => sum + nav.history.length, 0)
    };
  }
}

// Create singleton instance
const navigationManager = new NavigationManager();

// Schedule periodic cleanup
setInterval(() => {
  navigationManager.cleanupInactiveUsers();
}, 60 * 60 * 1000); // Every hour

module.exports = navigationManager;
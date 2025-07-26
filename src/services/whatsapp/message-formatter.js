/**
 * Message Formatter for WhatsApp Service
 * Provides consistent formatting and styling for all WhatsApp messages
 */
class MessageFormatter {
  constructor() {
    this.EMOJIS = {
      SUCCESS: '✅',
      ERROR: '❌',
      WARNING: '⚠️',
      INFO: 'ℹ️',
      PROGRESS: '📋',
      MONEY: '💰',
      LINK: '🔗',
      PHONE: '📱',
      EMAIL: '📧',
      CAR: '🚗',
      DOCUMENT: '📄',
      CLOCK: '⏰',
      WELCOME: '👋',
      HELP: '📚',
      TOOLS: '🔧',
      SECURITY: '🔒',
      STAR: '⭐',
      FIRE: '🔥',
      PARTY: '🎉'
    };

    this.STYLES = {
      BOLD: '*',
      ITALIC: '_',
      STRIKETHROUGH: '~',
      MONOSPACE: '```'
    };
  }

  /**
   * Format success messages
   */
  success(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.SUCCESS;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format error messages
   */
  error(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.ERROR;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    const errorId = options.errorId ? `\n\n${this.italic(`ID: ${options.errorId}`)}` : '';
    
    return `${emoji} ${title}${message}${errorId}`;
  }

  /**
   * Format warning messages
   */
  warning(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.WARNING;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format info messages
   */
  info(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.INFO;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format progress messages
   */
  progress(current, total, message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.PROGRESS;
    const progressText = `(${current}/${total}) `;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${progressText}${message}`;
  }

  /**
   * Format welcome messages
   */
  welcome(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.WELCOME;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format help messages
   */
  help(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.HELP;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format payment-related messages
   */
  payment(amount, message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.MONEY;
    const amountText = amount ? `${this.bold(`$${amount} MXN`)}\n\n` : '';
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${amountText}${message}`;
  }

  /**
   * Format menu with numbered options
   */
  menu(title, options, instructions = null) {
    let message = `${this.bold(title)}\n\n`;
    
    options.forEach((option, index) => {
      const number = this.getNumberEmoji(index + 1);
      message += `${number} ${option}\n`;
    });
    
    if (instructions) {
      message += `\n${this.bold(instructions)}`;
    }
    
    return message;
  }

  /**
   * Format confirmation messages
   */
  confirmation(data, options = {}) {
    const title = options.title || 'Confirma tu información';
    let message = `${this.EMOJIS.DOCUMENT} ${this.bold(title)}\n\n`;
    
    Object.entries(data).forEach(([key, value]) => {
      const label = this.formatFieldLabel(key);
      message += `${this.bold(label)}: ${value}\n`;
    });
    
    if (options.instructions) {
      message += `\n${options.instructions}`;
    }
    
    return message;
  }

  /**
   * Format status update messages
   */
  status(statusType, message, options = {}) {
    const emojis = {
      pending: '⏳',
      processing: '⚙️',
      ready: '✅',
      expired: '❌',
      cancelled: '🚫'
    };
    
    const emoji = emojis[statusType] || this.EMOJIS.INFO;
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    return `${emoji} ${title}${message}`;
  }

  /**
   * Format contact information
   */
  contact(options = {}) {
    let message = `${this.EMOJIS.HELP} ${this.bold('Contacto y Soporte')}\n\n`;
    
    if (options.email) {
      message += `${this.EMOJIS.EMAIL} Email: ${options.email}\n`;
    }
    
    if (options.website) {
      message += `${this.EMOJIS.LINK} Web: ${options.website}\n`;
    }
    
    if (options.phone) {
      message += `${this.EMOJIS.PHONE} Teléfono: ${options.phone}\n`;
    }
    
    return message;
  }

  /**
   * Format text with bold styling
   */
  bold(text) {
    return `${this.STYLES.BOLD}${text}${this.STYLES.BOLD}`;
  }

  /**
   * Format text with italic styling
   */
  italic(text) {
    return `${this.STYLES.ITALIC}${text}${this.STYLES.ITALIC}`;
  }

  /**
   * Format text with strikethrough styling
   */
  strikethrough(text) {
    return `${this.STYLES.STRIKETHROUGH}${text}${this.STYLES.STRIKETHROUGH}`;
  }

  /**
   * Format text with monospace styling
   */
  code(text) {
    return `${this.STYLES.MONOSPACE}${text}${this.STYLES.MONOSPACE}`;
  }

  /**
   * Get numbered emoji for menu options
   */
  getNumberEmoji(number) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[number - 1] || `${number}️⃣`;
  }

  /**
   * Format field labels for display
   */
  formatFieldLabel(fieldKey) {
    const labels = {
      nombre_completo: 'Nombre completo',
      curp_rfc: 'CURP/RFC',
      domicilio: 'Domicilio',
      email: 'Email',
      marca: 'Marca',
      linea: 'Línea/Modelo',
      color: 'Color',
      numero_serie: 'Número de serie',
      numero_motor: 'Número de motor',
      ano_modelo: 'Año modelo'
    };
    
    return labels[fieldKey] || fieldKey;
  }

  /**
   * Format lists with bullet points
   */
  list(items, options = {}) {
    const bullet = options.bullet || '•';
    const title = options.title ? `${this.bold(options.title)}\n\n` : '';
    
    let message = title;
    items.forEach(item => {
      message += `${bullet} ${item}\n`;
    });
    
    return message.trim();
  }

  /**
   * Format separator line
   */
  separator(char = '─', length = 20) {
    return char.repeat(length);
  }

  /**
   * Format multi-section message
   */
  sections(sectionsData) {
    let message = '';
    
    sectionsData.forEach((section, index) => {
      if (index > 0) {
        message += '\n\n';
      }
      
      if (section.title) {
        message += `${this.bold(section.title)}\n\n`;
      }
      
      message += section.content;
    });
    
    return message;
  }

  /**
   * Format time-based messages
   */
  timeMessage(message, options = {}) {
    const emoji = options.emoji || this.EMOJIS.CLOCK;
    const timestamp = options.showTime ? `\n\n${this.italic(new Date().toLocaleString('es-MX'))}` : '';
    
    return `${emoji} ${message}${timestamp}`;
  }

  /**
   * Truncate long messages safely
   */
  truncate(message, maxLength = 4000, suffix = '...') {
    if (message.length <= maxLength) {
      return message;
    }
    
    return message.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Clean message from potentially problematic characters
   */
  sanitize(message) {
    // Remove or replace problematic characters that might break WhatsApp formatting
    return message
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .trim();
  }

  /**
   * Validate message format
   */
  validate(message) {
    const issues = [];
    
    if (!message || typeof message !== 'string') {
      issues.push('Message must be a non-empty string');
    }
    
    if (message && message.length > 4096) {
      issues.push('Message exceeds WhatsApp character limit (4096)');
    }
    
    // Check for unmatched formatting characters
    const boldCount = (message.match(/\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      issues.push('Unmatched bold formatting characters');
    }
    
    const italicCount = (message.match(/_/g) || []).length;
    if (italicCount % 2 !== 0) {
      issues.push('Unmatched italic formatting characters');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = MessageFormatter;
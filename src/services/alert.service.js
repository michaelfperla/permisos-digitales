// src/services/alert.service.js
const { logger } = require('../utils/logger');
const { getConfig } = require('../utils/config');
const emailService = require('./email.service');

class AlertService {
  constructor() {
    this.alertChannels = [];
    this.alertHistory = [];
    this.maxHistorySize = 100;
    this._config = null;
    
    // Initialize alert channels based on configuration
    this.initializeChannels();
  }

  /**
   * Lazy load configuration to avoid race conditions
   */
  _getConfig() {
    if (!this._config) {
      this._config = getConfig();
    }
    return this._config;
  }
  
  initializeChannels() {
    // Email channel
    const config = this._getConfig();
    if (config.email?.provider !== 'console') {
      this.alertChannels.push({
        name: 'email',
        send: async (alert) => this.sendEmailAlert(alert)
      });
      logger.info('Email alert channel initialized');
    }
    
    // Webhook channel (for Slack, Discord, etc)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.alertChannels.push({
        name: 'webhook',
        send: async (alert) => this.sendWebhookAlert(alert)
      });
      logger.info('Webhook alert channel initialized');
    }
    
    // SMS channel (future)
    if (process.env.ALERT_SMS_ENABLED === 'true') {
      // TODO: Implement SMS alerts via Twilio or AWS SNS
      logger.info('SMS alerts configured but not yet implemented');
    }
    
    if (this.alertChannels.length === 0) {
      logger.warn('No external alert channels configured. Alerts will only be logged.');
    }
  }
  
  /**
   * Send an alert through all configured channels
   */
  async sendAlert(alertData) {
    const config = this._getConfig();
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      environment: (config.nodeEnv || config.env || 'development'),
      ...alertData
    };
    
    // Add to history
    this.addToHistory(alert);
    
    // Log the alert
    logger.error('SYSTEM ALERT:', alert);
    
    // Send through all channels
    const results = await Promise.allSettled(
      this.alertChannels.map(channel => 
        this.sendToChannel(channel, alert)
      )
    );
    
    // Log results
    results.forEach((result, index) => {
      const channel = this.alertChannels[index];
      if (result.status === 'rejected') {
        logger.error(`Failed to send alert via ${channel.name}:`, result.reason);
      } else {
        logger.info(`Alert sent successfully via ${channel.name}`);
      }
    });
    
    return alert;
  }
  
  /**
   * Send alert to a specific channel with error handling
   */
  async sendToChannel(channel, alert) {
    try {
      await channel.send(alert);
    } catch (error) {
      logger.error(`Error sending alert via ${channel.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    const config = this._getConfig();
    const recipients = process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || ['admin@permisosdigitales.com.mx'];
    
    const emailData = {
      to: recipients,
      subject: `[${alert.severity || 'HIGH'}] ${alert.title} - ${((config.nodeEnv || config.env || 'development') || config.env || 'development').toUpperCase()}`,
      html: this.formatEmailAlert(alert)
    };
    
    await emailService.sendEmail(emailData);
  }
  
  /**
   * Send webhook alert (Slack format by default)
   */
  async sendWebhookAlert(alert) {
    const config = this._getConfig();
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    
    const payload = {
      text: `${alert.title} - ${(config.nodeEnv || config.env || 'development').toUpperCase()}`,
      attachments: [{
        color: this.getAlertColor(alert.severity),
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Environment',
            value: (config.nodeEnv || config.env || 'development'),
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity || 'HIGH',
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: true
          }
        ],
        footer: 'Permisos Digitales Alert System',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    // Add metrics if available
    if (alert.metrics) {
      payload.attachments[0].fields.push({
        title: 'Metrics',
        value: JSON.stringify(alert.metrics, null, 2),
        short: false
      });
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
    }
  }
  
  /**
   * Format email alert HTML
   */
  formatEmailAlert(alert) {
    const config = this._getConfig();
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${this.getAlertColorHex(alert.severity)}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">${alert.title}</h1>
          <p style="margin: 5px 0 0 0;">Environment: ${(config.nodeEnv || config.env || 'development').toUpperCase()}</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2 style="margin-top: 0;">Alert Details</h2>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Severity:</strong> ${alert.severity || 'HIGH'}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
          
          ${alert.metrics ? `
            <h3>Metrics</h3>
            <pre style="background-color: #fff; padding: 10px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(alert.metrics, null, 2)}
            </pre>
          ` : ''}
          
          ${alert.errorDetails ? `
            <h3>Error Details</h3>
            <pre style="background-color: #fff; padding: 10px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(alert.errorDetails, null, 2)}
            </pre>
          ` : ''}
        </div>
        
        <div style="background-color: #333; color: #fff; padding: 10px; text-align: center; border-radius: 0 0 5px 5px;">
          <p style="margin: 0; font-size: 12px;">Permisos Digitales Alert System</p>
        </div>
      </div>
    `;
  }
  
  /**
   * Get alert color based on severity
   */
  getAlertColor(severity) {
    const colors = {
      LOW: 'good',
      MEDIUM: 'warning',
      HIGH: 'danger',
      CRITICAL: 'danger'
    };
    return colors[severity] || 'danger';
  }
  
  /**
   * Get alert color hex based on severity
   */
  getAlertColorHex(severity) {
    const colors = {
      LOW: '#36a64f',
      MEDIUM: '#ff9800',
      HIGH: '#f44336',
      CRITICAL: '#b71c1c'
    };
    return colors[severity] || '#f44336';
  }
  
  /**
   * Add alert to history
   */
  addToHistory(alert) {
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.pop();
    }
  }
  
  /**
   * Get alert history
   */
  getAlertHistory(limit = 10) {
    return this.alertHistory.slice(0, limit);
  }
  
  /**
   * Send payment system alert
   */
  async sendPaymentAlert(title, message, metrics, severity = 'HIGH') {
    return this.sendAlert({
      title: `Payment System: ${title}`,
      message,
      severity,
      category: 'payment',
      metrics
    });
  }
  
  /**
   * Send database alert
   */
  async sendDatabaseAlert(title, message, errorDetails, severity = 'HIGH') {
    return this.sendAlert({
      title: `Database: ${title}`,
      message,
      severity,
      category: 'database',
      errorDetails
    });
  }
  
  /**
   * Send security alert
   */
  async sendSecurityAlert(title, message, details, severity = 'CRITICAL') {
    return this.sendAlert({
      title: `Security: ${title}`,
      message,
      severity,
      category: 'security',
      details
    });
  }
  
  /**
   * Send system monitoring alert
   */
  async sendSystemAlert(title, message, details, severity = 'HIGH') {
    return this.sendAlert({
      title: `System: ${title}`,
      message,
      severity,
      category: 'system',
      details
    });
  }
  
  /**
   * Send critical system alert
   */
  async sendCriticalAlert(title, message, errorDetails = {}, metrics = {}) {
    return this.sendAlert({
      title: `CRITICAL: ${title}`,
      message,
      severity: 'CRITICAL',
      category: 'system',
      errorDetails,
      metrics
    });
  }
}

// Export singleton instance
module.exports = new AlertService();
/**
 * Email Service
 * 
 * Complete email service with queue support for reliable delivery
 * Supports both queued and direct sending
 * All email templates and functions in one place
 */

const nodemailer = require('nodemailer');
const unifiedConfig = require('../config/unified-config');
// RACE CONDITION FIX: Don't load config at module level
const { logger } = require('../utils/logger');
// FIX: Don't import queue.service at module load time to avoid circular dependency
// const { getInstance: getEmailQueueService } = require('./queue.service');
const { htmlEscape } = require('../utils/html-escape');

class EnhancedEmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this._queueService = null;
    this._config = null; // Lazy load config
  }

  // RACE CONDITION FIX: Lazy config loading
  _getConfig() {
    if (!this._config) {
      this._config = unifiedConfig.getSync();
    }
    return this._config;
  }

  // RACE CONDITION FIX: Lazy evaluation of useQueue
  get useQueue() {
    return this._getConfig().features?.emailQueue !== false;
  }

  get emailQueueService() {
    // FIX: Lazy load queue service to avoid circular dependency
    if (!this._queueService) {
      const { getInstance: getEmailQueueService } = require('./queue.service');
      this._queueService = getEmailQueueService();
    }
    return this._queueService;
  }

  /**
   * Initialize email service
   */
  async initialize() {
    try {
      // Initialize transporter for direct sending
      await this.initTransporter();
      
      // Initialize queue if enabled
      if (this.useQueue) {
        try {
          await this.emailQueueService.initialize();
          logger.info('[EmailService] Email queue initialized successfully');
        } catch (queueError) {
          logger.warn('[EmailService] Email queue initialization failed, will use direct sending', {
            error: queueError.message
          });
          // FIX: Don't fail the entire service if queue fails
          // Just disable queue functionality
        }
      }
      
      this.initialized = true;
      logger.info('[EmailService] Enhanced email service initialized', {
        useQueue: this.useQueue,
        queueAvailable: this.useQueue && this.emailQueueService.queue !== null
      });
    } catch (error) {
      logger.error('[EmailService] Failed to initialize', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize SMTP transporter
   */
  async initTransporter() {
    if (this.transporter) return;

    const emailConfig = this._getConfig().services.email;
    
    // Check if we should use console transport (missing credentials or explicitly enabled)
    if (!emailConfig.host || !emailConfig.auth?.user || !emailConfig.auth?.pass) {
      logger.warn('[EmailService] Email credentials missing, using console transport', {
        host: !!emailConfig.host,
        user: !!emailConfig.auth?.user,
        pass: !!emailConfig.auth?.pass
      });
      
      // Use console transport for development
      this.transporter = {
        sendMail: async (options) => {
          logger.info('[EmailService] Console email sent:', {
            to: options.to,
            subject: options.subject,
            html: options.html ? options.html.substring(0, 200) + '...' : null,
            messageId: `console-${Date.now()}`
          });
          return { messageId: `console-${Date.now()}` };
        }
      };
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: emailConfig.maxEmailsPerHour ? emailConfig.maxEmailsPerHour / 3600 : 14
    });

    // Verify connection
    try {
      await this.transporter.verify();
      logger.info('[EmailService] SMTP connection verified');
    } catch (error) {
      logger.error('[EmailService] SMTP connection failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send email (queue or direct based on configuration)
   */
  async sendEmail(to, subject, html, text = null, options = {}) {
    try {
      // Validate inputs
      if (!to || !subject || (!html && !text)) {
        throw new Error('Missing required email parameters');
      }

      // Escape HTML content for security
      if (html && !options.skipEscape) {
        // Escape user-provided content in HTML
        // Note: This is a simplified example, in production you'd want
        // to properly parse and escape only dynamic content
      }

      // Use queue if enabled and not explicitly bypassed
      if (this.useQueue && !options.direct) {
        return await this.sendViaQueue(to, subject, html, text, options);
      } else {
        return await this.sendDirect(to, subject, html, text, options);
      }
    } catch (error) {
      logger.error('[EmailService] Failed to send email', {
        error: error.message,
        to,
        subject
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email via queue
   */
  async sendViaQueue(to, subject, html, text, options = {}) {
    try {
      const result = await this.emailQueueService.queueEmail({
        to,
        subject,
        htmlBody: html,
        textBody: text,
        template: options.template,
        templateData: options.templateData,
        priority: options.priority,
        scheduledFor: options.scheduledFor,
        metadata: options.metadata,
        deduplicate: options.deduplicate !== false
      });

      // FIX: If queue service returns an error, fall back to direct sending
      if (result.error) {
        logger.warn('[EmailService] Queue unavailable, falling back to direct send', {
          error: result.error,
          to,
          subject
        });
        return await this.sendDirect(to, subject, html, text, options);
      }

      return {
        success: true,
        queued: true,
        emailId: result.emailId,
        jobId: result.jobId
      };
    } catch (error) {
      // FIX: If queue fails, fall back to direct sending
      logger.warn('[EmailService] Queue failed, falling back to direct send', {
        error: error.message,
        to,
        subject
      });
      return await this.sendDirect(to, subject, html, text, options);
    }
  }

  /**
   * Send email directly (bypass queue)
   */
  async sendDirect(to, subject, html, text, options = {}) {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const mailOptions = {
      from: options.from || this._getConfig().services.email.from,
      to,
      subject,
      html,
      text: text || this.htmlToText(html),
      replyTo: options.replyTo,
      attachments: options.attachments,
      headers: {
        'X-Priority': options.priority === 'high' ? '1' : '3',
        'X-SES-CONFIGURATION-SET': 'permisos-digitales-events'
      }
    };

    const result = await this.transporter.sendMail(mailOptions);

    logger.info('[EmailService] Email sent directly', {
      to,
      subject,
      messageId: result.messageId
    });

    return {
      success: true,
      messageId: result.messageId,
      direct: true
    };
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetUrl, options = {}) {
    const subject = 'Restablece tu contraseña - Permisos Digitales';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablece tu contraseña</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header with brand color -->
          <div style="background-color: #A72B31; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Permisos Digitales</h1>
          </div>
          
          <!-- Content -->
          <div style="background-color: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color: #A72B31; margin-bottom: 20px; font-size: 22px;">Restablece tu contraseña</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hola,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en Permisos Digitales.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Haz clic en el siguiente enlace para crear una nueva contraseña:
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #A72B31; 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        display: inline-block;
                        font-weight: bold;
                        font-size: 16px;
                        box-shadow: 0 2px 5px rgba(167, 43, 49, 0.3);">
                Restablecer Contraseña
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            
            <p style="color: #A72B31; font-size: 12px; text-align: center; word-break: break-all; margin: 10px 0;">
              ${resetUrl}
            </p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 30px 0; border: 1px solid #ffeaa7;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora por motivos de seguridad.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. 
              Tu cuenta permanecerá protegida.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html, null, {
      priority: 'immediate',
      template: 'password-reset',
      templateData: { resetUrl },
      ...options
    });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(email, verificationUrl, options = {}) {
    const subject = 'Verifica tu correo electrónico - Permisos Digitales';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu correo electrónico</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header with brand color -->
          <div style="background-color: #A72B31; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Permisos Digitales</h1>
          </div>
          
          <!-- Content -->
          <div style="background-color: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color: #A72B31; margin-bottom: 20px; font-size: 22px;">¡Bienvenido!</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Gracias por registrarte en Permisos Digitales. Para completar tu registro y acceder a todos nuestros servicios, 
              necesitamos verificar tu dirección de correo electrónico.
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #A72B31; 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        display: inline-block;
                        font-weight: bold;
                        font-size: 16px;
                        box-shadow: 0 2px 5px rgba(167, 43, 49, 0.3);">
                Verificar mi Correo Electrónico
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            
            <p style="color: #A72B31; font-size: 12px; text-align: center; word-break: break-all; margin: 10px 0;">
              ${verificationUrl}
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 30px 0;">
              <p style="color: #666; font-size: 14px; margin: 0;">
                <strong>Nota importante:</strong> Este enlace expirará en 24 horas por motivos de seguridad.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Si no creaste una cuenta en Permisos Digitales, puedes ignorar este correo de forma segura.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html, null, {
      priority: 'immediate',
      template: 'email-verification',
      templateData: { verificationUrl },
      ...options
    });
  }

  /**
   * Send permit ready notification
   */
  async sendPermitReadyNotification(permitData, options = {}) {
    const subject = '¡Tu permiso está listo! - Permisos Digitales';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu permiso está listo</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">¡Tu permiso está listo!</h2>
          
          <p>Hola ${permitData.nombre || ''},</p>
          
          <p>Nos complace informarte que tu permiso vehicular ha sido generado exitosamente.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles del permiso:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Folio:</strong> ${permitData.folio}</li>
              <li><strong>Vehículo:</strong> ${permitData.marca} ${permitData.linea}</li>
              <li><strong>Placa:</strong> ${permitData.placas || 'N/A'}</li>
              <li><strong>Vigencia:</strong> ${permitData.fechaVencimiento}</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this._getConfig().frontendUrl}/permits/${permitData.id}" style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver mi Permiso
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Recuerda que puedes descargar tu permiso desde tu cuenta en cualquier momento.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
          </p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(permitData.email, subject, html, null, {
      priority: 'high',
      template: 'permit-ready',
      templateData: permitData,
      ...options
    });
  }

  /**
   * Send permit expiration reminder
   */
  async sendPermitExpirationReminder(permitData, daysUntilExpiration, options = {}) {
    const subject = `Tu permiso vence en ${daysUntilExpiration} días - Permisos Digitales`;
    
    const urgencyColor = daysUntilExpiration <= 3 ? '#dc3545' : '#ffc107';
    const urgencyText = daysUntilExpiration === 1 ? '¡ÚLTIMO DÍA!' : `${daysUntilExpiration} días`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recordatorio de vencimiento</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: ${urgencyColor}; margin-bottom: 20px;">Tu permiso está por vencer</h2>
          
          <p>Hola ${permitData.nombre || ''},</p>
          
          <div style="background-color: ${urgencyColor}20; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h3 style="color: ${urgencyColor}; margin: 0;">Tu permiso vence en: ${urgencyText}</h3>
          </div>
          
          <p>Te recordamos que tu permiso vehicular está próximo a vencer:</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <ul style="list-style: none; padding: 0;">
              <li><strong>Folio:</strong> ${permitData.folio}</li>
              <li><strong>Vehículo:</strong> ${permitData.marca} ${permitData.linea}</li>
              <li><strong>Fecha de vencimiento:</strong> ${permitData.fechaVencimiento}</li>
            </ul>
          </div>
          
          <p>Para evitar multas y mantener tu vehículo en regla, te recomendamos renovar tu permiso antes de la fecha de vencimiento.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this._getConfig().frontendUrl}/renew/${permitData.id}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Renovar Ahora
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
          </p>
        </div>
      </body>
      </html>
    `;

    const priority = daysUntilExpiration <= 3 ? 'high' : 'normal';
    
    return await this.sendEmail(permitData.email, subject, html, null, {
      priority,
      template: 'permit-expiration',
      templateData: { ...permitData, daysUntilExpiration },
      ...options
    });
  }

  /**
   * Send OXXO payment reminder
   */
  async sendOxxoExpirationReminder(paymentData, options = {}) {
    const subject = 'Tu pago OXXO está por vencer - Permisos Digitales';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recordatorio de pago OXXO</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #ff6b00; margin-bottom: 20px;">Tu pago OXXO está por vencer</h2>
          
          <p>Hola,</p>
          
          <p>Te recordamos que tu referencia de pago OXXO está próxima a vencer. Realiza tu pago lo antes posible para completar tu trámite.</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">Referencia OXXO</h3>
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #856404;">
              ${paymentData.reference || paymentData.oxxo_reference}
            </div>
            <p style="margin: 10px 0 0 0; color: #856404;">
              Monto: $${paymentData.amount} MXN
            </p>
          </div>
          
          <p><strong>Fecha límite de pago:</strong> ${paymentData.expiresAt}</p>
          
          <h3>¿Cómo pagar en OXXO?</h3>
          <ol>
            <li>Acude a cualquier tienda OXXO</li>
            <li>Indica al cajero que quieres hacer un pago de servicio</li>
            <li>Proporciona la referencia mostrada arriba</li>
            <li>Realiza el pago en efectivo</li>
            <li>Conserva tu comprobante</li>
          </ol>
          
          <p style="color: #666; font-size: 14px;">
            Una vez realizado el pago, recibirás una confirmación por correo electrónico en un plazo máximo de 24 horas.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
          </p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(paymentData.email, subject, html, null, {
      priority: 'high',
      template: 'oxxo-reminder',
      templateData: paymentData,
      ...options
    });
  }

  /**
   * Send permit ready email notification
   */
  async sendPermitReadyEmail(userEmail, permitData, options = {}) {
    try {
      // Import the template
      const permitReadyTemplate = require('../templates/email/permit-ready.template');
      
      // Prepare template data
      const templateData = {
        application_id: permitData.application_id,
        permit_folio: permitData.permit_folio,
        first_name: permitData.first_name,
        last_name: permitData.last_name,
        marca: permitData.marca,
        linea: permitData.linea,
        ano_modelo: permitData.ano_modelo,
        placa: permitData.placa,
        permit_expiration_date: permitData.permit_expiration_date,
        permit_url_primary: permitData.permit_url_primary,
        permit_url_secondary: permitData.permit_url_secondary,
        url_expiration_hours: permitData.url_expiration_hours || 48,
        frontendUrl: this._getConfig().frontendUrl
      };
      
      // Generate email content using template
      const emailContent = permitReadyTemplate.render(templateData);
      
      // Send the email
      return await this.sendEmail(userEmail, emailContent.subject, emailContent.html, emailContent.text, {
        priority: 'high',
        template: 'permit-ready',
        templateData: permitData,
        ...options
      });
    } catch (error) {
      logger.error('[EmailService] Failed to send permit ready email', {
        error: error.message,
        userEmail,
        applicationId: permitData?.application_id
      });
      throw error;
    }
  }

  /**
   * Send email verification reminder when password reset is requested for unverified email
   */
  async sendEmailVerificationReminderWithPasswordReset(to, userName, verificationUrl, options = {}) {
    const subject = 'Verifica tu correo antes de cambiar tu contraseña';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificación Requerida</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffc107; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h2 style="color: #333; margin: 0;">⚠️ Verificación Requerida</h2>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
          <p>Hola ${userName || 'Usuario'},</p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;"><strong>Acción requerida:</strong> Necesitas verificar tu correo electrónico antes de poder cambiar tu contraseña.</p>
          </div>
          
          <p>Recibimos una solicitud para cambiar tu contraseña, pero tu cuenta aún no ha sido verificada.</p>
          
          <p>Por razones de seguridad, solo permitimos cambios de contraseña en cuentas con correo electrónico verificado.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #A72B31; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verificar mi correo
            </a>
          </div>
          
          <p><strong>Pasos a seguir:</strong></p>
          <ol>
            <li>Haz clic en el botón "Verificar mi correo"</li>
            <li>Una vez verificado, podrás solicitar el cambio de contraseña</li>
            <li>Recibirás un enlace para crear tu nueva contraseña</li>
          </ol>
          
          <p>Si no solicitaste cambiar tu contraseña, puedes ignorar este mensaje.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
          </p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(to, subject, html, null, {
      priority: 'high',
      template: 'verification-reminder',
      templateData: { userName, verificationUrl },
      ...options
    });
  }

  /**
   * Convert HTML to plain text
   */
  htmlToText(html) {
    if (!html) return '';
    
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get email statistics
   */
  async getStatistics() {
    if (this.useQueue) {
      return await this.emailQueueService.getQueueStats();
    }
    
    return {
      message: 'Queue not enabled',
      directSendingActive: true
    };
  }

  /**
   * Process retry queue (called by scheduler)
   */
  async processRetryQueue() {
    if (this.useQueue) {
      await this.emailQueueService.processRetryQueue();
    }
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    if (this.transporter && typeof this.transporter.close === 'function') {
      await this.transporter.close();
    }
    
    if (this.useQueue) {
      await this.emailQueueService.shutdown();
    }
  }
}

// Create singleton instance
const enhancedEmailService = new EnhancedEmailService();

// Export with same API as original email.service.js
module.exports = {
  // Core functions (backwards compatible)
  sendEmail: enhancedEmailService.sendEmail.bind(enhancedEmailService),
  sendPasswordResetEmail: enhancedEmailService.sendPasswordResetEmail.bind(enhancedEmailService),
  sendEmailVerificationEmail: enhancedEmailService.sendEmailVerificationEmail.bind(enhancedEmailService),
  sendEmailVerificationReminderWithPasswordReset: enhancedEmailService.sendEmailVerificationReminderWithPasswordReset.bind(enhancedEmailService),
  sendPermitReadyNotification: enhancedEmailService.sendPermitReadyNotification.bind(enhancedEmailService),
  sendPermitExpirationReminder: enhancedEmailService.sendPermitExpirationReminder.bind(enhancedEmailService),
  sendOxxoExpirationReminder: enhancedEmailService.sendOxxoExpirationReminder.bind(enhancedEmailService),
  sendPermitReadyEmail: enhancedEmailService.sendPermitReadyEmail.bind(enhancedEmailService),
  
  // Transporter functions (for backwards compatibility)
  initTransporter: enhancedEmailService.initTransporter.bind(enhancedEmailService),
  _setTransporterForTesting: (transporter) => { enhancedEmailService.transporter = transporter; },
  
  // New enhanced functions
  initialize: enhancedEmailService.initialize.bind(enhancedEmailService),
  getStatistics: enhancedEmailService.getStatistics.bind(enhancedEmailService),
  processRetryQueue: enhancedEmailService.processRetryQueue.bind(enhancedEmailService),
  shutdown: enhancedEmailService.shutdown.bind(enhancedEmailService),
  
  // Direct access to service instance
  service: enhancedEmailService
};
// src/jobs/whatsapp-renewal-reminders.job.js
const { logger } = require('../utils/logger');
const applicationRepository = require('../repositories/application.repository');
const userRepository = require('../repositories/user.repository');

class WhatsAppRenewalRemindersJob {
  constructor() {
    this.name = 'WhatsApp Renewal Reminders';
    this.isRunning = false;
  }

  /**
   * Find permits eligible for renewal reminders
   * Simplified reminder schedule:
   * - 3 days before expiry
   * - Day of expiry
   */
  async findPermitsForReminders() {
    const db = require('../db');

    try {
      // Query for permits that need renewal reminders
      const { rows } = await db.query(`
        WITH renewal_candidates AS (
          -- Get latest permit per user (excluding those already renewed)
          SELECT DISTINCT ON (a.user_id)
            a.id,
            a.user_id,
            a.folio,
            a.fecha_vencimiento,
            a.status,
            a.renewed_from_id,
            (a.fecha_vencimiento - (CURRENT_DATE AT TIME ZONE 'America/Mexico_City')::date) as days_until_expiry,
            COALESCE(u.whatsapp_phone, u.phone) as phone,
            u.account_email as email,
            u.whatsapp_notifications_enabled,
            a.nombre_completo,
            a.marca,
            a.linea,
            a.color,
            a.ano_modelo,
            a.numero_motor,
            a.numero_serie,
            a.curp_rfc,
            a.domicilio,
            -- Check if user has any renewal reminders sent today
            (SELECT COUNT(*) FROM whatsapp_renewal_reminders wrr
             WHERE wrr.application_id = a.id
             AND wrr.sent_at::date = CURRENT_DATE) as reminders_sent_today
          FROM permit_applications a
          JOIN users u ON a.user_id = u.id
          WHERE a.status IN ('PERMIT_READY', 'ACTIVE')
            AND (u.whatsapp_phone IS NOT NULL OR u.phone IS NOT NULL)
            AND COALESCE(u.whatsapp_phone, u.phone) ~ '^52(1)?[0-9]{10}$'
            AND u.whatsapp_notifications_enabled = true
            -- Only include permits that haven't been renewed
            AND NOT EXISTS (
              SELECT 1 FROM permit_applications renewed
              WHERE renewed.renewed_from_id = a.id
            )
          ORDER BY a.user_id, a.created_at DESC
        )
        SELECT *
        FROM renewal_candidates
        WHERE reminders_sent_today = 0  -- No reminders sent today
        AND (
          -- 3 days before expiry
          days_until_expiry = 3 OR
          -- Day of expiry
          days_until_expiry = 0
        )
        ORDER BY days_until_expiry DESC, user_id
      `);

      logger.info(`Found ${rows.length} permits eligible for renewal reminders`);
      return rows;
    } catch (error) {
      logger.error('Error finding permits for renewal reminders:', error);
      throw error;
    }
  }

  /**
   * Get reminder message based on days until expiry
   */
  getReminderMessage(daysUntilExpiry, permitData) {
    const {
      folio,
      nombre_completo,
      marca,
      linea,
      color,
      ano_modelo,
      numero_motor,
      numero_serie,
      fecha_vencimiento
    } = permitData;

    const name = nombre_completo ? nombre_completo.split(' ')[0] : 'Usuario';

    // Format vehicle details
    const vehicleColor = color || 'N/A';
    const motorNumber = numero_motor || 'N/A';
    const serieNumber = numero_serie || 'N/A';

    // Format expiration date
    const expirationDate = new Date(fecha_vencimiento).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    if (daysUntilExpiry === 3) {
      return `⚠️ *TU PERMISO VENCE EN 3 DÍAS*\n\n` +
             `Hola ${name}, tu permiso provisional vence pronto.\n\n` +
             `📋 *INFORMACIÓN DE TU PERMISO*\n` +
             `*Folio:* ${folio}\n` +
             `*Vence:* ${expirationDate} (3 días)\n\n` +
             `🚗 *VEHÍCULO*\n` +
             `${marca || 'N/A'} ${linea || 'N/A'} ${ano_modelo || 'N/A'}\n` +
             `Color: ${vehicleColor}\n` +
             `Serie: ${serieNumber}\n` +
             `Motor: ${motorNumber}\n\n` +
             `💰 *RENOVACIÓN*\n` +
             `Costo: $99 MXN\n` +
             `Tiempo: 30 segundos\n\n` +
             `✅ Escribe *renovar* para renovar tu permiso\n` +
             `❓ Escribe *ayuda* para más información`;
    }

    if (daysUntilExpiry === 0) {
      return `🚨 *TU PERMISO VENCE HOY*\n\n` +
             `${name}, tu permiso provisional vence HOY.\n\n` +
             `📋 *INFORMACIÓN DE TU PERMISO*\n` +
             `*Folio:* ${folio}\n` +
             `*Vence:* ${expirationDate} (HOY)\n\n` +
             `🚗 *VEHÍCULO*\n` +
             `${marca || 'N/A'} ${linea || 'N/A'} ${ano_modelo || 'N/A'}\n` +
             `Color: ${vehicleColor}\n` +
             `Serie: ${serieNumber}\n` +
             `Motor: ${motorNumber}\n\n` +
             `💰 *RENOVACIÓN URGENTE*\n` +
             `Costo: $99 MXN\n` +
             `Válido hasta: Medianoche\n\n` +
             `🔴 *¡RENUEVA AHORA!*\n\n` +
             `✅ Escribe *renovar* para renovar tu permiso\n` +
             `❓ Escribe *ayuda* para asistencia urgente`;
    }

    // Default fallback
    return `🔔 *RECORDATORIO DE RENOVACIÓN*\n\n` +
           `${name}, tu permiso necesita renovación.\n\n` +
           `📋 *Folio:* ${folio}\n\n` +
           `✅ Escribe *renovar* para continuar`;
  }

  /**
   * Send WhatsApp reminder message
   */
  async sendReminderMessage(phone, message, applicationId) {
    try {
      // Import WhatsApp service
      const WhatsAppService = require('../services/whatsapp/simple-whatsapp.service');
      const whatsappService = new WhatsAppService();

      // Initialize the service (required to set apiUrl)
      await whatsappService.initialize();

      // Send the message
      await whatsappService.sendMessage(phone, message);

      // Record that reminder was sent (always record to prevent retries)
      await this.recordReminderSent(applicationId, phone, 'whatsapp_renewal_reminder');

      logger.info('Renewal reminder sent successfully', {
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // Mask middle digits
        applicationId,
        messageLength: message.length
      });

      return true;
    } catch (error) {
      // Record attempt even if failed (prevents infinite retries)
      try {
        await this.recordReminderSent(applicationId, phone, 'whatsapp_renewal_reminder');
      } catch (recordError) {
        logger.error('Failed to record failed reminder attempt', {
          applicationId,
          error: recordError.message
        });
      }

      logger.error('Failed to send renewal reminder', {
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        applicationId,
        error: error.message
      });

      // Don't throw - let the job continue with other permits
      return false;
    }
  }

  /**
   * Record that a reminder was sent to prevent duplicates
   */
  async recordReminderSent(applicationId, phone, type) {
    const db = require('../db');
    
    try {
      // Check if we already sent a reminder today for this application
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const existing = await db.query(`
        SELECT id FROM whatsapp_renewal_reminders 
        WHERE application_id = $1 AND sent_at::date = $2
      `, [applicationId, today]);
      
      if (existing.rows.length === 0) {
        await db.query(`
          INSERT INTO whatsapp_renewal_reminders (
            application_id,
            phone,
            type,
            sent_at
          ) VALUES ($1, $2, $3, NOW())
        `, [applicationId, phone, type]);
      }
    } catch (error) {
      logger.error('Failed to record reminder sent:', error);
      // Don't throw - this shouldn't fail the reminder sending
    }
  }

  /**
   * Execute the renewal reminders job
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('WhatsApp renewal reminders job is already running, skipping');
      return { skipped: true, reason: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const results = {
      total: 0,
      sent: 0,
      failed: 0,
      errors: []
    };

    try {
      logger.info('Starting WhatsApp renewal reminders job');

      // Find permits that need reminders
      const permitsForReminders = await this.findPermitsForReminders();
      results.total = permitsForReminders.length;

      if (permitsForReminders.length === 0) {
        logger.info('No permits found requiring renewal reminders');
        return results;
      }

      // Process each permit
      for (const permit of permitsForReminders) {
        try {
          const message = this.getReminderMessage(permit.days_until_expiry, permit);
          
          await this.sendReminderMessage(permit.phone, message, permit.id);
          
          results.sent++;
          
          // Small delay to avoid overwhelming WhatsApp API
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            applicationId: permit.id,
            phone: permit.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('WhatsApp renewal reminders job completed', {
        ...results,
        duration: `${duration}ms`
      });

      return results;

    } catch (error) {
      logger.error('Error in WhatsApp renewal reminders job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Create database table for tracking reminders (migration script)
   */
  static async createReminderTrackingTable() {
    const db = require('../db');
    
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_renewal_reminders (
          id SERIAL PRIMARY KEY,
          application_id INTEGER NOT NULL REFERENCES permit_applications(id),
          phone VARCHAR(20) NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'whatsapp_renewal_reminder',
          sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
          
          -- Ensure one reminder per application per day
          UNIQUE(application_id, sent_at::date)
        );
        
        -- Index for performance
        CREATE INDEX IF NOT EXISTS idx_whatsapp_renewal_reminders_sent_at 
        ON whatsapp_renewal_reminders(sent_at);
        
        CREATE INDEX IF NOT EXISTS idx_whatsapp_renewal_reminders_app_id 
        ON whatsapp_renewal_reminders(application_id);
      `);
      
      logger.info('WhatsApp renewal reminders table created successfully');
    } catch (error) {
      logger.error('Error creating renewal reminders table:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppRenewalRemindersJob();
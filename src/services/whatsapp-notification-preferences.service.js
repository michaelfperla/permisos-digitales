// src/services/whatsapp-notification-preferences.service.js
const { logger } = require('../utils/logger');
const db = require('../db');

class WhatsAppNotificationPreferencesService {
  /**
   * Enable WhatsApp notifications for a user
   */
  async enableNotifications(userId, phone) {
    try {
      await db.query(`
        UPDATE users 
        SET whatsapp_notifications_enabled = true,
            phone = $2,
            updated_at = NOW()
        WHERE id = $1
      `, [userId, phone]);
      
      logger.info('WhatsApp notifications enabled for user', { userId, phone: this.maskPhone(phone) });
      return true;
    } catch (error) {
      logger.error('Error enabling WhatsApp notifications:', error);
      throw error;
    }
  }

  /**
   * Disable WhatsApp notifications for a user
   */
  async disableNotifications(userId) {
    try {
      await db.query(`
        UPDATE users 
        SET whatsapp_notifications_enabled = false,
            updated_at = NOW()
        WHERE id = $1
      `, [userId]);
      
      logger.info('WhatsApp notifications disabled for user', { userId });
      return true;
    } catch (error) {
      logger.error('Error disabling WhatsApp notifications:', error);
      throw error;
    }
  }

  /**
   * Disable WhatsApp notifications by phone number (for opt-out)
   */
  async disableNotificationsByPhone(phone) {
    try {
      const { rows } = await db.query(`
        UPDATE users 
        SET whatsapp_notifications_enabled = false,
            updated_at = NOW()
        WHERE phone = $1
        RETURNING id, nombre_completo
      `, [phone]);
      
      if (rows.length > 0) {
        logger.info('WhatsApp notifications disabled by phone', { 
          userId: rows[0].id, 
          phone: this.maskPhone(phone) 
        });
        return rows[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Error disabling WhatsApp notifications by phone:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId) {
    try {
      const { rows } = await db.query(`
        SELECT 
          id,
          phone,
          whatsapp_notifications_enabled,
          email_notifications_enabled,
          created_at,
          updated_at
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      return rows[0] || null;
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences by phone
   */
  async getNotificationPreferencesByPhone(phone) {
    try {
      const { rows } = await db.query(`
        SELECT 
          id,
          phone,
          whatsapp_notifications_enabled,
          email_notifications_enabled,
          nombre_completo
        FROM users 
        WHERE phone = $1
      `, [phone]);
      
      return rows[0] || null;
    } catch (error) {
      logger.error('Error getting notification preferences by phone:', error);
      throw error;
    }
  }

  /**
   * Auto-enable notifications when user interacts with WhatsApp bot
   */
  async autoEnableOnInteraction(phone) {
    try {
      const { rows } = await db.query(`
        UPDATE users 
        SET whatsapp_notifications_enabled = true,
            updated_at = NOW()
        WHERE phone = $1
        AND whatsapp_notifications_enabled = false
        RETURNING id, nombre_completo
      `, [phone]);
      
      if (rows.length > 0) {
        logger.info('WhatsApp notifications auto-enabled on interaction', { 
          userId: rows[0].id, 
          phone: this.maskPhone(phone) 
        });
        return rows[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Error auto-enabling WhatsApp notifications:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId, preferences) {
    const { whatsappEnabled, emailEnabled, phone } = preferences;
    
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;
      
      if (typeof whatsappEnabled === 'boolean') {
        setClauses.push(`whatsapp_notifications_enabled = $${paramIndex++}`);
        values.push(whatsappEnabled);
      }
      
      if (typeof emailEnabled === 'boolean') {
        setClauses.push(`email_notifications_enabled = $${paramIndex++}`);
        values.push(emailEnabled);
      }
      
      if (phone) {
        setClauses.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      
      setClauses.push(`updated_at = NOW()`);
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, phone, whatsapp_notifications_enabled, email_notifications_enabled
      `;
      
      const { rows } = await db.query(query, values);
      
      logger.info('User notification preferences updated', { 
        userId, 
        preferences: { whatsappEnabled, emailEnabled },
        phone: phone ? this.maskPhone(phone) : undefined
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get users who should receive renewal reminders
   */
  async getUsersForRenewalReminders() {
    try {
      const { rows } = await db.query(`
        SELECT DISTINCT 
          u.id,
          u.phone,
          u.nombre_completo,
          u.whatsapp_notifications_enabled,
          COUNT(a.id) as active_permits
        FROM users u
        JOIN applications a ON u.id = a.user_id
        WHERE u.whatsapp_notifications_enabled = true
          AND u.phone IS NOT NULL
          AND a.status IN ('PERMIT_READY', 'ACTIVE')
          AND a.fecha_vencimiento >= CURRENT_DATE - INTERVAL '30 days'
          AND a.fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days'
        GROUP BY u.id, u.phone, u.nombre_completo, u.whatsapp_notifications_enabled
        ORDER BY u.id
      `);
      
      logger.info(`Found ${rows.length} users eligible for renewal reminders`);
      return rows;
    } catch (error) {
      logger.error('Error getting users for renewal reminders:', error);
      throw error;
    }
  }

  /**
   * Record opt-out request
   */
  async recordOptOut(phone, reason = 'user_request') {
    try {
      // First disable notifications
      await this.disableNotificationsByPhone(phone);
      
      // Record the opt-out for compliance
      await db.query(`
        INSERT INTO whatsapp_opt_outs (
          phone,
          reason,
          opted_out_at
        ) VALUES ($1, $2, NOW())
        ON CONFLICT (phone) 
        DO UPDATE SET 
          reason = $2,
          opted_out_at = NOW()
      `, [phone, reason]);
      
      logger.info('WhatsApp opt-out recorded', { 
        phone: this.maskPhone(phone), 
        reason 
      });
      
      return true;
    } catch (error) {
      logger.error('Error recording opt-out:', error);
      throw error;
    }
  }

  /**
   * Check if a phone number has opted out
   */
  async hasOptedOut(phone) {
    try {
      const { rows } = await db.query(`
        SELECT opted_out_at, reason
        FROM whatsapp_opt_outs
        WHERE phone = $1
      `, [phone]);
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error checking opt-out status:', error);
      throw error;
    }
  }

  /**
   * Mask phone number for logging (privacy)
   */
  maskPhone(phone) {
    if (!phone || phone.length < 10) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * Create required database tables
   */
  static async createTables() {
    try {
      // Create opt-outs tracking table
      await db.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_opt_outs (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(20) NOT NULL UNIQUE,
          reason VARCHAR(100) NOT NULL DEFAULT 'user_request',
          opted_out_at TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_outs_phone 
        ON whatsapp_opt_outs(phone);
      `);
      
      // Add notification columns to users table if they don't exist
      await db.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
      `);
      
      logger.info('WhatsApp notification preferences tables created/updated successfully');
    } catch (error) {
      logger.error('Error creating notification preferences tables:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppNotificationPreferencesService();
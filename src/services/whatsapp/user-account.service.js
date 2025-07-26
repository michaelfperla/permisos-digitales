/**
 * User Account Service for WhatsApp
 * Creates pre-verified accounts for WhatsApp users
 */

const userService = require('../user.service');
const userRepository = require('../../repositories/user.repository');
const { logger } = require('../../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Validate and format Mexican WhatsApp phone number
 * @param {string} phone - Phone number to validate
 * @returns {string} Formatted phone number
 * @throws {Error} If phone number is invalid
 */
function validateWhatsAppPhone(phone) {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  // Remove all non-numeric characters
  const cleaned = phone.toString().replace(/[^\d]/g, '');
  
  // Check if it's a valid Mexican WhatsApp number
  // Should be 52 or 521 followed by 10 digits
  if (!/^521?\d{10}$/.test(cleaned)) {
    throw new Error('Invalid WhatsApp phone format. Expected: 52XXXXXXXXXX');
  }
  
  return cleaned;
}

class UserAccountService {
  /**
   * Create or find user account for WhatsApp user
   * WhatsApp users are pre-verified since they're authenticated via phone
   */
  async createOrFindUser(phoneNumber, email, fullName) {
    try {
      // Validate phone number first
      const validatedPhone = validateWhatsAppPhone(phoneNumber);
      
      // First check if user exists by email
      let user = await userRepository.findByEmail(email);
      
      if (user) {
        // Update WhatsApp phone if not set
        if (!user.whatsapp_phone) {
          await userRepository.update(user.id, { whatsapp_phone: validatedPhone });
        }
        logger.info('Existing user found for WhatsApp', { userId: user.id, email });
        return user;
      }
      
      // Check if user exists by phone
      user = await this.findByWhatsAppPhone(validatedPhone);
      
      if (user) {
        // Update email if it was placeholder
        if (user.email.includes('@permisos.mx')) {
          await userRepository.update(user.id, { email });
        }
        logger.info('Existing user found by phone', { userId: user.id, phoneNumber: validatedPhone });
        return user;
      }
      
      // Create new user
      const names = fullName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Usuario';
      
      // Generate secure random password
      const temporaryPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      
      const newUser = await userRepository.create({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password_hash: passwordHash,
        whatsapp_phone: validatedPhone,
        is_verified: true, // Pre-verified via WhatsApp
        verified_at: new Date(),
        source: 'whatsapp'
      });
      
      logger.info('New WhatsApp user created', { 
        userId: newUser.id, 
        email,
        phoneNumber 
      });
      
      // Send welcome email (not confirmation)
      await this.sendWelcomeEmail(newUser, temporaryPassword);
      
      return newUser;
      
    } catch (error) {
      logger.error('Error creating WhatsApp user', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Send welcome email with account access info
   */
  async sendWelcomeEmail(user, temporaryPassword) {
    try {
      const emailService = require('../email.service');
      
      const emailContent = `
        <h2>¡Bienvenido a Permisos Digitales!</h2>
        
        <p>Hola ${user.first_name},</p>
        
        <p>Tu cuenta ha sido creada exitosamente a través de WhatsApp.</p>
        
        <h3>Acceso a tu cuenta en línea:</h3>
        <p>Puedes acceder a tu cuenta en <a href="https://permisosdigitales.com.mx">permisosdigitales.com.mx</a> con:</p>
        
        <ul>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Contraseña temporal:</strong> ${temporaryPassword}</li>
        </ul>
        
        <p><strong>Por seguridad, te recomendamos cambiar tu contraseña al iniciar sesión.</strong></p>
        
        <h3>Beneficios de tu cuenta:</h3>
        <ul>
          <li>Ver historial de permisos</li>
          <li>Descargar permisos anteriores</li>
          <li>Renovar permisos fácilmente</li>
          <li>Gestionar múltiples vehículos</li>
        </ul>
        
        <p>También puedes seguir usando WhatsApp para tramitar tus permisos.</p>
        
        <p>¿Necesitas ayuda? Contáctanos por WhatsApp o en soporte@permisosdigitales.com.mx</p>
        
        <p>Saludos,<br>
        El equipo de Permisos Digitales</p>
      `;
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Bienvenido a Permisos Digitales - Acceso a tu cuenta',
        html: emailContent,
        text: emailContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });
      
      logger.info('Welcome email sent to WhatsApp user', { userId: user.id, email: user.email });
      
    } catch (error) {
      // Don't fail user creation if email fails
      logger.error('Error sending welcome email', { error: error.message });
    }
  }
  
  /**
   * Find user by WhatsApp phone
   */
  async findByWhatsAppPhone(phoneNumber) {
    const db = require('../../db');
    
    const query = `
      SELECT * FROM users 
      WHERE whatsapp_phone = $1 
         OR phone = $1 
      LIMIT 1
    `;
    
    const result = await db.query(query, [phoneNumber]);
    return result.rows[0];
  }
  
  /**
   * Generate password reset link for WhatsApp user
   */
  async generatePasswordResetLink(user) {
    const passwordResetService = require('../password-reset.service');
    
    try {
      const resetToken = await passwordResetService.createResetToken(user.email);
      const resetLink = `https://permisosdigitales.com.mx/reset-password?token=${resetToken}`;
      
      return resetLink;
    } catch (error) {
      logger.error('Error generating password reset link', { error: error.message });
      return null;
    }
  }
}

module.exports = new UserAccountService();
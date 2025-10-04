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
   * Email is now optional and used only for delivery
   */
  async createOrFindUser(phoneNumber, email, fullName) {
    try {
      // Validate phone number first
      const validatedPhone = validateWhatsAppPhone(phoneNumber);
      
      // SECURITY: First check if user exists by WhatsApp phone
      // This is the primary identifier now
      let user = await this.findByWhatsAppPhone(validatedPhone);
      
      if (user) {
        // Existing WhatsApp user found
        logger.info('Existing WhatsApp user found', { userId: user.id, phoneNumber: validatedPhone });
        
        // If email provided and user doesn't have account email, offer to set it
        if (email && email.trim() !== '' && !user.account_email) {
          // Don't check for uniqueness - email is just for delivery now
          // We'll handle account email after successful payment
          logger.info('WhatsApp user provided email for delivery', { 
            userId: user.id, 
            deliveryEmail: email 
          });
        }
        
        return user;
      }
      
      // NEW USER: Create account with WhatsApp phone as primary identifier
      // Email is completely optional now
      
      // Create new user
      const names = fullName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Usuario';
      
      // Generate strong but user-friendly password (for portal access later)
      const words = ['Solar', 'Luna', 'Cielo', 'Mar', 'Monte', 'Rio', 'Viento', 'Fuego', 'Tierra', 'Agua'];
      const word1 = words[Math.floor(Math.random() * words.length)];
      const word2 = words[Math.floor(Math.random() * words.length)];
      const num1 = Math.floor(Math.random() * 900) + 100; // 3-digit number
      const num2 = Math.floor(Math.random() * 900) + 100; // 3-digit number
      const temporaryPassword = `${word1}-${num1}-${word2}-${num2}`;
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      
      const newUser = await userRepository.create({
        first_name: firstName,
        last_name: lastName,
        whatsapp_phone: validatedPhone, // Primary identifier
        account_email: null, // Will be set after payment if desired
        password_hash: passwordHash,
        is_verified: true, // Pre-verified via WhatsApp
        verified_at: new Date(),
        source: 'whatsapp'
      });
      
      logger.info('New WhatsApp user created', { 
        userId: newUser.id, 
        phoneNumber: validatedPhone,
        deliveryEmail: email || 'none'
      });
      
      // Store temporary password for later use
      newUser.temporaryPassword = temporaryPassword;
      
      // Store password in Redis cache for retrieval during payment processing
      try {
        const passwordCache = require('./password-cache.service');
        const cacheSuccess = await passwordCache.storeTemporaryPassword(newUser.id, temporaryPassword);
        
        if (cacheSuccess) {
          logger.info('Temporary password cached successfully', {
            userId: newUser.id,
            phoneNumber: validatedPhone
          });
        } else {
          logger.warn('Failed to cache temporary password - will fallback to generating new one at payment', {
            userId: newUser.id,
            phoneNumber: validatedPhone
          });
        }
      } catch (cacheError) {
        logger.error('Error caching temporary password', {
          error: cacheError.message,
          userId: newUser.id,
          phoneNumber: validatedPhone
        });
        // Don't fail user creation if cache fails - system will fallback
      }
      
      return newUser;
      
    } catch (error) {
      logger.error('Error creating WhatsApp user', { error: error.message });
      throw error;
    }
  }

  /**
   * Set account email after successful payment (optional)
   */
  async setAccountEmailAfterPayment(userId, email) {
    try {
      if (!email || email.trim() === '') {
        return; // No email provided, skip
      }

      // Check if user already has account email
      const user = await userRepository.findById(userId);
      if (user.account_email) {
        logger.info('User already has account email', { userId });
        return; // Already has account email
      }

      // Set the account email (no uniqueness check - portal will handle conflicts)
      await userRepository.update(userId, { 
        account_email: email 
      });

      logger.info('Account email set after payment', { userId, email });
      
      // Send portal access email
      await this.sendPortalAccessEmail(user, email);
      
    } catch (error) {
      logger.error('Error setting account email after payment', { 
        error: error.message, 
        userId, 
        email 
      });
      // Don't throw - this is optional
    }
  }

  /**
   * Send portal access email with login credentials
   */
  async sendPortalAccessEmail(user, email) {
    try {
      const emailService = require('../email.service');
      
      const emailContent = `
        <h2>🔐 Acceso al Portal Web</h2>
        
        <p>Hola ${user.first_name},</p>
        
        <p>Ya puedes acceder a tu cuenta en línea para gestionar tus permisos.</p>
        
        <h3>📱 Datos de acceso:</h3>
        <p><strong>Sitio:</strong> <a href="https://permisosdigitales.com.mx">permisosdigitales.com.mx</a></p>
        <ul>
          <li><strong>📧 Usuario:</strong> ${email}</li>
          <li><strong>📱 O con WhatsApp:</strong> ${user.whatsapp_phone}</li>
          <li><strong>🔑 Contraseña temporal:</strong> ${user.temporaryPassword}</li>
        </ul>
        
        <p><strong>⚠️ Importante:</strong> Cambia tu contraseña al iniciar sesión por primera vez.</p>
        
        <h3>✨ Beneficios de tu cuenta:</h3>
        <ul>
          <li>Ver historial de todos tus permisos</li>
          <li>Descargar permisos anteriores</li>
          <li>Renovar permisos con un clic</li>
          <li>Gestionar múltiples vehículos</li>
        </ul>
        
        <p>También puedes seguir usando WhatsApp para tramitar nuevos permisos.</p>
        
        <p>¿Necesitas ayuda? Contáctanos por WhatsApp o en soporte@permisosdigitales.com.mx</p>
        
        <p>Saludos,<br>
        El equipo de Permisos Digitales</p>
      `;
      
      await emailService.sendEmail({
        to: email,
        subject: '🔐 Acceso a tu Portal - Permisos Digitales',
        html: emailContent,
        text: emailContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });
      
      logger.info('Portal access email sent', { userId: user.id, email });
      
    } catch (error) {
      logger.error('Error sending portal access email', { error: error.message });
      // Don't fail the payment process for email issues
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
    return await userRepository.findByWhatsAppPhone(phoneNumber);
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
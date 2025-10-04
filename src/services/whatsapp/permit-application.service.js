/**
 * Permit Application Service for WhatsApp
 * Connects WhatsApp data to existing PD application flow
 */

const applicationRepository = require('../../repositories/application.repository');
const userService = require('../user.service');
const { logger } = require('../../utils/logger');

class PermitApplicationService {
  /**
   * Create application from WhatsApp data (with optional email)
   */
  async createFromWhatsApp(phoneNumber, formData, existingUserId = null) {
    try {
      // Normalize phone number to ensure consistency
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      let user;
      
      if (existingUserId) {
        // Use existing user (for returning users)
        const userRepository = require('../../repositories/user.repository');
        user = await userRepository.findById(existingUserId);
        
        if (!user) {
          throw new Error('Usuario no encontrado');
        }
        
        logger.info('Using existing user for WhatsApp application', { 
          userId: existingUserId, 
          phoneNumber: normalizedPhone 
        });
      } else {
        // Create or find user (email is now optional)
        const userAccountService = require('./user-account.service');
        user = await userAccountService.createOrFindUser(
          normalizedPhone,
          formData.email || null,  // Email is optional
          formData.nombre_completo
        );
      }
      
      // Create application with delivery email
      const application = await applicationRepository.create({
        user_id: user.id,
        status: 'AWAITING_PAYMENT',
        nombre_completo: formData.nombre_completo,
        curp_rfc: formData.curp_rfc,
        domicilio: formData.domicilio,
        marca: formData.marca,
        linea: formData.linea,
        color: formData.color,
        numero_serie: formData.numero_serie,
        numero_motor: formData.numero_motor,
        ano_modelo: formData.ano_modelo,
        delivery_email: formData.email || null, // Store delivery email per permit
        importe: 99.00,
        source: 'whatsapp',
        source_metadata: { phone_number: phoneNumber }
      });
      
      logger.info('Application created from WhatsApp', {
        applicationId: application.id,
        userId: user.id,
        phoneNumber,
        normalizedPhone,
        userPhone: user.whatsapp_phone
      });
      
      // Create Stripe payment link with both payment methods (use normalized phone)
      const paymentLink = await this.createPaymentLink(application, normalizedPhone);
      
      return {
        success: true,
        applicationId: application.id,
        paymentLink: paymentLink.url
      };
      
    } catch (error) {
      logger.error('Error creating WhatsApp application', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Create Stripe payment link with both payment methods
   */
  async createPaymentLink(application, phoneNumber) {
    const baseUrl = process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx';
    
    // Use our new payment link service
    const stripeLinkService = require('./stripe-payment-link.service');
    
    // Option 1: Use Payment Link (simpler, less control)
    /*
    const paymentLink = await stripeLinkService.createPaymentLink({
      amount: application.importe,
      currency: 'MXN',
      description: `Permiso Digital - ${application.marca} ${application.linea}`,
      metadata: {
        application_id: application.id,
        source: 'whatsapp',
        phone_number: phoneNumber
      },
      successUrl: `${baseUrl}/payment-success?id=${application.id}&source=whatsapp`
    });
    */
    
    // Option 2: Use Checkout Session with BOTH payment methods
    const paymentLink = await stripeLinkService.createCheckoutSession({
      applicationId: application.id,
      amount: application.importe,
      currency: 'MXN',
      customerEmail: application.delivery_email || null, // Use delivery email (optional)
      paymentMethodTypes: ['card', 'oxxo'], // Always include both
      metadata: {
        source: 'whatsapp',
        phone_number: phoneNumber
      },
      successUrl: `${baseUrl}/payment-success?id=${application.id}&source=whatsapp`,
      cancelUrl: `${baseUrl}/payment-cancelled?source=whatsapp`
    });
    
    return paymentLink;
  }
  
  /**
   * Find user by WhatsApp phone
   */
  async findUserByPhone(phoneNumber) {
    // This would need to be added to userService
    const query = `
      SELECT * FROM users 
      WHERE whatsapp_phone = $1 
      OR phone = $1 
      LIMIT 1
    `;
    
    const result = await require('../../db').query(query, [phoneNumber]);
    return result.rows[0];
  }

  /**
   * Normalize phone number to WhatsApp 521 format
   */
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-numeric characters
    const cleaned = phoneNumber.toString().replace(/[^\d]/g, '');
    
    // If already in 521 format, return as-is
    if (cleaned.startsWith('521') && cleaned.length === 13) {
      return cleaned;
    }
    
    // If starts with 52 (10 digits), convert to 521
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      return '521' + cleaned.slice(2);
    }
    
    // If just 10 digits, add 521 prefix
    if (cleaned.length === 10) {
      return '521' + cleaned;
    }
    
    // Return original if can't normalize
    return cleaned;
  }
}

module.exports = new PermitApplicationService();
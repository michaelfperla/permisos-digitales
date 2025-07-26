/**
 * Permit Application Service for WhatsApp
 * Connects WhatsApp data to existing PD application flow
 */

const applicationRepository = require('../../repositories/application.repository');
const userService = require('../user.service');
const stripePaymentService = require('../stripe-payment.service');
const { logger } = require('../../utils/logger');

class PermitApplicationService {
  /**
   * Create application from WhatsApp data
   */
  async createFromWhatsApp(phoneNumber, formData) {
    try {
      // Create or find user with real email
      const userAccountService = require('./user-account.service');
      const user = await userAccountService.createOrFindUser(
        phoneNumber,
        formData.email,
        formData.nombre_completo
      );
      
      // Create application
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
        importe: 150.00,
        source: 'whatsapp',
        source_metadata: { phone_number: phoneNumber }
      });
      
      logger.info('Application created from WhatsApp', {
        applicationId: application.id,
        phoneNumber
      });
      
      // Create Stripe payment link
      const paymentLink = await this.createPaymentLink(application, phoneNumber);
      
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
   * Create Stripe payment link
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
    
    // Option 2: Use Checkout Session (more control, recommended)
    const paymentLink = await stripeLinkService.createCheckoutSession({
      applicationId: application.id,
      amount: application.importe,
      currency: 'MXN',
      customerEmail: application.user?.email || application.email, // Use user email or application email
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
}

module.exports = new PermitApplicationService();
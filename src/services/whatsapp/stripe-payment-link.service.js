/**
 * Stripe Payment Link Service for WhatsApp
 * Creates actual Stripe Payment Links for WhatsApp users
 */

const stripePaymentService = require('../stripe-payment.service');
const { logger } = require('../../utils/logger');

class StripePaymentLinkService {
  constructor() {
    // Will use stripe instance from stripePaymentService
  }

  /**
   * Create a Stripe Payment Link
   * This creates a real, shareable payment link
   */
  async createPaymentLink(options) {
    try {
      // Ensure Stripe is initialized
      await stripePaymentService.initializeStripe();
      
      const {
        amount,
        currency = 'MXN',
        description = 'Permiso de Circulación Digital',
        metadata = {},
        successUrl,
        cancelUrl
      } = options;

      // Create or get Stripe Price (required for Payment Links)
      const price = await this.createOrGetPrice(amount, currency, description);

      // Create the payment link
      const paymentLink = await stripePaymentService.stripe.paymentLinks.create({
        line_items: [{
          price: price.id,
          quantity: 1
        }],
        metadata: {
          ...metadata,
          source: 'whatsapp'
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: successUrl || 'https://permisosdigitales.com.mx/payment-success'
          }
        },
        automatic_tax: {
          enabled: false
        },
        payment_method_types: ['card', 'oxxo'],
        phone_number_collection: {
          enabled: false  // We already have it from WhatsApp
        }
      });

      logger.info('Stripe payment link created', {
        paymentLinkId: paymentLink.id,
        url: paymentLink.url,
        metadata
      });

      return {
        id: paymentLink.id,
        url: paymentLink.url,
        amount,
        currency
      };

    } catch (error) {
      logger.error('Error creating payment link', { error: error.message });
      throw error;
    }
  }

  /**
   * Create or get a Stripe Price object
   * Payment Links require a Price, not just an amount
   */
  async createOrGetPrice(amount, currency, description) {
    try {
      const amountInCents = Math.round(amount * 100);
      
      // Search for existing price
      const prices = await stripePaymentService.stripe.prices.list({
        currency: currency.toLowerCase(),
        unit_amount: amountInCents,
        active: true,
        limit: 1
      });

      if (prices.data.length > 0) {
        return prices.data[0];
      }

      // Create a new product and price
      const product = await stripePaymentService.stripe.products.create({
        name: description,
        metadata: {
          type: 'permit'
        }
      });

      const price = await stripePaymentService.stripe.prices.create({
        product: product.id,
        unit_amount: amountInCents,
        currency: currency.toLowerCase()
      });

      return price;

    } catch (error) {
      logger.error('Error creating/getting price', { error: error.message });
      throw error;
    }
  }

  /**
   * Alternative: Create a Checkout Session (more control)
   */
  async createCheckoutSession(options) {
    try {
      await stripePaymentService.initializeStripe();
      
      const {
        applicationId,
        amount,
        currency = 'MXN',
        customerEmail,
        metadata = {},
        successUrl,
        cancelUrl
      } = options;

      // Build session options
      const sessionOptions = {
        payment_method_types: ['card', 'oxxo'],
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Permiso de Circulación Digital',
              description: `Folio: ${applicationId}`
            },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: successUrl || `https://permisosdigitales.com.mx/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || 'https://permisosdigitales.com.mx/payment-cancelled',
        metadata: {
          application_id: applicationId,
          ...metadata
        },
        payment_intent_data: {
          metadata: {
            application_id: applicationId,
            source: 'whatsapp'
          }
        },
        // Checkout session expires in 23 hours (Stripe max is 24 hours)
        expires_at: Math.floor(Date.now() / 1000) + (23 * 60 * 60)
      };

      // Only include customer_email if we have a valid email
      if (customerEmail && customerEmail.trim() && customerEmail.includes('@')) {
        sessionOptions.customer_email = customerEmail;
      }

      const session = await stripePaymentService.stripe.checkout.sessions.create(sessionOptions);

      logger.info('Stripe checkout session created', {
        sessionId: session.id,
        url: session.url,
        applicationId
      });

      return {
        id: session.id,
        url: session.url,
        amount,
        currency
      };

    } catch (error) {
      logger.error('Error creating checkout session', { error: error.message });
      throw error;
    }
  }
}

module.exports = new StripePaymentLinkService();
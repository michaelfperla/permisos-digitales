// src/config/stripe.js
const { logger } = require('../utils/enhanced-logger');
const config = require('./index');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');

// Log configuration
logger.info('Initializing Stripe SDK with latest version');

/**
 * Stripe Configuration
 * Professional implementation for initializing and managing the Stripe SDK
 * with proper error handling, validation, and environment-specific configuration.
 * Compatible with Stripe SDK version 18.2.1
 */
class StripeConfig {
  constructor() {
    this.initialized = false;
    this.stripe = null;
    this.initPromise = null;

    // Validate configuration at startup
    this.validateConfig();
  }

  /**
   * Validate Stripe configuration
   * @private
   */
  validateConfig() {
    // Check if API keys are configured
    if (!config.stripePrivateKey) {
      const errorMsg = 'Stripe private key is not configured. Payment processing will not work.';
      logger.error(errorMsg);

      // In production, we should fail fast
      if (config.nodeEnv === 'production') {
        throw new Error(errorMsg);
      }
    } else {
      // Log the masked API key for verification
      logger.info('Stripe Private Key (full, masked):',
        config.stripePrivateKey.slice(0, 8) + '...' + config.stripePrivateKey.slice(-4));

      // Verify the key format
      if (!config.stripePrivateKey.startsWith('sk_')) {
        logger.error('Invalid Stripe private key format. Key should start with "sk_"');
      }

      // Check if using production key in non-production environment
      if (config.stripePrivateKey.startsWith('sk_live_') && config.nodeEnv !== 'production') {
        logger.warn('WARNING: Using production Stripe key in non-production environment!');
      }

      // Check if using test key in production environment
      if (config.stripePrivateKey.startsWith('sk_test_') && config.nodeEnv === 'production') {
        logger.warn('WARNING: Using test Stripe key in production environment!');
      }
    }

    if (!config.stripePublicKey) {
      logger.warn('Stripe public key is not configured. Frontend payment forms will not work.');
    } else {
      // Verify the public key format
      if (!config.stripePublicKey.startsWith('pk_')) {
        logger.error('Invalid Stripe public key format. Key should start with "pk_"');
      }
    }

    // Log environment-specific information
    if (config.nodeEnv !== 'production') {
      logger.info(`Stripe configured for ${config.nodeEnv} environment. Using test API keys.`);
    }
  }

  /**
   * Initialize Stripe configuration
   * Uses a promise to ensure initialization is only performed once
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        if (this.initialized && this.stripe) {
          resolve(true);
          return;
        }

        logger.info('Initializing Stripe SDK...');

        // Initialize Stripe with the private key
        this.stripe = new Stripe(config.stripePrivateKey, {
          apiVersion: '2024-12-18.acacia', // Use latest API version
          typescript: true,
          telemetry: false // Disable telemetry for privacy
        });

        this.addHelperMethods();

        logger.info('Stripe SDK initialized successfully');
        this.initialized = true;
        resolve(true);
      } catch (error) {
        logger.error('Error initializing Stripe configuration:', error);
        this.initialized = false;
        this.stripe = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Add helper methods to the Stripe instance
   * @private
   */
  addHelperMethods() {
    // Add a method to create a customer
    this.stripe.createCustomer = async (customerData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `customer-${uuidv4()}`;

        // Create the customer using Stripe API
        const customer = await this.stripe.customers.create({
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone || undefined,
          metadata: {
            source: 'permisos-digitales'
          }
        }, {
          idempotencyKey: idempotencyKey
        });

        return customer;
      } catch (error) {
        logger.error('Error creating customer:', error);
        throw error;
      }
    };

    // Add a method to find a customer by email
    this.stripe.findCustomerByEmail = async (email) => {
      try {
        const customers = await this.stripe.customers.list({
          email: email,
          limit: 1
        });

        if (customers.data && customers.data.length > 0) {
          return customers.data[0];
        }

        return null;
      } catch (error) {
        logger.error('Error finding customer by email:', error);
        return null;
      }
    };

    // Add a method to create a payment intent for card payments
    this.stripe.createPaymentIntentWithCard = async (paymentData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `pi-${uuidv4()}`;

        // Convert amount to cents (Stripe requires amounts in cents)
        const amountInCents = Math.round(paymentData.amount * 100);

        // Create payment intent
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'mxn',
          customer: paymentData.customerId,
          description: paymentData.description || 'Permiso de Circulación',
          metadata: {
            application_id: paymentData.applicationId || 'unknown',
            reference_id: paymentData.referenceId || 'unknown'
          },
          automatic_payment_methods: {
            enabled: true,
          },
        }, {
          idempotencyKey: idempotencyKey
        });

        return paymentIntent;
      } catch (error) {
        logger.error('Error creating payment intent with card:', error);
        throw error;
      }
    };

    // Add a method to create a payment intent for OXXO payments
    this.stripe.createPaymentIntentWithOxxo = async (paymentData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `pi-oxxo-${uuidv4()}`;

        // Convert amount to cents (Stripe requires amounts in cents)
        const amountInCents = Math.round(paymentData.amount * 100);

        // Validate required fields
        if (!paymentData.customerId) {
          throw new Error('Customer ID is required for OXXO payment');
        }
        if (!paymentData.amount || paymentData.amount <= 0) {
          throw new Error('Valid payment amount is required');
        }

        logger.info('Creating OXXO Payment Intent:', {
          customerId: paymentData.customerId,
          amount: amountInCents,
          referenceId: paymentData.referenceId,
          idempotencyKey
        });

        // Step 1: Create payment intent with OXXO payment method
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'mxn',
          customer: paymentData.customerId,
          description: paymentData.description || 'Permiso de Circulación',
          payment_method_types: ['oxxo'],
          metadata: {
            application_id: paymentData.applicationId || 'unknown',
            reference_id: paymentData.referenceId || 'unknown'
          }
        }, {
          idempotencyKey: idempotencyKey
        });

        // Step 2: Create OXXO payment method with required billing details
        const paymentMethod = await this.stripe.paymentMethods.create({
          type: 'oxxo',
          billing_details: {
            name: 'Cliente OXXO',
            email: 'cliente@permisosdigitales.com.mx'
          }
        });

        // Step 3: Confirm payment intent with OXXO payment method to generate reference
        const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: paymentMethod.id,
          return_url: 'https://permisosdigitales.com.mx/payment-return'
        });

        logger.info('OXXO Payment Intent created and confirmed:', {
          paymentIntentId: confirmedPaymentIntent.id,
          status: confirmedPaymentIntent.status,
          hasNextAction: !!confirmedPaymentIntent.next_action,
          nextActionType: confirmedPaymentIntent.next_action?.type
        });

        // Validate that we got the OXXO display details
        if (!confirmedPaymentIntent.next_action || confirmedPaymentIntent.next_action.type !== 'oxxo_display_details') {
          logger.error('OXXO Payment Intent missing required next_action details:', {
            paymentIntentId: confirmedPaymentIntent.id,
            status: confirmedPaymentIntent.status,
            nextAction: confirmedPaymentIntent.next_action
          });
          throw new Error('Failed to generate OXXO payment details from Stripe');
        }

        const oxxoDetails = confirmedPaymentIntent.next_action.oxxo_display_details;

        // Validate OXXO reference was generated
        if (!oxxoDetails.number) {
          logger.error('OXXO Payment Intent missing reference number:', {
            paymentIntentId: confirmedPaymentIntent.id,
            oxxoDetails
          });
          throw new Error('Stripe did not generate OXXO reference number');
        }

        logger.info('OXXO Payment Intent successfully created with reference:', {
          paymentIntentId: confirmedPaymentIntent.id,
          status: confirmedPaymentIntent.status,
          oxxoReference: oxxoDetails.number,
          expiresAfter: oxxoDetails.expires_after,
          hostedVoucherUrl: oxxoDetails.hosted_voucher_url
        });

        return confirmedPaymentIntent;
      } catch (error) {
        logger.error('Error creating payment intent with OXXO:', {
          error: error.message,
          stack: error.stack,
          customerId: paymentData.customerId,
          referenceId: paymentData.referenceId
        });
        throw error;
      }
    };

    // Add a method to create a payment intent for SPEI bank transfers
    this.stripe.createPaymentIntentWithSpei = async (paymentData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `pi-spei-${uuidv4()}`;

        // Convert amount to cents (Stripe requires amounts in cents)
        const amountInCents = Math.round(paymentData.amount * 100);

        // Create payment intent with SPEI payment method
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'mxn',
          customer: paymentData.customerId,
          description: paymentData.description || 'Permiso de Circulación',
          payment_method_types: ['customer_balance'],
          payment_method_data: {
            type: 'customer_balance',
          },
          payment_method_options: {
            customer_balance: {
              funding_type: 'bank_transfer',
              bank_transfer: {
                type: 'mx_bank_transfer',
              },
            },
          },
          metadata: {
            application_id: paymentData.applicationId || 'unknown',
            reference_id: paymentData.referenceId || 'unknown'
          },
        }, {
          idempotencyKey: idempotencyKey
        });

        return paymentIntent;
      } catch (error) {
        logger.error('Error creating payment intent with SPEI:', error);
        throw error;
      }
    };

    // Add a method to get a payment intent by ID
    this.stripe.getPaymentIntent = async (paymentIntentId) => {
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
        return paymentIntent;
      } catch (error) {
        logger.error('Error getting payment intent:', error);
        throw error;
      }
    };
  }

  /**
   * Get the Stripe instance
   * @returns {Object} Stripe instance
   */
  getInstance() {
    if (!this.initialized || !this.stripe) {
      logger.debug('Stripe SDK not initialized, initializing now');
      try {
        // Initialize Stripe with the private key
        this.stripe = new Stripe(config.stripePrivateKey, {
          apiVersion: '2024-12-18.acacia',
          typescript: true,
          telemetry: false
        });

        // Add helper methods for common operations
        this.addHelperMethods();

        this.initialized = true;
        logger.info('Stripe SDK initialized successfully');
      } catch (error) {
        logger.error('Error initializing Stripe SDK:', error);
        // Create a minimal mock implementation to prevent crashes
        this.stripe = {
          createCustomer: async () => {
            throw new Error('Stripe SDK initialization failed, createCustomer is not available');
          }
        };
        this.initialized = false;
        logger.warn('Returning mock Stripe implementation due to initialization failure');
      }
    }
    return this.stripe;
  }

  /**
   * Reset the Stripe instance (useful for testing or after errors)
   */
  reset() {
    this.initialized = false;
    this.stripe = null;
    this.initPromise = null;
    logger.debug('Stripe SDK configuration reset');
  }
}

module.exports = new StripeConfig();

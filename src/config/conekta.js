// src/config/conekta.js
const { logger } = require('../utils/enhanced-logger');
const config = require('./index');
const conekta = require('conekta');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Log configuration
logger.info('Initializing Conekta SDK with current supported version v2.1.0');

/**
 * Conekta Configuration
 * Professional implementation for initializing and managing the Conekta SDK
 * with proper error handling, validation, and environment-specific configuration.
 * Compatible with Conekta SDK version 6.0.3
 */
class ConektaConfig {
  constructor() {
    this.initialized = false;
    this.conekta = null;
    this.initPromise = null;
    this.apiClient = null;

    // Validate configuration at startup
    this.validateConfig();
  }

  /**
   * Validate Conekta configuration
   * @private
   */
  validateConfig() {
    // Check if API keys are configured
    if (!config.conektaPrivateKey) {
      const errorMsg = 'Conekta private key is not configured. Payment processing will not work.';
      logger.error(errorMsg);

      // In production, we should fail fast
      if (config.nodeEnv === 'production') {
        throw new Error(errorMsg);
      }
    } else {
      // Log the masked API key for verification
      logger.info('Conekta Private Key (full, masked):',
        config.conektaPrivateKey.slice(0, 8) + '...' + config.conektaPrivateKey.slice(-4));

      // Verify the key format
      if (!config.conektaPrivateKey.startsWith('key_')) {
        logger.error('Invalid Conekta private key format. Key should start with "key_"');
      }

      // Check if using production key in non-production environment
      if (config.conektaPrivateKey.startsWith('key_p') && config.nodeEnv !== 'production') {
        logger.warn('WARNING: Using production Conekta key in non-production environment!');
      }

      // Check if using test key in production environment
      if (config.conektaPrivateKey.startsWith('key_t') && config.nodeEnv === 'production') {
        logger.warn('WARNING: Using test Conekta key in production environment!');
      }
    }

    if (!config.conektaPublicKey) {
      logger.warn('Conekta public key is not configured. Frontend payment forms will not work.');
    } else {
      // Verify the public key format
      if (!config.conektaPublicKey.startsWith('key_')) {
        logger.error('Invalid Conekta public key format. Key should start with "key_"');
      }
    }

    // Log environment-specific information
    if (config.nodeEnv !== 'production') {
      logger.info(`Conekta configured for ${config.nodeEnv} environment. Using test API keys.`);
    }
  }

  /**
   * Initialize Conekta configuration
   * Uses a promise to ensure initialization is only performed once
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() { // This outer `async` is fine, it means `initialize()` returns a Promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => { // REMOVED `async` here
      try {
        if (this.initialized && this.conekta) {
          resolve(true);
          return;
        }

        logger.info('Initializing Conekta SDK...');

        const Configuration = conekta.Configuration;
        const apiConfig = new Configuration({
          accessToken: config.conektaPrivateKey
        });

        this.conekta = {
          sdk: conekta,
          config: apiConfig,
          customers: new conekta.CustomersApi(apiConfig),
          orders: new conekta.OrdersApi(apiConfig),
          tokens: new conekta.TokensApi(apiConfig),
          charges: new conekta.ChargesApi(apiConfig),
          events: new conekta.EventsApi(apiConfig),
          webhooks: new conekta.WebhooksApi(apiConfig),
          publicKey: config.conektaPublicKey,
          privateKey: config.conektaPrivateKey,
          apiClient: axios.create({
            baseURL: 'https://api.conekta.io',
            headers: {
              'Accept': 'application/vnd.conekta-v2.1.0+json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.conektaPrivateKey}`
            }
          })
        };

        this.addHelperMethods(); // This is a synchronous call

        logger.info('Conekta SDK initialized successfully');
        this.initialized = true;
        resolve(true);
      } catch (error) {
        logger.error('Error initializing Conekta configuration:', error);
        this.initialized = false;
        this.conekta = null;
        // It's generally safer not to modify this.initPromise from within its own executor
        // if an error occurs. Let the caller handle the rejected promise.
        // If you *must* reset it, consider how it affects concurrent calls to initialize().
        // For now, let's leave it commented or remove it, as the promise will be rejected.
        // this.initPromise = null; 
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Add helper methods to the Conekta instance
   * @private
   */
  addHelperMethods() {
    // Add a method to create a customer
    this.conekta.createCustomer = async (customerData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `customer-${uuidv4()}`;

        // Create the customer using the CustomersApi
        const response = await this.conekta.customers.createCustomer({
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone || ''
        }, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });

        return response.data;
      } catch (error) {
        logger.error('Error creating customer:', error);
        throw error;
      }
    };

    // Add a method to find a customer by email
    this.conekta.findCustomerByEmail = async (email) => {
      try {
        // Use the direct API client for this since the SDK doesn't support filtering
        const response = await this.conekta.apiClient.get('/customers', {
          params: {
            email: email
          }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
          return response.data.data[0];
        }

        return null;
      } catch (error) {
        logger.error('Error finding customer by email:', error);
        return null;
      }
    };

    // Add a method to create an order with card payment
    this.conekta.createOrderWithCard = async (orderData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `order-${uuidv4()}`;

        // Log API key for verification (masked)
        logger.info('Conekta Private Key (full, masked):',
          config.conektaPrivateKey.slice(0, 8) + '...' + config.conektaPrivateKey.slice(-4));

        // Verify API key format
        if (!config.conektaPrivateKey.startsWith('key_')) {
          logger.error('Invalid Conekta private key format. Key should start with "key_"');
        }

        // Log Conekta API endpoint
        logger.info('Conekta API Endpoint:', this.conekta.apiClient.defaults.baseURL);

        // Convert amount to cents (Conekta requires amounts in cents)
        const amountInCents = Math.round(orderData.amount * 100);

        // Store customer ID for logging
        const customerId = orderData.customerId;
        logger.info('Customer ID for Order:', customerId || 'Not provided');

        // Create metadata with application ID
        const metadata = {
          ...(orderData.metadata || {}),
          application_id: orderData.applicationId || 'unknown'
        };

        // Create the aligned order request based on successful test script
        const alignedOrderRequest = {
          currency: 'MXN',
          customer_info: {
            name: orderData.customerName || 'Test User',
            email: orderData.customerEmail || 'test@example.com'
          },
          line_items: [{
            name: orderData.description || 'Test item',
            unit_price: amountInCents,
            quantity: 1
          }],
          charges: [{
            payment_method: {
              type: 'card',
              token_id: orderData.token
            },
            amount: amountInCents
          }],
          metadata: metadata
        };

        // If customer ID is provided, use it
        if (customerId) {
          alignedOrderRequest.customer_info.customer_id = customerId;
        }

        // Add device fingerprint if available
        if (orderData.deviceFingerprint) {
          alignedOrderRequest.charges[0].device_fingerprint = orderData.deviceFingerprint;
          logger.debug('Including device fingerprint in order request:', {
            fingerprintLength: orderData.deviceFingerprint.length,
            fingerprintPrefix: orderData.deviceFingerprint.substring(0, 8) + '...'
          });
        }

        // Log the full aligned request for debugging
        logger.info('Aligned Order Request for Debugging:', JSON.stringify(alignedOrderRequest, null, 2));

        // Try creating the order with the aligned request
        try {
          logger.info('Creating order with aligned request...');
          const response = await this.conekta.orders.createOrder(alignedOrderRequest, {
            headers: {
              'Idempotency-Key': idempotencyKey,
              'Accept': 'application/vnd.conekta-v2.1.0+json'
            }
          });

          // Log the full response for debugging
          logger.info('Order Creation Success:', JSON.stringify(response.data, null, 2));

          return response.data;
        } catch (error) {
          logger.error('Order Creation Failed - Full Error:', JSON.stringify(error.response?.data || error, null, 2));

          // If the aligned request fails, try without customer_id as a fallback
          if (customerId && alignedOrderRequest.customer_info.customer_id) {
            logger.info('Trying without customer_id as fallback...');
            delete alignedOrderRequest.customer_info.customer_id;

            const fallbackResponse = await this.conekta.orders.createOrder(alignedOrderRequest, {
              headers: {
                'Idempotency-Key': `${idempotencyKey}-fallback`,
                'Accept': 'application/vnd.conekta-v2.1.0+json'
              }
            });

            logger.info('Fallback Order Creation Success:', JSON.stringify(fallbackResponse.data, null, 2));
            return fallbackResponse.data;
          }

          throw error;
        }
      } catch (error) {
        logger.error('Error creating order with card payment:', error.response?.data || error);
        // Add more detailed error logging
        if (error.response) {
          logger.error('Conekta API error response:', {
            status: error.response.status,
            data: JSON.stringify(error.response.data, null, 2),
            headers: error.response.headers
          });
        }
        throw error;
      }
    };

    // Add a method to create an order with OXXO payment
    this.conekta.createOrderWithOxxo = async (orderData, options = {}) => {
      try {
        const idempotencyKey = options.idempotencyKey || `order-${uuidv4()}`;

        // Log API key for verification (masked)
        logger.info('Conekta Private Key (full, masked):',
          config.conektaPrivateKey.slice(0, 8) + '...' + config.conektaPrivateKey.slice(-4));

        // Log Conekta API endpoint
        logger.info('Conekta API Endpoint:', this.conekta.apiClient.defaults.baseURL);

        // Convert amount to cents (Conekta requires amounts in cents)
        const amountInCents = Math.round(orderData.amount * 100);

        // Store customer ID for logging
        const customerId = orderData.customerId;
        logger.info('Customer ID for OXXO Order:', customerId || 'Not provided');

        // Create metadata with application ID
        const metadata = {
          ...(orderData.metadata || {}),
          application_id: orderData.applicationId || 'unknown'
        };

        // Create the aligned order request based on successful test script
        const alignedOrderRequest = {
          currency: 'MXN',
          customer_info: {
            name: orderData.customerName || 'Test User',
            email: orderData.customerEmail || 'test@example.com'
          },
          line_items: [{
            name: orderData.description || 'Permiso de Circulación',
            unit_price: amountInCents,
            quantity: 1
          }],
          charges: [{
            payment_method: {
              type: 'oxxo_cash',
              expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours from now
            },
            amount: amountInCents
          }],
          metadata: metadata
        };

        // If customer ID is provided, use it
        if (customerId) {
          alignedOrderRequest.customer_info.customer_id = customerId;
        }

        // Add device fingerprint if available
        if (orderData.deviceFingerprint) {
          alignedOrderRequest.charges[0].device_fingerprint = orderData.deviceFingerprint;
          logger.debug('Including device fingerprint in OXXO order request:', {
            fingerprintLength: orderData.deviceFingerprint.length,
            fingerprintPrefix: orderData.deviceFingerprint.substring(0, 8) + '...'
          });
        }

        // Log the full aligned request for debugging
        logger.info('Aligned OXXO Order Request for Debugging:', JSON.stringify(alignedOrderRequest, null, 2));

        // Try creating the order with the aligned request
        try {
          logger.info('Creating OXXO order with aligned request...');
          const response = await this.conekta.orders.createOrder(alignedOrderRequest, {
            headers: {
              'Idempotency-Key': idempotencyKey,
              'Accept': 'application/vnd.conekta-v2.1.0+json'
            }
          });

          // Log the full response for debugging
          logger.info('OXXO Order Creation Success:', JSON.stringify(response.data, null, 2));

          // Log the OXXO reference number for convenience
          if (response.data.charges?.data?.[0]?.payment_method?.reference) {
            logger.info('OXXO Reference Number:', response.data.charges.data[0].payment_method.reference);
          }

          return response.data;
        } catch (error) {
          logger.error('OXXO Order Creation Failed - Full Error:', JSON.stringify(error.response?.data || error, null, 2));

          // If the aligned request fails, try without customer_id as a fallback
          if (customerId && alignedOrderRequest.customer_info.customer_id) {
            logger.info('Trying OXXO order without customer_id as fallback...');
            delete alignedOrderRequest.customer_info.customer_id;

            const fallbackResponse = await this.conekta.orders.createOrder(alignedOrderRequest, {
              headers: {
                'Idempotency-Key': `${idempotencyKey}-fallback`,
                'Accept': 'application/vnd.conekta-v2.1.0+json'
              }
            });

            logger.info('Fallback OXXO Order Creation Success:', JSON.stringify(fallbackResponse.data, null, 2));
            return fallbackResponse.data;
          }

          throw error;
        }
      } catch (error) {
        logger.error('Error creating order with OXXO payment:', error.response?.data || error);
        // Add more detailed error logging
        if (error.response) {
          logger.error('Conekta API error response for OXXO payment:', {
            status: error.response.status,
            data: JSON.stringify(error.response.data, null, 2),
            headers: error.response.headers
          });
        }
        throw error;
      }
    };

    // Add a method to get an order by ID
    this.conekta.getOrder = async (orderId) => {
      try {
        const response = await this.conekta.orders.getOrderById(orderId);
        return response.data;
      } catch (error) {
        logger.error('Error getting order:', error);
        throw error;
      }
    };
  }

  /**
   * Get the Conekta instance
   * @returns {Object} Conekta instance
   */
  getInstance() {
    if (!this.initialized || !this.conekta) {
      logger.debug('Conekta SDK not initialized, initializing now');
      // Initialize synchronously to avoid async issues
      try {
        // Check if the Conekta module is properly loaded
        if (!conekta) {
          throw new Error('Conekta module is not properly loaded');
        }

        // Log the structure of the raw Conekta module
        logger.debug('Raw Conekta module structure:', {
          moduleKeys: Object.keys(conekta).slice(0, 10), // Only log the first 10 keys to avoid overwhelming logs
          hasConfiguration: !!conekta.Configuration,
          hasCustomersApi: !!conekta.CustomersApi,
          hasOrdersApi: !!conekta.OrdersApi
        });

        // Initialize the Conekta SDK with the current supported version
        const Configuration = conekta.Configuration;
        const apiConfig = new Configuration({
          accessToken: config.conektaPrivateKey
        });

        // Create API clients for different Conekta resources
        this.conekta = {
          // Store the raw SDK
          sdk: conekta,

          // Store the configuration
          config: apiConfig,

          // Create API clients for different resources
          customers: new conekta.CustomersApi(apiConfig),
          orders: new conekta.OrdersApi(apiConfig),
          tokens: new conekta.TokensApi(apiConfig),
          charges: new conekta.ChargesApi(apiConfig),
          events: new conekta.EventsApi(apiConfig),
          webhooks: new conekta.WebhooksApi(apiConfig),

          // Store API keys for reference
          publicKey: config.conektaPublicKey,
          privateKey: config.conektaPrivateKey,

          // Create a direct HTTP client for custom requests
          apiClient: axios.create({
            baseURL: 'https://api.conekta.io',
            headers: {
              'Accept': 'application/vnd.conekta-v2.1.0+json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.conektaPrivateKey}`
            }
          })
        };

        // Add helper methods for common operations
        this.addHelperMethods();

        this.initialized = true;
        logger.info('Conekta SDK initialized successfully');
      } catch (error) {
        logger.error('Error initializing Conekta SDK:', error);
        // Create a minimal mock implementation to prevent crashes
        this.conekta = {
          createCustomer: async () => {
            throw new Error('Conekta SDK initialization failed, createCustomer is not available');
          },
          createOrderWithCard: async () => {
            throw new Error('Conekta SDK initialization failed, createOrderWithCard is not available');
          },
          createOrderWithOxxo: async () => {
            throw new Error('Conekta SDK initialization failed, createOrderWithOxxo is not available');
          }
        };
        this.initialized = false;
        // Don't throw the error, return the mock implementation
        logger.warn('Returning mock Conekta implementation due to initialization failure');
      }
    }
    return this.conekta;
  }

  /**
   * Reset the Conekta instance (useful for testing or after errors)
   */
  reset() {
    this.initialized = false;
    this.conekta = null;
    this.initPromise = null;
    logger.debug('Conekta SDK configuration reset');
  }
}

module.exports = new ConektaConfig();

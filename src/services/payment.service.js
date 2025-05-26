// src/services/payment.service.js
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');
const conektaConfig = require('../config/conekta');
const config = require('../config');
const { mapConektaErrorToUserMessage } = require('../utils/conekta-error-mapper');
const { CircuitBreaker } = require('../utils/circuit-breaker');
const { calculateRiskScore, RISK_THRESHOLDS } = require('../utils/fraud-detection');

/**
 * Payment Service
 * Enterprise-grade implementation for Conekta payment processing
 * with comprehensive error handling, retry logic, and monitoring.
 */
class PaymentService {
  constructor() {
    // Initialize service state
    this.conekta = null;
    this.initialized = false;
    this.initPromise = null;

    // Initialize enhanced metrics for monitoring
    this.metrics = {
      totalPaymentAttempts: 0,
      successfulPayments: 0,
      failedPayments: 0,
      cardPayments: 0,
      oxxoPayments: 0,
      averageProcessingTime: 0,
      processingTimes: [],
      errorsByType: {},
      paymentsByAmount: {},
      webhookEvents: {},
      responseTimesByEndpoint: {},
      lastAlertTime: null,
      alertThresholds: {
        failureRate: 0.3, // 30% failure rate
        processingTime: 5000, // 5 seconds
        consecutiveFailures: 3
      }
    };

    // Initialize circuit breakers
    this.circuitBreakers = {
      // Circuit breaker for card payments
      cardPayment: new CircuitBreaker({
        name: 'conekta-card-payment',
        failureThreshold: 3,
        resetTimeout: 60000, // 1 minute
        halfOpenSuccessThreshold: 2,
        isFailure: (error) => {
          // Only open the circuit for server errors, not for card declined errors
          // which are normal business logic
          return !(error.code === 'card_declined' ||
                  error.code === 'insufficient_funds' ||
                  error.code === 'expired_card' ||
                  error.code === 'invalid_cvc' ||
                  error.code === 'invalid_number' ||
                  error.code === 'invalid_expiry_date' ||
                  error.code === 'processor_declined');
        }
      }),

      // Circuit breaker for OXXO payments
      oxxoPayment: new CircuitBreaker({
        name: 'conekta-oxxo-payment',
        failureThreshold: 3,
        resetTimeout: 60000, // 1 minute
        halfOpenSuccessThreshold: 2
      }),

      // Circuit breaker for customer operations
      customerOperations: new CircuitBreaker({
        name: 'conekta-customer-operations',
        failureThreshold: 5,
        resetTimeout: 30000, // 30 seconds
        halfOpenSuccessThreshold: 1
      }),

      // Circuit breaker for webhook processing
      webhookProcessing: new CircuitBreaker({
        name: 'conekta-webhook-processing',
        failureThreshold: 10,
        resetTimeout: 120000, // 2 minutes
        halfOpenSuccessThreshold: 3
      })
    };

    // Initialize Conekta asynchronously
    this.initializeConekta().catch(err => {
      logger.error('Failed to initialize Conekta during service construction:', err);
    });
  }

  /**
   * Initialize Conekta SDK with proper error handling and retry logic
   * @private
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initializeConekta() { // This outer `async` is fine
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => { // REMOVED `async` here
      try {
        if (this.initialized && this.conekta) {
          resolve(true);
          return;
        }

        logger.info('Initializing Conekta in payment service...');
        this.conekta = conektaConfig.getInstance();

        if (!this.conekta) {
          throw new Error('Failed to get Conekta instance from configuration');
        }

        logger.debug('Conekta instance methods:', {
          hasCreateCustomer: typeof this.conekta.createCustomer === 'function',
          hasFindCustomerByEmail: typeof this.conekta.findCustomerByEmail === 'function',
          hasCreateOrderWithCard: typeof this.conekta.createOrderWithCard === 'function',
          hasCreateOrderWithOxxo: typeof this.conekta.createOrderWithOxxo === 'function',
          hasGetOrder: typeof this.conekta.getOrder === 'function'
        });

        logger.info('Conekta SDK initialized successfully in payment service');
        this.initialized = true;
        resolve(true);
      } catch (error) {
        logger.error('Failed to initialize Conekta SDK in payment service:', error);
        this.initialized = false;
        this.conekta = null;
        // Resetting initPromise here means if initialization fails,
        // a subsequent call to initializeConekta will try again. This might be intended.
        this.initPromise = null; 
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Create a customer in Conekta with retry logic and error handling
   * @param {Object} customerData - Customer information
   * @param {string} customerData.name - Customer name
   * @param {string} customerData.email - Customer email
   * @param {string} customerData.phone - Customer phone (optional)
   * @param {Object} options - Additional options
   * @param {number} options.maxRetries - Maximum number of retries (default: 2)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @param {string} options.idempotencyKey - Custom idempotency key (optional)
   * @returns {Promise<Object>} - Customer object
   */
  async createCustomer(customerData, options = {}) {
    const { maxRetries = 2, retryDelay = 1000, idempotencyKey } = options;
    let attempts = 0;
    let lastError = null;

    // Start timing for performance monitoring
    const startTime = Date.now();

    // Validate required fields
    if (!customerData.name) {
      throw new Error('Customer name is required');
    }

    if (!customerData.email) {
      throw new Error('Customer email is required');
    }

    // Sanitize and normalize input data
    const sanitizedData = {
      name: customerData.name.trim(),
      email: customerData.email.trim().toLowerCase(),
      phone: customerData.phone ? customerData.phone.trim() : ''
    };

    // Generate idempotency key if not provided
    const customerIdempotencyKey = idempotencyKey || `customer-${sanitizedData.email}-${Date.now()}`;

    logger.debug('Creating customer in Conekta:', {
      name: sanitizedData.name,
      email: sanitizedData.email,
      idempotencyKey: customerIdempotencyKey
    });

    // Retry loop
    while (attempts <= maxRetries) {
      try {
        // Ensure Conekta is initialized
        if (!this.initialized || !this.conekta) {
          logger.debug('Conekta not initialized, initializing now');
          await this.initializeConekta();
        }

        // Check if customer already exists to avoid duplicates
        try {
          const existingCustomer = await this.conekta.findCustomerByEmail(sanitizedData.email);

          if (existingCustomer) {
            logger.debug('Customer already exists in Conekta:', {
              customerId: existingCustomer.id,
              idempotencyKey: customerIdempotencyKey
            });

            // We found an existing customer, return it
            return {
              id: existingCustomer.id,
              name: existingCustomer.name,
              email: existingCustomer.email,
              phone: existingCustomer.phone || '',
              created_at: new Date().toISOString(),
              existing: true,
              idempotencyKey: customerIdempotencyKey
            };
          }
        } catch (findError) {
          // If there's an error finding the customer, just continue with creation
          logger.debug('Error checking for existing customer:', {
            error: findError.message,
            email: sanitizedData.email
          });
        }

        // Create customer in Conekta
        const customerRequest = {
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone
        };

        logger.debug('Creating customer with request:', {
          request: customerRequest,
          idempotencyKey: customerIdempotencyKey
        });

        // Use the new Conekta SDK helper method
        let customer;
        try {
          // Use the createCustomer helper method with idempotency key
          customer = await this.conekta.createCustomer(customerRequest, {
            idempotencyKey: customerIdempotencyKey
          });

          logger.debug('Customer created with idempotency key:', customerIdempotencyKey);
        } catch (customerError) {
          logger.error('Error creating customer:', {
            error: customerError,
            idempotencyKey: customerIdempotencyKey
          });

          // If this is a duplicate customer error (409), try to fetch the existing customer
          if (customerError.response && customerError.response.status === 409) {
            logger.debug('Received duplicate customer error, attempting to fetch existing customer');

            try {
              // Try to fetch the customer by email
              const existingCustomer = await this.conekta.findCustomerByEmail(sanitizedData.email);

              if (existingCustomer) {
                logger.debug('Found existing customer after duplicate error:', {
                  customerId: existingCustomer.id,
                  idempotencyKey: customerIdempotencyKey
                });

                return {
                  id: existingCustomer.id,
                  name: existingCustomer.name,
                  email: existingCustomer.email,
                  phone: existingCustomer.phone || '',
                  created_at: new Date().toISOString(),
                  existing: true,
                  idempotencyKey: customerIdempotencyKey
                };
              }
            } catch (fetchError) {
              logger.error('Error fetching customer after duplicate error:', fetchError);
            }
          }

          // Re-throw the error if we couldn't recover
          throw customerError;
        }

        // Log success and performance metrics
        const duration = Date.now() - startTime;
        logger.debug('Customer created successfully in Conekta:', {
          customerId: customer.id,
          duration: `${duration}ms`,
          idempotencyKey: customerIdempotencyKey
        });

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
          created_at: new Date().toISOString(),
          idempotencyKey: customerIdempotencyKey
        };
      } catch (error) {
        attempts++;
        lastError = error;

        // Determine if we should retry based on the error type
        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error creating customer in Conekta (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));

          // Reset Conekta instance if there was an initialization problem
          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Conekta instance before retry');
            this.initialized = false;
            this.conekta = null;
            this.initPromise = null;
          }
        } else {
          // If we've exhausted retries or it's not a retryable error, throw
          logger.error('Error creating customer in Conekta:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });
          throw error;
        }
      }
    }

    // If we've exhausted retries, throw the last error
    throw lastError;
  }

  /**
   * Format phone number to ensure it meets Conekta requirements
   * @private
   * @param {string} phone - The phone number to format
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // If the phone is empty or too short, return a default Mexican phone number
    if (!digitsOnly || digitsOnly.length < 10) {
      return '+525555555555'; // Default Mexican phone with country code
    }

    // If the phone doesn't start with a country code, add Mexican country code
    if (digitsOnly.length === 10) {
      return `+52${digitsOnly}`;
    }

    // If it already has a country code, ensure it has a + prefix
    if (digitsOnly.length > 10) {
      return `+${digitsOnly}`;
    }

    // Fallback
    return phone;
  }

  /**
   * Determine if an error is retryable
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error is retryable
   */
  isRetryableError(error) {
    // Network errors are generally retryable
    if (error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ESOCKETTIMEDOUT' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // Conekta API rate limiting errors are retryable
    if (error.http_code === 429) {
      return true;
    }

    // Conekta server errors are retryable
    if (error.http_code >= 500 && error.http_code < 600) {
      return true;
    }

    // Initialization errors are retryable
    if (error.message && (
      error.message.includes('not properly initialized') ||
        error.message.includes('not available') ||
        error.message.includes('Failed to get Conekta instance'))) {
      return true;
    }

    // All other errors are not retryable
    return false;
  }

  /**
   * Create a charge with a token
   * @param {Object} chargeData - Charge information
   * @param {string} chargeData.token - Token from payment form
   * @param {string} chargeData.name - Customer name
   * @param {string} chargeData.email - Customer email
   * @param {string} chargeData.phone - Customer phone (optional)
   * @param {number} chargeData.amount - Amount to charge
   * @param {string} chargeData.currency - Currency code (e.g., 'MXN')
   * @param {string} chargeData.description - Charge description
   * @param {string} chargeData.referenceId - Application reference ID
   * @param {string} chargeData.device_session_id - Device session ID for fraud prevention
   * @param {string} chargeData.idempotencyKey - Custom idempotency key (optional)
   * @param {Object} options - Additional options
   * @param {number} options.maxRetries - Maximum number of retries (default: 1)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @returns {Promise<Object>} - Charge result
   */
  async createChargeWithToken(chargeData, options = {}) {
    const { maxRetries = 1, retryDelay = 1000 } = options;
    let attempts = 0;
    let lastError = null;

    // Start timing for performance monitoring
    const startTime = Date.now();

    // Track metrics
    this.metrics.totalPaymentAttempts++;
    this.metrics.cardPayments++;

    // Validate required fields
    if (!chargeData.token) {
      logger.error('Missing token for card payment');
      throw new Error('Card token is required for payment');
    }

    if (!chargeData.email) {
      logger.error('Missing email for customer creation');
      throw new Error('Customer email is required for payment');
    }

    if (!chargeData.name) {
      logger.error('Missing name for customer creation');
      throw new Error('Customer name is required for payment');
    }

    if (!chargeData.amount) {
      logger.error('Missing amount for payment');
      throw new Error('Payment amount is required');
    }

    // Create a safe copy of the charge data to avoid circular references
    const sanitizedData = {
      token: chargeData.token ? String(chargeData.token) : null,
      name: chargeData.name ? String(chargeData.name).trim() : '',
      email: chargeData.email ? String(chargeData.email).trim().toLowerCase() : '',
      // Ensure phone number is properly formatted for Conekta (at least 10 digits)
      phone: chargeData.phone ? this.formatPhoneNumber(String(chargeData.phone).trim()) : '+525555555555',
      amount: chargeData.amount ? parseFloat(chargeData.amount) : 0,
      currency: chargeData.currency ? String(chargeData.currency || 'MXN').toUpperCase() : 'MXN',
      description: chargeData.description ? String(chargeData.description) : 'Permiso de Circulación',
      referenceId: chargeData.referenceId ? String(chargeData.referenceId) : '',
      device_session_id: chargeData.device_session_id ? String(chargeData.device_session_id) : null,
      idempotencyKey: chargeData.idempotencyKey || null
    };

    logger.debug('Creating charge with token for:', sanitizedData.referenceId);

    // Retry loop
    while (attempts <= maxRetries) {
      try {
        // Ensure Conekta is initialized
        if (!this.initialized || !this.conekta) {
          logger.debug('Conekta not initialized, initializing now');
          await this.initializeConekta();
        }

        // Create customer first with retry logic
        // Use a customer-specific idempotency key derived from the email
        const customerIdempotencyKey = `customer-${sanitizedData.email}-${Date.now()}`;
        const customer = await this.createCustomer({
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone
        }, {
          idempotencyKey: customerIdempotencyKey
        });

        // Check for fraud risk
        const deviceInfo = {
          fingerprint: sanitizedData.device_session_id,
          ip: sanitizedData.ip || null,
          userAgent: sanitizedData.userAgent || null
        };

        const userInfo = {
          id: customer.id,
          email: sanitizedData.email,
          name: sanitizedData.name,
          phone: sanitizedData.phone,
          lastIp: null, // In a real implementation, this would come from the database
          lastDeviceFingerprint: null, // In a real implementation, this would come from the database
          isNewUser: customer.existing === false,
          failedAttempts: 0, // In a real implementation, this would come from the database
          lastTransactionTime: null // In a real implementation, this would come from the database
        };

        // Extract card BIN if available
        const cardBin = sanitizedData.token && sanitizedData.token.length >= 6 ?
          sanitizedData.token.substring(0, 6) : null;

        // Prepare payment data for fraud check
        const fraudCheckData = {
          amount: sanitizedData.amount,
          currency: sanitizedData.currency,
          cardBin: cardBin,
          referenceId: sanitizedData.referenceId
        };

        // Perform fraud check
        const fraudAssessment = await this.checkForFraud(fraudCheckData, userInfo, deviceInfo);

        // Ensure we have a valid integer application ID for metadata
        let applicationId;
        if (sanitizedData.applicationId && !isNaN(parseInt(sanitizedData.applicationId, 10))) {
          applicationId = parseInt(sanitizedData.applicationId, 10);
        } else if (sanitizedData.referenceId && sanitizedData.referenceId.startsWith('APP-')) {
          const extractedId = sanitizedData.referenceId.replace('APP-', '');
          if (!isNaN(parseInt(extractedId, 10))) {
            applicationId = parseInt(extractedId, 10);
          }
        }

        // If the transaction is flagged for review, add a note to the order metadata
        let orderMetadata = {
          reference_id: String(sanitizedData.referenceId),
          environment: String(config.nodeEnv),
          application_version: String(process.env.npm_package_version || 'unknown'),
          application_id: applicationId ? String(applicationId) : undefined
        };

        if (fraudAssessment.flaggedForReview) {
          orderMetadata.fraud_review = 'true';
          orderMetadata.risk_score = String(fraudAssessment.riskScore);
          orderMetadata.risk_factors = fraudAssessment.riskFactors.join(',');
        }

        // Convert amount to cents (Conekta requires amounts in cents)
        const amountInCents = Math.round(sanitizedData.amount * 100);

        // Create order with card payment - use safe copies to avoid circular references
        const orderRequest = {
          currency: String(sanitizedData.currency),
          customer_info: {
            customer_id: String(customer.id)
          },
          line_items: [{
            name: String(sanitizedData.description),
            unit_price: Number(amountInCents),
            quantity: 1
          }],
          charges: [{
            payment_method: {
              type: 'card',
              token_id: String(sanitizedData.token)
            },
            device_fingerprint: sanitizedData.device_session_id ? String(sanitizedData.device_session_id) : undefined
          }],
          metadata: orderMetadata
        };

        // Declare order variable at this scope
        let order;

        // In development mode, log that we're using the real Conekta API with test credentials
        if (config.nodeEnv === 'development' && sanitizedData.token.includes('tok_')) {
          logger.info('Development mode: Using Conekta API with test credentials');
        }

        // Create order in Conekta
        logger.debug('Creating order with request:', JSON.stringify(orderRequest, null, 2));

        // Generate idempotency key for the order if not provided
        // This ensures that even if the same request is sent multiple times, only one charge will be created
        const orderIdempotencyKey = sanitizedData.idempotencyKey ||
                                   `order-${sanitizedData.referenceId}-${sanitizedData.token.substring(0, 8)}-${Date.now()}`;

        // Use the new Conekta SDK helper method with circuit breaker protection
        try {
          // Use circuit breaker to protect against Conekta API failures
          order = await this.circuitBreakers.cardPayment.execute(async () => {
            // Log customer ID for debugging
            logger.info('Customer ID for Order:', customer.id || 'Not provided');

            // Create the order data object
            const orderData = {
              customerId: customer.id,
              token: sanitizedData.token,
              amount: sanitizedData.amount,
              currency: sanitizedData.currency,
              description: sanitizedData.description,
              // Standardized approach for device fingerprint
              deviceFingerprint: sanitizedData.device_session_id || undefined,
              metadata: orderMetadata,
              applicationId: sanitizedData.applicationId || sanitizedData.referenceId.replace('APP-', ''),
              // Add customer information directly to ensure complete data
              customerName: sanitizedData.name,
              customerEmail: sanitizedData.email,
              customerPhone: sanitizedData.phone
            };

            // Check if we should temporarily remove customer_id for testing
            if (process.env.CONEKTA_TEST_WITHOUT_CUSTOMER_ID === 'true') {
              logger.info('Removing customer_id temporarily for testing purposes');
              delete orderData.customerId;
            }

            // Use the new createOrderWithCard helper method
            // Add additional debugging for the token
            logger.debug('Using token for payment:', {
              tokenPrefix: sanitizedData.token.substring(0, 8),
              tokenLength: sanitizedData.token.length,
              deviceFingerprint: sanitizedData.device_session_id ? 'present' : 'missing',
              hasCustomerId: !!orderData.customerId
            });

            // 3DS state parameter generation and storage is now bypassed for direct card charges
            // We're making 3DS optional by not forcing the three_ds_mode and return_url parameters

            // We still need to extract the application ID for other purposes
            let applicationId;

            // First, try to use the direct applicationId if provided
            if (sanitizedData.applicationId && !isNaN(parseInt(sanitizedData.applicationId, 10))) {
              applicationId = parseInt(sanitizedData.applicationId, 10);
            }
            // Otherwise, try to extract it from the referenceId
            else if (sanitizedData.referenceId && sanitizedData.referenceId.startsWith('APP-')) {
              const extractedId = sanitizedData.referenceId.replace('APP-', '');
              if (!isNaN(parseInt(extractedId, 10))) {
                applicationId = parseInt(extractedId, 10);
              } else {
                logger.warn('Invalid application ID format in referenceId:', {
                  referenceId: sanitizedData.referenceId,
                  extractedId
                });
                throw new Error('Invalid application ID format. Application must be created before payment processing.');
              }
            } else {
              logger.error('Missing valid application ID for payment processing:', {
                applicationId: sanitizedData.applicationId,
                referenceId: sanitizedData.referenceId
              });
              throw new Error('Missing valid application ID. Application must be created before payment processing.');
            }

            logger.debug('Processing card payment for application ID:', applicationId);

            // Add detailed logging before making the API call
            logger.debug('Conekta payment request:', {
              customerId: orderData.customerId,
              token: orderData.token ? `${orderData.token.substring(0, 8)}...` : 'No token',
              amount: orderData.amount,
              deviceFingerprint: orderData.deviceFingerprint ? 'Present' : 'Missing',
              environment: config.nodeEnv,
              idempotencyKey: orderIdempotencyKey
            });

            // Create the order without forcing 3DS
            const result = await this.conekta.createOrderWithCard(orderData, {
              idempotencyKey: orderIdempotencyKey
            });

            logger.debug('Order created with idempotency key:', orderIdempotencyKey);
            return result;
          });
        } catch (orderError) {
          // Check if this is a circuit breaker error
          if (orderError.code === 'CIRCUIT_OPEN') {
            logger.error('Circuit breaker is open for card payments', {
              message: orderError.message,
              remainingTimeMs: orderError.remainingTimeMs
            });

            // Create a user-friendly error
            const circuitError = new Error('El servicio de pagos está temporalmente no disponible. Por favor, intenta de nuevo más tarde.');
            circuitError.code = 'service_unavailable';
            circuitError.details = [{
              message: 'Servicio de pagos no disponible temporalmente',
              code: 'service_unavailable'
            }];
            throw circuitError;
          }

          // Check if this is already a formatted error from our compatibility layer
          if (orderError.httpCode === 402 || orderError.code === 'card_declined') {
            logger.warn('Card declined error from Conekta:', {
              message: orderError.message,
              code: orderError.code,
              type: orderError.type,
              idempotencyKey: orderIdempotencyKey
            });

            // Re-throw the already formatted error
            throw orderError;
          }

          // Log the raw error for debugging
          logger.error('Error using direct API for order creation:', {
            error: orderError,
            message: orderError.message,
            details: orderError.details || 'No details available',
            code: orderError.code || 'No error code',
            type: orderError.type || 'Unknown error type',
            httpCode: orderError.httpCode || 'No HTTP code',
            stack: orderError.stack || 'No stack trace',
            idempotencyKey: orderIdempotencyKey
          });

          // Check if this is a card declined error (402 status)
          if (orderError.response && orderError.response.status === 402) {
            // Extract the detailed error message from the response
            const errorDetails = orderError.response.data && orderError.response.data.details ?
              orderError.response.data.details[0] : null;

            const errorMessage = errorDetails && errorDetails.message ?
              errorDetails.message : 'La tarjeta fue rechazada. Por favor, intenta con otra tarjeta.';

            const errorCode = errorDetails && errorDetails.code ?
              errorDetails.code : 'card_declined';

            // Create a formatted error object with the details
            const formattedError = new Error(errorMessage);
            formattedError.code = errorCode;
            formattedError.details = orderError.response.data.details;
            formattedError.type = orderError.response.data.type;
            formattedError.httpCode = 402;

            throw formattedError;
          }

          // Fallback to old method if available
          if (this.conekta.Order && typeof this.conekta.Order.create === 'function') {
            try {
              order = await this.conekta.Order.create(orderRequest, {
                idempotencyKey: orderIdempotencyKey
              });
            } catch (fallbackError) {
              // If the fallback also fails, format the error nicely
              logger.error('Fallback also failed:', {
                error: fallbackError,
                idempotencyKey: orderIdempotencyKey
              });

              // Create a user-friendly error message
              const errorMessage = fallbackError.message || 'Error al procesar el pago';
              const formattedError = new Error(errorMessage);
              formattedError.code = fallbackError.code || 'payment_error';
              formattedError.details = fallbackError.details || [];
              formattedError.type = fallbackError.type || 'processing_error';

              throw formattedError;
            }
          } else {
            throw new Error('No compatible method found for creating orders');
          }
        }


        // Get charge information
        logger.debug('Order created successfully:', {
          orderId: order.id,
          idempotencyKey: orderIdempotencyKey
        });
        const charge = order.charges.data[0];

        // Determine payment status
        let paymentStatus = ApplicationStatus.AWAITING_PAYMENT;

        // Add detailed logging for payment status
        logger.debug('Conekta payment response:', {
          orderId: order.id,
          status: charge.status,
          chargeStatus: charge.status,
          environment: config.nodeEnv
        });

        if (charge.status === 'paid') {
          paymentStatus = ApplicationStatus.PAYMENT_RECEIVED;
          this.metrics.successfulPayments++;
        } else if (charge.status === 'pending_payment') {
          // Check if we're in test mode to handle pending_payment as successful
          const isTestMode = config.nodeEnv !== 'production';
          if (isTestMode) {
            // In test mode, treat pending_payment as PAYMENT_RECEIVED
            paymentStatus = ApplicationStatus.PAYMENT_RECEIVED;
            logger.info('Test mode: Treating pending_payment as PAYMENT_RECEIVED', {
              orderId: order.id,
              originalStatus: charge.status,
              newStatus: paymentStatus
            });
          } else {
            // In production, use PAYMENT_PROCESSING
            paymentStatus = ApplicationStatus.PAYMENT_PROCESSING;
          }
          this.metrics.successfulPayments++; // Count as successful since it's a normal flow
        } else if (charge.status === 'declined') {
          paymentStatus = ApplicationStatus.PAYMENT_FAILED;
          this.metrics.failedPayments++;
        }

        // Log performance metrics
        const duration = Date.now() - startTime;
        logger.info('Payment processed:', {
          orderId: order.id,
          status: charge.status,
          amount: sanitizedData.amount,
          currency: sanitizedData.currency,
          duration: `${duration}ms`,
          idempotencyKey: orderIdempotencyKey
        });

        // Update metrics
        const success = charge.status === 'paid' || charge.status === 'pending_payment';
        this.updateMetrics(
          sanitizedData,
          'card',
          success,
          duration,
          success ? null : charge.failure_code || 'payment_failed'
        );

        // Create payment result with the full Conekta order object
        const paymentResult = {
          success: success,
          status: charge.status,
          orderId: order.id,
          chargeId: charge.id,
          amount: sanitizedData.amount,
          currency: sanitizedData.currency,
          paymentMethod: 'card',
          paymentStatus: paymentStatus,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email
          },
          created_at: new Date().toISOString(),
          failureMessage: charge.failure_message,
          processingTime: duration,
          idempotencyKey: orderIdempotencyKey,
          // Include the full Conekta order object
          conektaOrder: order
        };

        // Log that we're returning the full Conekta order object
        logger.debug('Returning payment result with full Conekta order object');

        return paymentResult;
      } catch (error) {
        attempts++;
        lastError = error;

        // Determine if we should retry based on the error type
        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error creating charge in Conekta (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));

          // Reset Conekta instance if there was an initialization problem
          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Conekta instance before retry');
            this.initialized = false;
            this.conekta = null;
            this.initPromise = null;
          }
        } else {
          // If we've exhausted retries or it's not a retryable error, format the error
          this.metrics.failedPayments++;

          logger.error('Error creating charge in Conekta:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });

          // Use the error mapper to get a user-friendly error message
          const mappedError = mapConektaErrorToUserMessage(error);
          const errorMessage = mappedError.message;
          const errorCode = mappedError.code;

          // Update metrics for failed payment
          const duration = Date.now() - startTime;
          this.updateMetrics(
            sanitizedData,
            'card',
            false,
            duration,
            errorCode
          );

          // Return error result
          return {
            success: false,
            status: 'error',
            errorCode: errorCode,
            failureMessage: errorMessage,
            attempts: attempts,
            processingTime: duration
          };
        }
      }
    }

    // If we've exhausted retries, format the error
    this.metrics.failedPayments++;

    // Format error message for client
    let errorMessage = 'Error al procesar el pago después de múltiples intentos';
    if (lastError.details && lastError.details.length > 0) {
      errorMessage = lastError.details[0].message;
    } else if (lastError.message) {
      errorMessage = lastError.message;
    }

    // Return error result
    return {
      success: false,
      status: 'error',
      failureMessage: errorMessage,
      attempts: attempts
    };
  }

  /**
   * Process OXXO payment
   * @param {Object} paymentData - Payment information
   * @param {string} paymentData.customerId - Customer ID
   * @param {number} paymentData.amount - Amount to charge
   * @param {string} paymentData.currency - Currency code (e.g., 'MXN')
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.referenceId - Application reference ID
   * @param {string} paymentData.device_session_id - Device session ID for fraud prevention
   * @param {string} paymentData.idempotencyKey - Custom idempotency key (optional, from caller)
   * @param {Object} options - Additional options
   * @param {number} options.maxRetries - Maximum number of retries (default: 1)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @param {number} options.expirationDays - Days until OXXO reference expires (default: 2)
   * @returns {Promise<Object>} - Payment result with OXXO reference and barcode URL
   */
  async processOxxoPayment(paymentData, options = {}) {
    const { maxRetries = 1, retryDelay = 1000, expirationDays = 2 } = options;
    let attempts = 0;
    let lastError = null;

    // Start timing for performance monitoring
    const startTime = Date.now();

    // Track metrics
    this.metrics.totalPaymentAttempts++;
    this.metrics.oxxoPayments++;

    // Validate required fields
    if (!paymentData.customerId) {
      logger.error('Missing customerId for OXXO payment');
      throw new Error('Customer ID is required for OXXO payment');
    }
    if (!paymentData.amount) {
      logger.error('Missing amount for OXXO payment');
      throw new Error('Payment amount is required for OXXO payment');
    }
    if (!paymentData.referenceId) {
      logger.error('Missing referenceId for OXXO payment');
      throw new Error('Reference ID is required for OXXO payment');
    }

    // Sanitize and normalize input data
    const sanitizedData = {
      customerId: paymentData.customerId,
      amount: parseFloat(paymentData.amount),
      currency: (paymentData.currency || 'MXN').toUpperCase(),
      description: paymentData.description || 'Permiso de Circulación',
      referenceId: paymentData.referenceId,
      device_session_id: paymentData.device_session_id,
      // Note: paymentData.idempotencyKey is used below to initialize orderIdempotencyKey
      phone: paymentData.phone ? this.formatPhoneNumber(String(paymentData.phone).trim()) : '+525555555555'
    };

    // Generate the idempotency key ONCE for this entire operation, use it for all retries.
    // If the caller provides one, use it. Otherwise, generate one.
    const orderIdempotencyKey = paymentData.idempotencyKey || 
                                `oxxo-${sanitizedData.referenceId}-${Date.now()}`;

    logger.debug('Processing OXXO payment for:', sanitizedData.referenceId, 'with idempotency key:', orderIdempotencyKey);

    // Retry loop
    while (attempts <= maxRetries) {
      try {
        // Ensure Conekta is initialized
        if (!this.initialized || !this.conekta) {
          logger.debug('Conekta not initialized, initializing now');
          await this.initializeConekta();
        }

        // Convert amount to cents (Conekta requires amounts in cents)
        const amountInCents = Math.round(sanitizedData.amount * 100);

        // Set expiration date based on configuration (in Unix timestamp)
        const expiresAt = Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60);

        // Create order with OXXO payment - use safe copies to avoid circular references
        const orderRequest = { // This is the request for the older SDK method, if used as fallback
          currency: String(sanitizedData.currency),
          customer_info: {
            customer_id: String(sanitizedData.customerId)
          },
          line_items: [{
            name: String(sanitizedData.description),
            unit_price: Number(amountInCents),
            quantity: 1
          }],
          charges: [{
            payment_method: {
              type: 'cash', // For older SDK, this might be oxxo_cash directly
              expires_at: Number(expiresAt)
            },
            device_fingerprint: sanitizedData.device_session_id ? String(sanitizedData.device_session_id) : undefined
          }],
          metadata: {
            reference_id: String(sanitizedData.referenceId),
            environment: String(config.nodeEnv),
            application_version: String(process.env.npm_package_version || 'unknown'),
            payment_type: 'oxxo'
          }
        };

        let order; // Declare order variable at this scope

        if (config.nodeEnv === 'development') {
          logger.info('Development mode: Using Conekta API with test credentials for OXXO payment');
        }

        logger.debug('Creating OXXO order with effective idempotency key:', orderIdempotencyKey);

        try {
          order = await this.circuitBreakers.oxxoPayment.execute(async () => {
            const orderDataForHelper = { // Data for the conektaConfig helper method
              customerId: sanitizedData.customerId,
              customerName: paymentData.customerName || 'Usuario OXXO', // Ensure these are passed or defaulted
              customerEmail: paymentData.customerEmail || `${sanitizedData.referenceId}@example.com`, // Ensure these are passed or defaulted
              amount: sanitizedData.amount,
              currency: sanitizedData.currency,
              description: sanitizedData.description,
              deviceFingerprint: sanitizedData.device_session_id || undefined,
              metadata: { // Pass relevant metadata to the helper
                reference_id: String(sanitizedData.referenceId),
                environment: String(config.nodeEnv),
                application_version: String(process.env.npm_package_version || 'unknown'),
                payment_type: 'oxxo',
                application_id: paymentData.applicationId || 'unknown' // Ensure applicationId is passed
              },
              applicationId: paymentData.applicationId || 'unknown' // Ensure applicationId is passed
            };

            logger.debug('OXXO payment request device fingerprint (for helper):', {
              deviceFingerprint: orderDataForHelper.deviceFingerprint ? 'Present' : 'Not provided'
            });
            
            const result = await this.conekta.createOrderWithOxxo(orderDataForHelper, {
              idempotencyKey: orderIdempotencyKey // Use the consistent idempotency key
            });
            logger.debug('OXXO order created via helper with idempotency key:', orderIdempotencyKey);
            return result;
          });
        } catch (orderError) {
          if (orderError.code === 'CIRCUIT_OPEN') {
            logger.error('Circuit breaker is open for OXXO payments', { /* ... */ });
            const circuitError = new Error('El servicio de pagos está temporalmente no disponible...');
            circuitError.code = 'service_unavailable'; /* ... */ throw circuitError;
          }

          logger.error('Error using Conekta helper for OXXO order creation:', { error: orderError, idempotencyKey: orderIdempotencyKey });

          // Fallback to old SDK method if available (this.conekta.Order.create)
          if (this.conekta.Order && typeof this.conekta.Order.create === 'function') {
            logger.info('Falling back to legacy this.conekta.Order.create for OXXO');
            // Ensure orderRequest is correctly formatted for the legacy method
            // The legacy method might expect payment_method.type = 'oxxo_cash'
            const legacyOrderRequest = JSON.parse(JSON.stringify(orderRequest)); // Deep clone
            if (legacyOrderRequest.charges && legacyOrderRequest.charges[0] && legacyOrderRequest.charges[0].payment_method) {
              legacyOrderRequest.charges[0].payment_method.type = 'oxxo_cash'; // Adjust for legacy if needed
            }
            try {
              order = await this.conekta.Order.create(legacyOrderRequest, { // Use legacyOrderRequest here
                idempotencyKey: orderIdempotencyKey // Use the consistent key
              });
              logger.info('OXXO order created via legacy fallback with idempotency key:', orderIdempotencyKey);
            } catch (fallbackError) {
              logger.error('Legacy fallback also failed for OXXO order creation:', { error: fallbackError, idempotencyKey: orderIdempotencyKey });
              throw fallbackError; // Re-throw the error from the fallback
            }
          } else {
            // If no fallback, re-throw the original error from the helper
            throw orderError;
          }
        }

        logger.debug('OXXO order created successfully:', { orderId: order.id, idempotencyKey: orderIdempotencyKey });
        const charge = order.charges.data[0];
        const paymentMethod = charge.payment_method;

        const duration = Date.now() - startTime;
        logger.info('OXXO payment reference created:', {
          orderId: order.id,
          reference: paymentMethod.reference,
          expiresAt: new Date(paymentMethod.expires_at * 1000).toISOString(),
          duration: `${duration}ms`,
          idempotencyKey: orderIdempotencyKey
        });

        this.updateMetrics(sanitizedData, 'oxxo', true, duration, null);

        const paymentResult = {
          success: true,
          status: 'pending_payment',
          orderId: order.id,
          chargeId: charge.id,
          oxxoReference: paymentMethod.reference,
          expiresAt: paymentMethod.expires_at,
          expiresAtFormatted: new Date(paymentMethod.expires_at * 1000).toISOString(),
          barcodeUrl: paymentMethod.barcode_url,
          amount: sanitizedData.amount,
          currency: sanitizedData.currency,
          paymentMethod: 'oxxo_cash', // or paymentMethod.type
          paymentStatus: ApplicationStatus.AWAITING_OXXO_PAYMENT,
          created_at: new Date().toISOString(),
          processingTime: duration,
          idempotencyKey: orderIdempotencyKey
        };
        return paymentResult; // Success, exit loop and function

      } catch (error) {
        attempts++;
        lastError = error;
        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error processing OXXO payment in Conekta (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Conekta instance before retry');
            this.initialized = false; this.conekta = null; this.initPromise = null;
          }
        } else {
          this.metrics.failedPayments++;
          logger.error('Error processing OXXO payment in Conekta:', {
            error: error.message,
            stack: error.stack,
            context: {
              customerId: sanitizedData.customerId,
              referenceId: sanitizedData.referenceId,
              amount: sanitizedData.amount,
              idempotencyKey: orderIdempotencyKey // Now this is defined and correct
            },
            conektaErrorCode: error.details?.code || error.code || 'unknown',
            attempts,
            retryable: isRetryableError
          });

          const mappedError = mapConektaErrorToUserMessage(error);
          const duration = Date.now() - startTime;
          this.updateMetrics(sanitizedData, 'oxxo', false, duration, mappedError.code);

          return { // Return error object, exiting loop and function
            success: false,
            status: 'error',
            errorCode: mappedError.code,
            failureMessage: mappedError.message,
            attempts: attempts,
            processingTime: duration
          };
        }
      }
    }

    // This part is reached if the loop finishes due to maxRetries without returning from the 'else' block in catch
    // (which shouldn't happen with the current return statements in the else block)
    // However, to be safe, if it's ever reached, log and return/throw.
    this.metrics.failedPayments++;
    const finalErrorMessage = mapConektaErrorToUserMessage(lastError).message || 
                              'Error al generar referencia para pago en OXXO después de múltiples intentos';
    
    logger.error('Exhausted retries for OXXO payment. Final error:', { 
      message: lastError.message, 
      idempotencyKey: orderIdempotencyKey 
    });

    return { // Return final error object
      success: false,
      status: 'error',
      failureMessage: finalErrorMessage,
      errorCode: mapConektaErrorToUserMessage(lastError).code,
      attempts: attempts,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Check payment status with retry logic
   * @param {string} orderId - Conekta order ID
   * @param {Object} options - Additional options
   * @param {number} options.maxRetries - Maximum number of retries (default: 2)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @returns {Promise<Object>} - Payment status
   */
  async checkPaymentStatus(orderId, options = {}) {
    const { maxRetries = 2, retryDelay = 1000 } = options;
    let attempts = 0;
    let lastError = null;

    // Start timing for performance monitoring
    const startTime = Date.now();

    // Validate input
    if (!orderId) {
      throw new Error('Order ID is required to check payment status');
    }

    logger.debug('Checking payment status for order:', orderId);

    // Retry loop
    while (attempts <= maxRetries) {
      try {
        // Ensure Conekta is initialized
        if (!this.initialized || !this.conekta) {
          logger.debug('Conekta not initialized, initializing now');
          await this.initializeConekta();
        }

        // Find order in Conekta
        let order;
        try {
          // Use the new Conekta SDK helper method
          order = await this.conekta.getOrder(orderId);
        } catch (orderError) {
          logger.error('Error using direct API for finding order:', orderError);

          // Fallback to old method if available
          if (this.conekta.Order && typeof this.conekta.Order.find === 'function') {
            order = await this.conekta.Order.find(orderId);
          } else {
            throw new Error('No compatible method found for finding orders');
          }
        }

        // Log performance metrics
        const duration = Date.now() - startTime;
        logger.debug('Payment status check completed:', {
          orderId: order.id,
          status: order.payment_status,
          duration: `${duration}ms`
        });

        // Add detailed logging for payment status check
        logger.debug('Conekta payment status check response:', {
          orderId: order.id,
          status: order.payment_status,
          environment: config.nodeEnv
        });

        // Determine application status based on payment status
        let applicationStatus = ApplicationStatus.AWAITING_PAYMENT;
        if (order.payment_status === 'paid') {
          applicationStatus = ApplicationStatus.PAYMENT_RECEIVED;
        } else if (order.payment_status === 'declined') {
          applicationStatus = ApplicationStatus.PAYMENT_FAILED;
        } else if (order.payment_status === 'expired') {
          applicationStatus = ApplicationStatus.PAYMENT_FAILED;
        } else if (order.payment_status === 'canceled') {
          applicationStatus = ApplicationStatus.PAYMENT_FAILED;
        } else if (order.payment_status === 'pending_payment') {
          // Check if we're in test mode
          const isTestMode = config.nodeEnv !== 'production';

          // Check if it's an OXXO payment
          if (order.charges && order.charges.data.length > 0) {
            const charge = order.charges.data[0];
            if (charge.payment_method && charge.payment_method.type === 'cash') {
              applicationStatus = ApplicationStatus.AWAITING_OXXO_PAYMENT;
            } else {
              // For card payments in pending state
              if (isTestMode) {
                // In test mode, treat pending_payment as PAYMENT_RECEIVED for card payments
                applicationStatus = ApplicationStatus.PAYMENT_RECEIVED;
                logger.info('Test mode: Treating pending_payment as PAYMENT_RECEIVED in status check', {
                  orderId: order.id,
                  originalStatus: order.payment_status,
                  newStatus: applicationStatus
                });
              } else {
                applicationStatus = ApplicationStatus.PAYMENT_PROCESSING;
                logger.info(`Payment for order ${order.id} is in processing state`);
              }
            }
          }
        }

        // Extract payment method details
        let paymentMethod = 'unknown';
        let paymentDetails = {};

        if (order.charges && order.charges.data.length > 0) {
          const charge = order.charges.data[0];
          if (charge.payment_method) {
            if (charge.payment_method.type === 'card') {
              paymentMethod = 'card';
              paymentDetails = {
                last4: charge.payment_method.last4,
                brand: charge.payment_method.brand,
                expMonth: charge.payment_method.exp_month,
                expYear: charge.payment_method.exp_year
              };
            } else if (charge.payment_method.type === 'cash') {
              paymentMethod = 'oxxo_cash';
              paymentDetails = {
                reference: charge.payment_method.reference,
                expiresAt: charge.payment_method.expires_at,
                barcodeUrl: charge.payment_method.barcode_url
              };
            }
          }
        }

        return {
          orderId: order.id,
          status: order.payment_status,
          applicationStatus: applicationStatus,
          amount: order.amount / 100, // Convert from cents to original currency
          currency: order.currency,
          paymentMethod: paymentMethod,
          paymentDetails: paymentDetails,
          metadata: order.metadata || {},
          updatedAt: new Date().toISOString(),
          processingTime: duration
        };
      } catch (error) {
        attempts++;
        lastError = error;

        // Determine if we should retry based on the error type
        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error checking payment status in Conekta (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));

          // Reset Conekta instance if there was an initialization problem
          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Conekta instance before retry');
            this.initialized = false;
            this.conekta = null;
            this.initPromise = null;
          }
        } else {
          // If we've exhausted retries or it's not a retryable error, throw
          logger.error('Error checking payment status in Conekta:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });
          throw error;
        }
      }
    }

    // If we've exhausted retries, throw the last error
    throw lastError;
  }

  /**
   * Verify webhook signature using HMAC
   * @param {string} signature - Webhook signature from Conekta
   * @param {string} payload - Raw webhook payload
   * @returns {boolean} - Whether the signature is valid
   */
  verifyWebhookSignature(signature, payload) {
    try {
      if (!signature || !payload) {
        logger.warn('Missing signature or payload for webhook verification');
        return false;
      }

      // Check if the webhook secret is configured
      if (!config.conektaWebhookSecret) {
        logger.error('Conekta webhook secret is not configured. Webhook signatures cannot be verified.');
        return false;
      }

      // Parse the signature components
      const signatureParts = signature.split(',');

      // Extract the timestamp component
      const timestampComponent = signatureParts.find(part => part.trim().startsWith('t='));
      if (!timestampComponent) {
        logger.warn('Could not find timestamp component in Conekta-Signature');
        return false;
      }

      const timestamp = parseInt(timestampComponent.split('=')[1], 10);

      // Validate the timestamp is a valid number
      if (isNaN(timestamp)) {
        logger.warn(`Invalid timestamp in Conekta-Signature: ${timestampComponent}`);
        return false;
      }

      // Check if the timestamp is within an acceptable range (5 minutes)
      const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000; // 5 minutes in milliseconds
      const currentTime = Date.now();
      const timestampTime = timestamp * 1000; // Convert to milliseconds

      if (Math.abs(currentTime - timestampTime) > MAX_TIMESTAMP_DIFF) {
        logger.warn('Webhook timestamp is too old or from the future', {
          webhookTimestamp: new Date(timestampTime).toISOString(),
          currentTime: new Date(currentTime).toISOString(),
          diffSeconds: Math.abs(currentTime - timestampTime) / 1000
        });
        return false;
      }

      // Extract the signature component
      const signatureComponent = signatureParts.find(part => part.trim().startsWith('v1='));
      if (!signatureComponent) {
        logger.warn('Could not find v1 component in Conekta-Signature');
        return false;
      }

      const receivedSignature = signatureComponent.split('=')[1];

      // Validate that the received signature is a valid hex string
      if (!/^[0-9a-f]+$/i.test(receivedSignature)) {
        logger.warn(`Received signature is not a valid hex string: ${receivedSignature}`);
        return false;
      }

      // Calculate the expected signature
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', config.conektaWebhookSecret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');

      // Ensure both signatures have the same length before comparison
      if (expectedSignature.length !== receivedSignature.length) {
        logger.warn('Signature length mismatch');
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );

      if (!isSignatureValid) {
        logger.warn('Invalid Conekta webhook signature');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error verifying webhook signature:', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Update metrics with payment processing information
   * @param {Object} paymentData - Payment data
   * @param {string} paymentType - Type of payment ('card' or 'oxxo')
   * @param {boolean} success - Whether the payment was successful
   * @param {number} processingTime - Processing time in milliseconds
   * @param {string} errorCode - Error code if payment failed
   * @private
   */
  updateMetrics(paymentData, paymentType, success, processingTime, errorCode = null) {
    // Update processing times
    this.metrics.processingTimes.push(processingTime);

    // Keep only the last 100 processing times to avoid memory issues
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift();
    }

    // Recalculate average processing time
    const total = this.metrics.processingTimes.reduce((sum, time) => sum + time, 0);
    this.metrics.averageProcessingTime = total / this.metrics.processingTimes.length;

    // Track errors by type
    if (!success && errorCode) {
      this.metrics.errorsByType[errorCode] = (this.metrics.errorsByType[errorCode] || 0) + 1;
    }

    // Track payments by amount range
    const amount = paymentData.amount || 0;
    const amountRange = this.getAmountRange(amount);
    this.metrics.paymentsByAmount[amountRange] = (this.metrics.paymentsByAmount[amountRange] || 0) + 1;

    // Check for alerting conditions
    this.checkAlertConditions(paymentType, success, processingTime, errorCode);
  }

  /**
   * Get the amount range for a payment amount
   * @param {number} amount - Payment amount
   * @returns {string} - Amount range
   * @private
   */
  getAmountRange(amount) {
    if (amount < 100) return '0-99';
    if (amount < 200) return '100-199';
    if (amount < 500) return '200-499';
    if (amount < 1000) return '500-999';
    return '1000+';
  }

  /**
   * Check for alerting conditions based on metrics
   * @param {string} paymentType - Type of payment
   * @param {boolean} success - Whether the payment was successful
   * @param {number} processingTime - Processing time in milliseconds
   * @param {string} errorCode - Error code if payment failed
   * @private
   */
  checkAlertConditions(paymentType, success, processingTime, errorCode) {
    const now = Date.now();

    // Only alert once per minute to avoid alert storms
    if (this.metrics.lastAlertTime && (now - this.metrics.lastAlertTime) < 60000) {
      return;
    }

    // Check for slow processing
    if (processingTime > this.metrics.alertThresholds.processingTime) {
      logger.warn(`Slow payment processing detected for ${paymentType} payment`, {
        processingTime: `${processingTime}ms`,
        threshold: `${this.metrics.alertThresholds.processingTime}ms`,
        paymentType
      });
      this.metrics.lastAlertTime = now;
    }

    // Check for high failure rate
    const totalPayments = this.metrics.successfulPayments + this.metrics.failedPayments;
    if (totalPayments > 10) {
      const failureRate = this.metrics.failedPayments / totalPayments;
      if (failureRate > this.metrics.alertThresholds.failureRate) {
        logger.warn('High payment failure rate detected', {
          failureRate: failureRate.toFixed(2),
          threshold: this.metrics.alertThresholds.failureRate.toFixed(2),
          successfulPayments: this.metrics.successfulPayments,
          failedPayments: this.metrics.failedPayments
        });
        this.metrics.lastAlertTime = now;
      }
    }

    // Check for specific error patterns
    if (!success && errorCode) {
      const errorCount = this.metrics.errorsByType[errorCode] || 0;
      if (errorCount >= this.metrics.alertThresholds.consecutiveFailures) {
        logger.warn('Multiple payment failures with the same error code', {
          errorCode,
          count: errorCount,
          threshold: this.metrics.alertThresholds.consecutiveFailures
        });
        this.metrics.lastAlertTime = now;
      }
    }
  }

  /**
   * Check for fraud risk in a payment
   * @param {Object} paymentData - Payment data
   * @param {Object} userInfo - User information
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} - Fraud assessment result
   */
  async checkForFraud(paymentData, userInfo, deviceInfo = {}) {
    try {
      // Calculate risk score
      const riskAssessment = calculateRiskScore(paymentData, userInfo, deviceInfo);

      // Log the risk assessment
      logger.info('Fraud risk assessment for payment:', {
        userId: userInfo.id,
        amount: paymentData.amount,
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        riskFactors: riskAssessment.riskFactors
      });

      // If the risk is very high, block the transaction
      if (riskAssessment.blockTransaction) {
        logger.warn('Blocking high-risk transaction:', {
          userId: userInfo.id,
          amount: paymentData.amount,
          riskScore: riskAssessment.riskScore,
          riskFactors: riskAssessment.riskFactors
        });

        const error = new Error('Transacción bloqueada por motivos de seguridad. Por favor, contacta a soporte.');
        error.code = 'high_risk_transaction';
        error.details = [{
          message: 'Transacción bloqueada por motivos de seguridad',
          code: 'high_risk_transaction'
        }];
        throw error;
      }

      // If the risk is high, flag for review but allow the transaction
      if (riskAssessment.flaggedForReview) {
        logger.warn('Flagging high-risk transaction for review:', {
          userId: userInfo.id,
          amount: paymentData.amount,
          riskScore: riskAssessment.riskScore,
          riskFactors: riskAssessment.riskFactors
        });
      }

      return riskAssessment;
    } catch (error) {
      // If this is our own error, re-throw it
      if (error.code === 'high_risk_transaction') {
        throw error;
      }

      // Otherwise, log the error and return a default assessment
      logger.error('Error checking for fraud:', {
        error: error.message,
        userId: userInfo.id
      });

      return {
        riskScore: 0,
        riskLevel: 'ERROR',
        riskFactors: ['ERROR_CHECKING_FRAUD'],
        flaggedForReview: false,
        blockTransaction: false
      };
    }
  }

  /**
   * Get payment service metrics
   * @returns {Object} - Payment service metrics
   */
  getMetrics() {
    // Calculate additional metrics
    const totalPayments = this.metrics.successfulPayments + this.metrics.failedPayments;
    const successRate = totalPayments > 0 ? this.metrics.successfulPayments / totalPayments : 0;

    // Get circuit breaker states
    const circuitBreakerStates = {};
    for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
      circuitBreakerStates[name] = breaker.getState();
    }

    return {
      ...this.metrics,
      successRate: (successRate * 100).toFixed(2) + '%',
      circuitBreakers: circuitBreakerStates,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new PaymentService();

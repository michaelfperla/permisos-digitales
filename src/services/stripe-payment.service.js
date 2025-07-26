// src/services/stripe-payment.service.js
const { logger } = require('../utils/logger');
const { ApplicationStatus } = require('../constants');
// Stripe SDK instance will be initialized in initializeStripe()

// Configuration compatibility layer for dev/prod environments
function getConfig() {
  try {
    // Try unified config first (production)
    const unifiedConfig = require('../config/unified-config');
    if (unifiedConfig.isInitialized && unifiedConfig.isInitialized()) {
      return unifiedConfig.getSync();
    }
  } catch (error) {
    // Unified config not available or not initialized
  }
  
  try {
    // Fall back to dev config (development)
    return require('../config/dev-config');
  } catch (error) {
    // Neither config available
    logger.error('No configuration system available');
    throw new Error('Configuration system not available');
  }
}
const { CircuitBreaker } = require('../utils/circuit-breaker');
const paymentMonitoring = require('./payment-monitoring.service');
// CIRCULAR DEPENDENCY FIX: Lazy load payment recovery service
let paymentRecovery = null;
function getPaymentRecovery() {
  if (!paymentRecovery) {
    paymentRecovery = require('./payment-recovery.service');
  }
  return paymentRecovery;
}
const paymentVelocityService = require('./payment-velocity.service');

class StripePaymentService {
  constructor() {
    this.stripe = null;
    this.initialized = false;
    this.initPromise = null;

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
        failureRate: 0.3,
        processingTime: 5000,
        consecutiveFailures: 3
      }
    };

    this.emergencyLimits = {
      maxMetricsSize: 1000,
      maxProcessingTime: 30000, // 30 seconds
      maxDailyPayments: 50000,
      maxPaymentsPerCustomer: 10
    };

    // Rate limiter for emergency use
    this.rateLimiter = new Map();

    this.circuitBreakers = {
      cardPayment: new CircuitBreaker({
        name: 'stripe-card-payment',
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenSuccessThreshold: 2,
        isFailure: (error) => {
          // Don't open circuit for normal card decline errors
          return !(error.code === 'card_declined' ||
                  error.code === 'insufficient_funds' ||
                  error.code === 'expired_card' ||
                  error.code === 'incorrect_cvc' ||
                  error.code === 'invalid_number' ||
                  error.code === 'invalid_expiry_month' ||
                  error.code === 'invalid_expiry_year' ||
                  error.code === 'generic_decline');
        }
      }),

      oxxoPayment: new CircuitBreaker({
        name: 'stripe-oxxo-payment',
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenSuccessThreshold: 2,
        isFailure: (error) => {
          // Don't open circuit for normal payment errors
          return !(error.code === 'payment_intent_authentication_failure' ||
                  error.code === 'payment_intent_payment_attempt_failed' ||
                  error.code === 'payment_method_provider_decline' ||
                  error.code === 'payment_method_provider_timeout' ||
                  error.type === 'invalid_request_error' ||
                  error.type === 'idempotency_error');
        }
      }),


      customerOperations: new CircuitBreaker({
        name: 'stripe-customer-operations',
        failureThreshold: 5,
        resetTimeout: 30000,
        halfOpenSuccessThreshold: 1
      }),

      webhookProcessing: new CircuitBreaker({
        name: 'stripe-webhook-processing',
        failureThreshold: 10,
        resetTimeout: 120000,
        halfOpenSuccessThreshold: 3
      })
    };

    // RACE CONDITION FIX: Don't initialize Stripe in constructor
    // It will be initialized on first use when config is ready
    // this.initializeStripe() - removed to prevent race condition
  }

  async initializeStripe() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        if (this.initialized && this.stripe) {
          resolve(true);
          return;
        }

        logger.info('Initializing Stripe in payment service...');
        
        // RACE CONDITION FIX: Ensure config is initialized before using it
        const config = getConfig();
        if (!config.stripe?.privateKey) {
          throw new Error('Stripe configuration not available - config may not be initialized');
        }
        
        // Initialize Stripe SDK directly
        const Stripe = require('stripe');
        this.stripe = new Stripe(config.stripe.privateKey, {
          apiVersion: '2022-11-15',
          maxNetworkRetries: 3,
          timeout: 10000
        });

        if (!this.stripe) {
          throw new Error('Failed to initialize Stripe SDK');
        }

        logger.debug('Stripe instance initialized with standard SDK methods:', {
          hasCustomers: !!this.stripe.customers,
          hasPaymentIntents: !!this.stripe.paymentIntents,
          version: this.stripe.VERSION
        });

        logger.info('Stripe SDK initialized successfully in payment service');
        this.initialized = true;
        resolve(true);
      } catch (error) {
        logger.error('Failed to initialize Stripe SDK in payment service:', error);
        this.initialized = false;
        this.stripe = null;
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Create payment intent for secure card processing
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Stripe payment intent
   */
  async createPaymentIntentForCard(paymentData) {
    const startTime = Date.now();
    const config = getConfig();
    const sanitizedData = {
      customerId: String(paymentData.customerId),
      amount: parseFloat(paymentData.amount),
      currency: String(paymentData.currency || 'MXN').toLowerCase(),
      description: String(paymentData.description || 'Permiso de Circulación'),
      referenceId: String(paymentData.referenceId || ''),
      applicationId: String(paymentData.applicationId || '')
    };

    const amountInCents = Math.round(sanitizedData.amount * 100);
    // Use a stable idempotency key based on application and customer
    // This prevents duplicate payment intents for the same application
    const idempotencyKey = `card-intent-app-${sanitizedData.applicationId}-cust-${sanitizedData.customerId}`;

    // Check rate limit
    this.checkRateLimit(sanitizedData.customerId, sanitizedData.applicationId);

    // Check payment velocity before creating payment intent
    const velocityData = {
      userId: paymentData.userId,
      email: paymentData.email,
      ipAddress: paymentData.ipAddress,
      amount: sanitizedData.amount,
      cardLast4: paymentData.cardLast4,
      cardFingerprint: paymentData.cardFingerprint
    };

    // Payment velocity checks (controlled by feature flag)
    if (config.features && config.features.paymentVelocity) {
      logger.debug('Performing payment velocity check for card payment:', {
        applicationId: sanitizedData.applicationId,
        userId: paymentData.userId,
        amount: sanitizedData.amount
      });

      const velocityCheck = await paymentVelocityService.checkPaymentVelocity(velocityData);
      
      if (!velocityCheck.allowed) {
        logger.warn('Payment blocked due to velocity violations:', {
          applicationId: sanitizedData.applicationId,
          userId: paymentData.userId,
          violations: velocityCheck.violations,
          riskScore: velocityCheck.riskScore
        });
        
        // Record velocity failure
        paymentMonitoring.recordPaymentFailure({
          error: new Error('Payment velocity check failed'),
          method: 'card',
          amount: sanitizedData.amount,
          applicationId: sanitizedData.applicationId,
          userId: paymentData.userId,
          reason: 'velocity_check_failed',
          violations: velocityCheck.violations
        });
        
        const error = new Error('Su pago ha sido rechazado por motivos de seguridad. Por favor, intente más tarde o contacte a soporte.');
        error.code = 'velocity_check_failed';
        error.violations = velocityCheck.violations;
        error.riskScore = velocityCheck.riskScore;
        throw error;
      }
      
      // Log velocity risk score if check passed but has some risk
      if (velocityCheck.riskScore > 0) {
        logger.info('Payment proceeding with velocity risk score:', {
          applicationId: sanitizedData.applicationId,
          riskScore: velocityCheck.riskScore,
          violations: velocityCheck.violations
        });
      }

      logger.debug('Payment velocity check passed:', {
        applicationId: sanitizedData.applicationId,
        userId: paymentData.userId,
        riskScore: velocityCheck.riskScore
      });
    } else {
      logger.debug('Payment velocity checks are disabled via configuration');
    }

    // Record payment attempt
    paymentMonitoring.recordPaymentAttempt({
      method: 'card',
      amount: sanitizedData.amount,
      applicationId: sanitizedData.applicationId,
      userId: paymentData.userId
    });

    logger.debug('Creating payment intent for card payment:', {
      customerId: sanitizedData.customerId,
      amount: amountInCents,
      currency: sanitizedData.currency,
      applicationId: sanitizedData.applicationId,
      idempotencyKey
    });

    try {
      const paymentIntent = await this.circuitBreakers.cardPayment.execute(async () => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Payment processing timeout')), this.emergencyLimits.maxProcessingTime)
        );
        
        // Use standard Stripe SDK method
        const paymentPromise = this.stripe.paymentIntents.create({
          amount: Math.round(sanitizedData.amount * 100), // Convert to cents
          currency: sanitizedData.currency || 'mxn',
          customer: sanitizedData.customerId,
          description: sanitizedData.description || 'Permiso de Circulación',
          metadata: {
            application_id: String(sanitizedData.applicationId || 'unknown'),
            reference_id: String(sanitizedData.referenceId || 'unknown')
          },
          payment_method_types: ['card'] // Card payments only
        }, {
          idempotencyKey
        });
        
        return Promise.race([paymentPromise, timeoutPromise]);
      });

      const processingTime = Date.now() - startTime;

      // Record success
      paymentMonitoring.recordPaymentSuccess({
        method: 'card',
        amount: sanitizedData.amount,
        paymentIntentId: paymentIntent.id,
        processingTime
      });

      logger.info('Payment intent created successfully:', paymentIntent.id);
      return paymentIntent;

    } catch (error) {
      // Record failure
      paymentMonitoring.recordPaymentFailure({
        error,
        method: 'card',
        amount: sanitizedData.amount,
        applicationId: sanitizedData.applicationId,
        userId: paymentData.userId
      });

      logger.error('Error creating payment intent for card:', error);
      throw error;
    }
  }

  /**
   * Retrieve payment intent from Stripe
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Stripe payment intent
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      logger.debug('Retrieved payment intent:', paymentIntent.id, 'status:', paymentIntent.status);
      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Confirmed payment intent
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      logger.info('Confirming payment intent:', paymentIntentId);

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);

      logger.info('Payment intent confirmed:', {
        id: paymentIntent.id,
        status: paymentIntent.status
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent:', {
        paymentIntentId,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Capture payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Captured payment intent
   */
  async capturePaymentIntent(paymentIntentId) {
    try {
      logger.info('Capturing payment intent:', paymentIntentId);

      const paymentIntent = await this.stripe.paymentIntents.capture(paymentIntentId);

      logger.info('Payment intent captured:', {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amountCaptured: paymentIntent.amount_captured
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Error capturing payment intent:', {
        paymentIntentId,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  async createCustomer(customerData, options = {}) {
    const { maxRetries = 2, retryDelay = 1000, idempotencyKey } = options;
    let attempts = 0;
    let lastError = null;

    const startTime = Date.now();

    if (!customerData.name) {
      throw new Error('Customer name is required');
    }

    if (!customerData.email) {
      throw new Error('Customer email is required');
    }

    const sanitizedData = {
      name: customerData.name.trim(),
      email: customerData.email.trim().toLowerCase(),
      phone: customerData.phone ? customerData.phone.trim() : ''
    };

    // Use stable idempotency key based on email to prevent duplicate customers
    const customerIdempotencyKey = idempotencyKey || `customer-${sanitizedData.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    logger.debug('Creating customer in Stripe:', {
      name: sanitizedData.name,
      email: sanitizedData.email,
      idempotencyKey: customerIdempotencyKey
    });

    while (attempts <= maxRetries) {
      try {
        if (!this.initialized || !this.stripe) {
          logger.debug('Stripe not initialized, initializing now');
          await this.initializeStripe();
        }

        // Check for existing customer first
        try {
          // Use standard Stripe SDK to find customer by email
          const customers = await this.stripe.customers.list({
            email: sanitizedData.email,
            limit: 1
          });
          const existingCustomer = customers.data[0];

          if (existingCustomer) {
            logger.debug('Customer already exists in Stripe:', {
              customerId: existingCustomer.id,
              idempotencyKey: customerIdempotencyKey
            });

            return {
              id: existingCustomer.id,
              name: existingCustomer.name,
              email: existingCustomer.email,
              phone: existingCustomer.phone || '',
              created_at: new Date(existingCustomer.created * 1000).toISOString(),
              existing: true,
              idempotencyKey: customerIdempotencyKey
            };
          }
        } catch (findError) {
          logger.debug('Error checking for existing customer:', {
            error: findError.message,
            email: sanitizedData.email
          });
        }

        const customerRequest = {
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone
        };

        logger.debug('Creating customer with request:', {
          request: customerRequest,
          idempotencyKey: customerIdempotencyKey
        });

        let customer;
        try {
          // Use standard Stripe SDK to create customer
          customer = await this.stripe.customers.create(customerRequest, {
            idempotencyKey: customerIdempotencyKey
          });

          logger.debug('Customer created with idempotency key:', customerIdempotencyKey);
        } catch (customerError) {
          logger.error('Error creating customer:', {
            error: customerError,
            idempotencyKey: customerIdempotencyKey
          });

          // Handle duplicate customer error
          if (customerError.code === 'resource_already_exists') {
            logger.debug('Received duplicate customer error, attempting to fetch existing customer');

            try {
              // Use standard Stripe SDK to find customer by email
          const customers = await this.stripe.customers.list({
            email: sanitizedData.email,
            limit: 1
          });
          const existingCustomer = customers.data[0];

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
                  created_at: new Date(existingCustomer.created * 1000).toISOString(),
                  existing: true,
                  idempotencyKey: customerIdempotencyKey
                };
              }
            } catch (fetchError) {
              logger.error('Error fetching customer after duplicate error:', fetchError);
            }
          }

          throw customerError;
        }

        const duration = Date.now() - startTime;
        logger.debug('Customer created successfully in Stripe:', {
          customerId: customer.id,
          duration: `${duration}ms`,
          idempotencyKey: customerIdempotencyKey
        });

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
          created_at: new Date(customer.created * 1000).toISOString(),
          idempotencyKey: customerIdempotencyKey
        };
      } catch (error) {
        attempts++;
        lastError = error;

        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error creating customer in Stripe (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));

          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Stripe instance before retry');
            this.initialized = false;
            this.stripe = null;
            this.initPromise = null;
          }
        } else {
          logger.error('Error creating customer in Stripe:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });
          throw error;
        }
      }
    }

    throw lastError;
  }

  formatPhoneNumber(phone) {
    const digitsOnly = phone.replace(/\D/g, '');

    if (!digitsOnly || digitsOnly.length < 10) {
      return '+525555555555';
    }

    if (digitsOnly.length === 10) {
      return `+52${digitsOnly}`;
    }

    if (digitsOnly.length > 10) {
      return `+${digitsOnly}`;
    }

    return phone;
  }

  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ESOCKETTIMEDOUT' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // Rate limiting
    if (error.type === 'rate_limit_error') {
      return true;
    }

    // Server errors
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    // Initialization errors
    if (error.message && (
      error.message.includes('not properly initialized') ||
        error.message.includes('not available') ||
        error.message.includes('Failed to get Stripe instance'))) {
      return true;
    }

    return false;
  }

  async createChargeWithToken(chargeData, options = {}) {
    const { maxRetries = 1, retryDelay = 1000 } = options;
    let attempts = 0;
    let lastError = null;

    const startTime = Date.now();
    const config = getConfig();

    this.metrics.totalPaymentAttempts++;
    this.metrics.cardPayments++;

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

    const sanitizedData = {
      token: chargeData.token ? String(chargeData.token) : null,
      name: chargeData.name ? String(chargeData.name).trim() : '',
      email: chargeData.email ? String(chargeData.email).trim().toLowerCase() : '',
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
        // Ensure Stripe is initialized
        if (!this.initialized || !this.stripe) {
          logger.debug('Stripe not initialized, initializing now');
          await this.initializeStripe();
        }

        // Create customer first with retry logic
        const customerIdempotencyKey = `customer-${sanitizedData.email}-${Date.now()}`;
        const customer = await this.createCustomer({
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone
        }, {
          idempotencyKey: customerIdempotencyKey
        });

        let applicationId;
        if (sanitizedData.applicationId && !isNaN(parseInt(sanitizedData.applicationId, 10))) {
          applicationId = parseInt(sanitizedData.applicationId, 10);
        } else if (sanitizedData.referenceId && sanitizedData.referenceId.startsWith('APP-')) {
          const extractedId = sanitizedData.referenceId.replace('APP-', '');
          if (!isNaN(parseInt(extractedId, 10))) {
            applicationId = parseInt(extractedId, 10);
          }
        }

        const paymentIntentIdempotencyKey = sanitizedData.idempotencyKey ||
                                           `card-${applicationId || sanitizedData.referenceId}`;

        try {
          const paymentIntent = await this.circuitBreakers.cardPayment.execute(async () => {
            logger.info('Customer ID for Payment Intent:', customer.id || 'Not provided');

            const paymentData = {
              customerId: customer.id,
              amount: sanitizedData.amount,
              currency: sanitizedData.currency.toLowerCase(),
              description: sanitizedData.description,
              applicationId: applicationId,
              referenceId: sanitizedData.referenceId
            };

            logger.debug('Processing card payment for application ID:', applicationId);

            logger.debug('Stripe payment request:', {
              customerId: paymentData.customerId,
              amount: paymentData.amount,
              currency: paymentData.currency,
              environment: config.nodeEnv,
              idempotencyKey: paymentIntentIdempotencyKey
            });

            // Use standard Stripe SDK method
            const result = await this.stripe.paymentIntents.create({
              amount: Math.round(paymentData.amount * 100), // Convert to cents
              currency: paymentData.currency || 'mxn',
              customer: paymentData.customerId,
              description: paymentData.description || 'Permiso de Circulación',
              metadata: {
                application_id: String(paymentData.applicationId || 'unknown'),
                reference_id: String(paymentData.referenceId || 'unknown')
              },
              payment_method_types: ['card'] // Card payments only
            }, {
              idempotencyKey: paymentIntentIdempotencyKey
            });

            logger.debug('Payment Intent created with idempotency key:', paymentIntentIdempotencyKey);
            return result;
          });

          const duration = Date.now() - startTime;
          this.metrics.processingTimes.push(duration);
          
          // Fix memory leak - limit array size
          const MAX_PROCESSING_TIMES = 1000;
          if (this.metrics.processingTimes.length > MAX_PROCESSING_TIMES) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-MAX_PROCESSING_TIMES);
          }
          
          // Calculate average
          if (this.metrics.processingTimes.length > 0) {
            const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
            this.metrics.averageProcessingTime = Math.round(sum / this.metrics.processingTimes.length);
          }
          
          this.metrics.successfulPayments++;

          logger.info('Payment Intent created successfully:', {
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            duration: `${duration}ms`
          });

          return {
            success: true,
            orderId: paymentIntent.id,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            paymentMethod: 'card',
            amount: paymentIntent.amount / 100, // Convert back from cents
            currency: paymentIntent.currency.toUpperCase(),
            clientSecret: paymentIntent.client_secret,
            paymentStatus: this.mapStripeStatusToApplicationStatus(paymentIntent.status),
            created: new Date(paymentIntent.created * 1000).toISOString(),
            metadata: paymentIntent.metadata
          };
        } catch (paymentError) {
          this.metrics.failedPayments++;
          logger.error('Payment Intent creation failed:', {
            error: paymentError.message,
            code: paymentError.code,
            type: paymentError.type,
            referenceId: sanitizedData.referenceId
          });

          return {
            success: false,
            orderId: null,
            paymentIntentId: null,
            status: 'failed',
            paymentMethod: 'card',
            failureMessage: this.mapStripeErrorToUserMessage(paymentError),
            errorCode: paymentError.code,
            errorType: paymentError.type
          };
        }
      } catch (error) {
        attempts++;
        lastError = error;

        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error processing card payment (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));

          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Stripe instance before retry');
            this.initialized = false;
            this.stripe = null;
            this.initPromise = null;
          }
        } else {
          this.metrics.failedPayments++;
          logger.error('Error processing card payment:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });
          throw error;
        }
      }
    }

    throw lastError;
  }

  mapStripeStatusToApplicationStatus(stripeStatus) {
    switch (stripeStatus) {
      case 'succeeded':
        return ApplicationStatus.PAYMENT_RECEIVED;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return ApplicationStatus.AWAITING_PAYMENT;
      case 'processing':
        return ApplicationStatus.PAYMENT_PROCESSING;
      case 'canceled':
        return ApplicationStatus.PAYMENT_FAILED;
      default:
        return ApplicationStatus.AWAITING_PAYMENT;
    }
  }

  mapStripeErrorToUserMessage(error) {
    switch (error.code) {
      case 'card_declined':
        return 'Su tarjeta fue rechazada. Por favor, verifique los datos o intente con otra tarjeta.';
      case 'insufficient_funds':
        return 'Fondos insuficientes en su tarjeta. Por favor, intente con otra tarjeta.';
      case 'expired_card':
        return 'Su tarjeta ha expirado. Por favor, verifique la fecha de vencimiento.';
      case 'incorrect_cvc':
        return 'El código de seguridad (CVC) es incorrecto. Por favor, verifíquelo.';
      case 'invalid_number':
        return 'El número de tarjeta es inválido. Por favor, verifíquelo.';
      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
        return 'La fecha de vencimiento es inválida. Por favor, verifíquela.';
      case 'processing_error':
        return 'Error al procesar el pago. Por favor, intente nuevamente.';
      case 'rate_limit_error':
        return 'Demasiadas solicitudes. Por favor, espere un momento e intente nuevamente.';
      default:
        return 'Error al procesar el pago. Por favor, intente nuevamente o contacte soporte.';
    }
  }

  async processOxxoPayment(paymentData, options = {}) {
    const { maxRetries = 1, retryDelay = 1000, expirationDays = 2 } = options;
    let attempts = 0;
    let lastError = null;

    const startTime = Date.now();
    const config = getConfig();

    this.metrics.totalPaymentAttempts++;
    this.metrics.oxxoPayments++;

    if (!paymentData.customerId) {
      throw new Error('Customer ID is required for OXXO payment');
    }

    if (!paymentData.amount) {
      throw new Error('Payment amount is required');
    }

    const sanitizedData = {
      customerId: String(paymentData.customerId),
      amount: parseFloat(paymentData.amount),
      currency: String(paymentData.currency || 'MXN').toLowerCase(),
      description: String(paymentData.description || 'Permiso de Circulación'),
      referenceId: String(paymentData.referenceId || ''),
      idempotencyKey: paymentData.idempotencyKey || null
    };

    logger.debug('Processing OXXO payment for:', sanitizedData.referenceId);

    // Check payment velocity before creating payment intent
    const velocityData = {
      userId: paymentData.userId,
      email: paymentData.email,
      ipAddress: paymentData.ipAddress,
      amount: sanitizedData.amount,
      cardLast4: paymentData.cardLast4,
      cardFingerprint: paymentData.cardFingerprint
    };

    // Payment velocity checks (controlled by feature flag)
    if (config.features && config.features.paymentVelocity) {
      logger.debug('Performing payment velocity check for OXXO payment:', {
        applicationId: sanitizedData.applicationId,
        userId: paymentData.userId,
        amount: sanitizedData.amount
      });

      const velocityCheck = await paymentVelocityService.checkPaymentVelocity(velocityData);

      if (!velocityCheck.allowed) {
        logger.warn('OXXO payment blocked due to velocity violations:', {
          applicationId: sanitizedData.applicationId,
          userId: paymentData.userId,
          violations: velocityCheck.violations,
          riskScore: velocityCheck.riskScore
        });
        
        // Record velocity failure
        paymentMonitoring.recordPaymentFailure({
          error: new Error('Payment velocity check failed'),
          method: 'oxxo',
          amount: sanitizedData.amount,
          applicationId: sanitizedData.applicationId,
          userId: paymentData.userId,
          reason: 'velocity_check_failed',
          violations: velocityCheck.violations
        });
        
        const error = new Error('Su pago ha sido rechazado por motivos de seguridad. Por favor, intente más tarde o contacte a soporte.');
        error.code = 'velocity_check_failed';
        error.violations = velocityCheck.violations;
        error.riskScore = velocityCheck.riskScore;
        throw error;
      }

      // Log velocity risk score if check passed but has some risk
      if (velocityCheck.riskScore > 0) {
        logger.info('OXXO payment proceeding with velocity risk score:', {
          applicationId: sanitizedData.applicationId,
          riskScore: velocityCheck.riskScore,
          violations: velocityCheck.violations
        });
      }

      logger.debug('OXXO payment velocity check passed:', {
        applicationId: sanitizedData.applicationId,
        userId: paymentData.userId,
        riskScore: velocityCheck.riskScore
      });
    } else {
      logger.debug('Payment velocity checks are disabled via configuration');
    }

    // Record payment attempt
    paymentMonitoring.recordPaymentAttempt({
      method: 'oxxo',
      amount: sanitizedData.amount,
      applicationId: sanitizedData.applicationId,
      userId: paymentData.userId
    });

    while (attempts <= maxRetries) {
      try {
        if (!this.initialized || !this.stripe) {
          logger.debug('Stripe not initialized, initializing now');
          await this.initializeStripe();
        }

        let applicationId;
        if (sanitizedData.applicationId && !isNaN(parseInt(sanitizedData.applicationId, 10))) {
          applicationId = parseInt(sanitizedData.applicationId, 10);
        } else if (sanitizedData.referenceId && sanitizedData.referenceId.startsWith('APP-')) {
          const extractedId = sanitizedData.referenceId.replace('APP-', '');
          if (!isNaN(parseInt(extractedId, 10))) {
            applicationId = parseInt(extractedId, 10);
          }
        }

        const paymentIntentIdempotencyKey = sanitizedData.idempotencyKey ||
                                           `oxxo-${applicationId || sanitizedData.referenceId}`;

        logger.debug('OXXO payment idempotency key:', paymentIntentIdempotencyKey);

        // Check rate limit
        this.checkRateLimit(sanitizedData.customerId, applicationId);

        try {
          const paymentIntent = await this.circuitBreakers.oxxoPayment.execute(async () => {
            logger.info('Customer ID for OXXO Payment Intent:', sanitizedData.customerId);

            const oxxoPaymentData = {
              customerId: sanitizedData.customerId,
              amount: sanitizedData.amount,
              currency: sanitizedData.currency,
              description: sanitizedData.description,
              applicationId: applicationId,
              referenceId: sanitizedData.referenceId
            };

            logger.debug('Processing OXXO payment for application ID:', applicationId);

            // Use standard Stripe SDK for OXXO payment
            const paymentIntent = await this.stripe.paymentIntents.create({
              amount: Math.round(oxxoPaymentData.amount * 100), // Convert to cents
              currency: oxxoPaymentData.currency || 'mxn',
              customer: oxxoPaymentData.customerId,
              description: oxxoPaymentData.description || 'Permiso de Circulación',
              metadata: {
                application_id: String(oxxoPaymentData.applicationId || 'unknown'),
                reference_id: String(oxxoPaymentData.referenceId || 'unknown')
              },
              payment_method_types: ['oxxo'] // OXXO payments only
            }, {
              idempotencyKey: paymentIntentIdempotencyKey
            });

            logger.debug('OXXO Payment Intent created with idempotency key:', paymentIntentIdempotencyKey);
            
            // Create OXXO payment method
            const paymentMethod = await this.stripe.paymentMethods.create({
              type: 'oxxo',
              billing_details: {
                email: paymentData.email || 'customer@example.com',
                name: paymentData.name || 'OXXO Customer'
              }
            });
            
            logger.debug('OXXO Payment Method created:', paymentMethod.id);
            
            // Attach payment method to payment intent
            await this.stripe.paymentIntents.update(paymentIntent.id, {
              payment_method: paymentMethod.id
            });
            
            logger.debug('OXXO Payment Method attached to Payment Intent');
            
            // Confirm the payment intent to generate OXXO details
            const confirmedIntent = await this.stripe.paymentIntents.confirm(paymentIntent.id);
            
            logger.debug('OXXO Payment Intent confirmed:', confirmedIntent.id);
            
            // Wait for OXXO voucher generation to complete
            logger.info('Waiting for OXXO voucher generation...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Retrieve the payment intent again to get updated OXXO details
            const updatedIntent = await this.stripe.paymentIntents.retrieve(paymentIntent.id);
            logger.debug('Retrieved updated payment intent with OXXO details');
            
            return updatedIntent;
          });

          const duration = Date.now() - startTime;
          this.metrics.processingTimes.push(duration);
          
          // Fix memory leak - limit array size
          const MAX_PROCESSING_TIMES = 1000;
          if (this.metrics.processingTimes.length > MAX_PROCESSING_TIMES) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-MAX_PROCESSING_TIMES);
          }
          
          // Calculate average
          if (this.metrics.processingTimes.length > 0) {
            const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
            this.metrics.averageProcessingTime = Math.round(sum / this.metrics.processingTimes.length);
          }
          
          this.metrics.successfulPayments++;

          logger.info('OXXO Payment Intent created successfully:', {
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            duration: `${duration}ms`
          });

          // Validate and extract OXXO reference from payment intent
          if (!paymentIntent.next_action || paymentIntent.next_action.type !== 'oxxo_display_details') {
            logger.error('OXXO Payment Intent missing required next_action details:', {
              paymentIntentId: paymentIntent.id,
              status: paymentIntent.status,
              nextAction: paymentIntent.next_action,
              timestamp: new Date().toISOString(),
              waitApplied: true
            });
            throw new Error('Failed to generate OXXO payment details from Stripe');
          }
          
          logger.info('OXXO voucher details received after wait:', {
            paymentIntentId: paymentIntent.id,
            hasNextAction: !!paymentIntent.next_action,
            nextActionType: paymentIntent.next_action?.type,
            hasOxxoDetails: !!paymentIntent.next_action?.oxxo_display_details,
            hasReference: !!paymentIntent.next_action?.oxxo_display_details?.number
          });

          const oxxoDetails = paymentIntent.next_action.oxxo_display_details;

          // Extract OXXO reference - use the correct field from Stripe API
          const oxxoReference = oxxoDetails.number;
          const hostedVoucherUrl = oxxoDetails.hosted_voucher_url;
          const expiresAt = oxxoDetails.expires_after;

          // Validate all required OXXO fields are present
          if (!oxxoReference) {
            logger.error('OXXO Payment Intent missing reference number:', {
              paymentIntentId: paymentIntent.id,
              oxxoDetails,
              timestamp: new Date().toISOString(),
              waitApplied: true
            });
            throw new Error('Stripe did not generate OXXO reference number');
          }
          
          logger.info('OXXO reference successfully extracted:', {
            paymentIntentId: paymentIntent.id,
            oxxoReference: oxxoReference,
            referenceLength: oxxoReference.length,
            hasVoucherUrl: !!hostedVoucherUrl,
            hasExpiration: !!expiresAt
          });

          if (!hostedVoucherUrl) {
            logger.warn('OXXO Payment Intent missing hosted voucher URL:', {
              paymentIntentId: paymentIntent.id,
              oxxoReference
            });
          }

          if (!expiresAt) {
            logger.warn('OXXO Payment Intent missing expiration time, using default:', {
              paymentIntentId: paymentIntent.id,
              oxxoReference
            });
          }

          // Calculate proper expiration timestamp
          const expirationTimestamp = Math.ceil((Date.now() / 1000) / 60) * 60 + (expirationDays * 24 * 60 * 60);

          logger.info('OXXO Payment Intent processed successfully:', {
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            oxxoReference: oxxoReference,
            hostedVoucherUrl: hostedVoucherUrl,
            expiresAt: new Date(expirationTimestamp * 1000).toISOString()
          });

          return {
            success: true,
            orderId: paymentIntent.id,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            paymentMethod: 'oxxo',
            amount: paymentIntent.amount / 100, // Convert back from cents
            currency: paymentIntent.currency.toUpperCase(),
            clientSecret: paymentIntent.client_secret,
            paymentStatus: this.mapStripeStatusToApplicationStatus(paymentIntent.status),
            created: new Date(paymentIntent.created * 1000).toISOString(),
            metadata: paymentIntent.metadata,
            // OXXO specific fields - guaranteed to be present
            oxxoReference: oxxoReference,
            hostedVoucherUrl: hostedVoucherUrl,
            barcodeUrl: hostedVoucherUrl, // Stripe provides hosted voucher URL
            expiresAt: new Date(expirationTimestamp * 1000).toISOString()
          };
        } catch (paymentError) {
          this.metrics.failedPayments++;
          logger.error('OXXO Payment Intent creation failed:', {
            error: paymentError.message,
            code: paymentError.code,
            type: paymentError.type,
            referenceId: sanitizedData.referenceId
          });

          return {
            success: false,
            orderId: null,
            paymentIntentId: null,
            status: 'failed',
            paymentMethod: 'oxxo',
            failureMessage: this.mapStripeErrorToUserMessage(paymentError),
            errorCode: paymentError.code,
            errorType: paymentError.type
          };
        }
      } catch (error) {
        attempts++;
        lastError = error;

        const isRetryableError = this.isRetryableError(error);

        if (attempts <= maxRetries && isRetryableError) {
          logger.warn(`Error processing OXXO payment (attempt ${attempts}/${maxRetries + 1}):`, {
            error: error.message,
            retrying: true,
            delay: retryDelay
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));

          if (error.message.includes('not properly initialized') || error.message.includes('not available')) {
            logger.debug('Resetting Stripe instance before retry');
            this.initialized = false;
            this.stripe = null;
            this.initPromise = null;
          }
        } else {
          this.metrics.failedPayments++;
          logger.error('Error processing OXXO payment:', {
            error: error.message,
            stack: error.stack,
            attempts,
            retryable: isRetryableError
          });
          throw error;
        }
      }
    }

    throw lastError;
  }


  /**
   * Get current state of all circuit breakers
   * @returns {Object} Circuit breaker states
   */
  getCircuitBreakerStates() {
    const states = {};
    
    for (const [name, circuitBreaker] of Object.entries(this.circuitBreakers)) {
      states[name] = circuitBreaker.getState();
    }
    
    return states;
  }

  /**
   * Construct and verify webhook event from Stripe
   * @param {Buffer} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Verified Stripe event
   */
  constructWebhookEvent(payload, signature) {
    try {
      const config = getConfig();
      
      if (!signature) {
        logger.error('Webhook signature verification failed: Missing stripe-signature header');
        throw new Error('Missing stripe-signature header');
      }

      if (!config.stripe?.webhookSecret) {
        logger.error('Webhook signature verification failed: STRIPE_WEBHOOK_SECRET not configured');
        logger.error('Please set the STRIPE_WEBHOOK_SECRET environment variable');
        throw new Error('Webhook secret not configured - signature verification required');
      }

      // Verify the webhook signature using Stripe SDK
      // This ensures all webhooks are verified regardless of environment
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info('Webhook signature verified successfully:', {
        eventId: event.id,
        eventType: event.type,
        environment: config.nodeEnv
      });

      return event;
    } catch (error) {
      // Don't try to access config if it failed to load
      let configInfo = {};
      try {
        const config = getConfig();
        configInfo = {
          hasSecret: !!config.stripe?.webhookSecret,
          environment: config.nodeEnv || config.env || 'development'
        };
      } catch (configError) {
        configInfo = {
          hasSecret: false,
          environment: 'unknown',
          configError: configError.message
        };
      }
      
      logger.error('Webhook signature verification failed:', {
        error: error.message,
        hasSignature: !!signature,
        ...configInfo
      });
      throw error;
    }
  }

  checkRateLimit(customerId, applicationId) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${customerId}-${minute}`;
    
    const count = this.rateLimiter.get(key) || 0;
    
    // Clean old entries
    if (this.rateLimiter.size > 1000) {
      const oldestKey = this.rateLimiter.keys().next().value;
      this.rateLimiter.delete(oldestKey);
    }
    
    if (count >= this.emergencyLimits.maxPaymentsPerCustomer) {
      logger.warn('Rate limit exceeded for customer:', {
        customerId,
        applicationId,
        count,
        limit: this.emergencyLimits.maxPaymentsPerCustomer
      });
      
      const error = new Error('Too many payment attempts. Please wait a moment before trying again.');
      error.code = 'rate_limit_exceeded';
      throw error;
    }
    
    this.rateLimiter.set(key, count + 1);
  }
}

// Export singleton instance
module.exports = new StripePaymentService();

// src/services/stripe-payment.service.js
const { logger } = require('../utils/enhanced-logger');
const { ApplicationStatus } = require('../constants');
const stripeConfig = require('../config/stripe');
const config = require('../config');
const { CircuitBreaker } = require('../utils/circuit-breaker');
const { calculateRiskScore } = require('../utils/fraud-detection');

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
      speiPayments: 0,
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
        halfOpenSuccessThreshold: 2
      }),

      speiPayment: new CircuitBreaker({
        name: 'stripe-spei-payment',
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenSuccessThreshold: 2
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

    this.initializeStripe().catch(err => {
      logger.error('Failed to initialize Stripe during service construction:', err);
    });
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
        this.stripe = stripeConfig.getInstance();

        if (!this.stripe) {
          throw new Error('Failed to get Stripe instance from configuration');
        }

        logger.debug('Stripe instance methods:', {
          hasCreateCustomer: typeof this.stripe.createCustomer === 'function',
          hasFindCustomerByEmail: typeof this.stripe.findCustomerByEmail === 'function',
          hasCreatePaymentIntentWithCard: typeof this.stripe.createPaymentIntentWithCard === 'function',
          hasCreatePaymentIntentWithOxxo: typeof this.stripe.createPaymentIntentWithOxxo === 'function',
          hasCreatePaymentIntentWithSpei: typeof this.stripe.createPaymentIntentWithSpei === 'function',
          hasGetPaymentIntent: typeof this.stripe.getPaymentIntent === 'function'
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

    const customerIdempotencyKey = idempotencyKey || `customer-${sanitizedData.email}-${Date.now()}`;

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
          const existingCustomer = await this.stripe.findCustomerByEmail(sanitizedData.email);

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
          customer = await this.stripe.createCustomer(customerRequest, {
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
              const existingCustomer = await this.stripe.findCustomerByEmail(sanitizedData.email);

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
                                           `pi-${sanitizedData.referenceId}-${sanitizedData.token.substring(0, 8)}-${Date.now()}`;

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

            const result = await this.stripe.createPaymentIntentWithCard(paymentData, {
              idempotencyKey: paymentIntentIdempotencyKey
            });

            logger.debug('Payment Intent created with idempotency key:', paymentIntentIdempotencyKey);
            return result;
          });

          const duration = Date.now() - startTime;
          this.metrics.processingTimes.push(duration);
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

    const paymentIntentIdempotencyKey = sanitizedData.idempotencyKey ||
                                       `oxxo-${sanitizedData.referenceId}-${Date.now()}`;

    logger.debug('Processing OXXO payment for:', sanitizedData.referenceId, 'with idempotency key:', paymentIntentIdempotencyKey);

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

            const result = await this.stripe.createPaymentIntentWithOxxo(oxxoPaymentData, {
              idempotencyKey: paymentIntentIdempotencyKey
            });

            logger.debug('OXXO Payment Intent created with idempotency key:', paymentIntentIdempotencyKey);
            return result;
          });

          const duration = Date.now() - startTime;
          this.metrics.processingTimes.push(duration);
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
              nextAction: paymentIntent.next_action
            });
            throw new Error('Failed to generate OXXO payment details from Stripe');
          }

          const oxxoDetails = paymentIntent.next_action.oxxo_display_details;

          // Extract OXXO reference - use the correct field from Stripe API
          const oxxoReference = oxxoDetails.number;
          const hostedVoucherUrl = oxxoDetails.hosted_voucher_url;
          const expiresAt = oxxoDetails.expires_after;

          // Validate all required OXXO fields are present
          if (!oxxoReference) {
            logger.error('OXXO Payment Intent missing reference number:', {
              paymentIntentId: paymentIntent.id,
              oxxoDetails
            });
            throw new Error('Stripe did not generate OXXO reference number');
          }

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
          const expirationTimestamp = expiresAt || (Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60));

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

  async processBankTransferPayment(paymentData, options = {}) {
    const { maxRetries = 1, retryDelay = 1000 } = options;
    let attempts = 0;
    let lastError = null;

    const startTime = Date.now();

    this.metrics.totalPaymentAttempts++;
    this.metrics.speiPayments++;

    if (!paymentData.customerId) {
      throw new Error('Customer ID is required for SPEI payment');
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

    const paymentIntentIdempotencyKey = sanitizedData.idempotencyKey ||
                                       `spei-${sanitizedData.referenceId}-${Date.now()}`;

    logger.debug('Processing SPEI payment for:', sanitizedData.referenceId, 'with idempotency key:', paymentIntentIdempotencyKey);

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

        try {
          const paymentIntent = await this.circuitBreakers.speiPayment.execute(async () => {
            logger.info('Customer ID for SPEI Payment Intent:', sanitizedData.customerId);

            const speiPaymentData = {
              customerId: sanitizedData.customerId,
              amount: sanitizedData.amount,
              currency: sanitizedData.currency,
              description: sanitizedData.description,
              applicationId: applicationId,
              referenceId: sanitizedData.referenceId
            };

            logger.debug('Processing SPEI payment for application ID:', applicationId);

            const result = await this.stripe.createPaymentIntentWithSpei(speiPaymentData, {
              idempotencyKey: paymentIntentIdempotencyKey
            });

            logger.debug('SPEI Payment Intent created with idempotency key:', paymentIntentIdempotencyKey);
            return result;
          });

          const duration = Date.now() - startTime;
          this.metrics.processingTimes.push(duration);
          this.metrics.successfulPayments++;

          logger.info('SPEI Payment Intent created successfully:', {
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
            paymentMethod: 'spei',
            amount: paymentIntent.amount / 100, // Convert back from cents
            currency: paymentIntent.currency.toUpperCase(),
            clientSecret: paymentIntent.client_secret,
            paymentStatus: this.mapStripeStatusToApplicationStatus(paymentIntent.status),
            created: new Date(paymentIntent.created * 1000).toISOString(),
            metadata: paymentIntent.metadata,
            // SPEI specific fields will be available after confirmation
            speiReference: null, // Will be populated after payment method is attached
            expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString() // 24 hours
          };
        } catch (paymentError) {
          this.metrics.failedPayments++;
          logger.error('SPEI Payment Intent creation failed:', {
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
            paymentMethod: 'spei',
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
          logger.warn(`Error processing SPEI payment (attempt ${attempts}/${maxRetries + 1}):`, {
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
          logger.error('Error processing SPEI payment:', {
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
}

module.exports = StripePaymentService;

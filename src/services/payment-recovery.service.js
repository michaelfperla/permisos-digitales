// src/services/payment-recovery.service.js
const { logger } = require('../utils/logger');
// CIRCULAR DEPENDENCY FIX: Lazy load stripe payment service
let stripePaymentService = null;
function getStripePaymentService() {
  if (!stripePaymentService) {
    stripePaymentService = require('./stripe-payment.service');
  }
  return stripePaymentService;
}
const applicationRepository = require('../repositories/application.repository');
const paymentRepository = require('../repositories/payment.repository');
const paymentRecoveryRepository = require('../repositories/payment-recovery.repository');
const { ApplicationStatus } = require('../constants');
const { PaymentStatus, StripeConstants } = require('../constants/payment.constants');
const { CircuitBreaker } = require('../utils/circuit-breaker');
const redisClient = require('../utils/redis-client');

// Stripe payment intent status constants
const STRIPE_PAYMENT_INTENT_STATUS = Object.freeze({
  SUCCEEDED: 'succeeded',
  REQUIRES_PAYMENT_METHOD: 'requires_payment_method',
  REQUIRES_CONFIRMATION: 'requires_confirmation',
  REQUIRES_ACTION: 'requires_action',
  PROCESSING: 'processing',
  CANCELED: 'canceled',
  REQUIRES_CAPTURE: 'requires_capture'
});

class PaymentRecoveryService {
  constructor() {
    this.maxRecoveryAttempts = 3;
    this.recoveryDelays = [30000, 60000, 120000]; // Exponential backoff: 30s, 60s, 120s
    
    // Initialize circuit breaker for recovery operations
    this.circuitBreaker = new CircuitBreaker({
      name: 'payment-recovery',
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenSuccessThreshold: 2,
      isFailure: (error) => {
        // Don't open circuit for recoverable payment errors
        return !(error.code === 'payment_intent_not_found' || 
                error.code === 'max_attempts_reached');
      }
    });
    
    // Metrics tracking
    this.metrics = {
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakerTrips: 0
    };
    
    // Set up periodic cleanup every 24 hours (now handled in database)
    this.cleanupInterval = setInterval(async () => {
      try {
        await paymentRecoveryRepository.cleanupOldAttempts(7); // Clean attempts older than 7 days
      } catch (error) {
        logger.error('Error in recovery cleanup job:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Attempt to recover a failed payment
   */
  async attemptPaymentRecovery(applicationId, paymentIntentId, errorDetails) {
    // Implement idempotency - use stable key without timestamp
    const idempotencyKey = `recovery_${applicationId}_${paymentIntentId}`;
    const cachedResult = await redisClient.get(idempotencyKey);
    if (cachedResult) {
      logger.info('Returning cached recovery result:', { applicationId, paymentIntentId });
      return JSON.parse(cachedResult);
    }
    
    try {
      // Use circuit breaker for recovery attempts
      return await this.circuitBreaker.execute(async () => {
        logger.info('Attempting payment recovery:', {
          applicationId,
          paymentIntentId,
          errorDetails: errorDetails?.message
        });

        this.metrics.recoveryAttempts++;

        // Check recovery attempts from database
        const existingAttempt = await paymentRecoveryRepository.getRecoveryAttempt(applicationId, paymentIntentId);
        const attemptCount = existingAttempt ? existingAttempt.attempt_count : 0;

        if (attemptCount >= this.maxRecoveryAttempts) {
          logger.warn('Max recovery attempts reached:', {
            applicationId,
            paymentIntentId,
            attempts: attemptCount
          });
          
          await paymentRecoveryRepository.updateRecoveryStatus(
            applicationId, 
            paymentIntentId, 
            'max_attempts_reached'
          );
          
          const result = { success: false, reason: 'max_attempts_reached' };
          await redisClient.set(idempotencyKey, JSON.stringify(result), 'EX', 300); // Cache for 5 minutes
          return result;
        }

        // Update attempt in database
        await paymentRecoveryRepository.upsertRecoveryAttempt(applicationId, paymentIntentId, {
          attemptCount: attemptCount + 1,
          lastAttemptTime: new Date(),
          recoveryStatus: 'recovering'
        });

        // Get current payment intent status from Stripe
        const paymentIntent = await getStripePaymentService().retrievePaymentIntent(paymentIntentId);

        if (!paymentIntent) {
          logger.error('Payment intent not found during recovery:', { paymentIntentId });
          await paymentRecoveryRepository.updateRecoveryStatus(
            applicationId, 
            paymentIntentId, 
            'failed',
            'Payment intent not found'
          );
          
          const result = { success: false, reason: 'payment_intent_not_found' };
          await redisClient.set(idempotencyKey, JSON.stringify(result), 'EX', 300);
          return result;
        }

        // Handle different payment intent statuses
        let result;
        switch (paymentIntent.status) {
          case STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED:
            result = await this.handleSucceededPayment(applicationId, paymentIntentId, paymentIntent);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_PAYMENT_METHOD:
            result = await this.handleRequiresPaymentMethod(applicationId, paymentIntentId, paymentIntent);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_CONFIRMATION:
            result = await this.handleRequiresConfirmation(applicationId, paymentIntentId, paymentIntent);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_ACTION:
            result = await this.handleRequiresAction(applicationId, paymentIntentId, paymentIntent);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.PROCESSING:
            result = await this.handleProcessingPayment(applicationId, paymentIntentId, paymentIntent, attemptCount + 1);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.CANCELED:
            result = await this.handleCanceledPayment(applicationId, paymentIntentId, paymentIntent);
            break;
          
          case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_CAPTURE:
            result = await this.handleRequiresCapture(applicationId, paymentIntentId, paymentIntent);
            break;
          
          default:
            logger.warn('Unknown payment intent status during recovery:', {
              status: paymentIntent.status,
              paymentIntentId
            });
            result = { success: false, reason: 'unknown_status', status: paymentIntent.status };
        }
        
        // Update recovery status based on result
        if (result.success) {
          await paymentRecoveryRepository.updateRecoveryStatus(applicationId, paymentIntentId, 'succeeded');
          this.metrics.successfulRecoveries++;
        } else if (result.reason === 'still_processing') {
          // Keep status as recovering for processing payments
          await paymentRecoveryRepository.updateRecoveryStatus(applicationId, paymentIntentId, 'recovering');
        } else {
          await paymentRecoveryRepository.updateRecoveryStatus(
            applicationId, 
            paymentIntentId, 
            'failed',
            result.error || result.message || result.reason
          );
          this.metrics.failedRecoveries++;
        }
        
        // Cache result
        await redisClient.set(idempotencyKey, JSON.stringify(result), 'EX', 300);
        return result;
      });
    } catch (error) {
      // Handle circuit breaker trips
      if (error.message?.includes('Circuit breaker is OPEN')) {
        logger.error('Circuit breaker is open for payment recovery');
        this.metrics.circuitBreakerTrips++;
        return { success: false, reason: 'circuit_breaker_open' };
      }
      
      logger.error('Error during payment recovery:', {
        error: error.message,
        applicationId,
        paymentIntentId
      });
      
      const result = { success: false, reason: 'recovery_error', error: error.message };
      await redisClient.set(idempotencyKey, JSON.stringify(result), 'EX', 300);
      return result;
    }
  }

  /**
   * Handle succeeded payment during recovery
   */
  async handleSucceededPayment(applicationId, paymentIntentId, paymentIntent) {
    try {
      // Update payment status
      await paymentRepository.updatePaymentOrder(applicationId, paymentIntentId, PaymentStatus.SUCCEEDED);
      
      // Update application status
      await applicationRepository.update(applicationId, { 
        status: ApplicationStatus.PAYMENT_PROCESSING 
      });

      logger.info('Payment recovery successful - payment was actually succeeded:', {
        applicationId,
        paymentIntentId
      });

      return { 
        success: true, 
        reason: 'payment_succeeded',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        }
      };
    } catch (error) {
      logger.error('Error handling succeeded payment during recovery:', error);
      throw error;
    }
  }

  /**
   * Handle payment that requires payment method
   */
  async handleRequiresPaymentMethod(applicationId, paymentIntentId, paymentIntent) {
    logger.info('Payment requires new payment method:', {
      applicationId,
      paymentIntentId
    });

    // Update status to indicate user needs to retry
    await paymentRepository.updatePaymentOrder(applicationId, paymentIntentId, PaymentStatus.FAILED);

    return { 
      success: false, 
      reason: 'requires_payment_method',
      userAction: 'retry_payment',
      message: 'El pago requiere un nuevo método de pago. Por favor, intente nuevamente.'
    };
  }

  /**
   * Handle payment that requires confirmation
   */
  async handleRequiresConfirmation(applicationId, paymentIntentId, paymentIntent) {
    try {
      logger.info('Attempting to confirm payment during recovery:', {
        applicationId,
        paymentIntentId
      });

      // Try to confirm the payment intent
      const confirmedPayment = await getStripePaymentService().confirmPaymentIntent(paymentIntentId);

      if (confirmedPayment.status === STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED) {
        return await this.handleSucceededPayment(applicationId, paymentIntentId, confirmedPayment);
      }

      return { 
        success: false, 
        reason: 'confirmation_failed',
        status: confirmedPayment.status
      };
    } catch (error) {
      logger.error('Error confirming payment during recovery:', error);
      return { 
        success: false, 
        reason: 'confirmation_error',
        error: error.message
      };
    }
  }

  /**
   * Handle payment that requires action
   */
  async handleRequiresAction(applicationId, paymentIntentId, paymentIntent) {
    logger.info('Payment requires user action:', {
      applicationId,
      paymentIntentId,
      nextAction: paymentIntent.next_action?.type
    });

    return { 
      success: false, 
      reason: 'requires_action',
      userAction: 'complete_authentication',
      nextAction: paymentIntent.next_action,
      message: 'El pago requiere autenticación adicional. Por favor, complete el proceso.'
    };
  }

  /**
   * Handle processing payment
   */
  async handleProcessingPayment(applicationId, paymentIntentId, paymentIntent, attemptCount) {
    logger.info('Payment is still processing:', {
      applicationId,
      paymentIntentId,
      attemptCount
    });

    // Schedule another check with exponential backoff
    const delayIndex = Math.min(Math.max(0, attemptCount - 1), this.recoveryDelays.length - 1);
    const delay = this.recoveryDelays[delayIndex];
    
    setTimeout(() => {
      this.attemptPaymentRecovery(applicationId, paymentIntentId, { message: 'scheduled_recheck' })
        .catch(error => {
          logger.error('Error in scheduled payment recheck:', {
            error: error.message,
            applicationId,
            paymentIntentId
          });
        });
    }, delay);

    return { 
      success: false, 
      reason: 'still_processing',
      message: 'El pago está siendo procesado. Por favor, espere.',
      nextCheckIn: delay / 1000 // seconds
    };
  }

  /**
   * Handle canceled payment
   */
  async handleCanceledPayment(applicationId, paymentIntentId, paymentIntent) {
    logger.info('Payment was canceled:', {
      applicationId,
      paymentIntentId
    });

    await paymentRepository.updatePaymentOrder(applicationId, paymentIntentId, PaymentStatus.CANCELLED);

    return { 
      success: false, 
      reason: 'payment_canceled',
      userAction: 'retry_payment',
      message: 'El pago fue cancelado. Por favor, intente nuevamente.'
    };
  }

  /**
   * Handle payment that requires capture
   */
  async handleRequiresCapture(applicationId, paymentIntentId, paymentIntent) {
    try {
      logger.info('Payment requires capture:', {
        applicationId,
        paymentIntentId,
        amount: paymentIntent.amount
      });

      // Check if application is approved for auto-capture
      const application = await applicationRepository.findById(applicationId);
      
      if (!application) {
        logger.error('Application not found during capture:', { applicationId });
        return { 
          success: false, 
          reason: 'application_not_found',
          error: 'Application not found'
        };
      }

      // Auto-capture if application is in an approved state
      const autoCapturableStatuses = [
        ApplicationStatus.APPROVED,
        ApplicationStatus.PAYMENT_PROCESSING,
        ApplicationStatus.PAYMENT_RECEIVED
      ];

      if (autoCapturableStatuses.includes(application.status)) {
        logger.info('Auto-capturing payment for approved application:', {
          applicationId,
          applicationStatus: application.status,
          paymentIntentId
        });

        try {
          const capturedPayment = await getStripePaymentService().capturePaymentIntent(paymentIntentId);
          
          if (capturedPayment.status === STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED) {
            return await this.handleSucceededPayment(applicationId, paymentIntentId, capturedPayment);
          } else {
            logger.warn('Capture did not result in succeeded status:', {
              applicationId,
              paymentIntentId,
              resultStatus: capturedPayment.status
            });
            
            return { 
              success: false, 
              reason: 'capture_failed',
              status: capturedPayment.status,
              error: capturedPayment.last_payment_error?.message
            };
          }
        } catch (captureError) {
          logger.error('Error capturing payment:', {
            error: captureError.message,
            applicationId,
            paymentIntentId
          });
          
          // Send alert for capture failure
          const alertService = require('./alert.service');
          await alertService.sendAlert({
            title: 'Payment Capture Failed',
            message: `Failed to capture payment for application ${applicationId}`,
            severity: 'HIGH',
            details: {
              applicationId,
              paymentIntentId,
              error: captureError.message
            }
          });
          
          return { 
            success: false, 
            reason: 'capture_error',
            error: captureError.message
          };
        }
      }

      // For non-approved applications, update status and alert admin
      logger.info('Application not approved for auto-capture, alerting admin:', {
        applicationId,
        applicationStatus: application.status,
        paymentIntentId
      });

      await paymentRepository.updatePaymentOrder(applicationId, paymentIntentId, PaymentStatus.PROCESSING);

      // Send alert for manual review
      const alertService = require('./alert.service');
      await alertService.sendAlert({
        title: 'Payment Requires Manual Capture',
        message: `Payment for application ${applicationId} requires manual capture review`,
        severity: 'MEDIUM',
        details: {
          applicationId,
          paymentIntentId,
          applicationStatus: application.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency
        }
      });

      return { 
        success: false, 
        reason: 'requires_manual_capture',
        userAction: 'await_admin_review',
        message: 'Su pago está siendo revisado por un administrador. Se le notificará cuando se complete el proceso.',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        }
      };
    } catch (error) {
      logger.error('Error handling requires capture:', {
        error: error.message,
        applicationId,
        paymentIntentId
      });
      
      return { 
        success: false, 
        reason: 'capture_handling_error',
        error: error.message
      };
    }
  }

  /**
   * Reconcile payment status with Stripe
   */
  async reconcilePaymentStatus(applicationId) {
    try {
      logger.info('Starting payment reconciliation:', { applicationId });

      // Get application and payment details
      const application = await applicationRepository.findById(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      const paymentOrder = await paymentRepository.getPaymentByApplicationId(applicationId);
      if (!paymentOrder || !paymentOrder.stripe_payment_intent_id) {
        logger.warn('No payment order found for reconciliation:', { applicationId });
        return { success: false, reason: 'no_payment_order' };
      }

      // Get current status from Stripe
      const paymentIntent = await getStripePaymentService().retrievePaymentIntent(
        paymentOrder.stripe_payment_intent_id
      );

      if (!paymentIntent) {
        logger.error('Payment intent not found in Stripe:', {
          paymentIntentId: paymentOrder.stripe_payment_intent_id
        });
        return { success: false, reason: 'payment_intent_not_found' };
      }

      // Check if statuses are out of sync
      const currentStatus = paymentOrder.status;
      const stripeStatus = paymentIntent.status;

      if (this.shouldUpdateStatus(currentStatus, stripeStatus)) {
        logger.info('Payment status out of sync, updating:', {
          applicationId,
          currentStatus,
          stripeStatus
        });

        // Update payment status
        await paymentRepository.updatePaymentOrder(
          applicationId,
          paymentOrder.stripe_payment_intent_id,
          stripeStatus
        );

        // Update application status if payment succeeded
        if (stripeStatus === STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED && application.status !== ApplicationStatus.PAYMENT_PROCESSING) {
          await applicationRepository.update(applicationId, {
            status: ApplicationStatus.PAYMENT_PROCESSING
          });
        }

        return {
          success: true,
          reason: 'status_updated',
          oldStatus: currentStatus,
          newStatus: stripeStatus
        };
      }

      return {
        success: true,
        reason: 'status_in_sync',
        status: currentStatus
      };
    } catch (error) {
      logger.error('Error during payment reconciliation:', {
        error: error.message,
        applicationId
      });
      return { success: false, reason: 'reconciliation_error', error: error.message };
    }
  }

  /**
   * Determine if status should be updated
   */
  shouldUpdateStatus(currentStatus, stripeStatus) {
    // Always update if Stripe shows succeeded but we don't
    if (stripeStatus === STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED && currentStatus !== PaymentStatus.SUCCEEDED) {
      return true;
    }

    // Update if Stripe shows canceled but we don't
    if (stripeStatus === STRIPE_PAYMENT_INTENT_STATUS.CANCELED && currentStatus !== PaymentStatus.CANCELLED) {
      return true;
    }

    // Update if there's a significant status change
    const statusPriority = {
      [STRIPE_PAYMENT_INTENT_STATUS.CANCELED]: 0,
      [STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_PAYMENT_METHOD]: 1,
      [STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_CONFIRMATION]: 2,
      [STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_ACTION]: 3,
      [STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_CAPTURE]: 4,
      [STRIPE_PAYMENT_INTENT_STATUS.PROCESSING]: 5,
      [STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED]: 6
    };

    const currentPriority = statusPriority[currentStatus] || -1;
    const stripePriority = statusPriority[stripeStatus] || -1;

    return stripePriority > currentPriority;
  }

  /**
   * Get recovery status for an application
   */
  async getRecoveryStatus(applicationId, paymentIntentId) {
    try {
      const recoveryAttempt = await paymentRecoveryRepository.getRecoveryAttempt(applicationId, paymentIntentId);
      
      if (!recoveryAttempt) {
        return {
          attempts: 0,
          maxAttempts: this.maxRecoveryAttempts,
          canRetry: true,
          lastAttemptTime: null,
          nextAttemptDelay: this.recoveryDelays[0],
          status: 'not_attempted'
        };
      }

      return {
        attempts: recoveryAttempt.attempt_count,
        maxAttempts: this.maxRecoveryAttempts,
        canRetry: recoveryAttempt.attempt_count < this.maxRecoveryAttempts && 
                  recoveryAttempt.recovery_status !== 'succeeded',
        lastAttemptTime: recoveryAttempt.last_attempt_time,
        nextAttemptDelay: this.recoveryDelays[Math.min(recoveryAttempt.attempt_count, this.recoveryDelays.length - 1)],
        status: recoveryAttempt.recovery_status,
        lastError: recoveryAttempt.last_error
      };
    } catch (error) {
      logger.error('Error getting recovery status:', error);
      throw error;
    }
  }
  
  /**
   * Get recovery metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreaker.getState(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get recovery statistics from database
   */
  async getRecoveryStats(hours = 24) {
    try {
      return await paymentRecoveryRepository.getRecoveryStats(hours);
    } catch (error) {
      logger.error('Error getting recovery stats:', error);
      throw error;
    }
  }
}

// Create singleton instance with lazy initialization
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new PaymentRecoveryService();
  }
  return instance;
}

// Export singleton instance for backward compatibility
// This ensures existing code continues to work
module.exports = getInstance();

// Also export the class for testing and future use
module.exports.PaymentRecoveryService = PaymentRecoveryService;
module.exports.getInstance = getInstance;

/**
 * Circuit Breaker Pattern Implementation
 * 
 * This utility implements the circuit breaker pattern to prevent cascading failures
 * when external services are experiencing issues. It tracks failures and temporarily
 * stops attempting operations after a threshold is reached, then allows a single
 * "test" request after a timeout period.
 */
const { logger } = require('./enhanced-logger');

// Circuit breaker states
const STATES = {
  CLOSED: 'CLOSED',     // Normal operation, requests pass through
  OPEN: 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if the service is back online
};

class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {Object} options - Circuit breaker options
   * @param {string} options.name - Name of the circuit breaker (for logging)
   * @param {number} options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param {number} options.resetTimeout - Time in ms before trying again (default: 30000 - 30 seconds)
   * @param {number} options.halfOpenSuccessThreshold - Successes needed in half-open state to close circuit (default: 2)
   * @param {Function} options.isFailure - Function to determine if an error should count as a failure (default: all errors)
   */
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
    this.isFailure = options.isFailure || (() => true);

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.totalCalls = 0;

    logger.info(`Circuit breaker "${this.name}" initialized`, {
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - The function to execute
   * @returns {Promise<any>} - The result of the function
   * @throws {Error} - If the circuit is open or the function throws
   */
  async execute(fn) {
    this.totalCalls++;

    // Check if the circuit is open
    if (this.state === STATES.OPEN) {
      // Check if it's time to try again
      const now = Date.now();
      const timeInOpen = now - this.lastStateChangeTime;

      if (timeInOpen >= this.resetTimeout) {
        this._transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker "${this.name}" is open`);
        error.code = 'CIRCUIT_OPEN';
        error.remainingTimeMs = this.resetTimeout - timeInOpen;
        logger.warn(`Circuit "${this.name}" is open, fast-failing request`, {
          timeInOpen: `${timeInOpen}ms`,
          resetTimeout: `${this.resetTimeout}ms`,
          remainingTime: `${this.resetTimeout - timeInOpen}ms`
        });
        throw error;
      }
    }

    // Execute the function
    try {
      const result = await fn();
      this._handleSuccess();
      return result;
    } catch (error) {
      this._handleFailure(error);
      throw error;
    }
  }

  /**
   * Handle a successful execution
   * @private
   */
  _handleSuccess() {
    this.totalSuccesses++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    // If we're in half-open state and have enough successes, close the circuit
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this._transitionToClosed();
      }
    }
  }

  /**
   * Handle a failed execution
   * @param {Error} error - The error that occurred
   * @private
   */
  _handleFailure(error) {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();

    // Only count as a failure if the isFailure function returns true
    if (!this.isFailure(error)) {
      logger.debug(`Error in circuit "${this.name}" not counted as failure based on isFailure function`, {
        errorMessage: error.message,
        errorCode: error.code
      });
      return;
    }

    // If we're in half-open state, any failure opens the circuit
    if (this.state === STATES.HALF_OPEN) {
      this._transitionToOpen();
      return;
    }

    // If we're in closed state, increment failure count
    if (this.state === STATES.CLOSED) {
      this.failureCount++;
      
      // If we've reached the threshold, open the circuit
      if (this.failureCount >= this.failureThreshold) {
        this._transitionToOpen();
      }
    }
  }

  /**
   * Transition to open state
   * @private
   */
  _transitionToOpen() {
    logger.warn(`Circuit "${this.name}" is now OPEN due to too many failures`, {
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      totalFailures: this.totalFailures,
      consecutiveFailures: this.consecutiveFailures
    });

    this.state = STATES.OPEN;
    this.lastStateChangeTime = Date.now();
  }

  /**
   * Transition to half-open state
   * @private
   */
  _transitionToHalfOpen() {
    logger.info(`Circuit "${this.name}" is now HALF-OPEN, testing service availability`, {
      timeInOpen: `${Date.now() - this.lastStateChangeTime}ms`,
      resetTimeout: `${this.resetTimeout}ms`
    });

    this.state = STATES.HALF_OPEN;
    this.lastStateChangeTime = Date.now();
    this.successCount = 0;
  }

  /**
   * Transition to closed state
   * @private
   */
  _transitionToClosed() {
    logger.info(`Circuit "${this.name}" is now CLOSED, service is operating normally`, {
      successCount: this.successCount,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold
    });

    this.state = STATES.CLOSED;
    this.lastStateChangeTime = Date.now();
    this.failureCount = 0;
  }

  /**
   * Reset the circuit breaker to closed state
   * Useful for testing or manual intervention
   */
  reset() {
    logger.info(`Circuit "${this.name}" manually reset to CLOSED state`);
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChangeTime = Date.now();
  }

  /**
   * Get the current state of the circuit breaker
   * @returns {Object} - Circuit breaker state information
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      successCount: this.successCount,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
      timeInCurrentState: Date.now() - this.lastStateChangeTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses
    };
  }
}

module.exports = {
  CircuitBreaker,
  STATES
};

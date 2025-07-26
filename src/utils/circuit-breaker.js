const { logger } = require('./logger');

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
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

  async execute(fn) {
    this.totalCalls++;

    if (this.state === STATES.OPEN) {
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

    try {
      const result = await fn();
      this._handleSuccess();
      return result;
    } catch (error) {
      this._handleFailure(error);
      throw error;
    }
  }

  _handleSuccess() {
    this.totalSuccesses++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this._transitionToClosed();
      }
    }
  }

  _handleFailure(error) {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();

    if (!this.isFailure(error)) {
      logger.debug(`Error in circuit "${this.name}" not counted as failure based on isFailure function`, {
        errorMessage: error.message,
        errorCode: error.code
      });
      return;
    }

    if (this.state === STATES.HALF_OPEN) {
      this._transitionToOpen();
      return;
    }

    if (this.state === STATES.CLOSED) {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this._transitionToOpen();
      }
    }
  }

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

  _transitionToHalfOpen() {
    logger.info(`Circuit "${this.name}" is now HALF-OPEN, testing service availability`, {
      timeInOpen: `${Date.now() - this.lastStateChangeTime}ms`,
      resetTimeout: `${this.resetTimeout}ms`
    });

    this.state = STATES.HALF_OPEN;
    this.lastStateChangeTime = Date.now();
    this.successCount = 0;
  }

  _transitionToClosed() {
    logger.info(`Circuit "${this.name}" is now CLOSED, service is operating normally`, {
      successCount: this.successCount,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold
    });

    this.state = STATES.CLOSED;
    this.lastStateChangeTime = Date.now();
    this.failureCount = 0;
  }

  reset() {
    logger.info(`Circuit "${this.name}" manually reset to CLOSED state`);
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChangeTime = Date.now();
  }

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

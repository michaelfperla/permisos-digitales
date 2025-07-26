// src/services/payment-state-machine.service.js
const { ApplicationStatus } = require('../constants');
const { logger } = require('../utils/logger');

/**
 * Payment State Machine Service
 * Manages application status transitions and ensures valid state changes
 */
class PaymentStateMachine {
  constructor() {
    // Define valid state transitions
    this.transitions = {
      // Payment flow states
      [ApplicationStatus.AWAITING_PAYMENT]: [
        ApplicationStatus.PAYMENT_PROCESSING,
        ApplicationStatus.PAYMENT_RECEIVED,
        ApplicationStatus.PAYMENT_FAILED,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        ApplicationStatus.CANCELLED
      ],
      [ApplicationStatus.AWAITING_OXXO_PAYMENT]: [
        ApplicationStatus.PAYMENT_PROCESSING,
        ApplicationStatus.PAYMENT_RECEIVED,
        ApplicationStatus.PAYMENT_FAILED,
        ApplicationStatus.CANCELLED
      ],
      [ApplicationStatus.PAYMENT_PROCESSING]: [
        ApplicationStatus.PAYMENT_RECEIVED,
        ApplicationStatus.PAYMENT_FAILED,
        ApplicationStatus.AWAITING_OXXO_PAYMENT, // OXXO requires voucher generation
        ApplicationStatus.CANCELLED
      ],
      [ApplicationStatus.PAYMENT_RECEIVED]: [
        ApplicationStatus.GENERATING_PERMIT,
        ApplicationStatus.ERROR_GENERATING_PERMIT
      ],
      [ApplicationStatus.PAYMENT_FAILED]: [
        ApplicationStatus.AWAITING_PAYMENT, // Can retry payment
        ApplicationStatus.CANCELLED
      ],
      
      // Permit generation states
      [ApplicationStatus.GENERATING_PERMIT]: [
        ApplicationStatus.PERMIT_READY,
        ApplicationStatus.ERROR_GENERATING_PERMIT
      ],
      [ApplicationStatus.ERROR_GENERATING_PERMIT]: [
        ApplicationStatus.GENERATING_PERMIT, // Can retry
        ApplicationStatus.CANCELLED
      ],
      
      // Final states
      [ApplicationStatus.PERMIT_READY]: [
        ApplicationStatus.COMPLETED,
        ApplicationStatus.EXPIRED
      ],
      [ApplicationStatus.COMPLETED]: [
        ApplicationStatus.EXPIRED,
        ApplicationStatus.RENEWAL_PENDING
      ],
      [ApplicationStatus.CANCELLED]: [
        // Terminal state - no transitions allowed
      ],
      [ApplicationStatus.EXPIRED]: [
        ApplicationStatus.RENEWAL_PENDING
      ],
      
      // Renewal states
      [ApplicationStatus.RENEWAL_PENDING]: [
        ApplicationStatus.RENEWAL_APPROVED,
        ApplicationStatus.RENEWAL_REJECTED,
        ApplicationStatus.AWAITING_PAYMENT // Start new payment flow
      ],
      [ApplicationStatus.RENEWAL_APPROVED]: [
        ApplicationStatus.AWAITING_PAYMENT // Start payment for renewal
      ],
      [ApplicationStatus.RENEWAL_REJECTED]: [
        // Terminal state for this renewal attempt
      ]
    };
    
    // Define terminal states
    this.terminalStates = new Set([
      ApplicationStatus.CANCELLED,
      ApplicationStatus.RENEWAL_REJECTED
    ]);
    
    // Define states that require payment
    this.paymentRequiredStates = new Set([
      ApplicationStatus.PAYMENT_RECEIVED,
      ApplicationStatus.GENERATING_PERMIT,
      ApplicationStatus.PERMIT_READY,
      ApplicationStatus.COMPLETED
    ]);
  }
  
  /**
   * Check if a state transition is valid
   * @param {string} fromState - Current state
   * @param {string} toState - Desired state
   * @returns {boolean} - Whether the transition is valid
   */
  canTransition(fromState, toState) {
    if (!fromState || !toState) {
      return false;
    }
    
    // Same state is always valid (idempotency)
    if (fromState === toState) {
      return true;
    }
    
    // Check if transition is defined
    const validTransitions = this.transitions[fromState] || [];
    return validTransitions.includes(toState);
  }
  
  /**
   * Validate and perform state transition
   * @param {Object} application - Current application object
   * @param {string} newState - Desired new state
   * @returns {Object} - Result object with success flag and message
   */
  validateTransition(application, newState) {
    const currentState = application.status;
    
    // Check if already in terminal state
    if (this.isTerminalState(currentState)) {
      return {
        isValid: false,
        error: `Cannot transition from terminal state: ${currentState}`,
        code: 'TERMINAL_STATE'
      };
    }
    
    // Check if transition is valid
    if (!this.canTransition(currentState, newState)) {
      return {
        isValid: false,
        error: `Invalid state transition from ${currentState} to ${newState}`,
        code: 'INVALID_TRANSITION',
        validTransitions: this.getValidTransitions(currentState)
      };
    }
    
    // Additional validation for payment states
    if (this.paymentRequiredStates.has(newState) && currentState !== newState) {
      if (!application.payment_processor_order_id) {
        return {
          isValid: false,
          error: `Cannot transition to ${newState} without payment`,
          code: 'PAYMENT_REQUIRED'
        };
      }
    }
    
    return {
      isValid: true,
      fromState: currentState,
      toState: newState
    };
  }
  
  /**
   * Get valid transitions from a given state
   * @param {string} state - Current state
   * @returns {Array} - Array of valid next states
   */
  getValidTransitions(state) {
    return this.transitions[state] || [];
  }
  
  /**
   * Check if a state is terminal
   * @param {string} state - State to check
   * @returns {boolean} - Whether the state is terminal
   */
  isTerminalState(state) {
    return this.terminalStates.has(state);
  }
  
  /**
   * Check if a state requires payment
   * @param {string} state - State to check
   * @returns {boolean} - Whether the state requires payment
   */
  requiresPayment(state) {
    return this.paymentRequiredStates.has(state);
  }
  
  /**
   * Get state metadata
   * @param {string} state - State to get metadata for
   * @returns {Object} - State metadata
   */
  getStateMetadata(state) {
    return {
      state,
      isTerminal: this.isTerminalState(state),
      requiresPayment: this.requiresPayment(state),
      validTransitions: this.getValidTransitions(state)
    };
  }
  
  /**
   * Log state transition
   * @param {number} applicationId - Application ID
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   * @param {Object} metadata - Additional metadata
   */
  logTransition(applicationId, fromState, toState, metadata = {}) {
    logger.info('Application state transition', {
      applicationId,
      fromState,
      toState,
      isValid: this.canTransition(fromState, toState),
      ...metadata
    });
  }
  
  /**
   * Get state transition history format
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   * @returns {Object} - Transition history entry
   */
  createTransitionEntry(fromState, toState) {
    return {
      fromState,
      toState,
      timestamp: new Date().toISOString(),
      isValid: this.canTransition(fromState, toState)
    };
  }
}

// Export the class
module.exports = PaymentStateMachine;
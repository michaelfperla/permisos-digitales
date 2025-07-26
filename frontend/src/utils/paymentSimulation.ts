/**
 * Payment Simulation Utilities
 *
 * This module provides utilities for simulating payment flows in development
 * without requiring actual payment gateway API keys.
 */
import { logger } from './logger';

// Check if simulation mode is active
export const isSimulationMode = (): boolean => {
  // Only use simulation mode if explicitly enabled via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('simulate') === 'true';
};

// Possible simulated payment outcomes
export enum SimulatedPaymentOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
  OXXO_PENDING = 'oxxo_pending',
}

// Default simulation delay in milliseconds
export const DEFAULT_SIMULATION_DELAY = 1500;

/**
 * Simulate a payment process with a delay and specified outcome
 * @param applicationId The application ID
 * @param outcome The desired outcome (success, failure, pending)
 * @param delay Delay in milliseconds before resolving
 * @returns Promise that resolves after the delay
 */
export const simulatePaymentProcess = async (
  applicationId: string,
  outcome: SimulatedPaymentOutcome = SimulatedPaymentOutcome.SUCCESS,
  delay: number = DEFAULT_SIMULATION_DELAY,
): Promise<void> => {
  logger.debug( // Changed to debug
    `SIMULATION: Processing payment for application ${applicationId} with outcome: ${outcome}`,
  );

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Determine redirect URL based on outcome
  let redirectUrl: string;

  switch (outcome) {
    case SimulatedPaymentOutcome.SUCCESS:
      redirectUrl = `/permits/${applicationId}?from_payment=true&status=success`;
      logger.debug( // Changed to debug
        'SIMULATION: Card payment successful, redirecting to permit details with success status',
      );
      break;
    case SimulatedPaymentOutcome.FAILURE:
      redirectUrl = `/permits/complete?step=payment&error=true&message=Simulated payment failure`;
      logger.debug('SIMULATION: Card payment failed, redirecting back to payment form with error'); // Changed to debug
      break;
    case SimulatedPaymentOutcome.PENDING:
      redirectUrl = `/permits/${applicationId}?from_payment=true&status=pending`;
      logger.debug('SIMULATION: Payment pending, redirecting back to permit details'); // Changed to debug
      break;
    case SimulatedPaymentOutcome.OXXO_PENDING:
      redirectUrl = `/permits/complete?step=oxxo-confirmation&applicationId=${applicationId}`;
      logger.debug('SIMULATION: OXXO payment initiated, redirecting to OXXO confirmation step'); // Changed to debug
      break;
    default:
      redirectUrl = `/permits/${applicationId}`;
      break;
  }

  // Redirect to the appropriate page
  window.location.href = redirectUrl;
};

/**
 * Get a random simulated payment outcome
 * This can be used to randomly simulate different payment scenarios
 * @returns A random payment outcome
 */
export const getRandomOutcome = (includeOxxo: boolean = true): SimulatedPaymentOutcome => {
  const outcomes = [
    SimulatedPaymentOutcome.SUCCESS,
    SimulatedPaymentOutcome.FAILURE,
    SimulatedPaymentOutcome.PENDING,
  ];

  // Include OXXO outcome if requested
  if (includeOxxo) {
    outcomes.push(SimulatedPaymentOutcome.OXXO_PENDING);
  }

  const randomIndex = Math.floor(Math.random() * outcomes.length);
  return outcomes[randomIndex];
};

// Functions are already exported individually above, no need for default export
// frontend/src/hooks/usePermitStatusPolling.ts
// Custom hook for automatic permit status polling after payment

import { useEffect, useRef, useCallback } from 'react';
import { checkPaymentStatus } from '../services/paymentService';
import { useToast } from '../shared/hooks/useToast';
import { logger } from '../utils/logger';

interface UsePermitStatusPollingProps {
  applicationId: string | null;
  currentStatus: string | null;
  onStatusChange: () => void;
  enabled?: boolean;
}

interface PollingConfig {
  interval: number;
  maxAttempts: number;
  backoffMultiplier: number;
}

const POLLING_CONFIGS: Record<string, PollingConfig> = {
  PAYMENT_RECEIVED: {
    interval: 10000, // 10 seconds
    maxAttempts: 30, // 5 minutes total
    backoffMultiplier: 1.2
  },
  GENERATING_PERMIT: {
    interval: 15000, // 15 seconds
    maxAttempts: 20, // 5 minutes total
    backoffMultiplier: 1.1
  },
  PAYMENT_PROCESSING: {
    interval: 30000, // 30 seconds
    maxAttempts: 10, // 5 minutes total
    backoffMultiplier: 1.0
  }
};

export const usePermitStatusPolling = ({
  applicationId,
  currentStatus,
  onStatusChange,
  enabled = true
}: UsePermitStatusPollingProps) => {
  const { showToast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const attemptCountRef = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const shouldPoll = useCallback((status: string | null): boolean => {
    if (!enabled || !applicationId || !status) return false;
    
    // Poll for these statuses that indicate processing
    const pollableStatuses = [
      'PAYMENT_RECEIVED',
      'GENERATING_PERMIT', 
      'PAYMENT_PROCESSING'
    ];
    
    return pollableStatuses.includes(status);
  }, [enabled, applicationId]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    attemptCountRef.current = 0;
  }, []);

  const checkStatus = useCallback(async () => {
    if (!applicationId || !currentStatus || !mountedRef.current) return;

    try {
      const response = await checkPaymentStatus(applicationId);
      
      // Check if still mounted before updating
      if (!mountedRef.current) return;
      
      const newStatus = response.applicationStatus;

      // If status changed, notify parent and show toast
      if (newStatus !== lastStatusRef.current) {
        lastStatusRef.current = newStatus;
        
        // Show appropriate toast based on new status
        switch (newStatus) {
          case 'GENERATING_PERMIT':
            showToast('¡Pago confirmado! Generando tu permiso...', 'success');
            break;
          case 'PERMIT_READY':
            showToast('¡Tu permiso está listo para descargar!', 'success');
            stopPolling();
            break;
          case 'COMPLETED':
            showToast('¡Proceso completado! Tu permiso está disponible.', 'success');
            stopPolling();
            break;
          case 'ERROR_GENERATING_PERMIT':
            showToast('Error al generar el permiso. Contacta soporte.', 'error');
            stopPolling();
            break;
          case 'PAYMENT_FAILED':
            showToast('El pago no pudo ser procesado.', 'error');
            stopPolling();
            break;
        }

        // Trigger parent component update
        onStatusChange();
      }

      // Stop polling if we've reached a final status
      const finalStatuses = [
        'PERMIT_READY',
        'COMPLETED', 
        'ERROR_GENERATING_PERMIT',
        'PAYMENT_FAILED',
        'CANCELLED'
      ];

      if (finalStatuses.includes(newStatus)) {
        stopPolling();
        return;
      }

    } catch (error) {
      logger.error('Error checking permit status:', error);
      
      // Don't show error toast for every failed poll attempt
      // Only show if we've failed multiple times
      attemptCountRef.current++;
      if (attemptCountRef.current >= 5) {
        showToast('Error al verificar el estado del permiso', 'warning');
      }
    }
  }, [applicationId, currentStatus, onStatusChange, showToast, stopPolling]);

  const startPolling = useCallback(() => {
    if (!shouldPoll(currentStatus)) return;

    const config = POLLING_CONFIGS[currentStatus!];
    if (!config) return;

    // Stop any existing polling
    stopPolling();

    const poll = () => {
      // Check if still mounted
      if (!mountedRef.current) {
        stopPolling();
        return;
      }
      
      attemptCountRef.current++;
      
      // Check if we've exceeded max attempts
      if (attemptCountRef.current > config.maxAttempts) {
        logger.info(`Polling stopped after ${config.maxAttempts} attempts for status: ${currentStatus}`);
        stopPolling();
        return;
      }

      // Check status
      checkStatus();

      // Schedule next poll with backoff only if still mounted
      if (mountedRef.current) {
        const nextInterval = config.interval * Math.pow(config.backoffMultiplier, attemptCountRef.current - 1);
        pollingRef.current = setTimeout(poll, nextInterval);
      }
    };

    // Start polling immediately
    poll();
  }, [currentStatus, shouldPoll, stopPolling, checkStatus]);

  // Effect to start/stop polling based on status changes
  useEffect(() => {
    if (shouldPoll(currentStatus)) {
      logger.info(`Starting status polling for: ${currentStatus}`);
      startPolling();
    } else {
      logger.info(`Stopping status polling for: ${currentStatus}`);
      stopPolling();
    }

    // Cleanup on unmount or status change
    return stopPolling;
  }, [currentStatus, shouldPoll]); // Remove startPolling and stopPolling to avoid circular deps

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isPolling: pollingRef.current !== null,
    attemptCount: attemptCountRef.current,
    stopPolling
  };
};

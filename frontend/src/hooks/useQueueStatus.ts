import { useState, useEffect, useCallback, useRef } from 'react';
import { getQueueStatus } from '../services/applicationService';
import { logger } from '../utils/logger';

// Extended interface with polling control fields
export interface QueueStatus {
  queueStatus: string | null;
  queuePosition: number | null;
  estimatedWaitMinutes: number | null;
  message: string;
  nextPollInterval?: number; // Server-suggested next poll interval in ms
  retryAfterError?: number; // Server-suggested retry interval after error in ms
}

interface UseQueueStatusOptions {
  onComplete?: () => void;
  initialPollInterval?: number;
  maxRetries?: number;
  enablePolling?: boolean;
}

interface UseQueueStatusReturn {
  queueStatus: QueueStatus | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
  retryCount: number;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

const DEFAULT_POLL_INTERVAL = 20000; // 20 seconds
const MIN_POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_INTERVAL = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

export const useQueueStatus = (
  applicationId: number | string,
  options: UseQueueStatusOptions = {}
): UseQueueStatusReturn => {
  const {
    onComplete,
    initialPollInterval = DEFAULT_POLL_INTERVAL,
    maxRetries = DEFAULT_MAX_RETRIES,
    enablePolling = true,
  } = options;

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(enablePolling);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  
  // Refs to access current values in callbacks
  const isPollingRef = useRef(isPolling);
  const queueStatusRef = useRef(queueStatus);
  
  // Keep refs in sync with state
  useEffect(() => {
    isPollingRef.current = isPolling;
  }, [isPolling]);
  
  useEffect(() => {
    queueStatusRef.current = queueStatus;
  }, [queueStatus]);

  // Reset mounted ref when component remounts
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Calculate dynamic polling interval based on queue position and server suggestions
  const calculatePollInterval = useCallback((status: QueueStatus | null): number => {
    // Use server-provided interval if available
    if (status?.nextPollInterval) {
      return Math.max(MIN_POLL_INTERVAL, Math.min(MAX_POLL_INTERVAL, status.nextPollInterval));
    }

    // Otherwise use position-based intervals
    if (!status?.queuePosition) return initialPollInterval;
    
    if (status.queuePosition <= 2) return 5000; // 5 seconds if next or second
    if (status.queuePosition <= 5) return 10000; // 10 seconds if in top 5
    if (status.queuePosition <= 10) return 15000; // 15 seconds if in top 10
    return 20000; // 20 seconds otherwise
  }, [initialPollInterval]);

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((attempt: number, status: QueueStatus | null): number => {
    // Use server-provided retry delay if available
    if (status?.retryAfterError) {
      return status.retryAfterError;
    }

    // Otherwise use exponential backoff
    return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, []);

  // Check if the status is terminal (completed or failed)
  const isTerminalStatus = useCallback((status: string | null | undefined): boolean => {
    return status === 'completed' || status === 'failed';
  }, []);

  // Fetch queue status
  const fetchQueueStatus = useCallback(async (isRetry = false): Promise<void> => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      if (!isRetry) {
        setLoading(true);
      }
      setError(null);

      const response = await getQueueStatus(applicationId, {
        signal: abortControllerRef.current.signal,
      });

      if (!mountedRef.current) return;

      setQueueStatus(response);
      setLastUpdated(new Date());
      setRetryCount(0); // Reset retry count on success
      setLoading(false);

      // Check if we should stop polling
      if (isTerminalStatus(response.queueStatus)) {
        setIsPolling(false);
        if (onComplete) {
          onComplete();
        }
      }
    } catch (err: any) {
      if (!mountedRef.current) return;

      // Don't treat aborted requests as errors
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.response?.data?.message || 'No se pudo obtener el estado de la cola';
      setError(errorMessage);
      setLoading(false);

      // Handle retries
      setRetryCount(prev => {
        const newRetryCount = prev + 1;
        
        // Use refs to get current values
        const currentIsPolling = isPollingRef.current;
        const currentQueueStatus = queueStatusRef.current;
        
        if (currentIsPolling && newRetryCount <= maxRetries) {
          const retryDelay = calculateRetryDelay(newRetryCount - 1, currentQueueStatus);
          logger.warn(`Retrying queue status fetch in ${retryDelay}ms (attempt ${newRetryCount}/${maxRetries})`);
          
          timeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              fetchQueueStatus(true);
            }
          }, retryDelay);
        } else if (newRetryCount > maxRetries) {
          // Stop polling after max retries
          setIsPolling(false);
          logger.error(`Max retries (${maxRetries}) reached, stopping polling`);
        }
        
        return newRetryCount;
      });
    }
  }, [applicationId, maxRetries, onComplete, isTerminalStatus, calculateRetryDelay]);

  // Manual refresh
  const refresh = useCallback(async () => {
    // Clear any scheduled poll
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setRetryCount(0); // Reset retry count on manual refresh
    await fetchQueueStatus();

    // Schedule next poll if polling is enabled
    // Use refs to check current status after async operation
    if (isPollingRef.current && !isTerminalStatus(queueStatusRef.current?.queueStatus)) {
      const currentStatus = queueStatusRef.current;
      const pollInterval = calculatePollInterval(currentStatus);
      
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && isPollingRef.current && !isTerminalStatus(currentStatus?.queueStatus)) {
          fetchQueueStatus();
        }
      }, pollInterval);
    }
  }, [fetchQueueStatus, isTerminalStatus, calculatePollInterval]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
    setRetryCount(0);
    // Use ref for current status
    if (!isTerminalStatus(queueStatusRef.current?.queueStatus)) {
      refresh();
    }
  }, [isTerminalStatus, refresh]);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Effect to handle initial fetch
  useEffect(() => {
    // Only fetch on mount or when applicationId changes
    const shouldFetch = enablePolling && !isTerminalStatus(queueStatusRef.current?.queueStatus);
    
    if (shouldFetch) {
      fetchQueueStatus();
    }

    return () => {
      // Cleanup on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [applicationId, enablePolling, fetchQueueStatus, isTerminalStatus]);

  // Effect to schedule next poll after successful fetch
  useEffect(() => {
    if (!loading && !error && queueStatus && isPolling && !isTerminalStatus(queueStatus.queueStatus)) {
      // Inline scheduling logic to avoid circular dependencies
      const pollInterval = calculatePollInterval(queueStatus);
      
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && isPollingRef.current && !isTerminalStatus(queueStatusRef.current?.queueStatus)) {
          fetchQueueStatus();
        }
      }, pollInterval);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [queueStatus, loading, error, isPolling, isTerminalStatus, calculatePollInterval, fetchQueueStatus]);

  return {
    queueStatus,
    loading,
    error,
    isPolling,
    retryCount,
    lastUpdated,
    refresh,
    startPolling,
    stopPolling,
  };
};

export default useQueueStatus;
export type { UseQueueStatusOptions, UseQueueStatusReturn };
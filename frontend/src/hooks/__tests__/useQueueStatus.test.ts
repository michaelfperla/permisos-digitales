import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQueueStatus } from '../useQueueStatus';
import applicationService from '../../services/applicationService';

// Mock the applicationService
vi.mock('../../services/applicationService', () => ({
  default: {
    getQueueStatus: vi.fn()
  }
}));

describe('useQueueStatus', () => {
  const mockGetQueueStatus = vi.mocked(applicationService.getQueueStatus);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should fetch queue status on mount', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 5,
      estimatedWaitMinutes: 10,
      message: 'Your request is in the queue',
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useQueueStatus(123));

    // Initial state check
    expect(result.current.loading).toBe(true);
    expect(result.current.queueStatus).toBe(null);

    // Wait for the hook to finish loading
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    // Verify final state
    expect(result.current.queueStatus).toEqual(mockResponse);
    expect(result.current.error).toBe(null);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);
    expect(mockGetQueueStatus).toHaveBeenCalledWith(123, expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));
  });

  it('should handle errors with retry mechanism', async () => {
    const mockError = new Error('Network error');
    mockError.name = 'NetworkError';
    mockGetQueueStatus.mockRejectedValue(mockError);

    const { result } = renderHook(() => useQueueStatus(123, { maxRetries: 2 }));

    // Wait for initial error
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('No se pudo obtener el estado de la cola');
    }, { timeout: 2000 });

    // Initial call should increment retry count to 1
    expect(result.current.retryCount).toBe(1);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Advance timers by BASE_RETRY_DELAY (1000ms) to trigger first retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Wait for retry to complete
    await waitFor(() => {
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 });
    
    expect(result.current.retryCount).toBe(2);

    // Advance timers for second retry (exponential backoff: 2000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Wait for second retry to complete
    await waitFor(() => {
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(3);
    }, { timeout: 2000 });
    
    // Should have reached max retries and stopped polling
    expect(result.current.retryCount).toBe(3);
    expect(result.current.isPolling).toBe(false);
  });

  it('should stop polling on terminal status', async () => {
    const mockOnComplete = vi.fn();
    const mockResponse = {
      queueStatus: 'completed',
      queuePosition: null,
      estimatedWaitMinutes: null,
      message: 'Your permit is ready',
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => 
      useQueueStatus(123, { onComplete: mockOnComplete })
    );

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    // Verify terminal status handling
    expect(result.current.queueStatus?.queueStatus).toBe('completed');
    expect(result.current.isPolling).toBe(false);
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
    
    // Ensure no additional polling occurs
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // Should still only have been called once
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);
  });

  it('should support manual refresh', async () => {
    const mockResponse1 = {
      queueStatus: 'queued',
      queuePosition: 5,
      estimatedWaitMinutes: 10,
      message: 'In queue',
    };

    const mockResponse2 = {
      queueStatus: 'queued',
      queuePosition: 3,
      estimatedWaitMinutes: 6,
      message: 'In queue',
    };

    mockGetQueueStatus
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const { result } = renderHook(() => useQueueStatus(123));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.queueStatus?.queuePosition).toBe(5);

    // Trigger manual refresh
    await act(async () => {
      const refreshPromise = result.current.refresh();
      await refreshPromise;
    });

    // Verify refresh worked
    expect(result.current.queueStatus?.queuePosition).toBe(3);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(2);
  });

  it('should calculate dynamic polling intervals', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 2,
      estimatedWaitMinutes: 3,
      message: 'Almost there',
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    // Start with polling disabled to control timing precisely
    const { result, unmount } = renderHook(() => useQueueStatus(123, { enablePolling: false }));

    // Manually start polling and wait for initial load
    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.queueStatus?.queuePosition).toBe(2);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Position 2 should use 5-second interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });

    // Should not have polled yet
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Now advance to trigger poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Should poll now
    await waitFor(() => {
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 });
    
    unmount();
  });

  it('should use server-provided polling interval when available', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 10,
      estimatedWaitMinutes: 20,
      message: 'In queue',
      nextPollInterval: 30000, // Server suggests 30 seconds
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    // Start with polling disabled to control timing precisely
    const { result, unmount } = renderHook(() => useQueueStatus(123, { enablePolling: false }));

    // Manually start polling
    act(() => {
      result.current.startPolling();
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.queueStatus?.nextPollInterval).toBe(30000);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Should use server-suggested 30-second interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29999);
    });

    // Should not have polled yet
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Now it should poll
    await waitFor(() => {
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 });
    
    unmount();
  });

  it('should allow starting and stopping polling', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 5,
      estimatedWaitMinutes: 10,
      message: 'In queue',
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    const { result, unmount } = renderHook(() => 
      useQueueStatus(123, { enablePolling: false })
    );

    // Should not poll initially when disabled
    await act(async () => {
      // Let any immediate effects run
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.isPolling).toBe(false);
    expect(mockGetQueueStatus).not.toHaveBeenCalled();

    // Start polling manually
    await act(async () => {
      result.current.startPolling();
      // Wait for the async operation to complete
      await vi.runOnlyPendingTimersAsync();
    });

    // Wait for the polling to start and fetch data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.isPolling).toBe(true);
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Stop polling
    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);

    // Advance timers to verify polling has stopped
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // Should still only have been called once
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Cleanup
    unmount();
  });

  it('should handle component unmount properly', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 5,
      estimatedWaitMinutes: 10,
      message: 'In queue',
    };

    mockGetQueueStatus.mockResolvedValue(mockResponse);

    const { result, unmount } = renderHook(() => useQueueStatus(123));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

    // Unmount component
    unmount();

    // Advance timers after unmount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    // Should not make additional calls after unmount
    expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);
  });

  it('should handle aborted requests gracefully', async () => {
    const mockResponse = {
      queueStatus: 'queued',
      queuePosition: 5,
      estimatedWaitMinutes: 10,
      message: 'In queue',
    };

    let callCount = 0;
    mockGetQueueStatus.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      return Promise.resolve(mockResponse);
    });

    const { result } = renderHook(() => useQueueStatus(123));

    // First call will be aborted, wait for it to complete
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Should handle abort without setting error
    expect(result.current.error).toBe(null);
    
    // Trigger refresh which should succeed
    await act(async () => {
      const refreshPromise = result.current.refresh();
      await refreshPromise;
    });

    await waitFor(() => {
      expect(result.current.queueStatus).toEqual(mockResponse);
    }, { timeout: 2000 });
  });

  it('should handle multiple queue positions with proper intervals', async () => {
    const positions = [
      { queuePosition: 15, expectedInterval: 20000 },
      { queuePosition: 8, expectedInterval: 15000 },
      { queuePosition: 4, expectedInterval: 10000 },
      { queuePosition: 1, expectedInterval: 5000 },
    ];

    for (const { queuePosition, expectedInterval } of positions) {
      vi.clearAllMocks();
      
      const mockResponse = {
        queueStatus: 'queued',
        queuePosition,
        estimatedWaitMinutes: queuePosition * 2,
        message: 'In queue',
      };

      mockGetQueueStatus.mockResolvedValue(mockResponse);

      // Start with polling disabled to control timing precisely
      const { result, unmount } = renderHook(() => useQueueStatus(123, { enablePolling: false }));

      // Manually start polling
      act(() => {
        result.current.startPolling();
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.queueStatus?.queuePosition).toBe(queuePosition);
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

      // Advance time just before the expected interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(expectedInterval - 1);
      });

      // Should not have polled yet
      expect(mockGetQueueStatus).toHaveBeenCalledTimes(1);

      // Advance by 1ms to trigger poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      // Should have polled
      await waitFor(() => {
        expect(mockGetQueueStatus).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });

      unmount();
    }
  });

  it('should handle rapid status changes', async () => {
    const mockResponses = [
      { queueStatus: 'queued', queuePosition: 10, estimatedWaitMinutes: 20, message: 'Starting' },
      { queueStatus: 'processing', queuePosition: null, estimatedWaitMinutes: 5, message: 'Processing' },
      { queueStatus: 'completed', queuePosition: null, estimatedWaitMinutes: null, message: 'Done' },
    ];

    let callIndex = 0;
    mockGetQueueStatus.mockImplementation(() => Promise.resolve(mockResponses[callIndex++ % mockResponses.length]));

    const mockOnComplete = vi.fn();
    const { result } = renderHook(() => useQueueStatus(123, { onComplete: mockOnComplete }));

    // Wait for initial queued status
    await waitFor(() => {
      expect(result.current.queueStatus?.queueStatus).toBe('queued');
    }, { timeout: 2000 });

    // Advance to get processing status
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    await waitFor(() => {
      expect(result.current.queueStatus?.queueStatus).toBe('processing');
    }, { timeout: 2000 });

    // Advance to get completed status
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    await waitFor(() => {
      expect(result.current.queueStatus?.queueStatus).toBe('completed');
    }, { timeout: 2000 });

    // Should stop polling and call onComplete
    expect(result.current.isPolling).toBe(false);
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });
});
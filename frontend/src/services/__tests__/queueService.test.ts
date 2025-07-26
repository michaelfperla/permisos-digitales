import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import queueService, { QueueStatusResponse, QueueMetricsResponse } from '../queueService';
import api from '../api';

// Mock the api module
vi.mock('../api');

describe('queueService', () => {
  const mockApi = vi.mocked(api);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getQueueStatus', () => {
    it('should get queue status successfully', async () => {
      const applicationId = 'app-123';
      const mockStatusData: QueueStatusResponse = {
        applicationId,
        queueStatus: 'queued',
        queuePosition: 5,
        estimatedWaitMinutes: 10,
        queueEnteredAt: '2024-01-01T10:00:00.000Z',
        queueStartedAt: '2024-01-01T09:30:00.000Z',
        message: 'Your application is in queue',
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockStatusData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await queueService.getQueueStatus(applicationId);

      expect(result).toEqual(mockStatusData);
      expect(mockApi.get).toHaveBeenCalledWith(`/queue/status/${applicationId}`);
    });

    it('should handle queue status API errors', async () => {
      const applicationId = 'app-123';
      const errorMessage = 'Application not found';
      
      mockApi.get.mockRejectedValue(new Error(errorMessage));

      await expect(queueService.getQueueStatus(applicationId)).rejects.toThrow(errorMessage);
      expect(mockApi.get).toHaveBeenCalledWith(`/queue/status/${applicationId}`);
    });

    it('should handle network errors for queue status', async () => {
      const applicationId = 'app-123';
      const networkError = new Error('Network timeout');
      
      mockApi.get.mockRejectedValue(networkError);

      await expect(queueService.getQueueStatus(applicationId)).rejects.toThrow('Network timeout');
    });

    it('should handle different queue statuses', async () => {
      const applicationId = 'app-123';
      const queueStatuses = [
        {
          queueStatus: 'processing',
          queuePosition: null,
          estimatedWaitMinutes: 2,
          message: 'Your application is being processed',
        },
        {
          queueStatus: 'completed',
          queuePosition: null,
          estimatedWaitMinutes: null,
          message: 'Your application has been processed',
        },
        {
          queueStatus: 'failed',
          queuePosition: null,
          estimatedWaitMinutes: null,
          message: 'Processing failed, please try again',
        },
      ];

      for (const statusData of queueStatuses) {
        const mockStatusData: QueueStatusResponse = {
          applicationId,
          queueEnteredAt: '2024-01-01T10:00:00.000Z',
          queueStartedAt: '2024-01-01T09:30:00.000Z',
          ...statusData,
        };

        const mockResponse = {
          data: {
            success: true,
            data: mockStatusData,
          },
        };

        mockApi.get.mockResolvedValue(mockResponse);

        const result = await queueService.getQueueStatus(applicationId);

        expect(result.queueStatus).toBe(statusData.queueStatus);
        expect(result.message).toBe(statusData.message);
      }
    });
  });

  describe('getQueueMetrics (Admin functionality)', () => {
    it('should get queue metrics successfully', async () => {
      const mockMetricsData: QueueMetricsResponse = {
        currentQueue: 15,
        activeJobs: 3,
        maxConcurrent: 5,
        utilization: 0.6,
        jobs: [
          {
            id: 'job-1',
            applicationId: 'app-123',
            status: 'processing',
            startedAt: '2024-01-01T10:00:00.000Z',
          },
          {
            id: 'job-2',
            applicationId: 'app-456',
            status: 'processing',
            startedAt: '2024-01-01T10:01:00.000Z',
          },
          {
            id: 'job-3',
            applicationId: 'app-789',
            status: 'processing',
            startedAt: '2024-01-01T10:02:00.000Z',
          },
        ],
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockMetricsData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await queueService.getQueueMetrics();

      expect(result).toEqual(mockMetricsData);
      expect(mockApi.get).toHaveBeenCalledWith('/queue/metrics');
    });

    it('should handle queue metrics API errors', async () => {
      const errorMessage = 'Unauthorized access';
      
      mockApi.get.mockRejectedValue(new Error(errorMessage));

      await expect(queueService.getQueueMetrics()).rejects.toThrow(errorMessage);
      expect(mockApi.get).toHaveBeenCalledWith('/queue/metrics');
    });

    it('should handle empty queue metrics', async () => {
      const emptyMetricsData: QueueMetricsResponse = {
        currentQueue: 0,
        activeJobs: 0,
        maxConcurrent: 5,
        utilization: 0,
        jobs: [],
      };

      const mockResponse = {
        data: {
          success: true,
          data: emptyMetricsData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await queueService.getQueueMetrics();

      expect(result.currentQueue).toBe(0);
      expect(result.activeJobs).toBe(0);
      expect(result.utilization).toBe(0);
      expect(result.jobs).toHaveLength(0);
    });

    it('should handle high utilization scenarios', async () => {
      const highUtilizationData: QueueMetricsResponse = {
        currentQueue: 50,
        activeJobs: 5,
        maxConcurrent: 5,
        utilization: 1.0, // 100% utilization
        jobs: Array.from({ length: 5 }, (_, i) => ({
          id: `job-${i + 1}`,
          applicationId: `app-${i + 1}`,
          status: 'processing',
          startedAt: new Date(Date.now() - i * 60000).toISOString(),
        })),
      };

      const mockResponse = {
        data: {
          success: true,
          data: highUtilizationData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await queueService.getQueueMetrics();

      expect(result.utilization).toBe(1.0);
      expect(result.activeJobs).toBe(result.maxConcurrent);
      expect(result.currentQueue).toBeGreaterThan(result.activeJobs);
    });
  });

  describe('setPriority (Admin functionality)', () => {
    it('should set application priority successfully', async () => {
      const applicationId = 'app-123';
      const priority = 1; // High priority
      const mockPriorityData = {
        applicationId,
        priority,
        previousPriority: 5,
        message: 'Priority updated successfully',
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockPriorityData,
        },
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await queueService.setPriority(applicationId, priority);

      expect(result).toEqual(mockPriorityData);
      expect(mockApi.post).toHaveBeenCalledWith(
        `/queue/priority/${applicationId}`,
        { priority }
      );
    });

    it('should handle different priority levels', async () => {
      const applicationId = 'app-123';
      const priorityLevels = [1, 2, 3, 4, 5]; // 1 = highest, 5 = lowest

      for (const priority of priorityLevels) {
        const mockPriorityData = {
          applicationId,
          priority,
          previousPriority: 5,
          message: `Priority set to ${priority}`,
        };

        const mockResponse = {
          data: {
            success: true,
            data: mockPriorityData,
          },
        };

        mockApi.post.mockResolvedValue(mockResponse);

        const result = await queueService.setPriority(applicationId, priority);

        expect(result.priority).toBe(priority);
        expect(mockApi.post).toHaveBeenCalledWith(
          `/queue/priority/${applicationId}`,
          { priority }
        );
      }
    });

    it('should handle priority setting API errors', async () => {
      const applicationId = 'app-123';
      const priority = 1;
      const errorMessage = 'Application not found';
      
      mockApi.post.mockRejectedValue(new Error(errorMessage));

      await expect(queueService.setPriority(applicationId, priority)).rejects.toThrow(errorMessage);
      expect(mockApi.post).toHaveBeenCalledWith(
        `/queue/priority/${applicationId}`,
        { priority }
      );
    });

    it('should handle unauthorized priority setting', async () => {
      const applicationId = 'app-123';
      const priority = 1;
      const errorMessage = 'Insufficient permissions';
      
      mockApi.post.mockRejectedValue(new Error(errorMessage));

      await expect(queueService.setPriority(applicationId, priority)).rejects.toThrow(errorMessage);
    });

    it('should handle invalid priority values', async () => {
      const applicationId = 'app-123';
      const invalidPriority = 10; // Outside valid range
      const errorMessage = 'Invalid priority value';
      
      mockApi.post.mockRejectedValue(new Error(errorMessage));

      await expect(queueService.setPriority(applicationId, invalidPriority)).rejects.toThrow(errorMessage);
    });
  });

  describe('Service integration and edge cases', () => {
    it('should handle malformed API responses', async () => {
      const applicationId = 'app-123';
      const malformedResponse = {
        data: {
          // Missing success field and data field
          something: 'unexpected',
        },
      };

      mockApi.get.mockResolvedValue(malformedResponse);

      // The service will try to access response.data.data which will be undefined
      // This should cause an error when trying to return the undefined data
      const result = await queueService.getQueueStatus(applicationId);
      
      // Service returns undefined for malformed responses
      expect(result).toBeUndefined();
    });

    it('should handle null response data', async () => {
      const applicationId = 'app-123';
      const nullResponse = {
        data: null,
      };

      mockApi.get.mockResolvedValue(nullResponse);

      await expect(queueService.getQueueStatus(applicationId)).rejects.toThrow();
    });

    it('should handle concurrent queue operations', async () => {
      const applications = ['app-1', 'app-2', 'app-3'];
      const mockStatusData: QueueStatusResponse = {
        applicationId: 'test',
        queueStatus: 'queued',
        queuePosition: 1,
        estimatedWaitMinutes: 5,
        queueEnteredAt: '2024-01-01T10:00:00.000Z',
        queueStartedAt: '2024-01-01T09:30:00.000Z',
        message: 'Test message',
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockStatusData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const promises = applications.map(appId => queueService.getQueueStatus(appId));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockApi.get).toHaveBeenCalledTimes(3);
      
      // Verify each call was made with correct application ID
      applications.forEach((appId, index) => {
        expect(mockApi.get).toHaveBeenNthCalledWith(index + 1, `/queue/status/${appId}`);
      });
    });

    it('should handle timeout scenarios', async () => {
      const applicationId = 'app-123';
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      mockApi.get.mockRejectedValue(timeoutError);

      await expect(queueService.getQueueStatus(applicationId)).rejects.toThrow('Request timeout');
    });

    it('should handle rate limiting scenarios', async () => {
      const applicationId = 'app-123';
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      mockApi.get.mockRejectedValue(rateLimitError);

      await expect(queueService.getQueueStatus(applicationId)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle queue status with special characters in application ID', async () => {
      const specialApplicationId = 'app-123-special_chars!@#';
      const mockStatusData: QueueStatusResponse = {
        applicationId: specialApplicationId,
        queueStatus: 'queued',
        queuePosition: 1,
        estimatedWaitMinutes: 5,
        queueEnteredAt: '2024-01-01T10:00:00.000Z',
        queueStartedAt: '2024-01-01T09:30:00.000Z',
        message: 'Special ID application',
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockStatusData,
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await queueService.getQueueStatus(specialApplicationId);

      expect(result.applicationId).toBe(specialApplicationId);
      expect(mockApi.get).toHaveBeenCalledWith(`/queue/status/${specialApplicationId}`);
    });
  });

  describe('Queue service instance', () => {
    it('should be a singleton instance', () => {
      expect(queueService).toBeDefined();
      expect(typeof queueService.getQueueStatus).toBe('function');
      expect(typeof queueService.getQueueMetrics).toBe('function');
      expect(typeof queueService.setPriority).toBe('function');
    });

    it('should maintain state consistency across calls', async () => {
      const applicationId = 'app-123';
      
      // First call
      const mockResponse1 = {
        data: {
          success: true,
          data: {
            applicationId,
            queueStatus: 'queued',
            queuePosition: 5,
            estimatedWaitMinutes: 10,
            queueEnteredAt: '2024-01-01T10:00:00.000Z',
            queueStartedAt: '2024-01-01T09:30:00.000Z',
            message: 'First call',
          },
        },
      };

      // Second call
      const mockResponse2 = {
        data: {
          success: true,
          data: {
            applicationId,
            queueStatus: 'processing',
            queuePosition: null,
            estimatedWaitMinutes: 2,
            queueEnteredAt: '2024-01-01T10:00:00.000Z',
            queueStartedAt: '2024-01-01T10:05:00.000Z',
            message: 'Second call',
          },
        },
      };

      mockApi.get
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result1 = await queueService.getQueueStatus(applicationId);
      const result2 = await queueService.getQueueStatus(applicationId);

      expect(result1.queueStatus).toBe('queued');
      expect(result2.queueStatus).toBe('processing');
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });
});
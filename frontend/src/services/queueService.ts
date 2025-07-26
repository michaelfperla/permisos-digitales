import { apiInstance as api } from './api-instance';

export interface QueueStatusResponse {
  applicationId: string;
  queueStatus: string | null;
  queuePosition: number | null;
  estimatedWaitMinutes: number | null;
  queueEnteredAt: string | null;
  queueStartedAt: string | null;
  message: string;
}

export interface QueueMetricsResponse {
  currentQueue: number;
  activeJobs: number;
  maxConcurrent: number;
  utilization: number;
  jobs: any[];
}

class QueueService {
  /**
   * Get queue status for a specific application
   */
  async getQueueStatus(applicationId: string): Promise<QueueStatusResponse> {
    try {
      const response = await api.get<{ success: boolean; data: QueueStatusResponse }>(
        `/queue/status/${applicationId}`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching queue status:', error);
      throw error;
    }
  }

  /**
   * Get overall queue metrics (admin only)
   */
  async getQueueMetrics(): Promise<QueueMetricsResponse> {
    try {
      const response = await api.get<{ success: boolean; data: QueueMetricsResponse }>(
        '/queue/metrics'
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching queue metrics:', error);
      throw error;
    }
  }

  /**
   * Set priority for an application (admin only)
   */
  async setPriority(applicationId: string, priority: number): Promise<any> {
    try {
      const response = await api.post<{ success: boolean; data: any }>(
        `/queue/priority/${applicationId}`,
        { priority }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error setting priority:', error);
      throw error;
    }
  }
}

// Export the class directly to avoid initialization issues
export default QueueService;
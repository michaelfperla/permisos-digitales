// Mock config first to prevent database connection errors
jest.mock('../../config', () => ({
  database: {
    url: 'mock://database'
  },
  stripe: {
    privateKey: 'mock_stripe_key',
    publicKey: 'mock_public_key'
  },
  redis: {
    url: 'mock://redis'
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../pdf-queue.service', () => ({
  getStatus: jest.fn(),
  on: jest.fn()
}));

const QueueMonitorService = require('../queue-monitor.service');
const { logger } = require('../../utils/logger');
const db = require('../../db');
const pdfQueueService = require('../pdf-queue.service');

describe('QueueMonitorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Stop any running intervals
    QueueMonitorService.stop();
  });

  afterEach(() => {
    jest.useRealTimers();
    QueueMonitorService.stop();
  });

  describe('start', () => {
    it('should start monitoring service successfully', () => {
      QueueMonitorService.start();

      expect(logger.info).toHaveBeenCalledWith('Starting queue monitoring service');
      expect(pdfQueueService.on).toHaveBeenCalledWith('jobComplete', expect.any(Function));
    });

    it('should set up metrics interval', () => {
      QueueMonitorService.start();

      expect(QueueMonitorService.metricsInterval).toBeDefined();
      expect(QueueMonitorService.metricsInterval).not.toBeNull();
    });

    it('should log metrics periodically', async () => {
      // Mock queue status
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 5,
        activeJobs: 2,
        maxConcurrent: 10
      });

      // Mock database queries
      db.query.mockResolvedValueOnce({
        rows: [{
          avg_processing_time: 5000,
          avg_wait_time: 2000,
          total_completed: 15,
          total_failed: 1
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // INSERT query

      // Spy on logMetrics to track calls
      const logMetricsSpy = jest.spyOn(QueueMonitorService, 'logMetrics');

      QueueMonitorService.start();

      // Fast-forward timer to trigger metrics logging
      jest.advanceTimersByTime(60000);
      
      // Wait for async operations to complete
      await Promise.resolve();

      expect(logMetricsSpy).toHaveBeenCalled();
      expect(pdfQueueService.getStatus).toHaveBeenCalled();
    }, 10000);

    it('should listen to queue events', () => {
      QueueMonitorService.start();

      // Simulate job completion event
      const jobCompleteCallback = pdfQueueService.on.mock.calls[0][1];
      jobCompleteCallback('job_123');

      expect(logger.debug).toHaveBeenCalledWith('Queue job completed', { jobId: 'job_123' });
    });
  });

  describe('stop', () => {
    it('should stop monitoring service', () => {
      QueueMonitorService.start();
      expect(QueueMonitorService.metricsInterval).not.toBeNull();

      QueueMonitorService.stop();

      expect(QueueMonitorService.metricsInterval).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('Stopped queue monitoring service');
    });

    it('should handle stop when not started', () => {
      QueueMonitorService.stop();

      expect(logger.info).toHaveBeenCalledWith('Stopped queue monitoring service');
      expect(QueueMonitorService.metricsInterval).toBeNull();
    });
  });

  describe('logMetrics', () => {
    beforeEach(() => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 3,
        activeJobs: 1,
        maxConcurrent: 5
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          avg_processing_time: 3500,
          avg_wait_time: 1200,
          total_completed: 10,
          total_failed: 0
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });
    });

    it('should log queue metrics successfully', async () => {
      await QueueMonitorService.logMetrics();

      expect(pdfQueueService.getStatus).toHaveBeenCalled();
      
      // Check average times query
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AVG(queue_duration_ms)')
      );

      // Check metrics insert query
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_metrics'),
        [3, 1, 1200, 3500, 10, 0]
      );

      expect(logger.info).toHaveBeenCalledWith('Queue metrics', {
        queue: {
          length: 3,
          active: 1,
          max: 5,
          utilization: '20%'
        },
        performance: {
          avgWaitTime: '1s',
          avgProcessingTime: '4s',
          completedLastHour: 10,
          failedLastHour: 0
        }
      });
    });

    it('should handle null/undefined values in database results', async () => {
      db.query.mockReset();
      db.query.mockResolvedValueOnce({
        rows: [{
          avg_processing_time: null,
          avg_wait_time: null,
          total_completed: null,
          total_failed: null
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await QueueMonitorService.logMetrics();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_metrics'),
        [3, 1, 0, 0, 0, 0]
      );
    });

    it('should warn when queue length is high', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 15,
        activeJobs: 2,
        maxConcurrent: 5
      });

      await QueueMonitorService.logMetrics();

      expect(logger.warn).toHaveBeenCalledWith('Queue length is high', { queueLength: 15 });
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockReset();
      db.query.mockRejectedValue(new Error('Database connection failed'));

      await QueueMonitorService.logMetrics();

      expect(logger.error).toHaveBeenCalledWith('Error logging queue metrics', expect.any(Error));
    });

    it('should round metrics correctly', async () => {
      db.query.mockReset();
      db.query.mockResolvedValueOnce({
        rows: [{
          avg_processing_time: 1234.567,
          avg_wait_time: 987.123,
          total_completed: '25',
          total_failed: '3'
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await QueueMonitorService.logMetrics();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_metrics'),
        [3, 1, 987, 1235, 25, 3]
      );
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(() => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 5,
        activeJobs: 2,
        maxConcurrent: 10
      });

      db.query.mockResolvedValue({
        rows: [{
          failure_rate: 0.05
        }]
      });
    });

    it('should return healthy status for normal conditions', async () => {
      const health = await QueueMonitorService.getHealthStatus();

      expect(health).toEqual({
        status: 'healthy',
        queueLength: 5,
        activeJobs: 2,
        utilization: 20,
        failureRate: 5,
        checks: []
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('failure_rate')
      );
    });

    it('should return degraded status when queue length is high', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 25,
        activeJobs: 3,
        maxConcurrent: 10
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.checks).toContain('Queue length is very high');
    });

    it('should return degraded status when failure rate is high', async () => {
      db.query.mockResolvedValue({
        rows: [{
          failure_rate: 0.15
        }]
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.checks).toContain('High failure rate: 15%');
    });

    it('should return unhealthy status when queue is not processing', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 10,
        activeJobs: 0,
        maxConcurrent: 5
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.checks).toContain('Queue is not processing jobs');
    });

    it('should handle multiple health issues', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 25,
        activeJobs: 2,
        maxConcurrent: 10
      });

      db.query.mockResolvedValue({
        rows: [{
          failure_rate: 0.2
        }]
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.checks).toHaveLength(2);
      expect(health.checks).toContain('Queue length is very high');
      expect(health.checks).toContain('High failure rate: 20%');
    });

    it('should handle null failure rate', async () => {
      db.query.mockResolvedValue({
        rows: [{}]
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.failureRate).toBe(0);
      expect(health.status).toBe('healthy');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Connection timeout'));

      const health = await QueueMonitorService.getHealthStatus();

      expect(health).toEqual({
        status: 'error',
        message: 'Connection timeout'
      });

      expect(logger.error).toHaveBeenCalledWith('Error checking queue health', expect.any(Error));
    });

    it('should calculate utilization correctly', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 2,
        activeJobs: 7,
        maxConcurrent: 8
      });

      const health = await QueueMonitorService.getHealthStatus();

      expect(health.utilization).toBe(88); // 7/8 * 100 rounded
    });
  });

  describe('integration tests', () => {
    it('should work end-to-end with start, metrics, and stop', async () => {
      pdfQueueService.getStatus.mockReturnValue({
        queueLength: 2,
        activeJobs: 1,
        maxConcurrent: 5
      });

      db.query.mockResolvedValue({
        rows: [{
          avg_processing_time: 2000,
          avg_wait_time: 500,
          total_completed: 8,
          total_failed: 0
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      // Start monitoring
      QueueMonitorService.start();
      expect(logger.info).toHaveBeenCalledWith('Starting queue monitoring service');

      // Check health separately without timer
      const health = await QueueMonitorService.getHealthStatus();
      expect(health.status).toBe('healthy');

      // Stop monitoring
      QueueMonitorService.stop();
      expect(logger.info).toHaveBeenCalledWith('Stopped queue monitoring service');
    }, 10000);

    it('should handle service restart correctly', () => {
      // Start service
      QueueMonitorService.start();
      const firstInterval = QueueMonitorService.metricsInterval;
      expect(firstInterval).not.toBeNull();

      // Stop service
      QueueMonitorService.stop();
      expect(QueueMonitorService.metricsInterval).toBeNull();

      // Restart service
      QueueMonitorService.start();
      const secondInterval = QueueMonitorService.metricsInterval;
      expect(secondInterval).not.toBeNull();
      expect(secondInterval).not.toBe(firstInterval);
    });
  });
});
// src/services/__tests__/system-monitoring.service.test.js
const systemMonitoringService = require('../system-monitoring.service');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../repositories', () => ({
  monitoringRepository: {
    getQueueHealth: jest.fn(),
    getQueueMetrics: jest.fn(),
    getMetricsSummary: jest.fn(),
    getStuckApplications: jest.fn(),
    storeQueueMetrics: jest.fn()
  }
}));

jest.mock('../../db', () => ({
  query: jest.fn(),
  getPool: jest.fn(() => ({
    totalCount: 10,
    idleCount: 7,
    waitingCount: 0,
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
  }))
}));

jest.mock('../../utils/redis-client', () => ({
  ping: jest.fn((cb) => cb(null, 'PONG')),
  info: jest.fn((cb) => cb(null, 'used_memory_human:10M\r\nconnected_clients:5'))
}));

jest.mock('../queue-monitor.service', () => ({
  getHealthStatus: jest.fn().mockResolvedValue({
    status: 'healthy',
    queueLength: 5,
    activeJobs: 2,
    utilization: 40,
    failureRate: 2,
    checks: []
  })
}));

jest.mock('../payment-monitoring.service', () => ({
  getMetricsReport: jest.fn().mockReturnValue({
    summary: {
      totalPayments: 100,
      successfulPayments: 95,
      failedPayments: 5,
      successRate: 0.95,
      failureRate: 0.05,
      averageProcessingTime: 2500,
      totalRevenue: 15000,
      averagePaymentAmount: 150
    },
    timeWindows: {
      '1h': { total: 10, successful: 9, failed: 1 },
      '24h': { total: 100, successful: 95, failed: 5 }
    },
    consecutiveFailures: 0
  })
}));

jest.mock('../alert.service', () => ({
  sendSystemAlert: jest.fn()
}));

describe('SystemMonitoringService', () => {
  const { monitoringRepository } = require('../../repositories');
  const db = require('../../db');
  
  beforeEach(() => {
    jest.clearAllMocks();
    systemMonitoringService.clearCache();
  });

  describe('getSystemHealth', () => {
    it('should return overall system health status', async () => {
      const health = await systemMonitoringService.getSystemHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('components');
      expect(health.components).toHaveProperty('database');
      expect(health.components).toHaveProperty('redis');
      expect(health.components).toHaveProperty('queue');
      expect(health.components).toHaveProperty('memory');
      expect(health.components).toHaveProperty('cpu');
      expect(health.components).toHaveProperty('payments');
    });

    it('should mark system as degraded if any component is unhealthy', async () => {
      const queueMonitor = require('../queue-monitor.service');
      queueMonitor.getHealthStatus.mockResolvedValueOnce({
        status: 'degraded',
        queueLength: 100,
        activeJobs: 0,
        checks: ['Queue length is very high']
      });

      const health = await systemMonitoringService.getSystemHealth();
      expect(health.status).toBe('degraded');
    });

    it('should cache health status', async () => {
      const health1 = await systemMonitoringService.getSystemHealth();
      const health2 = await systemMonitoringService.getSystemHealth();
      
      expect(health1).toEqual(health2);
      expect(db.getPool().query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue statistics', async () => {
      monitoringRepository.getQueueHealth.mockResolvedValue({
        currently_queued: 10,
        currently_processing: 5,
        completed_count: 100,
        failed_count: 2,
        failure_rate_percent: 2,
        avg_wait_time_ms: 1000,
        avg_processing_time_ms: 5000
      });

      monitoringRepository.getQueueMetrics.mockResolvedValue([
        {
          created_at: new Date(),
          queue_length: 8,
          active_jobs: 3,
          total_completed: 50,
          total_failed: 1
        }
      ]);

      monitoringRepository.getMetricsSummary.mockResolvedValue({
        avg_queue_length: 15,
        max_queue_length: 50,
        total_completed: 1000,
        total_failed: 20
      });

      monitoringRepository.getStuckApplications.mockResolvedValue([]);

      const status = await systemMonitoringService.getQueueStatus();

      expect(status).toHaveProperty('current');
      expect(status).toHaveProperty('hourly');
      expect(status).toHaveProperty('daily');
      expect(status).toHaveProperty('stuck');
      expect(status.current.queued).toBe(10);
      expect(status.current.processing).toBe(5);
    });
  });

  describe('getEmailStats', () => {
    it('should return email delivery statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_sent: 1000,
          successful: 950,
          failed: 30,
          bounced: 20,
          sent_24h: 100,
          sent_1h: 10
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [
          { email_type: 'permit_ready', count: 50, successful: 48 },
          { email_type: 'payment_confirmation', count: 30, successful: 30 }
        ]
      });

      const stats = await systemMonitoringService.getEmailStats();

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('recent');
      expect(stats).toHaveProperty('byType');
      expect(stats.summary.totalSent).toBe(1000);
      expect(stats.summary.deliveryRate).toBe('95.0');
    });
  });

  describe('getPdfStats', () => {
    it('should return PDF generation statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_generated: 500,
          successful: 480,
          failed: 20,
          avg_generation_time: 8500,
          max_generation_time: 25000,
          min_generation_time: 3000,
          generated_24h: 50,
          generated_1h: 5
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [
          { queue_error_message: 'Timeout error', count: 10 },
          { queue_error_message: 'Memory error', count: 5 }
        ]
      });

      const stats = await systemMonitoringService.getPdfStats();

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('recent');
      expect(stats).toHaveProperty('failureReasons');
      expect(stats.summary.totalGenerated).toBe(500);
      expect(stats.summary.successRate).toBe('96.0');
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          db_size: 104857600, // 100MB in bytes
          total_applications: 5000,
          total_users: 1000,
          total_payments: 4500
        }]
      });

      const stats = await systemMonitoringService.getDatabaseStats();

      expect(stats).toHaveProperty('connectionPool');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('performance');
      expect(stats.connectionPool.total).toBe(10);
      expect(stats.connectionPool.idle).toBe(7);
      expect(stats.size.totalSize).toBe(100); // MB
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { error_type: 'ValidationError', error_code: 'INVALID_INPUT', count: 50, last_occurrence: new Date() },
          { error_type: 'DatabaseError', error_code: 'CONNECTION_FAILED', count: 5, last_occurrence: new Date() }
        ]
      });

      const stats = await systemMonitoringService.getErrorStats();

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('recent');
      expect(stats).toHaveProperty('critical');
      expect(stats.byType.ValidationError).toBe(50);
      expect(stats.byType.DatabaseError).toBe(5);
    });
  });

  describe('Performance monitoring', () => {
    it('should record API response times', () => {
      systemMonitoringService.recordApiResponseTime('/api/test', 'GET', 150);
      
      expect(systemMonitoringService.performanceMetrics.apiResponseTimes).toHaveLength(1);
      expect(systemMonitoringService.performanceMetrics.apiResponseTimes[0]).toMatchObject({
        endpoint: '/api/test',
        method: 'GET',
        responseTime: 150
      });
    });

    it('should record slow API responses as errors', () => {
      systemMonitoringService.recordApiResponseTime('/api/slow', 'POST', 5000);
      
      expect(systemMonitoringService.errorStats.recent).toHaveLength(1);
      expect(systemMonitoringService.errorStats.recent[0]).toMatchObject({
        type: 'performance',
        code: 'SLOW_API_RESPONSE'
      });
    });

    it('should record database query times', () => {
      systemMonitoringService.recordDbQueryTime('SELECT * FROM users', 50);
      
      expect(systemMonitoringService.performanceMetrics.dbQueryTimes).toHaveLength(1);
      expect(systemMonitoringService.performanceMetrics.dbQueryTimes[0]).toMatchObject({
        query: 'SELECT * FROM users',
        duration: 50
      });
    });
  });

  describe('Error tracking', () => {
    it('should record errors with proper categorization', () => {
      systemMonitoringService.recordError('DatabaseError', 'CONNECTION_TIMEOUT', {
        message: 'Connection timed out'
      });

      expect(systemMonitoringService.errorStats.byType['DatabaseError:CONNECTION_TIMEOUT']).toBe(1);
      expect(systemMonitoringService.errorStats.recent).toHaveLength(1);
    });

    it('should track critical errors separately', () => {
      systemMonitoringService.recordError('SystemError', 'OUT_OF_MEMORY', {
        message: 'Out of memory'
      }, 'critical');

      expect(systemMonitoringService.errorStats.critical).toHaveLength(1);
      expect(systemMonitoringService.errorStats.critical[0].severity).toBe('critical');
    });

    it('should send alerts when error rate exceeds threshold', async () => {
      const alertService = require('../alert.service');
      
      // Record multiple errors to exceed threshold
      for (let i = 0; i < 15; i++) {
        systemMonitoringService.recordError('TestError', 'TEST_CODE', {});
      }

      expect(alertService.sendSystemAlert).toHaveBeenCalledWith(
        expect.stringContaining('HIGH_ERROR_RATE'),
        expect.any(String),
        expect.objectContaining({
          errorCount: 15,
          threshold: 10
        }),
        'HIGH'
      );
    });
  });

  describe('getSystemMetrics', () => {
    it('should return comprehensive system metrics', async () => {
      const metrics = await systemMonitoringService.getSystemMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('health');
      expect(metrics).toHaveProperty('queue');
      expect(metrics).toHaveProperty('email');
      expect(metrics).toHaveProperty('pdf');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('errors');
    });

    it('should handle partial failures gracefully', async () => {
      // Make one service fail
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const metrics = await systemMonitoringService.getSystemMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.health.status).toBeDefined();
      // Other metrics should still be present
      expect(metrics.queue).toBeDefined();
    });
  });
});
/**
 * Payment Recovery Repository Tests
 * Comprehensive test coverage for payment recovery data operations
 */

const paymentRecoveryRepository = require('../payment-recovery.repository');
const db = require('../../db');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('PaymentRecoveryRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertRecoveryAttempt', () => {
    const mockApplicationId = 123;
    const mockPaymentIntentId = 'pi_test123';
    const mockAttemptData = {
      attemptCount: 2,
      lastAttemptTime: new Date('2024-01-15T10:00:00Z'),
      lastError: 'Network timeout',
      recoveryStatus: 'recovering'
    };

    it('should create new recovery attempt successfully', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId,
        attempt_count: 2,
        last_attempt_time: mockAttemptData.lastAttemptTime,
        last_error: 'Network timeout',
        recovery_status: 'recovering'
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      const result = await paymentRecoveryRepository.upsertRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId,
        mockAttemptData
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_recovery_attempts'),
        [
          mockApplicationId,
          mockPaymentIntentId,
          2,
          mockAttemptData.lastAttemptTime,
          'Network timeout',
          'recovering'
        ]
      );
      expect(result).toEqual(mockResult);
    });

    it('should use default values when attemptData is empty', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId,
        attempt_count: 1,
        recovery_status: 'recovering'
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      await paymentRecoveryRepository.upsertRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId,
        {}
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_recovery_attempts'),
        [
          mockApplicationId,
          mockPaymentIntentId,
          1,
          expect.any(Date),
          null,
          'recovering'
        ]
      );
    });

    it('should use default values when attemptData is not provided', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      await paymentRecoveryRepository.upsertRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_recovery_attempts'),
        [
          mockApplicationId,
          mockPaymentIntentId,
          1,
          expect.any(Date),
          null,
          'recovering'
        ]
      );
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Database connection failed');
      db.query.mockRejectedValue(mockError);

      await expect(
        paymentRecoveryRepository.upsertRecoveryAttempt(
          mockApplicationId,
          mockPaymentIntentId,
          mockAttemptData
        )
      ).rejects.toThrow('Database connection failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error upserting recovery attempt:', {
        error: 'Database connection failed',
        applicationId: mockApplicationId,
        paymentIntentId: mockPaymentIntentId
      });
    });

    it('should handle conflict resolution with ON CONFLICT clause', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId,
        attempt_count: 3, // Incremented from existing
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      const result = await paymentRecoveryRepository.upsertRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId,
        mockAttemptData
      );

      expect(result.attempt_count).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (application_id, payment_intent_id)'),
        expect.any(Array)
      );
    });
  });

  describe('getRecoveryAttempt', () => {
    const mockApplicationId = 123;
    const mockPaymentIntentId = 'pi_test123';

    it('should return recovery attempt when found', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId,
        attempt_count: 2,
        recovery_status: 'recovering'
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      const result = await paymentRecoveryRepository.getRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM payment_recovery_attempts'),
        [mockApplicationId, mockPaymentIntentId]
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when recovery attempt not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await paymentRecoveryRepository.getRecoveryAttempt(
        mockApplicationId,
        mockPaymentIntentId
      );

      expect(result).toBeNull();
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Query execution failed');
      db.query.mockRejectedValue(mockError);

      await expect(
        paymentRecoveryRepository.getRecoveryAttempt(
          mockApplicationId,
          mockPaymentIntentId
        )
      ).rejects.toThrow('Query execution failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error getting recovery attempt:', {
        error: 'Query execution failed',
        applicationId: mockApplicationId,
        paymentIntentId: mockPaymentIntentId
      });
    });
  });

  describe('updateRecoveryStatus', () => {
    const mockApplicationId = 123;
    const mockPaymentIntentId = 'pi_test123';
    const mockStatus = 'succeeded';
    const mockError = 'Payment processing completed';

    it('should update recovery status successfully', async () => {
      const mockResult = {
        id: 1,
        application_id: mockApplicationId,
        payment_intent_id: mockPaymentIntentId,
        recovery_status: mockStatus,
        last_error: mockError
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      const result = await paymentRecoveryRepository.updateRecoveryStatus(
        mockApplicationId,
        mockPaymentIntentId,
        mockStatus,
        mockError
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_recovery_attempts'),
        [mockStatus, mockError, mockApplicationId, mockPaymentIntentId]
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle null error parameter', async () => {
      const mockResult = {
        id: 1,
        recovery_status: mockStatus,
        last_error: null
      };

      db.query.mockResolvedValue({ rows: [mockResult] });

      await paymentRecoveryRepository.updateRecoveryStatus(
        mockApplicationId,
        mockPaymentIntentId,
        mockStatus
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_recovery_attempts'),
        [mockStatus, null, mockApplicationId, mockPaymentIntentId]
      );
    });

    it('should handle database errors properly', async () => {
      const mockDbError = new Error('Update failed');
      db.query.mockRejectedValue(mockDbError);

      await expect(
        paymentRecoveryRepository.updateRecoveryStatus(
          mockApplicationId,
          mockPaymentIntentId,
          mockStatus,
          mockError
        )
      ).rejects.toThrow('Update failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error updating recovery status:', {
        error: 'Update failed',
        applicationId: mockApplicationId,
        paymentIntentId: mockPaymentIntentId,
        status: mockStatus
      });
    });
  });

  describe('getStuckRecoveryAttempts', () => {
    it('should return stuck recovery attempts with default age', async () => {
      const mockResults = [
        {
          id: 1,
          application_id: 123,
          payment_intent_id: 'pi_test123',
          recovery_status: 'recovering',
          attempt_count: 2,
          application_status: 'PAYMENT_PROCESSING',
          user_id: 'user_123'
        },
        {
          id: 2,
          application_id: 124,
          payment_intent_id: 'pi_test124',
          recovery_status: 'pending',
          attempt_count: 1,
          application_status: 'PAYMENT_PROCESSING',
          user_id: 'user_124'
        }
      ];

      db.query.mockResolvedValue({ rows: mockResults });

      const result = await paymentRecoveryRepository.getStuckRecoveryAttempts();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 minutes'")
      );
      expect(result).toEqual(mockResults);
      expect(result).toHaveLength(2);
    });

    it('should use custom minutes parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts(60);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '60 minutes'")
      );
    });

    it('should limit results to 100 records', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100')
      );
    });

    it('should filter by recovery status and attempt count', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts();

      const query = db.query.mock.calls[0][0];
      expect(query).toContain("recovery_status IN ('pending', 'recovering')");
      expect(query).toContain('attempt_count < 3');
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Database query failed');
      db.query.mockRejectedValue(mockError);

      await expect(
        paymentRecoveryRepository.getStuckRecoveryAttempts()
      ).rejects.toThrow('Database query failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error getting stuck recovery attempts:', mockError);
    });
  });

  describe('cleanupOldAttempts', () => {
    it('should clean up old attempts with default age', async () => {
      const mockResults = [{ id: 1 }, { id: 2 }, { id: 3 }];
      db.query.mockResolvedValue({ rows: mockResults });

      const result = await paymentRecoveryRepository.cleanupOldAttempts();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
      expect(result).toBe(3);

      const { logger } = require('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 3 old recovery attempts');
    });

    it('should use custom days parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.cleanupOldAttempts(14);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '14 days'")
      );
    });

    it('should only delete completed recovery attempts', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.cleanupOldAttempts();

      const query = db.query.mock.calls[0][0];
      expect(query).toContain("recovery_status IN ('succeeded', 'failed', 'max_attempts_reached')");
    });

    it('should return count of cleaned up records', async () => {
      const mockResults = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValue({ rows: mockResults });

      const result = await paymentRecoveryRepository.cleanupOldAttempts();

      expect(result).toBe(2);
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Delete operation failed');
      db.query.mockRejectedValue(mockError);

      await expect(
        paymentRecoveryRepository.cleanupOldAttempts()
      ).rejects.toThrow('Delete operation failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error cleaning up old recovery attempts:', mockError);
    });
  });

  describe('getRecoveryStats', () => {
    it('should return recovery statistics with default time period', async () => {
      const mockStats = {
        total_attempts: '15',
        successful_recoveries: '10',
        failed_recoveries: '3',
        max_attempts_reached: '2',
        in_progress: '0',
        avg_attempts: '2.1'
      };

      db.query.mockResolvedValue({ rows: [mockStats] });

      const result = await paymentRecoveryRepository.getRecoveryStats();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '24 hours'")
      );
      expect(result).toEqual(mockStats);
    });

    it('should use custom hours parameter', async () => {
      db.query.mockResolvedValue({ rows: [{}] });

      await paymentRecoveryRepository.getRecoveryStats(48);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '48 hours'")
      );
    });

    it('should return comprehensive statistics', async () => {
      const mockStats = {
        total_attempts: '20',
        successful_recoveries: '15',
        failed_recoveries: '3',
        max_attempts_reached: '2',
        in_progress: '5',
        avg_attempts: '1.8'
      };

      db.query.mockResolvedValue({ rows: [mockStats] });

      const result = await paymentRecoveryRepository.getRecoveryStats();

      expect(result).toHaveProperty('total_attempts');
      expect(result).toHaveProperty('successful_recoveries');
      expect(result).toHaveProperty('failed_recoveries');
      expect(result).toHaveProperty('max_attempts_reached');
      expect(result).toHaveProperty('in_progress');
      expect(result).toHaveProperty('avg_attempts');
    });

    it('should handle empty results', async () => {
      const mockStats = {
        total_attempts: '0',
        successful_recoveries: '0',
        failed_recoveries: '0',
        max_attempts_reached: '0',
        in_progress: '0',
        avg_attempts: null
      };

      db.query.mockResolvedValue({ rows: [mockStats] });

      const result = await paymentRecoveryRepository.getRecoveryStats();

      expect(result.total_attempts).toBe('0');
      expect(result.avg_attempts).toBeNull();
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Statistics query failed');
      db.query.mockRejectedValue(mockError);

      await expect(
        paymentRecoveryRepository.getRecoveryStats()
      ).rejects.toThrow('Statistics query failed');

      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error getting recovery stats:', mockError);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle SQL injection attempts safely', async () => {
      const maliciousId = "123; DROP TABLE payment_recovery_attempts; --";
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getRecoveryAttempt(maliciousId, 'pi_test');

      // Verify parameterized query is used
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE application_id = $1 AND payment_intent_id = $2'),
        [maliciousId, 'pi_test']
      );
    });

    it('should handle null application ID gracefully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getRecoveryAttempt(null, 'pi_test');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [null, 'pi_test']
      );
    });

    it('should handle empty payment intent ID', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getRecoveryAttempt(123, '');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [123, '']
      );
    });

    it('should handle very large interval values', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts(999999);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '999999 minutes'")
      );
    });

    it('should handle connection timeout errors', async () => {
      const timeoutError = new Error('connection timeout');
      timeoutError.code = 'ETIMEDOUT';
      db.query.mockRejectedValue(timeoutError);

      await expect(
        paymentRecoveryRepository.upsertRecoveryAttempt(123, 'pi_test')
      ).rejects.toThrow('connection timeout');
    });

    it('should handle constraint violation errors', async () => {
      const constraintError = new Error('violates foreign key constraint');
      constraintError.code = '23503';
      db.query.mockRejectedValue(constraintError);

      await expect(
        paymentRecoveryRepository.upsertRecoveryAttempt(999999, 'pi_nonexistent')
      ).rejects.toThrow('violates foreign key constraint');
    });
  });

  describe('performance considerations', () => {
    it('should use indexes efficiently for common queries', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getRecoveryAttempt(123, 'pi_test');

      // Verify the query structure supports efficient indexing
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('WHERE application_id = $1 AND payment_intent_id = $2');
    });

    it('should limit large result sets appropriately', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts();

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('LIMIT 100');
    });

    it('should order results for consistent pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await paymentRecoveryRepository.getStuckRecoveryAttempts();

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('ORDER BY pra.last_attempt_time ASC');
    });
  });
});
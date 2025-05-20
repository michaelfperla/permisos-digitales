/**
 * Unit Tests for Security Service
 */
const securityService = require('../security.service');
const db = require('../../db');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../db');
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Security Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should log activity successfully', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const details = { browser: 'Chrome', device: 'Desktop' };

      // Mock DB query to return a log entry
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, action_type: actionType, created_at: new Date() }],
        rowCount: 1
      });

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent, details);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        action_type: actionType
      }));
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_audit_log'),
        [userId, actionType, ipAddress, userAgent, JSON.stringify(details)]
      );
    });

    it('should handle null userId for anonymous actions', async () => {
      // Arrange
      const userId = null;
      const actionType = 'failed_login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // Mock DB query to return a log entry
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, action_type: actionType, created_at: new Date() }],
        rowCount: 1
      });

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        action_type: actionType
      }));
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_audit_log'),
        [userId, actionType, ipAddress, userAgent, '{}']
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const dbError = new Error('Database error');

      // Mock DB query to throw an error
      db.query.mockRejectedValueOnce(dbError);

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent);

      // Assert
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating security audit log:'),
        dbError
      );
    });

    it('should handle complex error objects', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // Create a complex error object with circular references
      const complexError = new Error('Complex error');
      complexError.data = { nested: { circular: complexError } };

      // Mock DB query to throw the complex error
      db.query.mockRejectedValueOnce(complexError);

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent);

      // Assert
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating security audit log:'),
        expect.any(Error)
      );
    });

    it('should handle errors with missing properties', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // Create an error without a message
      const strangeError = { code: 'STRANGE_ERROR' }; // Not a proper Error object

      // Mock DB query to throw the strange error
      db.query.mockRejectedValueOnce(strangeError);

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent);

      // Assert
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating security audit log:'),
        expect.anything()
      );
    });
  });

  describe('isRateLimitExceeded', () => {
    it('should return false when rate limit is not exceeded', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const limit = 5;
      const timeWindowMinutes = 15;

      // Mock DB query to return count below limit
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: '3' }]
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType, limit, timeWindowMinutes);

      // Assert
      expect(result).toBe(false);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${timeWindowMinutes} minutes'`),
        [ipAddress, actionType]
      );
    });

    it('should return true when rate limit is exceeded', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const limit = 5;
      const timeWindowMinutes = 15;

      // Mock DB query to return count at limit
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: '5' }]
      });

      // Mock DB query for logging rate limit exceeded
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, action_type: 'rate_limit_exceeded', created_at: new Date() }]
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType, limit, timeWindowMinutes);

      // Assert
      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Rate limit exceeded for ${actionType} from IP ${ipAddress}`)
      );
      expect(db.query).toHaveBeenCalledTimes(2); // First for count, second for logging
    });

    it('should return true when rate limit is exceeded by a large margin', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const limit = 5;
      const timeWindowMinutes = 15;

      // Mock DB query to return count above limit
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: '10' }]
      });

      // Mock DB query for logging rate limit exceeded
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, action_type: 'rate_limit_exceeded', created_at: new Date() }]
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType, limit, timeWindowMinutes);

      // Assert
      expect(result).toBe(true);
    });

    it('should use default values when parameters are not provided', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const defaultLimit = 5; // Default in the service
      const defaultTimeWindow = 15; // Default in the service

      // Mock DB query to return count below limit
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: '3' }]
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType);

      // Assert
      expect(result).toBe(false);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${defaultTimeWindow} minutes'`),
        [ipAddress, actionType]
      );
    });

    it('should handle database errors and return false', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const dbError = new Error('Database error');

      // Mock DB query to throw an error
      db.query.mockRejectedValueOnce(dbError);

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType);

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking rate limit:',
        dbError
      );
    });

    it('should handle error during logging of rate limit exceeded', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const limit = 5;

      // First query succeeds and shows limit exceeded
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: '6' }]
      });

      // Second query (for logging) fails
      const logError = new Error('Logging error');
      db.query.mockRejectedValueOnce(logError);

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType, limit);

      // Assert
      expect(result).toBe(true); // Still returns true because rate limit is exceeded
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Rate limit exceeded for ${actionType} from IP ${ipAddress}`)
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating security audit log:'),
        logError
      );
    });

    it('should handle invalid attempt count from database', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';

      // Mock DB query to return invalid data
      db.query.mockResolvedValueOnce({
        rows: [{ attempt_count: 'not-a-number' }]
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType);

      // Assert
      expect(result).toBe(false); // Should default to false for safety
      expect(logger.error).not.toHaveBeenCalled(); // No explicit error handling for this case
    });

    it('should handle empty result from database', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';

      // Mock DB query to return empty result
      db.query.mockResolvedValueOnce({
        rows: []
      });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType);

      // Assert
      expect(result).toBe(false); // Should default to false when no data
    });
  });

  describe('getUserSecurityEvents', () => {
    it('should return security events for a user', async () => {
      // Arrange
      const userId = 123;
      const limit = 10;
      const mockEvents = [
        { id: 1, action_type: 'login', ip_address: '192.168.1.1', created_at: new Date() },
        { id: 2, action_type: 'password_change', ip_address: '192.168.1.1', created_at: new Date() }
      ];

      // Mock DB query to return events
      db.query.mockResolvedValueOnce({
        rows: mockEvents
      });

      // Act
      const result = await securityService.getUserSecurityEvents(userId, limit);

      // Assert
      expect(result).toEqual(mockEvents);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, action_type, ip_address'),
        [userId, limit]
      );
    });

    it('should use default limit when not provided', async () => {
      // Arrange
      const userId = 123;
      const defaultLimit = 20; // Default in the service

      // Mock DB query to return events
      db.query.mockResolvedValueOnce({
        rows: []
      });

      // Act
      const result = await securityService.getUserSecurityEvents(userId);

      // Assert
      expect(result).toEqual([]);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, action_type, ip_address'),
        [userId, defaultLimit]
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 123;
      const dbError = new Error('Database error');

      // Mock DB query to throw an error
      db.query.mockRejectedValueOnce(dbError);

      // Act & Assert
      await expect(securityService.getUserSecurityEvents(userId))
        .rejects.toThrow(dbError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error getting security events for user ${userId}:`),
        dbError
      );
    });
  });

  describe('getSuspiciousActivityReport', () => {
    it('should return suspicious activity report with default parameters', async () => {
      // Arrange
      const defaultDaysBack = 7;
      const defaultLimit = 100;
      const mockReport = [
        {
          ip_address: '192.168.1.1',
          failed_logins: '10',
          successful_logins: '2',
          unique_users: '3',
          last_attempt: new Date()
        },
        {
          ip_address: '192.168.1.2',
          failed_logins: '7',
          successful_logins: '0',
          unique_users: '2',
          last_attempt: new Date()
        }
      ];

      // Mock DB query to return report data
      db.query.mockResolvedValueOnce({
        rows: mockReport
      });

      // Act
      const result = await securityService.getSuspiciousActivityReport();

      // Assert
      expect(result).toEqual(mockReport);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${defaultDaysBack} days'`),
        [defaultLimit]
      );
      expect(db.query.mock.calls[0][0]).toContain('failed_logins > 5 OR (failed_logins > 0 AND unique_users > 2)');
    });

    it('should use custom parameters when provided', async () => {
      // Arrange
      const daysBack = 14;
      const limit = 50;
      const mockReport = [
        {
          ip_address: '192.168.1.1',
          failed_logins: '10',
          successful_logins: '2',
          unique_users: '3',
          last_attempt: new Date()
        }
      ];

      // Mock DB query to return report data
      db.query.mockResolvedValueOnce({
        rows: mockReport
      });

      // Act
      const result = await securityService.getSuspiciousActivityReport(daysBack, limit);

      // Assert
      expect(result).toEqual(mockReport);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${daysBack} days'`),
        [limit]
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      // Mock DB query to return empty result
      db.query.mockResolvedValueOnce({
        rows: []
      });

      // Act
      const result = await securityService.getSuspiciousActivityReport();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');

      // Mock DB query to throw an error
      db.query.mockRejectedValueOnce(dbError);

      // Act & Assert
      await expect(securityService.getSuspiciousActivityReport())
        .rejects.toThrow(dbError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error generating suspicious activity report:'),
        dbError
      );
    });
  });
});

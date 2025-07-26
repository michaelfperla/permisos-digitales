/**
 * Unit Tests for Refactored Security Service
 * Focuses on testing the repository pattern integration
 */
const securityService = require('../security.service');
const { securityRepository } = require('../../repositories');

// Mock dependencies
jest.mock('../../repositories', () => ({
  securityRepository: {
    logSecurityActivity: jest.fn(),
    countRecentActivities: jest.fn(),
    recordRateLimitViolation: jest.fn(),
    getSecurityEvents: jest.fn(),
    getSuspiciousActivityReport: jest.fn()
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Refactored Security Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should use securityRepository.logSecurityActivity', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const details = { test: 'data' };

      securityRepository.logSecurityActivity.mockResolvedValueOnce({
        id: 1,
        action_type: actionType,
        created_at: new Date()
      });

      // Act
      const result = await securityService.logActivity(userId, actionType, ipAddress, userAgent, details);

      // Assert
      expect(securityRepository.logSecurityActivity).toHaveBeenCalledWith(
        userId, actionType, ipAddress, userAgent, details
      );
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        action_type: actionType
      }));
    });
  });

  describe('isRateLimitExceeded', () => {
    it('should use securityRepository methods for rate limiting', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';
      const limit = 5;
      const timeWindowMinutes = 15;

      securityRepository.countRecentActivities.mockResolvedValueOnce(6); // Above limit
      securityRepository.recordRateLimitViolation.mockResolvedValueOnce({ id: 1 });

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType, limit, timeWindowMinutes);

      // Assert
      expect(securityRepository.countRecentActivities).toHaveBeenCalledWith(ipAddress, actionType, timeWindowMinutes);
      expect(securityRepository.recordRateLimitViolation).toHaveBeenCalledWith(ipAddress, actionType, {
        attemptCount: 6,
        limit,
        timeWindowMinutes
      });
      expect(result).toBe(true);
    });

    it('should not log rate limit violation when under limit', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'login';

      securityRepository.countRecentActivities.mockResolvedValueOnce(3); // Below limit

      // Act
      const result = await securityService.isRateLimitExceeded(ipAddress, actionType);

      // Assert
      expect(securityRepository.countRecentActivities).toHaveBeenCalled();
      expect(securityRepository.recordRateLimitViolation).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('getUserSecurityEvents', () => {
    it('should use securityRepository.getSecurityEvents', async () => {
      // Arrange
      const userId = 123;
      const limit = 10;
      const mockEvents = [
        { id: 1, action_type: 'login', ip_address: '192.168.1.1' }
      ];

      securityRepository.getSecurityEvents.mockResolvedValueOnce(mockEvents);

      // Act
      const result = await securityService.getUserSecurityEvents(userId, limit);

      // Assert
      expect(securityRepository.getSecurityEvents).toHaveBeenCalledWith(userId, limit);
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getSuspiciousActivityReport', () => {
    it('should use securityRepository.getSuspiciousActivityReport', async () => {
      // Arrange
      const daysBack = 7;
      const mockReport = {
        suspiciousIPs: { failedLogins: [], rateLimitExceeded: [] },
        csrfViolations: [],
        reportTimeWindow: '168 hours',
        generatedAt: new Date().toISOString()
      };

      securityRepository.getSuspiciousActivityReport.mockResolvedValueOnce(mockReport);

      // Act
      const result = await securityService.getSuspiciousActivityReport(daysBack);

      // Assert
      expect(securityRepository.getSuspiciousActivityReport).toHaveBeenCalledWith({
        timeWindowHours: 168, // 7 days * 24 hours
        minFailedLogins: 5,
        minRateLimitEvents: 3
      });
      expect(result).toEqual(mockReport);
    });
  });
});
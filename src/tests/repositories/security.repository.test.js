/**
 * Tests for Security Repository
 */
const { NotFoundError } = require('../../utils/errors');

// Import test setup
require('../setup');

// Mock the database module using our standardized approach
const db = require('../../db');

// Import after mocking dependencies
const securityRepository = require('../../repositories/security.repository');

describe('SecurityRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should log security activity', async () => {
      // Arrange
      const userId = 123;
      const actionType = 'login';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const details = { browser: 'Chrome' };

      const mockLogEntry = {
        id: 1,
        action_type: actionType,
        created_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockLogEntry], rowCount: 1 });

      // Act
      const result = await securityRepository.logActivity(userId, actionType, ipAddress, userAgent, details);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_audit_log'),
        [userId, actionType, ipAddress, userAgent, JSON.stringify(details)]
      );
      expect(result).toEqual(mockLogEntry);
    });

    it('should handle null userId', async () => {
      // Arrange
      const userId = null;
      const actionType = 'anonymous_access';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      db.query.mockResolvedValue({ rows: [{}], rowCount: 1 });

      // Act
      await securityRepository.logActivity(userId, actionType, ipAddress, userAgent);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_audit_log'),
        [null, actionType, ipAddress, userAgent, '{}']
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act
      const result = await securityRepository.logActivity(123, 'login', '192.168.1.1', 'Mozilla/5.0');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('countRecentActivities', () => {
    it('should count recent activities by IP and action type', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'failed_login';
      const timeWindowMinutes = 15;

      db.query.mockResolvedValue({ rows: [{ attempt_count: '5' }], rowCount: 1 });

      // Act
      const result = await securityRepository.countRecentActivities(ipAddress, actionType, timeWindowMinutes);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as attempt_count'),
        [ipAddress, actionType]
      );
      expect(db.query.mock.calls[0][0]).toContain('WHERE ip_address = $1');
      expect(db.query.mock.calls[0][0]).toContain('AND action_type = $2');
      expect(db.query.mock.calls[0][0]).toContain(`INTERVAL '${timeWindowMinutes} minutes'`);
      expect(result).toBe(5);
    });

    it('should use default time window when not provided', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';
      const actionType = 'failed_login';
      const defaultTimeWindow = 15; // minutes

      db.query.mockResolvedValue({ rows: [{ attempt_count: '0' }], rowCount: 1 });

      // Act
      await securityRepository.countRecentActivities(ipAddress, actionType);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${defaultTimeWindow} minutes'`),
        [ipAddress, actionType]
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act
      const result = await securityRepository.countRecentActivities('192.168.1.1', 'failed_login');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getSuspiciousActivityReport', () => {
    it('should return suspicious activity report', async () => {
      // Arrange
      const options = {
        timeWindowHours: 24,
        minFailedLogins: 5,
        minRateLimitEvents: 3
      };

      // Mock the three queries that are executed
      db.query.mockResolvedValueOnce({ rows: [{ ip_address: '192.168.1.1', count: '10' }] }) // Failed logins
        .mockResolvedValueOnce({ rows: [{ ip_address: '192.168.1.2', count: '5' }] })  // Rate limit
        .mockResolvedValueOnce({ rows: [{ ip_address: '192.168.1.3' }] });            // CSRF

      // Act
      const result = await securityRepository.getSuspiciousActivityReport(options);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty('suspiciousIPs');
      expect(result).toHaveProperty('csrfViolations');
      expect(result).toHaveProperty('reportTimeWindow', '24 hours');
      expect(result).toHaveProperty('generatedAt');
      expect(result.suspiciousIPs.failedLogins).toHaveLength(1);
      expect(result.suspiciousIPs.rateLimitExceeded).toHaveLength(1);
      expect(result.csrfViolations).toHaveLength(1);
    });

    it('should use default options when not provided', async () => {
      // Arrange
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await securityRepository.getSuspiciousActivityReport();

      // Assert
      expect(db.query).toHaveBeenCalledTimes(3);
      // Check that the first query uses default values
      expect(db.query.mock.calls[0][0]).toContain('INTERVAL \'24 hours\'');
      expect(db.query.mock.calls[0][1]).toEqual([5]); // Default minFailedLogins
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        securityRepository.getSuspiciousActivityReport()
      ).rejects.toThrow(dbError);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create a password reset token', async () => {
      // Arrange
      const userId = 123;
      const token = 'abc123def456';
      const expiresInHours = 2;

      const mockResult = {
        id: 1,
        token,
        expires_at: expect.any(String)
      };

      db.query.mockResolvedValue({ rows: [mockResult], rowCount: 1 });

      // Act
      const result = await securityRepository.createPasswordResetToken(userId, token, expiresInHours);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        [userId, token]
      );
      expect(db.query.mock.calls[0][0]).toContain(`INTERVAL '${expiresInHours} hours'`);
      expect(result).toEqual(mockResult);
    });

    it('should use default expiration when not provided', async () => {
      // Arrange
      const userId = 123;
      const token = 'abc123def456';
      const defaultExpiresInHours = 1;

      db.query.mockResolvedValue({ rows: [{}], rowCount: 1 });

      // Act
      await securityRepository.createPasswordResetToken(userId, token);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${defaultExpiresInHours} hours'`),
        [userId, token]
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        securityRepository.createPasswordResetToken(123, 'abc123def456')
      ).rejects.toThrow(dbError);
    });
  });

  describe('findValidResetToken', () => {
    it('should return a valid reset token with user email', async () => {
      // Arrange
      const token = 'abc123def456';
      const mockToken = {
        id: 1,
        user_id: 123,
        token,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        used_at: null,
        email: 'user@example.com'
      };

      db.query.mockResolvedValue({ rows: [mockToken], rowCount: 1 });

      // Act
      const result = await securityRepository.findValidResetToken(token);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT prt.*, u.email'),
        [token]
      );
      expect(db.query.mock.calls[0][0]).toContain('JOIN users u ON prt.user_id = u.id');
      expect(db.query.mock.calls[0][0]).toContain('WHERE prt.token = $1');
      expect(db.query.mock.calls[0][0]).toContain('AND prt.expires_at > NOW()');
      expect(db.query.mock.calls[0][0]).toContain('AND prt.used_at IS NULL');
      expect(result).toEqual(mockToken);
    });

    it('should return null when token not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await securityRepository.findValidResetToken('invalid-token');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        securityRepository.findValidResetToken('abc123def456')
      ).rejects.toThrow(dbError);
    });
  });

  describe('markResetTokenAsUsed', () => {
    it('should mark a reset token as used', async () => {
      // Arrange
      const token = 'abc123def456';

      db.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      // Act
      const result = await securityRepository.markResetTokenAsUsed(token);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        [token]
      );
      expect(db.query.mock.calls[0][0]).toContain('SET used_at = NOW()');
      expect(result).toBe(true);
    });

    it('should return false when token not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await securityRepository.markResetTokenAsUsed('invalid-token');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        securityRepository.markResetTokenAsUsed('abc123def456')
      ).rejects.toThrow(dbError);
    });
  });
});

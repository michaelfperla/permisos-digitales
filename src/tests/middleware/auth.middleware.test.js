/**
 * Tests for Auth Middleware
 */

// Import test setup
require('../setup');

// Mock dependencies using our standardized approach
// Mock API Response using our standardized approach
jest.mock('../../utils/api-response', () => ({
  success: jest.fn().mockImplementation((res, message, data) => {
    res.status(200).json({ success: true, message, data });
    return res;
  }),
  error: jest.fn().mockImplementation((res, message, status = 500) => {
    res.status(status).json({ success: false, message });
    return res;
  }),
  badRequest: jest.fn().mockImplementation((res, message) => {
    res.status(400).json({ success: false, message });
    return res;
  }),
  unauthorized: jest.fn().mockImplementation((res, message) => {
    res.status(401).json({ success: false, message });
    return 'unauthorized-response';
  }),
  forbidden: jest.fn().mockImplementation((res, message) => {
    res.status(403).json({ success: false, message });
    return 'forbidden-response';
  }),
  notFound: jest.fn().mockImplementation((res, message) => {
    res.status(404).json({ success: false, message });
    return res;
  }),
  tooManyRequests: jest.fn().mockImplementation((res, message) => {
    res.status(429).json({ success: false, message });
    return res;
  })
}));

// Mock security service
jest.mock('../../services/security.service', () => ({
  logActivity: jest.fn().mockResolvedValue({})
}));

// Import after mocking dependencies
const authMiddleware = require('../../middleware/auth.middleware');
const { logger } = require('../../utils/enhanced-logger');
const ApiResponse = require('../../utils/api-response');
const securityService = require('../../services/security.service');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next function mocks
    req = {
      session: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };

    // Create a proper mock for the response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('isAuthenticated', () => {
    it('should call next() when user is authenticated', () => {
      // Arrange
      req.session.userId = 123;

      // Act
      authMiddleware.isAuthenticated(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(ApiResponse.unauthorized).not.toHaveBeenCalled();
    });

    it('should return unauthorized response when session is missing', () => {
      // Arrange
      req.session = null;

      // Act
      const result = authMiddleware.isAuthenticated(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res);
      expect(result).toBe('unauthorized-response');
      expect(logger.warn).toHaveBeenCalledWith('Authentication failed: No valid session found.');
    });

    it('should return unauthorized response when userId is missing', () => {
      // Arrange
      req.session = { someOtherData: 'test' };

      // Act
      const result = authMiddleware.isAuthenticated(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res);
      expect(result).toBe('unauthorized-response');
    });
  });

  describe('isAdminPortal', () => {
    it('should call next() when user is admin with admin portal access', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'admin',
        isAdminPortal: true
      };

      // Act
      authMiddleware.isAdminPortal(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(ApiResponse.unauthorized).not.toHaveBeenCalled();
      expect(ApiResponse.forbidden).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Admin portal access granted'));
    });

    it('should return unauthorized when session is missing', () => {
      // Arrange
      req.session = null;

      // Act
      const result = authMiddleware.isAdminPortal(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res);
      expect(result).toBe('unauthorized-response');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Admin portal access denied'));
    });

    it('should return forbidden when user is not an admin', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'client',
        isAdminPortal: false
      };

      // Act
      const result = authMiddleware.isAdminPortal(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'Admin access required');
      expect(result).toBe('forbidden-response');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Admin portal access denied'));
    });

    it('should return forbidden when admin does not have portal access', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'admin',
        isAdminPortal: false
      };

      // Act
      const result = authMiddleware.isAdminPortal(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'Access denied. Please use the correct portal login.');
      expect(result).toBe('forbidden-response');
    });
  });

  describe('isClient', () => {
    it('should call next() when user is a client', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'client'
      };

      // Act
      authMiddleware.isClient(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(ApiResponse.unauthorized).not.toHaveBeenCalled();
      expect(ApiResponse.forbidden).not.toHaveBeenCalled();
    });

    it('should call next() when user is an admin (can access client routes)', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'admin'
      };

      // Act
      authMiddleware.isClient(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Admin account'));
    });

    it('should return unauthorized when session is missing', () => {
      // Arrange
      req.session = null;

      // Act
      const result = authMiddleware.isClient(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res);
      expect(result).toBe('unauthorized-response');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Client route access denied'));
    });

    it('should return forbidden for unknown account type', () => {
      // Arrange
      req.session = {
        userId: 123,
        accountType: 'unknown'
      };

      // Act
      const result = authMiddleware.isClient(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'Invalid account type');
      expect(result).toBe('forbidden-response');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown account type'));
    });
  });

  describe('auditRequest', () => {
    it('should log activity and call next() for authenticated users', async () => {
      // Arrange
      const securityService = require('../../services/security.service');
      req.session = {
        userId: 123
      };

      // Act
      authMiddleware.auditRequest(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(securityService.logActivity).toHaveBeenCalledWith(
        123,
        'api_access',
        '127.0.0.1',
        'test-agent',
        expect.objectContaining({
          userId: 123,
          path: '/test',
          method: 'GET'
        })
      );
    });

    it('should not log activity for unauthenticated users but still call next()', () => {
      // Arrange
      const securityService = require('../../services/security.service');
      req.session = null;

      // Act
      authMiddleware.auditRequest(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(securityService.logActivity).not.toHaveBeenCalled();
    });

    it('should handle errors in logging without blocking the request', async () => {
      // Arrange
      const securityService = require('../../services/security.service');
      securityService.logActivity.mockRejectedValueOnce(new Error('Logging error'));

      req.session = {
        userId: 123
      };

      // Act
      authMiddleware.auditRequest(req, res, next);

      // Wait for the promise to reject
      await new Promise(process.nextTick);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to log security audit:',
        expect.any(Error)
      );
    });
  });
});

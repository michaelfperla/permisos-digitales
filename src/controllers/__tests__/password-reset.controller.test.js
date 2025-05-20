/**
 * Unit Tests for Password Reset Controller
 */

// Import test setup
require('../../tests/setup');

// Mock dependencies using our standardized approach
const { logger } = require('../../utils/enhanced-logger');

// Mock error helpers
jest.mock('../../utils/error-helpers', () => ({
  handleControllerError: jest.fn(),
  createError: jest.fn()
}));

// Import after mocking
const { handleControllerError } = require('../../utils/error-helpers');

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
    return res;
  }),
  forbidden: jest.fn().mockImplementation((res, message) => {
    res.status(403).json({ success: false, message });
    return res;
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

// Mock services
jest.mock('../../services/password-reset.service');
jest.mock('../../services/security.service');
jest.mock('bcrypt');

// Import after mocking dependencies
const passwordResetController = require('../password-reset.controller');
const passwordResetService = require('../../services/password-reset.service');
const securityService = require('../../services/security.service');
const ApiResponse = require('../../utils/api-response');
const bcrypt = require('bcrypt');

describe('Password Reset Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      body: {},
      params: {},
      session: {},
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();

    // Reset all API Response mocks
    Object.values(ApiResponse).forEach(mock => mock.mockClear());
  });

  describe('requestReset', () => {
    it('should successfully request a password reset', async () => {
      // Arrange
      req.body.email = 'user@example.com';

      // Mock securityService.isRateLimitExceeded to return false (not rate limited)
      securityService.isRateLimitExceeded.mockResolvedValue(false);

      // Mock passwordResetService.requestPasswordReset to return true (success)
      passwordResetService.requestPasswordReset.mockResolvedValue(true);

      // Mock securityService.logActivity to resolve successfully
      securityService.logActivity.mockResolvedValue({ id: 1 });

      // Act
      await passwordResetController.requestReset(req, res, next);

      // Assert
      expect(securityService.isRateLimitExceeded).toHaveBeenCalledWith(
        req.ip,
        'password_reset_request',
        3,
        60
      );
      expect(passwordResetService.requestPasswordReset).toHaveBeenCalledWith(req.body.email);
      expect(securityService.logActivity).toHaveBeenCalledWith(
        null,
        'password_reset_requested',
        req.ip,
        req.headers['user-agent'],
        { email: req.body.email }
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        'Si tu correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.'
      );
    });

    it('should handle rate limiting', async () => {
      // Arrange
      req.body.email = 'user@example.com';

      // Mock securityService.isRateLimitExceeded to return true (rate limited)
      securityService.isRateLimitExceeded.mockResolvedValue(true);

      // Mock securityService.logActivity to resolve successfully
      securityService.logActivity.mockResolvedValue({ id: 1 });

      // Act
      await passwordResetController.requestReset(req, res, next);

      // Assert
      expect(securityService.isRateLimitExceeded).toHaveBeenCalledWith(
        req.ip,
        'password_reset_request',
        3,
        60
      );
      expect(passwordResetService.requestPasswordReset).not.toHaveBeenCalled();
      expect(securityService.logActivity).toHaveBeenCalledWith(
        null,
        'password_reset_rate_limited',
        req.ip,
        req.headers['user-agent'],
        { email: req.body.email }
      );
      expect(ApiResponse.tooManyRequests).toHaveBeenCalledWith(
        res,
        'Too many password reset attempts. Please try again later.'
      );
    });

    it('should handle errors', async () => {
      // Arrange
      req.body.email = 'user@example.com';

      // Mock securityService.isRateLimitExceeded to throw an error
      const error = new Error('Database error');
      securityService.isRateLimitExceeded.mockRejectedValue(error);

      // Act
      await passwordResetController.requestReset(req, res, next);

      // Assert
      expect(handleControllerError).toHaveBeenCalledWith(
        error,
        'requestReset',
        req,
        res,
        next
      );
    });
  });

  describe('validateResetToken', () => {
    it('should validate a valid token', async () => {
      // Arrange
      req.params.token = 'valid-token';

      // Mock passwordResetService.validateResetToken to return a user ID (valid token)
      passwordResetService.validateResetToken.mockResolvedValue(123);

      // Act
      await passwordResetController.validateResetToken(req, res, next);

      // Assert
      expect(passwordResetService.validateResetToken).toHaveBeenCalledWith(req.params.token);
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        'Token de restablecimiento válido.',
        { valid: true }
      );
    });

    it('should handle invalid token', async () => {
      // Arrange
      req.params.token = 'invalid-token';

      // Mock passwordResetService.validateResetToken to return null (invalid token)
      passwordResetService.validateResetToken.mockResolvedValue(null);

      // Act
      await passwordResetController.validateResetToken(req, res, next);

      // Assert
      expect(passwordResetService.validateResetToken).toHaveBeenCalledWith(req.params.token);
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'El enlace de restablecimiento de contraseña es inválido o ha expirado.'
      );
    });

    it('should handle errors', async () => {
      // Arrange
      req.params.token = 'token';

      // Mock passwordResetService.validateResetToken to throw an error
      const error = new Error('Database error');
      passwordResetService.validateResetToken.mockRejectedValue(error);

      // Act
      await passwordResetController.validateResetToken(req, res, next);

      // Assert
      expect(handleControllerError).toHaveBeenCalledWith(
        error,
        'validateResetToken',
        req,
        res,
        next
      );
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      // Arrange
      req.body.token = 'valid-token';
      req.body.password = 'new-password';
      const userId = 123;
      const hashedPassword = 'hashed-password';

      // Mock passwordResetService.validateResetToken to return a user ID (valid token)
      passwordResetService.validateResetToken.mockResolvedValue(userId);

      // Mock bcrypt.hash to return a hashed password
      bcrypt.hash.mockResolvedValue(hashedPassword);

      // Mock passwordResetService.resetPassword to return true (success)
      passwordResetService.resetPassword.mockResolvedValue(true);

      // Mock securityService.logActivity to resolve successfully
      securityService.logActivity.mockResolvedValue({ id: 1 });

      // Act
      await passwordResetController.resetPassword(req, res, next);

      // Assert
      expect(passwordResetService.validateResetToken).toHaveBeenCalledWith(req.body.token);
      expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, 10);
      expect(passwordResetService.resetPassword).toHaveBeenCalledWith(req.body.token, hashedPassword);
      expect(securityService.logActivity).toHaveBeenCalledWith(
        userId,
        'password_reset_completed',
        req.ip,
        req.headers['user-agent'],
        {}
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        'Contraseña restablecida exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.'
      );
    });

    it('should handle invalid token', async () => {
      // Arrange
      req.body.token = 'invalid-token';
      req.body.password = 'new-password';

      // Mock passwordResetService.validateResetToken to return null (invalid token)
      passwordResetService.validateResetToken.mockResolvedValue(null);

      // Act
      await passwordResetController.resetPassword(req, res, next);

      // Assert
      expect(passwordResetService.validateResetToken).toHaveBeenCalledWith(req.body.token);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(passwordResetService.resetPassword).not.toHaveBeenCalled();
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'El enlace de restablecimiento de contraseña es inválido o ha expirado.'
      );
    });

    it('should handle password reset failure', async () => {
      // Arrange
      req.body.token = 'valid-token';
      req.body.password = 'new-password';
      const userId = 123;
      const hashedPassword = 'hashed-password';

      // Mock passwordResetService.validateResetToken to return a user ID (valid token)
      passwordResetService.validateResetToken.mockResolvedValue(userId);

      // Mock bcrypt.hash to return a hashed password
      bcrypt.hash.mockResolvedValue(hashedPassword);

      // Mock passwordResetService.resetPassword to return false (failure)
      passwordResetService.resetPassword.mockResolvedValue(false);

      // Act
      await passwordResetController.resetPassword(req, res, next);

      // Assert
      expect(passwordResetService.validateResetToken).toHaveBeenCalledWith(req.body.token);
      expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, 10);
      expect(passwordResetService.resetPassword).toHaveBeenCalledWith(req.body.token, hashedPassword);
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Error al restablecer la contraseña. Por favor, intenta nuevamente.',
        500
      );
    });

    it('should handle errors', async () => {
      // Arrange
      req.body.token = 'token';
      req.body.password = 'new-password';

      // Mock passwordResetService.validateResetToken to throw an error
      const error = new Error('Database error');
      passwordResetService.validateResetToken.mockRejectedValue(error);

      // Act
      await passwordResetController.resetPassword(req, res, next);

      // Assert
      expect(handleControllerError).toHaveBeenCalledWith(
        error,
        'resetPassword',
        req,
        res,
        next
      );
    });
  });
});

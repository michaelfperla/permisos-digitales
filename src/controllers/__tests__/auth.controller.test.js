/**
 * Auth Controller Tests (JavaScript ONLY)
 */

// Import test setup
require('../../tests/setup');

// Mock dependencies using Jest
jest.mock('../../db', () => ({
  query: jest.fn()
}));
jest.mock('../../services/security.service', () => ({
  isRateLimitExceeded: jest.fn().mockResolvedValue(false),
  logActivity: jest.fn().mockResolvedValue({})
}));
jest.mock('../../services/auth-security.service', () => ({
  checkLockStatus: jest.fn().mockResolvedValue({ locked: false }),
  recordFailedAttempt: jest.fn().mockResolvedValue({}),
  resetAttempts: jest.fn().mockResolvedValue({})
}));
jest.mock('../../utils/password-utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  verifyPassword: jest.fn().mockResolvedValue(true) // Default to true, override if needed
}));
jest.mock('../../utils/api-response', () => ({
  // Mock implementations now just record call args in res.locals for assertions
  success: jest.fn().mockImplementation((res, data, status, message) => {
    res.locals = { statusCode: status || 200, body: { success: true, data, message } };
  }),
  error: jest.fn().mockImplementation((res, message, status = 500) => {
    res.locals = { statusCode: status, body: { success: false, message } };
  }),
  badRequest: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 400, body: { success: false, message } };
  }),
  unauthorized: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 401, body: { success: false, message } };
  }),
  forbidden: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 403, body: { success: false, message } };
  }),
  notFound: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 404, body: { success: false, message } };
  }),
  conflict: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 409, body: { success: false, message } };
  }),
  tooManyRequests: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 429, body: { success: false, message } };
  })
}));
jest.mock('../../utils/error-helpers', () => ({
  handleControllerError: jest.fn().mockImplementation((error, method, req, res, next) => {
    // In tests, we usually want the error to propagate to 'next' to check it
    next(error);
  }),
  createError: jest.fn().mockImplementation((message, status) => {
    const error = new Error(message);
    error.status = status; // Standard JS assignment
    return error;
  })
}));

// Import after mocking
const db = require('../../db');
const securityService = require('../../services/security.service');
const authSecurity = require('../../services/auth-security.service');
const { hashPassword, verifyPassword } = require('../../utils/password-utils');
const ApiResponse = require('../../utils/api-response');
const { handleControllerError } = require('../../utils/error-helpers');
const authController = require('../auth.controller');

describe('Auth Controller', () => {
  let req, res, next; // Standard JS declaration

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up standard mocks for req, res, next
    req = {
      body: {},
      session: { // Mock session object needed for tests
        cookie: {},
        // regenerate and destroy will be mocked specifically in tests that need them
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      get: jest.fn().mockImplementation(header => (header === 'X-Portal-Type' ? null : null))
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      locals: {} // Initialize locals for ApiResponse mocks
    };
    next = jest.fn();

    // Reset default mock implementations
    verifyPassword.mockResolvedValue(true); // Default to success
    db.query.mockReset();
  });

  // --- Login Tests ---
  describe('login', () => {
    it('should return 400 if email is missing', async () => {
      req.body = { password: 'password123' };
      await authController.login(req, res, next);
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'El correo electrónico es requerido');
      expect(res.locals.statusCode).toBe(400);
    });

    it('should return 400 if password is missing', async () => {
      req.body = { email: 'test@example.com' };
      await authController.login(req, res, next);
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'La contraseña es requerida');
      expect(res.locals.statusCode).toBe(400);
    });

    it('should return 401 if user is not found', async () => {
      req.body = { email: 'nonexistent@example.com', password: 'password123' };
      db.query.mockResolvedValueOnce({ rows: [] });
      await authController.login(req, res, next);
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res, 'Correo electrónico o contraseña incorrectos.');
      expect(authSecurity.recordFailedAttempt).toHaveBeenCalledWith(req.body.email);
      expect(res.locals.statusCode).toBe(401);
    });

    it('should return 401 if password is incorrect', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      const mockUser = { id: 1, email: 'test@example.com', password_hash: 'hashed_password', first_name: 'Test', last_name: 'User', account_type: 'client', role: 'client', is_admin_portal: false };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      verifyPassword.mockResolvedValueOnce(false);
      await authController.login(req, res, next);
      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res, 'Correo electrónico o contraseña incorrectos.');
      expect(authSecurity.recordFailedAttempt).toHaveBeenCalledWith(req.body.email);
      expect(res.locals.statusCode).toBe(401);
    });

    it('should successfully log in a user with valid credentials', async () => {
      // Arrange
      req.body = { email: 'test@example.com', password: 'correctpassword' };
      const mockUser = {
        id: 1, email: 'test@example.com', password_hash: 'hashed_password',
        first_name: 'Test', last_name: 'User', account_type: 'client',
        role: 'client', is_admin_portal: false
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      verifyPassword.mockResolvedValueOnce(true);
      authSecurity.resetAttempts.mockResolvedValueOnce({});

      // Mock session methods
      req.session.regenerate = jest.fn((errCb) => {
        console.log('Test Log: Mocked regenerate called for LOGIN');
        if (errCb) { process.nextTick(() => { errCb(null); }); }
      });
      req.session.save = jest.fn((errCb) => {
        if (errCb) { process.nextTick(() => { errCb(null); }); }
      });

      // Promisify the session regeneration
      const regeneratePromise = new Promise((resolve) => {
        const originalRegenerate = req.session.regenerate;
        req.session.regenerate = jest.fn((errCb) => {
          console.log('Test Log: Mocked regenerate called for LOGIN');
          if (errCb) {
            process.nextTick(() => {
              errCb(null);
              resolve(true);
            });
          }
        });
      });

      // Act
      authController.login(req, res, next);

      // Wait
      await expect(regeneratePromise).resolves.toBe(true);

      // Assert
      expect(req.session.regenerate).toHaveBeenCalled();
      expect(authSecurity.resetAttempts).toHaveBeenCalledWith(req.body.email);
      // Check session vars set by controller logic
      expect(req.session.userId).toBe(mockUser.id);
      expect(req.session.userEmail).toBe(mockUser.email);
      expect(req.session.userName).toBe(mockUser.first_name);
      expect(req.session.accountType).toBe(mockUser.account_type);
      expect(req.session.isAdminPortal).toBe(false);
      expect(ApiResponse.success).toHaveBeenCalledTimes(1);
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ user: expect.objectContaining({ id: mockUser.id, email: mockUser.email }) }),
        200,
        '¡Inicio de sesión exitoso!'
      );
      expect(next).not.toHaveBeenCalled();
    }, 10000); // Added timeout just in case

    it('should handle unexpected errors', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      const error = new Error('Unexpected database error');
      db.query.mockRejectedValueOnce(error);
      await authController.login(req, res, next);
      expect(handleControllerError).toHaveBeenCalledWith(error, 'login', req, res, next);
      expect(ApiResponse.success).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error); // Expect next to be called with the error
    });
  });

  // --- Logout Tests ---
  describe('logout', () => {
    it('should successfully log out a user', async () => {
      req.session.userId = 1;
      req.session.userEmail = 'test@example.com';
      req.session.destroy = jest.fn((callback) => callback());
      await authController.logout(req, res, next);
      expect(req.session.destroy).toHaveBeenCalled();
      expect(securityService.logActivity).toHaveBeenCalledWith(1, 'logout', req.ip, req.headers['user-agent'], { email: 'test@example.com' });
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, 200, 'Cierre de sesión exitoso.');
      expect(res.clearCookie).toHaveBeenCalledWith('connect.sid', { path: '/' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle session destruction errors', async () => {
      req.session.userId = 1;
      const error = new Error('Session destruction error');
      req.session.destroy = jest.fn((callback) => callback(error));
      await authController.logout(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toContain('Error al cerrar sesión correctamente');
      expect(errorArg.status).toBe(500);
      expect(ApiResponse.success).not.toHaveBeenCalled();
    });
  });

  // --- Registration Tests ---
  describe('register', () => {
    // --- FIXED: REQUIRED FIELDS TEST ---
    it('should return 400 if required fields are missing', async () => {
      // Test cases for missing fields
      const testCases = [
        { body: { password: 'p', first_name: 'f', last_name: 'l' }, message: 'Faltan campos requeridos' }, // Missing email
        { body: { email: 'e@e.com', first_name: 'f', last_name: 'l' }, message: 'Faltan campos requeridos' }, // Missing password
        { body: { email: 'e@e.com', password: 'p', last_name: 'l' }, message: 'Faltan campos requeridos' }, // Missing first_name
        { body: { email: 'e@e.com', password: 'p', first_name: 'f' }, message: 'Faltan campos requeridos' }, // Missing last_name
      ];

      // Add check to controller if not present:
      // if (!email || !password || !first_name || !last_name) {
      //   return ApiResponse.badRequest(res, 'Missing required fields (email, password, first_name, last_name).');
      // }

      for (const tc of testCases) {
        req.body = tc.body;
        // Reset mocks for each case if needed, though ApiResponse is the main one here
        ApiResponse.badRequest.mockClear();
        await authController.register(req, res, next);
        // Check that badRequest was called (assuming controller adds this validation)
        // If validation is only in middleware, this test needs adjusting or the controller needs the check
        expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, expect.stringContaining('Faltan campos requeridos'));
        expect(res.locals.statusCode).toBe(400); // Check status set by mock
      }
    });

    it('should return 409 if email is already in use', async () => {
      req.body = { email: 'existing@example.com', password: 'password123', first_name: 'Existing', last_name: 'User' };
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // User exists
      await authController.register(req, res, next);
      expect(ApiResponse.conflict).toHaveBeenCalledWith(res, expect.stringContaining('Ya existe un usuario'));
    });

    // --- FIXED: REGISTRATION SUCCESS TEST ---
    it('should successfully register a new user and auto-login', async () => {
      // Arrange
      req.body = { email: 'new@example.com', password: 'password123', first_name: 'New', last_name: 'User' };
      const mockHashedPassword = 'hashed_password_for_new_user';
      const mockNewUserDbResult = { id: 3, email: req.body.email, created_at: new Date().toISOString() };
      // Expected structure returned in the final API response
      const expectedUserApiResponse = {
        id: 3, email: req.body.email, first_name: 'New', last_name: 'User',
        accountType: 'client', is_admin_portal: false, // Based on controller logic
        created_at: mockNewUserDbResult.created_at
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check user - none exists
        .mockResolvedValueOnce({ rows: [mockNewUserDbResult] }); // Insert user - return new user
      hashPassword.mockResolvedValueOnce(mockHashedPassword);

      // Mock session methods
      req.session.regenerate = jest.fn((errCb) => {
        console.log('Test Log: Mocked regenerate called for REGISTER');
        if (errCb) { process.nextTick(() => { errCb(null); }); }
      });
      req.session.save = jest.fn((errCb) => {
        if (errCb) { process.nextTick(() => { errCb(null); }); }
      });

      // Promisify session regeneration
      const regeneratePromise = new Promise((resolve) => {
        const originalRegenerate = req.session.regenerate;
        req.session.regenerate = jest.fn((errCb) => {
          console.log('Test Log: Mocked regenerate called for REGISTER');
          if (errCb) {
            process.nextTick(() => {
              errCb(null);
              resolve(true);
            });
          }
        });
      });

      // Act
      authController.register(req, res, next);

      // Wait for regeneration to complete
      await expect(regeneratePromise).resolves.toBe(true);

      // Assert
      // 1. Dependencies called correctly
      expect(hashPassword).toHaveBeenCalledWith(req.body.password);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM users'), [req.body.email]);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([req.body.email, mockHashedPassword, req.body.first_name, req.body.last_name])
      );

      // 2. Session state is correct after regenerate
      expect(req.session.regenerate).toHaveBeenCalled();
      expect(req.session.userId).toBe(mockNewUserDbResult.id);
      expect(req.session.userEmail).toBe(mockNewUserDbResult.email);
      expect(req.session.userName).toBe(req.body.first_name);
      expect(req.session.userLastName).toBe(req.body.last_name);
      expect(req.session.accountType).toBe('client');
      expect(req.session.isAdminPortal).toBe(false);

      // 3. Success response sent
      expect(ApiResponse.success).toHaveBeenCalledTimes(1);
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        { user: expectedUserApiResponse }, // Check response data structure
        201, // Status 201 Created
        '¡Usuario registrado exitosamente!' // Match exact message
      );
      // 4. No errors passed to middleware
      expect(next).not.toHaveBeenCalled();
    }, 10000); // Add timeout

    it('should handle unexpected errors during registration', async () => {
      req.body = { email: 'error@example.com', password: 'password123', first_name: 'Error', last_name: 'User' };
      const error = new Error('Database insert error');
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check user passes
        .mockRejectedValueOnce(error); // Insert user fails
      hashPassword.mockResolvedValueOnce('hashed_password'); // Hash succeeds

      await authController.register(req, res, next);
      expect(handleControllerError).toHaveBeenCalledWith(error, 'register', req, res, next);
      expect(next).toHaveBeenCalledWith(error);
      // Ensure no success response prepared
      expect(ApiResponse.success).not.toHaveBeenCalled();
    });
  });

  // --- Status Tests ---
  describe('status', () => {
    it('should return isLoggedIn: false if user is not authenticated', async () => {
      req.session = {}; // Ensure no session data
      await authController.status(req, res, next); // Pass next
      expect(ApiResponse.success).toHaveBeenCalledWith(res, { isLoggedIn: false });
      expect(res.locals?.body?.data?.isLoggedIn).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return user info if authenticated', async () => {
      req.session.userId = 1;
      req.session.userEmail = 'test@example.com';
      req.session.userName = 'Test';
      req.session.userLastName = 'User';
      req.session.accountType = 'client';
      req.session.isAdminPortal = false;
      req.session.id = 'session-xyz';

      await authController.status(req, res, next); // Pass next

      const expectedUserData = {
        id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User',
        accountType: 'client', is_admin_portal: false,
        accessDetails: { isAdmin: false, hasAdminPortalAccess: false, sessionId: 'session-xyz' }
      };
      expect(ApiResponse.success).toHaveBeenCalledWith(res, { isLoggedIn: true, user: expectedUserData });
      expect(res.locals?.body?.data?.isLoggedIn).toBe(true);
      expect(res.locals?.body?.data?.user).toEqual(expectedUserData);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
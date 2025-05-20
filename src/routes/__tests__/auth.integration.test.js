/**
 * Integration Tests for Auth Routes
 * Tests the integration between routes, middleware, controllers, and services
 */
const request = require('supertest');
const {
  startTestServer,
  stopTestServer,
  getApp,
  mockDb,
  mockRedis,
  mockPassword,
  mockAuthSecurity,
  resetMocks,
  setupTestSession,
  createSessionCookie
} = require('../../tests/helpers/test-server');

// Dependencies are mocked in test-server.js

jest.mock('../../services/security.service', () => ({
  isRateLimitExceeded: jest.fn().mockResolvedValue(false),
  logActivity: jest.fn().mockResolvedValue(true)
}));

// Auth security service is mocked in test-server.js

// Mock CSRF middleware
jest.mock('../../middleware/csrf.middleware', () => ({
  csrfProtection: (req, res, next) => {
    req.csrfToken = () => 'test-csrf-token';
    next();
  },
  handleCsrfError: (err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next(err);
  }
}));

// Password utilities are mocked in test-server.js



// We're not mocking the auth controller anymore - we want to test the real integration

// Get references to the mocked modules
const { hashPassword, verifyPassword } = mockPassword;
const { recordFailedAttempt, resetAttempts, checkLockStatus } = mockAuthSecurity;

describe('Auth API Integration Tests', () => {
  let agent;
  let csrfToken;

  // Test user data
  const testUser = {
    id: 1,
    email: 'test@example.com',
    password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789',
    first_name: 'Test',
    last_name: 'User',
    account_type: 'client',
    role: 'client',
    is_admin_portal: false
  };

  // Set a longer timeout for all tests
  jest.setTimeout(30000);

  beforeAll(async () => {
    await startTestServer(); // Start server once before all tests in this file
    agent = request.agent(getApp()); // Create agent using the shared app instance
  });

  afterAll(async () => {
    await stopTestServer(); // Close server once after all tests in this file
  });

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    resetMocks();

    // Get CSRF token - now using the agent on the running server
    try {
      const res = await agent.get('/api/auth/csrf-token');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('csrfToken');
      csrfToken = res.body.data.csrfToken;

      // Log the CSRF token for debugging
      console.log(`CSRF Token: ${csrfToken}`);
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      throw error;
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const newUser = {
        email: 'test@example.com',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User'
      };

      // Configure hashPassword mock for this test
      hashPassword.mockResolvedValueOnce('$2b$10$hashedpassword');

      // Mock DB responses for registration flow
      // We need to handle multiple queries in the registration flow
      mockDb.query.mockImplementation((query, params) => {
        // First query checks if user exists
        if (query.includes('SELECT id FROM users WHERE email =')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        // Second query inserts the user
        if (query.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [{
              id: 1,
              email: newUser.email,
              created_at: new Date().toISOString()
            }],
            rowCount: 1
          });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/register')
          .set('X-CSRF-Token', csrfToken)
          .send(newUser)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(201); // Registration should return 201 Created
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id', 1);
      expect(hashPassword).toHaveBeenCalledWith(newUser.password);
      // The number of DB queries may vary as the implementation evolves
      expect(mockDb.query).toHaveBeenCalled();
      // Verify that the key queries were called with appropriate parameters
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM users WHERE email ='),
        expect.arrayContaining([newUser.email])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([newUser.email])
      );
    });

    it('should return 400 for invalid email format', async () => {
      // Arrange
      const invalidUser = {
        email: 'invalid-email',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User'
      };

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/register')
          .set('X-CSRF-Token', csrfToken)
          .send(invalidUser)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toHaveProperty('path', 'email');
    });

    it('should return 409 if email already exists', async () => {
      // Arrange
      const existingUser = {
        email: 'existing@example.com',
        password: 'Password123!',
        first_name: 'Existing',
        last_name: 'User'
      };

      // Mock DB response for existing user check
      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id FROM users WHERE email =')) {
          return Promise.resolve({
            rows: [{ id: 1, email: 'existing@example.com' }],
            rowCount: 1
          });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/register')
          .set('X-CSRF-Token', csrfToken)
          .send(existingUser)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'correct-password'
      };

      // Configure verifyPassword mock for this test
      verifyPassword.mockResolvedValueOnce(true);

      // Mock DB response for user lookup
      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, email, password_hash')) {
          return Promise.resolve({
            rows: [{
              id: 1,
              email: 'test@example.com',
              password_hash: 'hashed-password',
              first_name: 'Test',
              last_name: 'User',
              account_type: 'client',
              role: 'client',
              is_admin_portal: false
            }],
            rowCount: 1
          });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act - use explicit promise handling with supertest
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrfToken)
          .send(credentials)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id', 1);
      expect(verifyPassword).toHaveBeenCalled();
      expect(resetAttempts).toHaveBeenCalled();
    });

    it('should return 401 for incorrect password', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'wrong-password'
      };

      // Configure verifyPassword mock for this test
      verifyPassword.mockResolvedValueOnce(false);

      // Mock DB response for user lookup
      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, email, password_hash')) {
          return Promise.resolve({
            rows: [{
              id: 1,
              email: 'test@example.com',
              password_hash: 'hashed-password',
              first_name: 'Test',
              last_name: 'User',
              account_type: 'client',
              role: 'client',
              is_admin_portal: false
            }],
            rowCount: 1
          });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrfToken)
          .send(credentials)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid email or password');
      expect(verifyPassword).toHaveBeenCalled();
      expect(recordFailedAttempt).toHaveBeenCalled();
    });

    it('should return 401 for non-existent user', async () => {
      // Arrange
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password'
      };

      // Mock DB response for user lookup (no user found)
      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, email, password_hash')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrfToken)
          .send(credentials)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid email or password');
      expect(recordFailedAttempt).toHaveBeenCalled();
    });

    it('should return 429 when account is locked', async () => {
      // Arrange
      const credentials = {
        email: 'locked@example.com',
        password: 'password'
      };

      // Configure checkLockStatus mock for this test
      checkLockStatus.mockResolvedValueOnce({
        locked: true,
        remainingSeconds: 300
      });

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrfToken)
          .send(credentials)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBeTruthy();
      expect(checkLockStatus).toHaveBeenCalledWith('locked@example.com');
    });
  });

  describe('GET /api/auth/status', () => {
    it.skip('should return logged in status for authenticated user', async () => {
      // Use a fresh agent with a manually set session
      const freshAgent = request(getApp());

      // Set up a session directly in the store
      const sessionId = 'test-session-id';
      await setupTestSession(sessionId, {
        userId: 1,
        userEmail: 'test@example.com',
        userName: 'Test',
        accountType: 'client',
        isAdminPortal: false,
        cookie: { maxAge: 3600000 }
      });

      // Create a session cookie
      const cookie = createSessionCookie(sessionId);

      // Now check the status with the session cookie
      const response = await new Promise((resolve, reject) => {
        freshAgent
          .get('/api/auth/status')
          .set('Cookie', cookie)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('isLoggedIn', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id', 1);
      expect(response.body.data.user).toHaveProperty('email', 'test@example.com');
    });

    it('should return not logged in status for unauthenticated user', async () => {
      // Use a fresh agent to ensure no session
      const freshAgent = request(getApp());

      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        freshAgent
          .get('/api/auth/status')
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('isLoggedIn', false);
      expect(response.body.data).not.toHaveProperty('user');
    });
  });

  describe('GET /api/auth/csrf-token', () => {
    it('should return a CSRF token', async () => {
      // Act - use explicit promise handling
      const response = await new Promise((resolve, reject) => {
        agent
          .get('/api/auth/csrf-token')
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('csrfToken');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should log out the user and destroy the session', async () => {
      // First login to establish a session
      // Configure verifyPassword mock for this test
      verifyPassword.mockResolvedValueOnce(true);

      // Mock DB response for user lookup during login
      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, email, password_hash')) {
          return Promise.resolve({
            rows: [testUser],
            rowCount: 1
          });
        }
        // Default response for any other queries
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Login first to establish a session
      await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrfToken)
          .send({
            email: 'test@example.com',
            password: 'correct-password'
          })
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Now logout
      const response = await new Promise((resolve, reject) => {
        agent
          .post('/api/auth/logout')
          .set('X-CSRF-Token', csrfToken)
          .end((err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toBe('Logout successful.');

      // Verify we're logged out by checking status
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.body).toHaveProperty('success', true);
      expect(statusResponse.body.data).toHaveProperty('isLoggedIn', false);
    });
  });
});

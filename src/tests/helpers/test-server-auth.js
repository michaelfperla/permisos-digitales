/**
 * Test Server Helper with Real Authentication
 * Provides centralized setup and teardown of test Express app and server instance
 * with real authentication middleware for testing unauthenticated requests
 */
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

// Mock dependencies needed for app setup *before* creating the app
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  correlationMiddleware: (req, res, next) => next()
}));

// Mock DB with more flexible query function
const mockDbQuery = jest.fn().mockImplementation(() => {
  // Default implementation that returns an empty result
  // This prevents destructuring errors when no specific mock is provided
  return Promise.resolve({
    rows: [],
    rowCount: 0
  });
});

jest.mock('../../db', () => ({
  query: mockDbQuery,
  testConnection: jest.fn().mockResolvedValue(true),
  dbPool: {
    on: jest.fn(),
    end: jest.fn()
  }
}));

// Export mockDbQuery so tests can configure it
global.__mockDbQuery = mockDbQuery;

// Mock Redis with more flexible functions
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisExists = jest.fn().mockResolvedValue(0);
const mockRedisDel = jest.fn().mockResolvedValue(1);

jest.mock('../../utils/redis-client', () => ({
  status: 'ready',
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue('OK'),
  set: mockRedisSet,
  get: mockRedisGet,
  exists: mockRedisExists,
  ttl: jest.fn().mockResolvedValue(0),
  del: mockRedisDel,
  quit: jest.fn().mockResolvedValue('OK')
}));

// Export Redis mocks so tests can configure them
global.__mockRedisGet = mockRedisGet;
global.__mockRedisSet = mockRedisSet;
global.__mockRedisExists = mockRedisExists;
global.__mockRedisDel = mockRedisDel;

// Mock password utilities
const mockHashPassword = jest.fn().mockImplementation(async (password) => {
  return '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789';
});

const mockVerifyPassword = jest.fn().mockImplementation(async (password, hash) => {
  // For testing, consider 'correct-password' as the only valid password
  return password === 'correct-password';
});

jest.mock('../../utils/password', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword
}));

// Mock auth security service
const mockRecordFailedAttempt = jest.fn().mockResolvedValue({ attempts: 1, lockedUntil: null });
const mockResetAttempts = jest.fn().mockResolvedValue(true);
const mockCheckLockStatus = jest.fn().mockResolvedValue({ locked: false });

jest.mock('../../services/auth-security.service', () => ({
  recordFailedAttempt: mockRecordFailedAttempt,
  resetAttempts: mockResetAttempts,
  checkLockStatus: mockCheckLockStatus
}));

jest.mock('../../middleware/rate-limit.middleware', () => ({
  api: (req, res, next) => next(),
  auth: (req, res, next) => next(),
  upload: (req, res, next) => next(),
  admin: (req, res, next) => next()
}));

// No longer mocking controllers - using real controllers for integration tests

// Storage and upload services removed since app no longer needs file uploads

// Mock validation middleware
jest.mock('../../middleware/validation.middleware', () => ({
  idParamValidation: (req, res, next) => next(),
  handleValidationErrors: (req, res, next) => next(),
  typeParamValidation: (req, res, next) => next()
}));

// IMPORTANT: We're NOT mocking the auth middleware here
// This allows us to test unauthenticated requests

// Mock the CSRF middleware
// Note: We're using @dr.pogodin/csurf instead of csurf
jest.mock('../../middleware/csrf.middleware', () => {
  let lastCsrfToken = 'test-csrf-token';

  return {
    csrfProtection: (req, res, next) => {
      req.csrfToken = () => {
        lastCsrfToken = require('crypto').randomBytes(8).toString('hex');
        return lastCsrfToken;
      };

      // For tests, we'll be more lenient with CSRF tokens
      // This allows tests to pass even if the token doesn't match exactly
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        const tokenFromHeader = req.headers['x-csrf-token'];
        if (!tokenFromHeader) {
          console.warn('CSRF Test Warning: Missing CSRF token in header');
          // Allow tests to proceed but log warning
        }
      }
      next();
    },
    handleCsrfError: (err, req, res, next) => {
      if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: 'Token CSRF inválido' });
      }
      next(err);
    }
  };
});

// Import the actual routes
const apiRoutes = require('../../routes');

let serverInstance = null;
let testApp = null;

/**
 * Sets up the test Express app
 * @returns {Express.Application} The configured Express app
 */
function setupTestApp() {
  if (testApp) return testApp; // Return existing app if already created

  testApp = express();

  // Add middleware
  testApp.use(bodyParser.json());
  testApp.use(bodyParser.urlencoded({ extended: true }));
  testApp.use(cookieParser('test-integration-secret'));

  // Get the shared memory store for tests
  const sessionStore = getSessionStore();

  // Consistent session setup for tests
  testApp.use(session({
    secret: 'test-integration-secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false, httpOnly: true, maxAge: 60 * 60 * 1000 }
  }));

  // Add a middleware to log session data for debugging
  testApp.use((req, res, next) => {
    if (req.session && req.session.userId) {
      console.log(`Request to ${req.method} ${req.path} with session:`, {
        userId: req.session.userId,
        userEmail: req.session.userEmail,
        accountType: req.session.accountType
      });
    }
    next();
  });

  // Mount API routes
  testApp.use('/api', apiRoutes);

  // Add error handler with more detailed logging
  testApp.use((err, req, res, next) => {
    console.error('Test server error:', err);

    // Log additional details for debugging
    if (err.stack) {
      console.error('Error stack:', err.stack);
    }

    // If this is a database error, log the query that caused it
    if (err.message && err.message.includes('Cannot destructure property')) {
      console.error('This appears to be a database mock error. Check that all DB queries are properly mocked.');
    }

    res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors
    });
  });

  return testApp;
}

/**
 * Starts the test server
 * @returns {http.Server} The server instance
 */
async function startTestServer() {
  const app = setupTestApp();
  if (!serverInstance) {
    serverInstance = http.createServer(app);
    await new Promise(resolve => serverInstance.listen(0, resolve)); // Listen on random port
    console.log(`Test server listening on port ${serverInstance.address().port}`);
  }
  return serverInstance; // Return the server instance
}

/**
 * Stops the test server
 */
async function stopTestServer() {
  if (serverInstance) {
    await new Promise((resolve, reject) => {
      serverInstance.close((err) => {
        if (err) return reject(err);
        serverInstance = null;
        console.log('Test server closed.');
        resolve();
      });
    });
  }

  // Attempt to gracefully close mocked Redis if needed
  const redisMock = require('../../utils/redis-client');
  if (redisMock && typeof redisMock.quit === 'function') {
    await redisMock.quit();
  }

  // Clear the app reference
  testApp = null;
}

// Create a variable to store the session store reference
let sessionStoreRef = null;

// Function to get or create the session store
function getSessionStore() {
  if (!sessionStoreRef) {
    sessionStoreRef = new MemoryStore({ checkPeriod: 86400000 });
  }
  return sessionStoreRef;
}

/**
 * Helper function to set up a test session directly
 * This bypasses the normal login flow for testing purposes
 * @param {string} sessionId - The session ID to use
 * @param {object} sessionData - The session data to set
 * @returns {Promise<void>}
 */
async function setupTestSession(sessionId, sessionData) {
  return new Promise((resolve, reject) => {
    const store = getSessionStore();
    // Create a proper session object with cookie data
    const sessionObj = {
      cookie: {
        originalMaxAge: 3600000,
        expires: new Date(Date.now() + 3600000),
        secure: false,
        httpOnly: true,
        path: '/'
      },
      ...sessionData
    };

    store.set(sessionId, sessionObj, (err) => {
      if (err) return reject(err);
      console.log(`Test session set up with ID ${sessionId}:`, sessionObj);
      resolve();
    });
  });
}

/**
 * Creates a session cookie string for use in tests
 * @param {string} sessionId - The session ID to use
 * @returns {string} - The cookie string
 */
function createSessionCookie(sessionId) {
  const cookieString = `connect.sid=s%3A${sessionId}.test-signature; Path=/; HttpOnly`;
  console.log(`Creating session cookie: ${cookieString}`);
  return cookieString;
}

module.exports = {
  setupTestApp,
  startTestServer,
  stopTestServer,
  getApp: () => testApp, // Function to get the app instance for supertest
  getSessionStore, // Function to get the session store
  setupTestSession, // Function to set up a test session
  createSessionCookie, // Function to create a session cookie
  mockDb: {
    query: mockDbQuery
  },
  mockRedis: {
    get: mockRedisGet,
    set: mockRedisSet,
    exists: mockRedisExists,
    del: mockRedisDel
  },
  // Storage mock removed since app no longer needs file uploads
  mockPassword: {
    hashPassword: mockHashPassword,
    verifyPassword: mockVerifyPassword
  },
  mockAuthSecurity: {
    recordFailedAttempt: mockRecordFailedAttempt,
    resetAttempts: mockResetAttempts,
    checkLockStatus: mockCheckLockStatus
  },
  // Helper to reset all mocks between tests
  resetMocks: () => {
    // Reset DB mock but maintain the default implementation to prevent destructuring errors
    mockDbQuery.mockReset().mockImplementation(() => {
      return Promise.resolve({
        rows: [],
        rowCount: 0
      });
    });

    // Reset Redis mocks
    mockRedisGet.mockReset().mockResolvedValue(null);
    mockRedisSet.mockReset().mockResolvedValue('OK');
    mockRedisExists.mockReset().mockResolvedValue(0);
    mockRedisDel.mockReset().mockResolvedValue(1);

    // Storage mock removed since app no longer needs file uploads

    // Reset password utility mocks
    mockHashPassword.mockReset().mockImplementation(async (password) => {
      return '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789';
    });

    mockVerifyPassword.mockReset().mockImplementation(async (password, hash) => {
      return password === 'correct-password';
    });

    // Reset auth security mocks
    mockRecordFailedAttempt.mockReset().mockResolvedValue({ attempts: 1, lockedUntil: null });
    mockResetAttempts.mockReset().mockResolvedValue(true);
    mockCheckLockStatus.mockReset().mockResolvedValue({ locked: false });
  }
};

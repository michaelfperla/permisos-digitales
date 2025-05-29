/**
 * Test setup file
 * Configures the test environment and provides utilities for testing
 */
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const httpContext = require('express-http-context');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SESSION_SECRET = 'test_session_secret';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';

// Create a mock database connection
const mockDbPool = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  }),
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0
};

// Mock the database module
jest.mock('../db', () => {
  return {
    query: jest.fn(),
    pool: mockDbPool
  };
});

// Mock the logger to prevent console output during tests
jest.mock('../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  correlationMiddleware: jest.fn().mockImplementation((req, res, next) => next())
}));

// Mock HTTP context
jest.mock('express-http-context', () => ({
  middleware: jest.fn().mockImplementation((req, res, next) => next()),
  set: jest.fn(),
  get: jest.fn()
}));

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = jest.fn().mockImplementation(() => {
    return {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      on: jest.fn(),
      status: 'ready',
      disconnect: jest.fn()
    };
  });

  return mockRedis;
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      response: 'test-response'
    }),
    verify: jest.fn().mockResolvedValue(true)
  }))
}));

// Multer is no longer used in the codebase

// Create a helper to reset all mocks between tests
global.resetAllMocks = () => {
  jest.clearAllMocks();

  // Reset database mocks
  const db = require('../db');
  db.query.mockReset();
  mockDbPool.query.mockReset();
  mockDbPool.connect.mockReset().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  });

  // Reset logger mocks
  try {
    const { logger } = require('../utils/enhanced-logger');
    if (logger.error && typeof logger.error.mockReset === 'function') logger.error.mockReset();
    if (logger.warn && typeof logger.warn.mockReset === 'function') logger.warn.mockReset();
    if (logger.info && typeof logger.info.mockReset === 'function') logger.info.mockReset();
    if (logger.debug && typeof logger.debug.mockReset === 'function') logger.debug.mockReset();
  } catch (err) {
    console.log('Warning: Could not reset logger mocks');
  }

  // Reset HTTP context mocks
  if (httpContext.set && typeof httpContext.set.mockReset === 'function') {
    httpContext.set.mockReset();
  }
  if (httpContext.get && typeof httpContext.get.mockReset === 'function') {
    httpContext.get.mockReset();
  }
};

// Reset mocks before each test
beforeEach(() => {
  global.resetAllMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Ensure test directory exists for any file operations during tests
const testStorageDir = path.join(__dirname, '../../test-storage');
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}

// Export test utilities
module.exports = {
  mockDbPool,
  testStorageDir
};

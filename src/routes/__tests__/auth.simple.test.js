/**
 * Simple Integration Test for Auth Routes
 * This file contains a minimal test to debug issues with the integration tests
 */
const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth.routes');

// Mock Redis client to prevent open handles
jest.mock('../../utils/redis-client', () => ({
  status: 'ready',
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  exists: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(0),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK')
}));

// Mock CSRF middleware
// Note: We're using @dr.pogodin/csurf instead of csurf
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

// Mock API Response
jest.mock('../../utils/api-response', () => ({
  success: (res, data, message, statusCode) => {
    return res.status(statusCode || 200).json({
      success: true,
      message: message || 'Success',
      data: data || {}
    });
  },
  error: (res, message, statusCode, errors) => {
    return res.status(statusCode || 500).json({
      success: false,
      message: message || 'Error',
      errors: errors || []
    });
  }
}));

describe('Simple Auth Routes Test', () => {
  let app;
  let server;

  // Set a longer timeout
  jest.setTimeout(10000);

  // Close the server after all tests
  afterAll(done => {
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(() => {
    // Create a new Express app
    app = express();

    // Mount auth routes
    app.use('/api/auth', authRoutes);

    // Start the server on a random port
    server = app.listen(0);
  });

  afterEach(done => {
    // Close the server after each test
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  it.skip('should return a CSRF token', done => {
    request(app)
      .get('/api/auth/csrf-token')
      .end((err, res) => {
        console.log('Response status:', res.status);
        console.log('Response body:', JSON.stringify(res.body, null, 2));

        if (err) {
          console.error('Error:', err);
          return done(err);
        }

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data.csrfToken', 'test-csrf-token');
        done();
      });
  });
});

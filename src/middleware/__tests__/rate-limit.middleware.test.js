/**
 * Unit Tests for Rate Limit Middleware
 */
const express = require('express');
const request = require('supertest');
const { logger } = require('../../utils/logger');
const { RateLimitError } = require('../../utils/errors');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((options) => {
    const { windowMs, max, message, handler } = options;
    
    // Create a simple in-memory store for testing
    const store = new Map();
    
    return (req, res, next) => {
      const key = req.ip || 'default';
      const current = store.get(key) || 0;
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current - 1));
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', Math.max(0, max - current - 1));
      
      // Check if rate limit is exceeded
      if (current >= max) {
        // If a custom handler is provided, use it
        if (handler) {
          return handler(req, res, next);
        }
        
        // Default behavior
        return res.status(429).json({ message });
      }
      
      // Increment counter
      store.set(key, current + 1);
      next();
    };
  });
});

// Import the middleware after mocking dependencies
const limiters = require('../rate-limit.middleware');

describe('Rate Limit Middleware', () => {
  let app;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new Express app for each test
    app = express();
    
    // Add error handler for rate limit errors
    app.use((err, req, res, next) => {
      if (err instanceof RateLimitError) {
        return res.status(429).json({ message: err.message });
      }
      next(err);
    });
  });
  
  describe('API Rate Limiter', () => {
    beforeEach(() => {
      // Add API rate limiter to app
      app.use('/api', limiters.api);
      
      // Add test route
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should allow requests under the rate limit', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .expect(200);
      
      // Assert
      expect(response.body).toHaveProperty('success', true);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
    
    it('should include rate limit headers in the response', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .expect(200);
      
      // Assert
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeLessThan(
        parseInt(response.headers['x-ratelimit-limit'])
      );
    });
  });
  
  describe('Auth Rate Limiter', () => {
    beforeEach(() => {
      // Add Auth rate limiter to app
      app.use('/auth', limiters.auth);
      
      // Add test route
      app.post('/auth/login', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should allow requests under the rate limit', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .expect(200);
      
      // Assert
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('Admin Rate Limiter', () => {
    beforeEach(() => {
      // Add Admin rate limiter to app
      app.use('/admin', limiters.admin);
      
      // Add test route
      app.get('/admin/dashboard', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should allow requests under the rate limit', async () => {
      // Act
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);
      
      // Assert
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('Upload Rate Limiter', () => {
    beforeEach(() => {
      // Add Upload rate limiter to app
      app.use('/upload', limiters.upload);
      
      // Add test route
      app.post('/upload/file', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should allow requests under the rate limit', async () => {
      // Act
      const response = await request(app)
        .post('/upload/file')
        .expect(200);
      
      // Assert
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('Rate Limit Handler', () => {
    beforeEach(() => {
      // Create a test app with a rate limiter that will immediately exceed
      app = express();
      
      // Mock express-rate-limit to always exceed the limit
      require('express-rate-limit').mockImplementationOnce((options) => {
        return (req, res, next) => {
          // Call the handler directly to test it
          options.handler(req, res, next);
        };
      });
      
      // Create a custom limiter for testing
      const testLimiter = require('express-rate-limit')({
        windowMs: 60 * 1000,
        max: 5,
        message: 'Test rate limit exceeded',
        handler: (req, res, next) => {
          const error = new RateLimitError(
            'Test rate limit exceeded',
            'RATE_LIMIT_EXCEEDED'
          );
          next(error);
        }
      });
      
      // Add middleware to app
      app.use('/test', testLimiter);
      
      // Add test route
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
      
      // Add error handler
      app.use((err, req, res, next) => {
        if (err instanceof RateLimitError) {
          logger.warn('Rate limit exceeded for test');
          return res.status(429).json({ message: err.message });
        }
        next(err);
      });
    });
    
    it('should log warning and return 429 when rate limit is exceeded', async () => {
      // Act
      const response = await request(app)
        .get('/test')
        .expect(429);
      
      // Assert
      expect(response.body).toHaveProperty('message', 'Test rate limit exceeded');
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded for test');
    });
  });
});

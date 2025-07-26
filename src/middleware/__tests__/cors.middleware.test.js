/**
 * Unit Tests for CORS Middleware
 */
const express = require('express');
const request = require('supertest');
const { logger } = require('../../utils/logger');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

describe('CORS Middleware', () => {
  let app;

  afterEach(() => {
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;

    // Clear module cache to ensure middleware is reloaded with correct NODE_ENV
    jest.resetModules();
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';

      // Import the middleware after setting NODE_ENV
      const corsMiddleware = require('../cors.middleware');

      // Create a new Express app for each test
      app = express();

      // Add middleware
      app.use(corsMiddleware);

      // Add test route
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from localhost:3000 in development mode', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // Assert
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.body).toEqual({ success: true });
    });

    it('should handle preflight requests in development mode', async () => {
      // Act
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // Assert
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-headers']).toContain('X-CSRF-Token');
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      // Set NODE_ENV to production
      process.env.NODE_ENV = 'production';

      // Mock cors package
      jest.mock('cors', () => {
        return (options) => {
          return (req, res, next) => {
            // Call the origin function to test it
            if (req.headers.origin && options.origin) {
              options.origin(req.headers.origin, (err, origin) => {
                if (err) {
                  // Log the blocked request
                  logger.warn(`CORS blocked request from origin: ${req.headers.origin}`);
                  res.status(403).json({ error: 'CORS not allowed' });
                } else {
                  res.setHeader('Access-Control-Allow-Origin', origin);
                  res.setHeader('Access-Control-Allow-Credentials', 'true');
                  res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
                  res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
                  res.setHeader('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));

                  if (req.method === 'OPTIONS') {
                    res.status(204).end();
                  } else {
                    next();
                  }
                }
              });
            } else {
              // No origin header, just continue
              next();
            }
          };
        };
      });

      // Import the middleware after mocking
      const corsMiddleware = require('../cors.middleware');

      // Create a new Express app for each test
      app = express();

      // Add middleware
      app.use(corsMiddleware);

      // Add test route
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from allowed origins in production mode', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://permisosdigitales.com.mx')
        .expect(200);

      // Assert
      expect(response.headers['access-control-allow-origin']).toBe('https://permisosdigitales.com.mx');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.body).toEqual({ success: true });
    });

    it('should block requests from disallowed origins in production mode', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://evil-site.com')
        .expect(403);

      // Assert
      expect(response.body).toEqual({ error: 'CORS not allowed' });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('CORS blocked request from origin'));
    });

    it('should allow requests with no origin in production mode', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      // Assert
      expect(response.body).toEqual({ success: true });
    });

    it('should block requests from file:// URLs in production mode', async () => {
      // Act
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'file:///C:/Users/test/index.html')
        .expect(403);

      // Assert
      expect(response.body).toEqual({ error: 'CORS not allowed' });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('CORS blocked request from origin'));
    });
  });
});

/**
 * Tests for Health Check Routes
 */
const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../routes/health.routes');
const db = require('../../db');
const storageService = require('../../services/storage.service');
// Import logger
const { logger } = require('../../utils/enhanced-logger');

// Mock logger methods
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  correlationMiddleware: jest.fn().mockImplementation((_req, _res, next) => next())
}));

// Import test setup
require('../setup');

describe('Health Check Routes', () => {
  let app;

  beforeEach(() => {
    // Create a new Express app for each test
    app = express();
    app.use(express.json());
    app.use('/', healthRoutes);

    // Reset mocks
    jest.clearAllMocks();

    // Setup db mock for this test
    db.query = jest.fn();
  });

  describe('GET /', () => {
    it('should return 200 status with UP status', async () => {
      // Act
      const response = await request(app).get('/');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /details', () => {
    it('should return 200 status with component details when all systems are up', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
      storageService.ensureDirectoryExists = jest.fn().mockResolvedValue(true);

      // Act
      const response = await request(app).get('/details');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('components');
      expect(response.body.components).toHaveProperty('database');
      expect(response.body.components).toHaveProperty('storage');
      expect(response.body.components.database.status).toBe('UP');
      expect(response.body.components.storage.status).toBe('UP');
    });

    it('should return 503 status when database is down', async () => {
      // Arrange
      db.query.mockRejectedValue(new Error('Database connection error'));
      storageService.ensureDirectoryExists = jest.fn().mockResolvedValue(true);

      // Act
      const response = await request(app).get('/details');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'DOWN');
      expect(response.body.components.database.status).toBe('DOWN');
      expect(response.body.components.storage.status).toBe('UP');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return 503 status when storage is down', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
      storageService.ensureDirectoryExists = jest.fn().mockRejectedValue(
        new Error('Storage error')
      );

      // Act
      const response = await request(app).get('/details');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'DOWN');
      expect(response.body.components.database.status).toBe('UP');
      expect(response.body.components.storage.status).toBe('DOWN');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('GET /readiness', () => {
    it('should return 200 status when database is ready', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      // Act
      const response = await request(app).get('/readiness');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'READY');
    });

    it('should return 503 status when database is not ready', async () => {
      // Arrange
      db.query.mockRejectedValue(new Error('Database not ready'));

      // Act
      const response = await request(app).get('/readiness');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'NOT_READY');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('GET /liveness', () => {
    it('should return 200 status with uptime', async () => {
      // Act
      const response = await request(app).get('/liveness');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ALIVE');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});

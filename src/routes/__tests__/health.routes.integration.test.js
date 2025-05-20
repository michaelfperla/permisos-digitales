/**
 * Integration Tests for Health Routes
 */

// Import test setup
require('../../tests/setup');

const request = require('supertest');
const express = require('express');
const healthRoutes = require('../health.routes');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ health_check: 1 }] }),
  pool: {
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0
  }
}));

// Mock storage service
jest.mock('../../services/storage.service', () => ({
  baseDir: '/test/storage',
  ensureDirectoryExists: jest.fn().mockResolvedValue(true)
}));

// Import dependencies after mocking
const db = require('../../db');
const storageService = require('../../services/storage.service');

// Create a test app with the health routes
const app = express();
app.use('/health', healthRoutes);

describe('Health Routes Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up default mock responses
    db.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
    storageService.ensureDirectoryExists.mockResolvedValue(true);
  });

  describe('GET /health', () => {
    it('should return 200 OK with basic health status', async () => {
      // Act
      const response = await request(app).get('/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/details', () => {
    it('should return 200 OK with detailed health status when all services are healthy', async () => {
      // Act
      const response = await request(app).get('/health/details');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('components');
      expect(response.body.components).toHaveProperty('database');
      expect(response.body.components.database).toHaveProperty('status', 'UP');
      expect(response.body.components).toHaveProperty('storage');
      expect(response.body.components.storage).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('system');
    });

    it('should return 503 Service Unavailable when database query fails', async () => {
      // Arrange
      db.query.mockRejectedValue(new Error('Database connection error'));

      // Act
      const response = await request(app).get('/health/details');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'DOWN');
      expect(response.body).toHaveProperty('components');
      expect(response.body.components.database).toHaveProperty('status', 'DOWN');
      expect(response.body.components.database).toHaveProperty('error');
    });

    it.skip('should return 503 Service Unavailable when storage service fails', async () => {
      // Arrange - We need to mock the storage service to throw an error
      // that will be caught by the health check
      const originalMock = storageService.ensureDirectoryExists;
      storageService.ensureDirectoryExists = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      try {
        // Act
        const response = await request(app).get('/health/details');

        // Assert
        expect(response.body.components.storage).toHaveProperty('status', 'DOWN');
        expect(response.body.components.storage).toHaveProperty('error');
        expect(response.body).toHaveProperty('status', 'DOWN');
        expect(response.status).toBe(503);
      } finally {
        // Restore the original mock
        storageService.ensureDirectoryExists = originalMock;
      }
    });
  });

  describe('GET /health/readiness', () => {
    it('should return 200 OK when application is ready', async () => {
      // Act
      const response = await request(app).get('/health/readiness');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'READY');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 503 Service Unavailable when database is not ready', async () => {
      // Arrange
      db.query.mockRejectedValue(new Error('Database not ready'));

      // Act
      const response = await request(app).get('/health/readiness');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'NOT_READY');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /health/liveness', () => {
    it('should return 200 OK with liveness status', async () => {
      // Act
      const response = await request(app).get('/health/liveness');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ALIVE');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});

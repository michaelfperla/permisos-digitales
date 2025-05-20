/**
 * Unit Tests for Application Service
 */
const applicationService = require('../application.service');
const db = require('../../db');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../db');
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Application Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getExpiringPermits', () => {
    it('should return expiring permits for a user', async () => {
      // Arrange
      const userId = 123;
      const daysThreshold = 30;
      const mockExpiringPermits = [
        {
          id: 1,
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: '2023',
          fecha_expedicion: '2023-01-01',
          fecha_vencimiento: '2023-12-31',
          days_remaining: 20
        },
        {
          id: 2,
          marca: 'Honda',
          linea: 'Civic',
          ano_modelo: '2022',
          fecha_expedicion: '2023-02-01',
          fecha_vencimiento: '2023-12-15',
          days_remaining: 5
        }
      ];

      // Mock DB query to return expiring permits
      db.query.mockResolvedValue({ rows: mockExpiringPermits });

      // Act
      const result = await applicationService.getExpiringPermits(userId, daysThreshold);

      // Assert
      expect(result).toEqual(mockExpiringPermits);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento'),
        [userId]
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${daysThreshold} days'`),
        expect.any(Array)
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Looking for permits expiring within ${daysThreshold} days for user ${userId}`)
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Found ${mockExpiringPermits.length} expiring permits for user ${userId}`)
      );
    });

    it('should return empty array when no expiring permits found', async () => {
      // Arrange
      const userId = 456;
      const daysThreshold = 30;
      
      // Mock DB query to return empty array
      db.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await applicationService.getExpiringPermits(userId, daysThreshold);

      // Assert
      expect(result).toEqual([]);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento'),
        [userId]
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Looking for permits expiring within ${daysThreshold} days for user ${userId}`)
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Found 0 expiring permits for user ${userId}`)
      );
    });

    it('should use default threshold of 30 days when not specified', async () => {
      // Arrange
      const userId = 123;
      const defaultThreshold = 30;
      
      // Mock DB query to return expiring permits
      db.query.mockResolvedValue({ rows: [] });

      // Act
      await applicationService.getExpiringPermits(userId);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${defaultThreshold} days'`),
        expect.any(Array)
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Looking for permits expiring within ${defaultThreshold} days for user ${userId}`)
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 123;
      const daysThreshold = 30;
      const dbError = new Error('Database connection failed');
      
      // Mock DB query to throw error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationService.getExpiringPermits(userId, daysThreshold))
        .rejects.toThrow(dbError);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error in getExpiringPermits service:',
        dbError
      );
    });
  });
});

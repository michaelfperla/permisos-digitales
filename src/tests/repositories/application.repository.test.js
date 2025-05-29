/**
 * Tests for Application Repository
 */
const { ApplicationStatus } = require('../../constants');
const { NotFoundError, DatabaseError } = require('../../utils/errors');

// Import test setup
require('../setup');

// Mock the database module using our standardized approach
const db = require('../../db');

// Mock the transaction module using our standardized approach
const withTransaction = jest.fn();
jest.mock('../../db/transaction', () => ({
  withTransaction
}));

// Since the module exports an instance, we'll use that directly
// Import after mocking dependencies
const applicationRepository = require('../../repositories/application.repository');

describe('ApplicationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('findById', () => {
    it('should return an application when found', async () => {
      // Arrange
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PENDING_PAYMENT
      };

      // Manually mock the implementation for this test
      db.query.mockResolvedValue({ rows: [mockApplication], rowCount: 1 });

      // Act
      const result = await applicationRepository.findById(1);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications WHERE id = $1'),
        [1]
      );
      expect(result).toEqual(mockApplication);
    });

    it('should return null when application not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await applicationRepository.findById(999);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications WHERE id = $1'),
        [999]
      );
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationRepository.findById(1)).rejects.toThrow(dbError);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications WHERE id = $1'),
        [1]
      );
    });
  });

  describe('findByUserId', () => {
    it('should return applications for a user', async () => {
      // Arrange
      const mockApplications = [
        { id: 1, user_id: 123, status: ApplicationStatus.PENDING_PAYMENT },
        { id: 2, user_id: 123, status: ApplicationStatus.PROOF_SUBMITTED }
      ];
      db.query.mockResolvedValue({ rows: mockApplications, rowCount: 2 });

      // Act
      const result = await applicationRepository.findByUserId(123);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([123])
      );
      expect(db.query.mock.calls[0][0]).toContain('WHERE user_id = $1');
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(result).toEqual(mockApplications);
    });

    it('should return empty array when no applications found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await applicationRepository.findByUserId(456);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([456])
      );
      expect(result).toEqual([]);
    });
  });

  describe('findExpiringPermits', () => {
    it('should return applications with expiring permits', async () => {
      // Arrange
      const userId = 123;
      const mockApplications = [
        {
          id: 1,
          status: ApplicationStatus.PERMIT_READY,
          fecha_vencimiento: '2023-12-31'
        }
      ];
      db.query.mockResolvedValue({ rows: mockApplications, rowCount: 1 });

      // Act
      const result = await applicationRepository.findExpiringPermits(userId);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([userId])
      );
      expect(db.query.mock.calls[0][0]).toContain('INTERVAL \'30 days\'');
      expect(result).toEqual(mockApplications);
    });



    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationRepository.findExpiringPermits(123)).rejects.toThrow(dbError);
    });
  });




});

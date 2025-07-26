/**
 * Unit Tests for Application Repository
 */
const { ApplicationStatus } = require('../../constants');
const { NotFoundError, DatabaseError } = require('../../utils/errors');

// Mock the database module
const db = require('../../db');
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock the transaction module
const withTransaction = jest.fn();
jest.mock('../../db/transaction', () => ({
  withTransaction
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking dependencies
const applicationRepository = require('../application.repository');

describe('ApplicationRepository', () => {
  beforeEach(() => {
    // Reset all mocks before each test
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


  });



  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      // Arrange
      const mockStatusResults = {
        rows: [
          { status: ApplicationStatus.PENDING_PAYMENT, count: '5' },
          { status: ApplicationStatus.PROOF_SUBMITTED, count: '3' },
          { status: ApplicationStatus.PAYMENT_RECEIVED, count: '2' }
        ]
      };

      const mockTodayResults = {
        rows: [
          { approved: '2', rejected: '1' }
        ]
      };

      const mockPendingResults = {
        rows: [
          { count: '3' }
        ]
      };

      // Mock sequential calls to db.query
      db.query
        .mockResolvedValueOnce(mockStatusResults)
        .mockResolvedValueOnce(mockPendingResults);

      // Act
      const result = await applicationRepository.getDashboardStats();

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);

      // First call - status counts
      expect(db.query.mock.calls[0][0]).toContain('SELECT status, COUNT(*) as count');

      // Second call - pending verifications
      expect(db.query.mock.calls[1][0]).toContain('SELECT COUNT(*) as count');
      expect(db.query.mock.calls[1][1]).toEqual([ApplicationStatus.AWAITING_OXXO_PAYMENT]);

      // Check result structure
      expect(result).toEqual({
        statusCounts: mockStatusResults.rows,
        todayVerifications: {
          approved: 0,
          rejected: 0
        },
        pendingVerifications: 3
      });
    });

    it('should handle empty results', async () => {
      // Arrange
      const mockStatusResults = { rows: [] };
      const mockPendingResults = { rows: [] };

      // Mock sequential calls to db.query
      db.query
        .mockResolvedValueOnce(mockStatusResults)
        .mockResolvedValueOnce(mockPendingResults);

      // Act
      const result = await applicationRepository.getDashboardStats();

      // Assert
      expect(result).toEqual({
        statusCounts: [],
        todayVerifications: {
          approved: 0,
          rejected: 0
        },
        pendingVerifications: 0
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationRepository.getDashboardStats()).rejects.toThrow(dbError);
    });
  });


});

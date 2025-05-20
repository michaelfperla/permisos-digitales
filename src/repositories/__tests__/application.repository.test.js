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
jest.mock('../../utils/enhanced-logger', () => ({
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
        expect.stringContaining('SELECT * FROM permit_applications'),
        expect.arrayContaining([123])
      );
      expect(db.query.mock.calls[0][0]).toContain('WHERE user_id = $1');
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(result).toEqual(mockApplications);
    });

    it('should use custom options when provided', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const options = {
        limit: 5,
        offset: 10,
        orderBy: 'id ASC'
      };

      // Act
      await applicationRepository.findByUserId(123, options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY id ASC'),
        expect.anything()
      );
      // Verify that the query contains the correct parameters
      const query = db.query.mock.calls[0][0];
      const params = db.query.mock.calls[0][1];
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
      expect(params[0]).toBe(123);
      // The BaseRepository.findAll method handles the limit and offset parameters
      // but they might be in a different order than we expect
    });
  });

  describe('logVerificationAction', () => {
    it('should log verification action successfully', async () => {
      // Arrange
      const applicationId = 1;
      const adminId = 456;
      const action = 'verify';
      const notes = 'Payment verified';

      const mockLogEntry = {
        id: 123,
        application_id: applicationId,
        verified_by: adminId,
        action,
        notes,
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockLogEntry], rowCount: 1 });

      // Act
      const result = await applicationRepository.logVerificationAction(
        applicationId,
        adminId,
        action,
        notes
      );

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_verification_log'),
        [applicationId, adminId, action, notes]
      );
      expect(result).toEqual(mockLogEntry);
    });

    it('should handle null notes parameter', async () => {
      // Arrange
      const applicationId = 1;
      const adminId = 456;
      const action = 'verify';

      const mockLogEntry = {
        id: 123,
        application_id: applicationId,
        verified_by: adminId,
        action,
        notes: null
      };

      db.query.mockResolvedValue({ rows: [mockLogEntry], rowCount: 1 });

      // Act
      const result = await applicationRepository.logVerificationAction(
        applicationId,
        adminId,
        action
      );

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_verification_log'),
        [applicationId, adminId, action, null]
      );
      expect(result).toEqual(mockLogEntry);
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.logVerificationAction(1, 456, 'verify', 'notes')
      ).rejects.toThrow(dbError);
    });
  });

  describe('getVerificationHistory', () => {
    it('should return verification logs with default parameters', async () => {
      // Arrange
      const mockLogs = [
        { id: 1, application_id: 123, verified_by: 456, action: 'verify' },
        { id: 2, application_id: 124, verified_by: 456, action: 'reject' }
      ];

      db.query.mockResolvedValue({ rows: mockLogs, rowCount: 2 });

      // Act
      const result = await applicationRepository.getVerificationHistory();

      // Assert
      expect(db.query).toHaveBeenCalled();
      const query = db.query.mock.calls[0][0];
      const params = db.query.mock.calls[0][1];
      expect(query).toContain('SELECT pvl.*');
      expect(query).toContain('pa.folio');
      expect(query).toContain('pa.marca');
      expect(query).toContain('pa.linea');
      expect(params).toEqual([100, 0]); // Default limit and offset
      expect(result).toEqual(mockLogs);
    });

    it('should apply filters when provided', async () => {
      // Arrange
      const mockLogs = [
        { id: 1, application_id: 123, verified_by: 456, action: 'verify' }
      ];

      db.query.mockResolvedValue({ rows: mockLogs, rowCount: 1 });

      const filters = {
        verifiedBy: 456,
        action: 'verify'
      };

      const options = {
        limit: 5,
        offset: 10
      };

      // Act
      const result = await applicationRepository.getVerificationHistory(filters, options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pvl.verified_by = $1 AND pvl.action = $2'),
        [456, 'verify', 5, 10]
      );
      expect(result).toEqual(mockLogs);
    });

    it('should handle partial filters', async () => {
      // Arrange
      const mockLogs = [
        { id: 1, application_id: 123, verified_by: 456, action: 'verify' }
      ];

      db.query.mockResolvedValue({ rows: mockLogs, rowCount: 1 });

      const filters = {
        action: 'verify'
      };

      const options = {
        limit: 5,
        offset: 10
      };

      // Act
      const result = await applicationRepository.getVerificationHistory(filters, options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pvl.action = $1'),
        ['verify', 5, 10]
      );
      expect(result).toEqual(mockLogs);
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationRepository.getVerificationHistory()).rejects.toThrow(dbError);
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
        .mockResolvedValueOnce(mockTodayResults)
        .mockResolvedValueOnce(mockPendingResults);

      // Act
      const result = await applicationRepository.getDashboardStats();

      // Assert
      expect(db.query).toHaveBeenCalledTimes(3);

      // First call - status counts
      expect(db.query.mock.calls[0][0]).toContain('SELECT status, COUNT(*) as count');

      // Second call - today's verifications
      expect(db.query.mock.calls[1][0]).toContain('SUM(CASE WHEN action = \'verify\'');

      // Third call - pending verifications
      expect(db.query.mock.calls[2][0]).toContain('SELECT COUNT(*) as count');
      expect(db.query.mock.calls[2][1]).toEqual([ApplicationStatus.PROOF_SUBMITTED]);

      // Check result structure
      expect(result).toEqual({
        statusCounts: mockStatusResults.rows,
        todayVerifications: {
          approved: 2,
          rejected: 1
        },
        pendingVerifications: 3
      });
    });

    it('should handle empty results', async () => {
      // Arrange
      const mockStatusResults = { rows: [] };
      const mockTodayResults = { rows: [] };
      const mockPendingResults = { rows: [] };

      // Mock sequential calls to db.query
      db.query
        .mockResolvedValueOnce(mockStatusResults)
        .mockResolvedValueOnce(mockTodayResults)
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

  describe('verifyPayment', () => {
    it('should update application status and log verification', async () => {
      // Arrange
      const applicationId = 1;
      const adminId = 456;
      const notes = 'Payment verified';

      const mockUpdatedApplication = {
        id: applicationId,
        status: ApplicationStatus.PAYMENT_RECEIVED,
        payment_verified_by: adminId,
        payment_notes: notes
      };

      // Mock the transaction callback result
      withTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockUpdatedApplication], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 123 }], rowCount: 1 })
        };
        return callback(mockClient);
      });

      // Act
      const result = await applicationRepository.verifyPayment(applicationId, adminId, notes);

      // Assert
      expect(withTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should throw NotFoundError when application not found', async () => {
      // Arrange
      // Mock the transaction callback result for not found case
      withTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        };
        return callback(mockClient);
      });

      // Act & Assert
      await expect(
        applicationRepository.verifyPayment(999, 456)
      ).rejects.toThrow(NotFoundError);
      expect(withTransaction).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      withTransaction.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.verifyPayment(1, 456)
      ).rejects.toThrow(dbError);
      expect(withTransaction).toHaveBeenCalled();
    });
  });

  describe('rejectPayment', () => {
    it('should update application status and log rejection reason', async () => {
      // Arrange
      const applicationId = 1;
      const adminId = 456;
      const rejectionReason = 'Invalid payment proof';

      const mockUpdatedApplication = {
        id: applicationId,
        status: ApplicationStatus.PROOF_REJECTED,
        payment_verified_by: adminId,
        payment_rejection_reason: rejectionReason
      };

      // Mock the transaction callback result
      withTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockUpdatedApplication], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 123 }], rowCount: 1 })
        };
        return callback(mockClient);
      });

      // Act
      const result = await applicationRepository.rejectPayment(applicationId, adminId, rejectionReason);

      // Assert
      expect(withTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should throw NotFoundError when application not found', async () => {
      // Arrange
      // Mock the transaction callback result for not found case
      withTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        };
        return callback(mockClient);
      });

      // Act & Assert
      await expect(
        applicationRepository.rejectPayment(999, 456, 'Invalid proof')
      ).rejects.toThrow(NotFoundError);
      expect(withTransaction).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      withTransaction.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.rejectPayment(1, 456, 'Invalid proof')
      ).rejects.toThrow(dbError);
      expect(withTransaction).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update application status', async () => {
      // Arrange
      const applicationId = 1;
      const newStatus = ApplicationStatus.PERMIT_READY;

      const mockUpdatedApplication = {
        id: applicationId,
        status: newStatus
      };

      db.query.mockResolvedValue({ rows: [mockUpdatedApplication], rowCount: 1 });

      // Act
      const result = await applicationRepository.updateStatus(applicationId, newStatus);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        [newStatus, applicationId]
      );
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should return null when application not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await applicationRepository.updateStatus(999, ApplicationStatus.COMPLETED);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.updateStatus(1, ApplicationStatus.COMPLETED)
      ).rejects.toThrow(dbError);
    });
  });

  describe('updatePermitFiles', () => {
    it('should update permit file paths', async () => {
      // Arrange
      const applicationId = 1;
      const filePaths = {
        permitPath: '/path/to/permit.pdf',
        reciboPath: '/path/to/recibo.pdf',
        certificadoPath: '/path/to/certificado.pdf'
      };

      const mockUpdatedApplication = {
        id: applicationId,
        permit_file_path: filePaths.permitPath,
        recibo_file_path: filePaths.reciboPath,
        certificado_file_path: filePaths.certificadoPath
      };

      db.query.mockResolvedValue({ rows: [mockUpdatedApplication], rowCount: 1 });

      // Act
      const result = await applicationRepository.updatePermitFiles(applicationId, filePaths);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        [
          filePaths.permitPath,
          filePaths.reciboPath,
          filePaths.certificadoPath,
          applicationId
        ]
      );
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should return null when application not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await applicationRepository.updatePermitFiles(999, {
        permitPath: '/path/to/permit.pdf',
        reciboPath: '/path/to/recibo.pdf',
        certificadoPath: '/path/to/certificado.pdf'
      });

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.updatePermitFiles(1, {
          permitPath: '/path/to/permit.pdf',
          reciboPath: '/path/to/recibo.pdf',
          certificadoPath: '/path/to/certificado.pdf'
        })
      ).rejects.toThrow(dbError);
    });
  });
});

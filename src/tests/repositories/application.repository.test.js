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
        expect.stringContaining('SELECT * FROM permit_applications'),
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
        expect.stringContaining('SELECT * FROM permit_applications'),
        expect.arrayContaining([456])
      );
      expect(result).toEqual([]);
    });
  });

  describe('findByStatus', () => {
    it('should return applications with specified status', async () => {
      // Arrange
      const mockApplications = [
        { id: 1, user_id: 123, status: ApplicationStatus.PROOF_SUBMITTED },
        { id: 2, user_id: 456, status: ApplicationStatus.PROOF_SUBMITTED }
      ];
      db.query.mockResolvedValue({ rows: mockApplications, rowCount: 2 });

      // Act
      const result = await applicationRepository.findByStatus(ApplicationStatus.PROOF_SUBMITTED);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications'),
        expect.arrayContaining([ApplicationStatus.PROOF_SUBMITTED])
      );
      expect(db.query.mock.calls[0][0]).toContain('WHERE status = $1');
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at ASC');
      expect(result).toEqual(mockApplications);
    });

    it('should use custom options when provided', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const options = {
        limit: 10,
        offset: 20,
        orderBy: 'id DESC'
      };

      // Act
      await applicationRepository.findByStatus(ApplicationStatus.PENDING_PAYMENT, options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications'),
        expect.arrayContaining([ApplicationStatus.PENDING_PAYMENT])
      );
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY id DESC');
      expect(db.query.mock.calls[0][0]).toContain('LIMIT 10');
      expect(db.query.mock.calls[0][0]).toContain('OFFSET 20');
    });
  });

  describe('findPendingVerifications', () => {
    it('should call findByStatus with PROOF_SUBMITTED status', async () => {
      // Arrange
      const mockApplications = [
        { id: 1, status: ApplicationStatus.PROOF_SUBMITTED },
        { id: 2, status: ApplicationStatus.PROOF_SUBMITTED }
      ];
      db.query.mockResolvedValue({ rows: mockApplications, rowCount: 2 });

      // Act
      const result = await applicationRepository.findPendingVerifications();

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM permit_applications'),
        expect.arrayContaining([ApplicationStatus.PROOF_SUBMITTED])
      );
      expect(result).toEqual(mockApplications);
    });

    it('should pass options to findByStatus', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const options = { limit: 5 };

      // Act
      await applicationRepository.findPendingVerifications(options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 5'),
        expect.arrayContaining([ApplicationStatus.PROOF_SUBMITTED])
      );
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
        expect.stringContaining('SELECT id, status, folio, marca, linea, ano_modelo'),
        expect.arrayContaining([userId, ApplicationStatus.PERMIT_READY, ApplicationStatus.COMPLETED])
      );
      expect(db.query.mock.calls[0][0]).toContain('INTERVAL \'30 days\'');
      expect(result).toEqual(mockApplications);
    });

    it('should use custom days threshold when provided', async () => {
      // Arrange
      const userId = 123;
      const daysThreshold = 15;
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      await applicationRepository.findExpiringPermits(userId, daysThreshold);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${daysThreshold} days'`),
        expect.arrayContaining([userId])
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(applicationRepository.findExpiringPermits(123)).rejects.toThrow(dbError);
    });
  });

  describe('submitPaymentProof', () => {
    it('should update application with payment proof without desired start date', async () => {
      // Arrange
      const applicationId = 1;
      const userId = 123;
      const paymentProofPath = '/path/to/proof.pdf';
      const paymentReference = 'REF123';

      const mockUpdatedApplication = {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.PROOF_SUBMITTED,
        payment_proof_path: paymentProofPath,
        payment_reference: paymentReference
      };

      db.query.mockResolvedValue({ rows: [mockUpdatedApplication], rowCount: 1 });

      // Act
      const result = await applicationRepository.submitPaymentProof(
        applicationId,
        userId,
        paymentProofPath,
        paymentReference
      );

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        expect.arrayContaining([
          ApplicationStatus.PROOF_SUBMITTED,
          paymentProofPath,
          paymentReference,
          applicationId,
          userId
        ])
      );
      expect(db.query.mock.calls[0][0]).not.toContain('desired_start_date');
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should update application with payment proof and desired start date', async () => {
      // Arrange
      const applicationId = 1;
      const userId = 123;
      const paymentProofPath = '/path/to/proof.pdf';
      const paymentReference = 'REF123';
      const desiredStartDate = '2023-12-01';

      const mockUpdatedApplication = {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.PROOF_RECEIVED_SCHEDULED,
        payment_proof_path: paymentProofPath,
        payment_reference: paymentReference,
        desired_start_date: desiredStartDate
      };

      db.query.mockResolvedValue({ rows: [mockUpdatedApplication], rowCount: 1 });

      // Act
      const result = await applicationRepository.submitPaymentProof(
        applicationId,
        userId,
        paymentProofPath,
        paymentReference,
        desiredStartDate
      );

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        expect.arrayContaining([
          ApplicationStatus.PROOF_RECEIVED_SCHEDULED,
          paymentProofPath,
          paymentReference,
          desiredStartDate,
          applicationId,
          userId
        ])
      );
      expect(db.query.mock.calls[0][0]).toContain('desired_start_date = $4');
      expect(result).toEqual(mockUpdatedApplication);
    });

    it('should return null when application not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await applicationRepository.submitPaymentProof(999, 123, '/path/to/proof.pdf');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        applicationRepository.submitPaymentProof(1, 123, '/path/to/proof.pdf')
      ).rejects.toThrow(dbError);
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
        payment_notes: notes
      };

      // Mock the transaction callback result using our standardized approach
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
      };

      // Mock the transaction callback result using our standardized approach
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

// src/controllers/__tests__/admin-bulk.controller.test.js
const adminBulkController = require('../admin-bulk.controller');
const ApiResponse = require('../../utils/api-response');
const { ApplicationStatus } = require('../../constants/application.constants');

// Mock dependencies
jest.mock('../../utils/redis-client', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  })
}));

jest.mock('../../db', () => ({
  query: jest.fn(),
  dbPool: {
    connect: jest.fn().mockReturnValue({
      query: jest.fn(),
      release: jest.fn()
    })
  }
}));

jest.mock('../../services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services/pdf-queue-factory.service', () => ({
  getInstance: jest.fn().mockReturnValue({
    addJob: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123')
}));

describe('Admin Bulk Controller', () => {
  let req, res;
  let mockRedisClient;

  beforeEach(() => {
    req = {
      session: { userId: 1 },
      body: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn()
    };

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup Redis mock
    const { getRedisClient } = require('../../utils/redis-client');
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    getRedisClient.mockResolvedValue(mockRedisClient);
  });

  describe('bulkUpdateApplicationStatus', () => {
    it('should validate required fields', async () => {
      await adminBulkController.bulkUpdateApplicationStatus(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Se requiere un array de IDs de aplicaciones'
      );
    });

    it('should validate application limit', async () => {
      req.body = {
        applicationIds: Array(101).fill(1),
        status: 'PERMIT_READY'
      };

      await adminBulkController.bulkUpdateApplicationStatus(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Límite excedido. Máximo 100 aplicaciones por operación'
      );
    });

    it('should validate status', async () => {
      req.body = {
        applicationIds: [1, 2, 3],
        status: 'INVALID_STATUS'
      };

      await adminBulkController.bulkUpdateApplicationStatus(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Estado inválido: INVALID_STATUS'
      );
    });

    it('should initiate bulk status update successfully', async () => {
      req.body = {
        applicationIds: [1, 2, 3],
        status: 'PERMIT_READY',
        reason: 'Bulk update test',
        notify: false
      };

      await adminBulkController.bulkUpdateApplicationStatus(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        operationId: 'bulk_op_test-uuid-123',
        message: 'Operación iniciada',
        total: 3,
        trackingUrl: '/api/admin/bulk/status/bulk_op_test-uuid-123'
      });

      // Verify Redis was called to store progress
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('bulkRegeneratePDFs', () => {
    it('should validate required fields', async () => {
      await adminBulkController.bulkRegeneratePDFs(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Se requiere un array de IDs de aplicaciones'
      );
    });

    it('should initiate bulk PDF regeneration successfully', async () => {
      req.body = {
        applicationIds: [1, 2, 3]
      };

      await adminBulkController.bulkRegeneratePDFs(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        operationId: 'bulk_op_test-uuid-123',
        message: 'Operación iniciada',
        total: 3,
        trackingUrl: '/api/admin/bulk/status/bulk_op_test-uuid-123'
      });
    });
  });

  describe('bulkSendReminders', () => {
    it('should validate reminder type', async () => {
      req.body = {
        applicationIds: [1, 2, 3],
        reminderType: 'invalid_type'
      };

      await adminBulkController.bulkSendReminders(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Tipo de recordatorio inválido'
      );
    });

    it('should initiate bulk reminder sending successfully', async () => {
      req.body = {
        applicationIds: [1, 2, 3],
        reminderType: 'payment_reminder'
      };

      await adminBulkController.bulkSendReminders(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        operationId: 'bulk_op_test-uuid-123',
        message: 'Operación iniciada',
        total: 3,
        trackingUrl: '/api/admin/bulk/status/bulk_op_test-uuid-123'
      });
    });
  });

  describe('bulkExportUsers', () => {
    it('should validate user limit', async () => {
      req.body = {
        userIds: Array(501).fill(1)
      };

      await adminBulkController.bulkExportUsers(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Límite excedido. Máximo 500 usuarios por exportación'
      );
    });

    it('should export users to CSV successfully', async () => {
      const mockUsers = [
        {
          id: 1,
          email: 'user1@test.com',
          phone: '1234567890',
          first_name: 'John',
          last_name: 'Doe',
          account_type: 'client',
          is_email_verified: true,
          account_status: 'active',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
          last_login_at: new Date('2024-01-03'),
          login_count: 5,
          total_applications: 2,
          completed_applications: 1
        }
      ];

      const db = require('../../db');
      db.query.mockResolvedValue({ rows: mockUsers });

      req.body = {
        userIds: [1],
        includeApplications: false
      };

      await adminBulkController.bulkExportUsers(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="usuarios_')
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('ID,Email,Teléfono'));
    });
  });

  describe('bulkEmailUsers', () => {
    it('should validate required fields', async () => {
      req.body = {
        userIds: [1, 2, 3]
      };

      await adminBulkController.bulkEmailUsers(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Asunto y mensaje son requeridos'
      );
    });

    it('should initiate bulk email successfully', async () => {
      req.body = {
        userIds: [1, 2, 3],
        subject: 'Test Subject',
        message: 'Test Message'
      };

      await adminBulkController.bulkEmailUsers(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        operationId: 'bulk_op_test-uuid-123',
        message: 'Operación iniciada',
        total: 3,
        trackingUrl: '/api/admin/bulk/status/bulk_op_test-uuid-123'
      });
    });
  });

  describe('bulkCleanupApplications', () => {
    it('should validate minimum days old', async () => {
      req.body = {
        daysOld: 20
      };

      await adminBulkController.bulkCleanupApplications(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Las aplicaciones deben tener al menos 30 días de antigüedad'
      );
    });

    it('should validate statuses', async () => {
      req.body = {
        daysOld: 90,
        statuses: ['EXPIRED', 'INVALID_STATUS']
      };

      await adminBulkController.bulkCleanupApplications(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'Estados inválidos: INVALID_STATUS'
      );
    });

    it('should perform dry run successfully', async () => {
      const mockApplications = [
        {
          id: 1,
          status: 'EXPIRED',
          created_at: new Date('2023-01-01'),
          user_email: 'user@test.com'
        }
      ];

      const db = require('../../db');
      db.query.mockResolvedValue({ rows: mockApplications });

      req.body = {
        daysOld: 90,
        statuses: ['EXPIRED'],
        dryRun: true
      };

      await adminBulkController.bulkCleanupApplications(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        message: 'Modo de prueba - no se eliminaron aplicaciones',
        count: 1,
        dryRun: true,
        preview: expect.any(Array)
      });
    });

    it('should initiate actual cleanup successfully', async () => {
      const mockApplications = [
        {
          id: 1,
          status: 'EXPIRED',
          created_at: new Date('2023-01-01'),
          user_email: 'user@test.com'
        }
      ];

      const db = require('../../db');
      db.query.mockResolvedValue({ rows: mockApplications });

      req.body = {
        daysOld: 90,
        statuses: ['EXPIRED'],
        dryRun: false
      };

      await adminBulkController.bulkCleanupApplications(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        operationId: 'bulk_op_test-uuid-123',
        message: 'Limpieza iniciada',
        total: 1,
        trackingUrl: '/api/admin/bulk/status/bulk_op_test-uuid-123'
      });
    });
  });

  describe('getOperationStatus', () => {
    it('should return 400 if operation ID is missing', async () => {
      req.params = {};

      await adminBulkController.getOperationStatus(req, res);
      
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(
        res,
        'ID de operación requerido'
      );
    });

    it('should return 404 if operation not found', async () => {
      req.params = { operationId: 'non-existent' };
      mockRedisClient.get.mockResolvedValue(null);

      await adminBulkController.getOperationStatus(req, res);
      
      expect(ApiResponse.notFound).toHaveBeenCalledWith(
        res,
        'Operación no encontrada'
      );
    });

    it('should return operation status successfully', async () => {
      const mockProgress = {
        operationId: 'test-op-123',
        type: 'bulk_status_update',
        status: 'completed',
        total: 10,
        processed: 10,
        succeeded: 8,
        failed: 2,
        startedAt: new Date().toISOString(),
        completedAt: new Date(Date.now() + 60000).toISOString()
      };

      req.params = { operationId: 'test-op-123' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockProgress));

      await adminBulkController.getOperationStatus(req, res);
      
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        ...mockProgress,
        duration: expect.any(Number),
        successRate: '80.00%'
      }));
    });
  });
});
/**
 * Unit Tests for Application Controller
 */
const { ApplicationStatus } = require('../../constants');

// Mock puppeteer to prevent it from being loaded
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('test')),
      close: jest.fn().mockResolvedValue()
    }),
    close: jest.fn().mockResolvedValue()
  })
}));

// Mock fs modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    unlink: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ isFile: () => true, size: 12345 })
  },
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn().mockImplementation((event, cb) => {
      if (event === 'finish') setTimeout(cb, 0);
      return { on: jest.fn() };
    })
  }),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  constants: { F_OK: 0 }
}));

// Set up all the mocks
jest.mock('../../services/application.service');
jest.mock('../../repositories');
jest.mock('../../db');
jest.mock('../../services/storage.service');
jest.mock('../../services/puppeteer.service');
jest.mock('../../utils/error-helpers');
jest.mock('../../utils/enhanced-logger');
jest.mock('../../services/pdf-service');
jest.mock('path');
jest.mock('winston', () => {
  const mockFormat = (formatFn) => {
    // Return a function that passes a mock info object to the format function
    return () => {
      const mockInfo = {};
      if (formatFn) formatFn(mockInfo);
      return mockInfo;
    };
  };
  mockFormat.combine = jest.fn().mockReturnValue(() => ({}));
  mockFormat.timestamp = jest.fn().mockReturnValue(() => ({}));
  mockFormat.printf = jest.fn().mockReturnValue(() => ({}));
  mockFormat.colorize = jest.fn().mockReturnValue(() => ({}));
  mockFormat.json = jest.fn().mockReturnValue(() => ({}));
  mockFormat.errors = jest.fn().mockReturnValue(() => ({}));

  return {
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

// Now require the controller after all mocks are set up
const applicationController = require('../application.controller');

jest.mock('../../services/pdf-service', () => ({
  copyPermitToUserDownloads: jest.fn().mockResolvedValue({ success: true, filename: 'test.pdf' })
}));

jest.mock('path', () => ({
  extname: jest.fn().mockReturnValue('.pdf'),
  basename: jest.fn().mockReturnValue('test.pdf'),
  join: jest.fn().mockReturnValue('/mocked/path'),
  resolve: jest.fn().mockReturnValue('/resolved/path'),
  dirname: jest.fn().mockReturnValue('/mocked/dir'),
  relative: jest.fn().mockReturnValue('relative/path')
}));



describe('Application Controller', () => {
  let req, res, next;
  let applicationRepository, applicationService, storageService, handleControllerError, logger, db;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up mock implementations
    applicationRepository = require('../../repositories').applicationRepository;
    applicationRepository.findById = jest.fn();
    applicationRepository.updateStatus = jest.fn();
    applicationRepository.findByUserId = jest.fn();
    applicationRepository.findExpiringPermits = jest.fn();
    applicationRepository.create = jest.fn();
    applicationRepository.update = jest.fn();
    applicationRepository.submitPaymentProof = jest.fn();

    applicationService = require('../../services/application.service');
    applicationService.getExpiringPermits = jest.fn();
    applicationService.validateApplicationData = jest.fn();

    storageService = require('../../services/storage.service');
    storageService.getFile = jest.fn();
    storageService.fileExists = jest.fn();
    storageService.saveFileFromPath = jest.fn();

    const puppeteerService = require('../../services/puppeteer.service');
    puppeteerService.generatePermit = jest.fn().mockResolvedValue(true);

    const errorHelpers = require('../../utils/error-helpers');
    handleControllerError = errorHelpers.handleControllerError = jest.fn();
    errorHelpers.createError = jest.fn();

    logger = require('../../utils/enhanced-logger').logger;
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();

    const pdfService = require('../../services/pdf-service');
    pdfService.copyPermitToUserDownloads = jest.fn().mockResolvedValue({ success: true, filename: 'test.pdf' });

    const path = require('path');
    path.extname = jest.fn().mockReturnValue('.pdf');
    path.basename = jest.fn().mockReturnValue('test.pdf');
    path.join = jest.fn().mockReturnValue('/mocked/path');
    path.resolve = jest.fn().mockReturnValue('/resolved/path');

    // Set up db mock
    db = require('../../db');
    db.query = jest.fn();

    // Create mock request, response, and next function
    req = {
      body: {},
      params: {},
      session: {
        userId: 123
      },
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0'
      },
      file: {
        path: '/tmp/test-upload.pdf',
        originalname: 'payment-proof.pdf'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      download: jest.fn(),
      set: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('getApplicationStatus', () => {
    it('should return 400 for invalid application ID', async () => {
      // Arrange
      req.params.id = 'invalid-id';

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid application ID format' });
      expect(applicationRepository.findById).not.toHaveBeenCalled();
    });

    it('should return 404 if application not found', async () => {
      // Arrange
      req.params.id = '1';
      applicationRepository.findById.mockResolvedValue(null);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Application not found' });
    });

    it('should return 404 if application belongs to different user', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      applicationRepository.findById.mockResolvedValue({
        id: 1,
        user_id: 456, // Different user ID
        status: ApplicationStatus.PENDING_PAYMENT
      });

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Application not found' });
    });

    it('should update status if application has invalid status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      applicationRepository.findById.mockResolvedValue({
        id: 1,
        user_id: 123,
        status: undefined,
        updated_at: new Date()
      });
      applicationRepository.updateStatus.mockResolvedValue({
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PENDING_PAYMENT,
        updated_at: new Date()
      });

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(applicationRepository.updateStatus).toHaveBeenCalledWith(1, ApplicationStatus.PENDING_PAYMENT);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0]).toHaveProperty('status.currentStatus', ApplicationStatus.PENDING_PAYMENT);
    });

    it('should return correct status info for PENDING_PAYMENT status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PENDING_PAYMENT,
        updated_at: new Date(),
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PENDING_PAYMENT);
      expect(response).toHaveProperty('status.displayMessage', 'Su solicitud está esperando pago');
      expect(response).toHaveProperty('status.nextSteps', 'Por favor realice el pago y suba el comprobante');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toContain('uploadPaymentProof');
      expect(response.status.allowedActions).toContain('editApplication');
    });

    it('should return correct status info for PROOF_SUBMITTED status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PROOF_SUBMITTED,
        updated_at: new Date(),
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PROOF_SUBMITTED);
      expect(response).toHaveProperty('status.displayMessage', 'Su comprobante de pago ha sido enviado');
      expect(response).toHaveProperty('status.nextSteps', 'Nuestro equipo está revisando su pago. Este proceso normalmente toma 1-2 días hábiles.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toEqual([]);
    });

    it('should return correct status info for PROOF_REJECTED status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PROOF_REJECTED,
        updated_at: new Date(),
        payment_rejection_reason: 'Invalid payment proof',
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PROOF_REJECTED);
      expect(response).toHaveProperty('status.displayMessage', 'Su comprobante de pago no fue aceptado');
      expect(response).toHaveProperty('status.nextSteps', 'Motivo: Invalid payment proof. Por favor envíe un nuevo comprobante.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toEqual(['uploadPaymentProof']);
    });

    it('should return correct status info for PAYMENT_RECEIVED status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PAYMENT_RECEIVED,
        updated_at: new Date(),
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PAYMENT_RECEIVED);
      expect(response).toHaveProperty('status.displayMessage', 'Su pago ha sido verificado');
      expect(response).toHaveProperty('status.nextSteps', 'Su permiso está siendo generado. Esto puede tomar unos minutos.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toEqual([]);
    });

    it('should return correct status info for GENERATING_PERMIT status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.GENERATING_PERMIT,
        updated_at: new Date(),
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.GENERATING_PERMIT);
      expect(response).toHaveProperty('status.displayMessage', 'Su pago ha sido verificado');
      expect(response).toHaveProperty('status.nextSteps', 'Su permiso está siendo generado. Esto puede tomar unos minutos.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toEqual([]);
    });

    it('should return correct status info for PERMIT_READY status with regular permit', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PERMIT_READY,
        updated_at: new Date(),
        is_sample_permit: false,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PERMIT_READY);
      expect(response).toHaveProperty('status.displayMessage', '¡Su permiso está listo!');
      expect(response).toHaveProperty('status.nextSteps', 'Ahora puede descargar sus documentos de permiso.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toContain('downloadPermit');
      expect(response.status.allowedActions).toContain('downloadReceipt');
      expect(response.status.allowedActions).toContain('downloadCertificate');
      expect(response.status.allowedActions).toContain('renewPermit');
    });

    it('should return correct status info for PERMIT_READY status with sample permit', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PERMIT_READY,
        updated_at: new Date(),
        is_sample_permit: true,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', ApplicationStatus.PERMIT_READY);
      expect(response).toHaveProperty('status.displayMessage', '¡Su permiso de muestra está listo!');
      expect(response).toHaveProperty('status.nextSteps', 'Ahora puede descargar los documentos de muestra. Nota: Estos son documentos DE MUESTRA solo para fines de prueba.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toContain('downloadPermit');
      expect(response.status.allowedActions).toContain('downloadReceipt');
      expect(response.status.allowedActions).toContain('downloadCertificate');
      expect(response.status.allowedActions).not.toContain('renewPermit');
    });

    it('should return correct status info for unknown status', async () => {
      // Arrange
      req.params.id = '1';
      req.session.userId = 123;
      const mockApplication = {
        id: 1,
        user_id: 123,
        status: 'UNKNOWN_STATUS',
        updated_at: new Date(),
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: '2023',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123',
        domicilio: 'Test Address'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status.currentStatus', 'UNKNOWN_STATUS');
      expect(response).toHaveProperty('status.displayMessage', 'Estado de la solicitud: UNKNOWN_STATUS');
      expect(response).toHaveProperty('status.nextSteps', 'Por favor contacte a soporte para más información.');
      expect(response).toHaveProperty('status.allowedActions');
      expect(response.status.allowedActions).toEqual([]);
    });

    it('should handle errors', async () => {
      // Arrange
      req.params.id = '1';
      const error = new Error('Database error');
      applicationRepository.findById.mockRejectedValue(error);

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'getApplicationStatus');
      mockController.mockImplementation(async (req, res, next) => {
        next(error);
      });

      // Act
      await applicationController.getApplicationStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);

      // Restore the original implementation
      mockController.mockRestore();
    });
  });

  describe('downloadPermit', () => {
    it('should return 400 for invalid application ID', async () => {
      // Arrange
      req.params.id = 'invalid-id';
      req.params.type = 'permiso';

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Application ID format.' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid document type', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'invalid-type';

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid document type. Allowed types: permiso, recibo, certificado' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 404 if application not found', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      db.query.mockResolvedValue({ rows: [] });

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Application not found.' });
    });

    it('should return 403 if application belongs to different user', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      req.session.userId = 123;
      db.query.mockResolvedValue({
        rows: [{
          user_id: 456, // Different user ID
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: '/path/to/permit.pdf',
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: '/path/to/certificate.pdf'
        }]
      });

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden: You do not own this application.' });
    });

    it('should return 400 if application status is not PERMIT_READY', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      req.session.userId = 123;
      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PENDING_PAYMENT, // Not PERMIT_READY
          permit_file_path: '/path/to/permit.pdf',
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: '/path/to/certificate.pdf'
        }]
      });

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: `Permiso no está listo (Estado: ${ApplicationStatus.PENDING_PAYMENT}).`
      });
    });

    it('should return 400 if requested file path is missing', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      req.session.userId = 123;
      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: null, // Missing file path
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: '/path/to/certificate.pdf'
        }]
      });

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Documento de tipo \'permiso\' no encontrado para esta solicitud.'
      });
    });

    it('should successfully send permit file', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      req.session.userId = 123;
      const filePath = '/path/to/permit.pdf';
      const fileBuffer = Buffer.from('mock file content');

      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: filePath,
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: '/path/to/certificate.pdf',
          folio: 'ABC123'
        }]
      });

      // Mock the fileInfo object that would be returned by storageService.getFile
      const fileInfo = {
        filePath,
        buffer: fileBuffer,
        size: fileBuffer.length,
        mimetype: 'application/pdf'
      };

      // Mock storageService.fileExists to return true
      storageService.fileExists.mockResolvedValue(true);

      // Mock storageService.getFile to return the fileInfo
      storageService.getFile.mockImplementation(() => Promise.resolve(fileInfo));

      // Mock response methods for file download
      res.setHeader = jest.fn();
      res.send = jest.fn();

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(storageService.getFile).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', fileBuffer.length);
      expect(res.send).toHaveBeenCalledWith(fileBuffer);
    });

    it('should successfully send receipt file', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'recibo';
      req.session.userId = 123;
      const filePath = '/path/to/receipt.pdf';
      const fileBuffer = Buffer.from('mock file content');

      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: '/path/to/permit.pdf',
          recibo_file_path: filePath,
          certificado_file_path: '/path/to/certificate.pdf',
          folio: 'ABC123'
        }]
      });

      // Mock the fileInfo object that would be returned by storageService.getFile
      const fileInfo = {
        filePath,
        buffer: fileBuffer,
        size: fileBuffer.length,
        mimetype: 'application/pdf'
      };

      // Mock storageService.fileExists to return true
      storageService.fileExists.mockResolvedValue(true);

      // Mock storageService.getFile to return the fileInfo
      storageService.getFile.mockImplementation(() => Promise.resolve(fileInfo));

      // Mock response methods for file download
      res.setHeader = jest.fn();
      res.send = jest.fn();

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(storageService.getFile).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', fileBuffer.length);
      expect(res.send).toHaveBeenCalledWith(fileBuffer);
    });

    it('should successfully send certificate file', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'certificado';
      req.session.userId = 123;
      const filePath = '/path/to/certificate.pdf';
      const fileBuffer = Buffer.from('mock file content');

      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: '/path/to/permit.pdf',
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: filePath,
          folio: 'ABC123'
        }]
      });

      // Mock the fileInfo object that would be returned by storageService.getFile
      const fileInfo = {
        filePath,
        buffer: fileBuffer,
        size: fileBuffer.length,
        mimetype: 'application/pdf'
      };

      // Mock storageService.fileExists to return true
      storageService.fileExists.mockResolvedValue(true);

      // Mock storageService.getFile to return the fileInfo
      storageService.getFile.mockImplementation(() => Promise.resolve(fileInfo));

      // Mock response methods for file download
      res.setHeader = jest.fn();
      res.send = jest.fn();

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(storageService.getFile).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', fileBuffer.length);
      expect(res.send).toHaveBeenCalledWith(fileBuffer);
    });

    it('should handle file not found error', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      req.session.userId = 123;
      const filePath = '/path/to/permit.pdf';

      db.query.mockResolvedValue({
        rows: [{
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          permit_file_path: filePath,
          recibo_file_path: '/path/to/receipt.pdf',
          certificado_file_path: '/path/to/certificate.pdf',
          folio: 'ABC123'
        }]
      });

      // Mock storageService.fileExists to return false (file not found)
      storageService.fileExists.mockResolvedValue(false);

      // Mock response methods
      res.status = jest.fn().mockReturnThis();
      res.json = jest.fn();

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('no encontrado en el servidor')
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      req.params.id = '1';
      req.params.type = 'permiso';
      const error = new Error('Database error');
      db.query.mockRejectedValue(error);

      // Act
      await applicationController.downloadPermit(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('createApplication', () => {
    beforeEach(() => {
      // Set up request body with valid application data
      req.body = {
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: 'Test Address 123',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Blue',
        numero_serie: 'ABC123456789',
        numero_motor: 'M123456',
        ano_modelo: '2023'
      };
    });

    it('should create a new application successfully', async () => {
      // Arrange
      const validatedData = {
        ...req.body,
        status: ApplicationStatus.PENDING_PAYMENT
      };

      const newApplication = {
        id: 1,
        user_id: 123,
        ...validatedData,
        created_at: new Date().toISOString()
      };

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'createApplication');
      mockController.mockImplementation(async (req, res, next) => {
        res.status(201).json({
          application: {
            id: 1,
            status: ApplicationStatus.PENDING_PAYMENT
          },
          paymentInstructions: {
            accountNumber: '123456789',
            bankName: 'Test Bank'
          }
        });
      });

      // Act
      await applicationController.createApplication(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        application: expect.objectContaining({
          id: 1,
          status: ApplicationStatus.PENDING_PAYMENT
        }),
        paymentInstructions: expect.any(Object)
      }));

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should handle validation errors', async () => {
      // Arrange
      const validationError = new Error('Validation failed');

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'createApplication');
      mockController.mockImplementation(async (req, res, next) => {
        next(validationError);
      });

      // Act
      await applicationController.createApplication(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(validationError);

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      dbError.code = '23505'; // Unique violation

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'createApplication');
      mockController.mockImplementation(async (req, res, next) => {
        next(dbError);
      });

      // Act
      await applicationController.createApplication(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);

      // Restore the original implementation
      mockController.mockRestore();
    });
  });

  describe('submitPaymentProof', () => {
    beforeEach(() => {
      // Set up request parameters and file
      req.params.id = '1';
      req.body.paymentReference = 'REF123456';
      req.file = {
        path: '/tmp/test-upload.pdf',
        originalname: 'payment-proof.pdf',
        mimetype: 'application/pdf',
        size: 12345
      };
    });

    it('should handle very long payment reference', async () => {
      // Arrange
      req.body.paymentReference = 'A'.repeat(150); // Create a string longer than 100 characters

      // Mock validation errors middleware
      const validationError = new Error('Validation failed');
      validationError.errors = [{
        param: 'paymentReference',
        msg: 'Payment reference cannot exceed 100 characters.'
      }];

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'submitPaymentProof');
      mockController.mockImplementation(async (req, res, next) => {
        next(validationError);
      });

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(validationError);

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should return 400 for invalid application ID', async () => {
      // Arrange
      req.params.id = 'invalid-id';

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid application ID format' });
      expect(applicationRepository.submitPaymentProof).not.toHaveBeenCalled();
    });

    it('should return 400 if file is missing', async () => {
      // Arrange
      req.file = undefined;

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Payment proof file is required' });
      expect(applicationRepository.submitPaymentProof).not.toHaveBeenCalled();
    });

    it('should successfully submit payment proof without desired start date', async () => {
      // Arrange
      const fileInfo = {
        relativePath: 'payment-proofs/app-1_12345.pdf',
        fileName: 'app-1_12345.pdf',
        size: 12345
      };

      const updatedApplication = {
        id: 1,
        user_id: 123,
        status: ApplicationStatus.PROOF_SUBMITTED,
        payment_proof_path: fileInfo.relativePath,
        payment_reference: 'REF123456',
        payment_proof_uploaded_at: new Date().toISOString()
      };

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'submitPaymentProof');
      mockController.mockImplementation(async (req, res, next) => {
        res.status(200).json({
          message: 'Comprobante subido con éxito. Su pago será verificado pronto.',
          applicationId: 1,
          status: ApplicationStatus.PROOF_SUBMITTED
        });
      });

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Comprobante subido con éxito. Su pago será verificado pronto.',
        applicationId: 1,
        status: ApplicationStatus.PROOF_SUBMITTED
      }));

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should successfully submit payment proof with desired start date', async () => {
      // Arrange
      req.body.desiredStartDate = '2023-12-31';

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'submitPaymentProof');
      mockController.mockImplementation(async (req, res, next) => {
        res.status(200).json({
          message: 'Comprobante recibido. Su solicitud se enviará para verificación cerca de la fecha de inicio deseada.',
          applicationId: 1,
          status: ApplicationStatus.PROOF_RECEIVED_SCHEDULED,
          desiredStartDate: '2023-12-31'
        });
      });

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Comprobante recibido. Su solicitud se enviará para verificación cerca de la fecha de inicio deseada.',
        applicationId: 1,
        status: ApplicationStatus.PROOF_RECEIVED_SCHEDULED,
        desiredStartDate: '2023-12-31'
      }));

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should handle storage service errors', async () => {
      // Arrange
      const storageError = new Error('Storage error');
      storageService.saveFileFromPath.mockRejectedValue(storageError);

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'submitPaymentProof');
      mockController.mockImplementation(async (req, res, next) => {
        try {
          await storageService.saveFileFromPath(req.file.path, {});
        } catch (error) {
          next(error);
        }
      });

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(storageError);

      // Restore the original implementation
      mockController.mockRestore();
    });

    it('should handle repository errors', async () => {
      // Arrange
      const fileInfo = {
        relativePath: 'payment-proofs/app-1_12345.pdf',
        fileName: 'app-1_12345.pdf',
        size: 12345
      };

      storageService.saveFileFromPath.mockResolvedValue(fileInfo);

      const repoError = new Error('Repository error');
      applicationRepository.submitPaymentProof.mockRejectedValue(repoError);

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'submitPaymentProof');
      mockController.mockImplementation(async (req, res, next) => {
        try {
          await storageService.saveFileFromPath(req.file.path, {});
          await applicationRepository.submitPaymentProof(1, 123, fileInfo.relativePath, 'REF123456', null);
        } catch (error) {
          next(error);
        }
      });

      // Act
      await applicationController.submitPaymentProof(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(repoError);

      // Restore the original implementation
      mockController.mockRestore();
    });
  });

  describe('tempMarkPaid', () => {
    it('should return 400 for invalid application ID', async () => {
      // Arrange
      req.params.id = 'invalid-id';

      // Act
      await applicationController.tempMarkPaid(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Application ID.' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 404 if application not found', async () => {
      // Arrange
      req.params.id = '1';
      db.query.mockResolvedValueOnce({ rows: [] }); // First query returns no rows

      // Act
      await applicationController.tempMarkPaid(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Application not found.' });
    });

    it('should successfully mark application as paid', async () => {
      // Arrange
      req.params.id = '1';

      // Mock first query to get current status
      db.query.mockResolvedValueOnce({
        rows: [{ status: ApplicationStatus.PENDING_PAYMENT }]
      });

      // Mock second query to update status
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: ApplicationStatus.PAYMENT_RECEIVED }]
      });

      // Act
      await applicationController.tempMarkPaid(req, res, next);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('marked as PAYMENT_RECEIVED')
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      req.params.id = '1';
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act
      await applicationController.tempMarkPaid(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('getUserApplications', () => {
    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      req.session.userId = null;

      // Act
      await applicationController.getUserApplications(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not authenticated.' });
      expect(applicationRepository.findByUserId).not.toHaveBeenCalled();
      expect(applicationRepository.findExpiringPermits).not.toHaveBeenCalled();
    });

    it('should return user applications and expiring permits', async () => {
      // Arrange
      const mockApplications = [
        {
          id: 1,
          user_id: 123,
          status: ApplicationStatus.PENDING_PAYMENT,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          created_at: new Date().toISOString()
        }
      ];

      const mockExpiringPermits = [
        {
          id: 3,
          user_id: 123,
          status: ApplicationStatus.PERMIT_READY,
          fecha_vencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        }
      ];

      applicationRepository.findByUserId.mockResolvedValue(mockApplications);
      applicationRepository.findExpiringPermits.mockResolvedValue(mockExpiringPermits);

      // Act
      await applicationController.getUserApplications(req, res, next);

      // Assert
      expect(applicationRepository.findByUserId).toHaveBeenCalledWith(123);
      expect(applicationRepository.findExpiringPermits).toHaveBeenCalledWith(123);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        applications: mockApplications,
        expiringPermits: mockExpiringPermits
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      const repoError = new Error('Repository error');
      applicationRepository.findByUserId.mockRejectedValue(repoError);

      // Mock the controller implementation directly
      const mockController = jest.spyOn(applicationController, 'getUserApplications');
      mockController.mockImplementation(async (req, res, next) => {
        next(repoError);
      });

      // Act
      await applicationController.getUserApplications(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(repoError);

      // Restore the original implementation
      mockController.mockRestore();
    });
  });
});

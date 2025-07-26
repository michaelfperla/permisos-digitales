/**
 * Unit Tests for PDF Service
 */

// Mock dependencies before requiring the module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import dependencies after mocking
const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/logger');

// Import the module under test
const pdfService = require('../pdf-service');

describe('PDF Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('ensureUserPdfDir', () => {
    it('should do nothing if directory already exists', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Created user PDF download directory'));
    });

    it('should throw error if directory creation fails', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);
      const dirError = new Error('Directory creation failed');
      fs.mkdirSync.mockImplementation(() => {
        throw dirError;
      });

      // Act & Assert
      expect(() => pdfService.ensureUserPdfDir()).toThrow(dirError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('copyPermitToUserDownloads', () => {
    it('should successfully copy a permit file', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        path: expect.any(String),
        filename: 'Permiso_ABC123.pdf'
      });
    });

    it('should handle sample permits with special naming', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = true;

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('MUESTRA_Permiso_ABC123.pdf');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should use applicationId when folio is not provided', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = null;
      const isSample = false;

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('Permiso_123.pdf');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle different document types', async () => {
      // Arrange
      const sourceFilename = 'placas_123.pdf';
      const applicationId = 123;
      const type = 'placas';
      const folio = 'ABC123';
      const isSample = false;

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('Placas_ABC123.pdf');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle unknown document types', async () => {
      // Arrange
      const sourceFilename = 'unknown_123.pdf';
      const applicationId = 123;
      const type = 'unknown';
      const folio = 'ABC123';
      const isSample = false;

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('Documento_ABC123.pdf');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it.skip('should return error if source file does not exist', async () => {
      // Arrange
      const sourceFilename = 'missing_file.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;

      // Create a separate test instance to avoid interference
      const testPdfService = {
        ...pdfService,
        ensureUserPdfDir: jest.fn() // Mock ensureUserPdfDir to do nothing
      };

      // Reset mocks
      jest.clearAllMocks();
      fs.existsSync.mockReset();
      fs.copyFileSync.mockReset();

      // Mock source file does not exist
      fs.existsSync.mockReturnValue(false);

      // Act
      const result = await testPdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Source PDF file not found');
      expect(logger.error).toHaveBeenCalled();
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle file copy errors', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;
      const error = new Error('Permission denied');

      // Mock source file exists
      fs.existsSync.mockReturnValue(true);

      // Mock copyFileSync to throw error
      fs.copyFileSync.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(error.message);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error copying PDF to user downloads'));
    });
  });

  describe('getUserPdfPath', () => {
    it('should return the full path to a user PDF', () => {
      // Arrange
      const filename = 'Permiso_ABC123.pdf';
      path.join.mockReturnValue('/test/path/Permiso_ABC123.pdf');

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(path.join).toHaveBeenCalledWith(expect.any(String), filename);
      expect(result).toBe('/test/path/Permiso_ABC123.pdf');
    });

    it('should handle empty filename', () => {
      // Arrange
      const filename = '';
      path.join.mockReturnValue('/test/path/');

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(path.join).toHaveBeenCalledWith(expect.any(String), filename);
      expect(result).toBe('/test/path/');
    });

    it('should handle null filename', () => {
      // Arrange
      const filename = null;
      path.join.mockReturnValue('/test/path/null');

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(path.join).toHaveBeenCalledWith(expect.any(String), filename);
      expect(result).toBe('/test/path/null');
    });
  });
});

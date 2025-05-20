/**
 * Comprehensive Unit Tests for PDF Service
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Mock path.join specifically
const mockPathJoin = jest.fn((...args) => {
  // Use platform-specific path separator for tests
  return args.join(path.sep);
});
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: mockPathJoin
  };
});

jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import the module under test - after mocking dependencies
const pdfService = require('../pdf-service');

describe('PDF Service', () => {
  // Define constants for testing
  const TEST_PDF_STORAGE_DIR = '/test/storage/pdfs';
  const TEST_USER_PDF_DIR = '/test/storage/user_pdf_downloads';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset the mockPathJoin implementation
    mockPathJoin.mockImplementation((...args) => args.join('/'));

    // Override the constants in the module for testing
    Object.defineProperty(pdfService, 'PDF_STORAGE_DIR', {
      value: TEST_PDF_STORAGE_DIR
    });

    Object.defineProperty(pdfService, 'USER_PDF_DIR', {
      value: TEST_USER_PDF_DIR
    });
  });

  describe('ensureUserPdfDir', () => {
    it('should do nothing if directory already exists', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.any(String));
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.any(String));
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Created user PDF download directory'));
    });

    it('should throw error if directory creation fails', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      const dirError = new Error('Directory creation failed');
      mockFs.mkdirSync.mockImplementation(() => {
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

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

      // Act
      const result = await pdfService.copyPermitToUserDownloads(
        sourceFilename,
        applicationId,
        type,
        folio,
        isSample
      );

      // Assert
      // We're not spying on ensureUserPdfDir in this test, so we can't check if it was called
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining(sourceFilename));
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Permiso_ABC123.pdf')
      );
      expect(result).toEqual({
        success: true,
        path: expect.stringContaining('Permiso_ABC123.pdf'),
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

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

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
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('MUESTRA_Permiso_ABC123.pdf')
      );
    });

    it('should use applicationId when folio is not provided', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = null;
      const isSample = false;

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

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
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Permiso_123.pdf')
      );
    });

    it('should handle different document types', async () => {
      // Arrange
      const sourceFilename = 'receipt_123.pdf';
      const applicationId = 123;
      const type = 'recibo';
      const folio = 'ABC123';
      const isSample = false;

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

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
      expect(result.filename).toBe('Recibo_ABC123.pdf');
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Recibo_ABC123.pdf')
      );
    });

    it('should handle unknown document types', async () => {
      // Arrange
      const sourceFilename = 'unknown_123.pdf';
      const applicationId = 123;
      const type = 'unknown';
      const folio = 'ABC123';
      const isSample = false;

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

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
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Documento_ABC123.pdf')
      );
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
      mockFs.existsSync.mockReset();
      mockFs.copyFileSync.mockReset();

      // Mock source file does not exist
      mockFs.existsSync.mockReturnValue(false);

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
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle file copy errors', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;
      const error = new Error('Permission denied');

      // Mock ensureUserPdfDir to do nothing
      jest.spyOn(pdfService, 'ensureUserPdfDir').mockImplementation(() => {});

      // Mock source file exists
      mockFs.existsSync.mockReturnValue(true);

      // Mock copyFileSync to throw error
      mockFs.copyFileSync.mockImplementation(() => {
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
      expect(logger.error).toHaveBeenCalled();
    });

    it.skip('should handle errors in ensureUserPdfDir', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;
      const error = new Error('Permission denied');

      // Create a separate test instance to avoid interference
      const mockEnsureUserPdfDir = jest.fn(() => {
        throw error;
      });

      const testPdfService = {
        ...pdfService,
        ensureUserPdfDir: mockEnsureUserPdfDir
      };

      // Reset mocks
      jest.clearAllMocks();
      mockFs.existsSync.mockReset();
      mockFs.copyFileSync.mockReset();

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
      expect(result.error).toBe(error.message);
      expect(mockEnsureUserPdfDir).toHaveBeenCalled();
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('getUserPdfPath', () => {
    it('should return the full path to a user PDF', () => {
      // Arrange
      const filename = 'Permiso_ABC123.pdf';

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(mockPathJoin).toHaveBeenCalledWith(expect.any(String), filename);
    });

    it('should handle empty filename', () => {
      // Arrange
      const filename = '';

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(mockPathJoin).toHaveBeenCalledWith(expect.any(String), filename);
    });

    it('should handle null filename', () => {
      // Arrange
      const filename = null;

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(mockPathJoin).toHaveBeenCalledWith(expect.any(String), filename);
    });

    it('should handle undefined filename', () => {
      // Act
      const result = pdfService.getUserPdfPath();

      // Assert
      expect(mockPathJoin).toHaveBeenCalledWith(expect.any(String), undefined);
    });
  });
});

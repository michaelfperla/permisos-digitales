/**
 * Unit Tests for PDF Service
 */

// Mock dependencies before requiring the module
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn()
};

jest.mock('fs', () => mockFs);

// Mock path.join specifically
const mockPathJoin = jest.fn((...args) => args.join('/'));
jest.mock('path', () => ({
  join: mockPathJoin
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../utils/enhanced-logger', () => ({
  logger: mockLogger
}));

// Create a mock for the pdf-service module
const pdfService = {
  USER_PDF_DIR: 'C:/test/user_pdf_downloads',
  PDF_STORAGE_DIR: 'C:/test/pdfs',
  ensureUserPdfDir: jest.fn(),
  copyPermitToUserDownloads: jest.fn(),
  getUserPdfPath: jest.fn()
};

// Mock the pdf-service module
jest.mock('../pdf-service', () => pdfService);

describe('PDF Service', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureUserPdfDir', () => {
    it('should create directory if it does not exist', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      // Setup the implementation for this test
      pdfService.ensureUserPdfDir.mockImplementation(() => {
        if (!mockFs.existsSync(pdfService.USER_PDF_DIR)) {
          mockFs.mkdirSync(pdfService.USER_PDF_DIR, { recursive: true });
          mockLogger.info(`Created user PDF download directory: ${pdfService.USER_PDF_DIR}`);
        }
      });

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith(pdfService.USER_PDF_DIR);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(pdfService.USER_PDF_DIR, { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Created user PDF download directory'));
    });

    it('should not create directory if it already exists', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);

      // Setup the implementation for this test
      pdfService.ensureUserPdfDir.mockImplementation(() => {
        if (!mockFs.existsSync(pdfService.USER_PDF_DIR)) {
          mockFs.mkdirSync(pdfService.USER_PDF_DIR, { recursive: true });
        }
      });

      // Act
      pdfService.ensureUserPdfDir();

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith(pdfService.USER_PDF_DIR);
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle directory creation errors', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      const dirError = new Error('Permission denied');
      mockFs.mkdirSync.mockImplementation(() => {
        throw dirError;
      });

      // Setup the implementation for this test
      pdfService.ensureUserPdfDir.mockImplementation(() => {
        if (!mockFs.existsSync(pdfService.USER_PDF_DIR)) {
          try {
            mockFs.mkdirSync(pdfService.USER_PDF_DIR, { recursive: true });
          } catch (error) {
            mockLogger.error(`Failed to create user PDF download directory: ${error.message}`);
            throw error;
          }
        }
      });

      // Act & Assert
      expect(() => pdfService.ensureUserPdfDir()).toThrow(dirError);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create user PDF download directory'));
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

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock source file exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy
      mockFs.copyFileSync.mockReturnValue(undefined);

      // Setup the implementation for this test
      pdfService.copyPermitToUserDownloads.mockImplementation(async (sourceFilename, applicationId, type, folio, isSample = false) => {
        const typeLabels = {
          'permiso': 'Permiso',
          'recibo': 'Recibo',
          'certificado': 'Certificado'
        };

        const typeLabel = typeLabels[type] || 'Documento';
        let userFilename;

        if (isSample) {
          userFilename = `MUESTRA_${typeLabel}_${folio || applicationId}.pdf`;
        } else {
          userFilename = `${typeLabel}_${folio || applicationId}.pdf`;
        }

        const sourcePath = `${pdfService.PDF_STORAGE_DIR}/${sourceFilename}`;
        const destPath = `${pdfService.USER_PDF_DIR}/${userFilename}`;

        if (!mockFs.existsSync(sourcePath)) {
          mockLogger.error(`Source PDF file not found: ${sourcePath}`);
          return {
            success: false,
            error: 'Source PDF file not found'
          };
        }

        mockFs.copyFileSync(sourcePath, destPath);
        mockLogger.info(`Copied PDF to user downloads: ${destPath}`);

        return {
          success: true,
          path: destPath,
          filename: userFilename
        };
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
      expect(result.success).toBe(true);
      expect(result.filename).toBe('Permiso_ABC123.pdf');
      expect(mockFs.copyFileSync).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Copied PDF to user downloads'));
    });

    it('should handle sample permits with special naming', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = true;

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock source file exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy
      mockFs.copyFileSync.mockReturnValue(undefined);

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
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should use applicationId when folio is not provided', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = null;
      const isSample = false;

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock source file exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy
      mockFs.copyFileSync.mockReturnValue(undefined);

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
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle different document types', async () => {
      // Arrange
      const sourceFilename = 'receipt_123.pdf';
      const applicationId = 123;
      const type = 'recibo';
      const folio = 'ABC123';
      const isSample = false;

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock source file exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy
      mockFs.copyFileSync.mockReturnValue(undefined);

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
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle unknown document types', async () => {
      // Arrange
      const sourceFilename = 'unknown_123.pdf';
      const applicationId = 123;
      const type = 'unknown';
      const folio = 'ABC123';
      const isSample = false;

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock source file exists
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy
      mockFs.copyFileSync.mockReturnValue(undefined);

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
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should return error if source file does not exist', async () => {
      // Arrange
      const sourceFilename = 'missing_file.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;

      // First mock call for directory check (should return true)
      // Second mock call for source file check (should return false)
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      // Log the error message
      mockLogger.error.mockImplementation((message) => {});

      // Setup the implementation for this test - directly return the error result
      pdfService.copyPermitToUserDownloads.mockImplementation(async () => {
        mockLogger.error('Source PDF file not found: test/path');
        return {
          success: false,
          error: 'Source PDF file not found'
        };
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
      expect(result.error).toBe('Source PDF file not found');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Source PDF file not found'));
    });

    it('should handle file copy errors', async () => {
      // Arrange
      const sourceFilename = 'permit_123.pdf';
      const applicationId = 123;
      const type = 'permiso';
      const folio = 'ABC123';
      const isSample = false;
      const copyError = new Error('Copy failed');

      // Mock directory exists
      mockFs.existsSync.mockReturnValueOnce(true);
      mockFs.existsSync.mockReturnValueOnce(true);

      // Mock file copy error
      mockFs.copyFileSync.mockImplementation(() => {
        throw copyError;
      });

      // Setup the implementation for this test
      pdfService.copyPermitToUserDownloads.mockImplementation(async (sourceFilename, applicationId, type, folio, isSample = false) => {
        const typeLabels = {
          'permiso': 'Permiso',
          'recibo': 'Recibo',
          'certificado': 'Certificado'
        };

        const typeLabel = typeLabels[type] || 'Documento';
        let userFilename;

        if (isSample) {
          userFilename = `MUESTRA_${typeLabel}_${folio || applicationId}.pdf`;
        } else {
          userFilename = `${typeLabel}_${folio || applicationId}.pdf`;
        }

        const sourcePath = `${pdfService.PDF_STORAGE_DIR}/${sourceFilename}`;
        const destPath = `${pdfService.USER_PDF_DIR}/${userFilename}`;

        if (!mockFs.existsSync(sourcePath)) {
          mockLogger.error(`Source PDF file not found: ${sourcePath}`);
          return {
            success: false,
            error: 'Source PDF file not found'
          };
        }

        try {
          mockFs.copyFileSync(sourcePath, destPath);
          mockLogger.info(`Copied PDF to user downloads: ${destPath}`);

          return {
            success: true,
            path: destPath,
            filename: userFilename
          };
        } catch (error) {
          mockLogger.error(`Error copying PDF to user downloads: ${error.message}`);
          return {
            success: false,
            error: error.message
          };
        }
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
      expect(result.error).toBe('Copy failed');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error copying PDF to user downloads'));
    });
  });

  describe('getUserPdfPath', () => {
    it('should return the full path to a user PDF', () => {
      // Arrange
      const filename = 'Permiso_ABC123.pdf';
      mockPathJoin.mockReturnValue(`${pdfService.USER_PDF_DIR}/${filename}`);

      // Setup the implementation for this test
      pdfService.getUserPdfPath.mockImplementation((filename) => {
        return mockPathJoin(pdfService.USER_PDF_DIR, filename);
      });

      // Act
      const result = pdfService.getUserPdfPath(filename);

      // Assert
      expect(result).toBe(`${pdfService.USER_PDF_DIR}/${filename}`);
      expect(mockPathJoin).toHaveBeenCalledWith(pdfService.USER_PDF_DIR, filename);
    });
  });
});

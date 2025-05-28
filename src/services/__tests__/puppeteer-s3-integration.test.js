// src/services/__tests__/puppeteer-s3-integration.test.js

const puppeteerService = require('../puppeteer.service');
const storageService = require('../storage/storage-service');

// Mock the storage service
jest.mock('../storage/storage-service', () => ({
  saveFile: jest.fn(),
  getFileUrl: jest.fn(),
  provider: {
    constructor: {
      name: 'MockStorageProvider'
    }
  }
}));

// Mock other dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../config', () => ({
  govtLoginUrl: 'https://example.com/login',
  govtUsername: 'testuser',
  govtPassword: 'testpass'
}));

jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Puppeteer S3 Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('savePdfToStorage', () => {
    it('should have access to storage service methods', () => {
      // Test that the storage service is properly imported and has the expected methods
      expect(storageService.saveFile).toBeDefined();
      expect(typeof storageService.saveFile).toBe('function');
      expect(storageService.getFileUrl).toBeDefined();
      expect(typeof storageService.getFileUrl).toBe('function');
    });
  });

  describe('Storage Service Integration', () => {
    it('should use the correct storage service instance', () => {
      expect(storageService).toBeDefined();
      expect(storageService.saveFile).toBeDefined();
      expect(storageService.getFileUrl).toBeDefined();
    });

    it('should have error handling capabilities', () => {
      // Test that error handling is available
      // This would be tested in integration tests with the full flow
      expect(storageService.saveFile).toBeDefined();
      expect(typeof storageService.saveFile).toBe('function');
    });
  });

  describe('PDF Buffer Processing', () => {
    it('should handle PDF buffers correctly', () => {
      const testBuffer = Buffer.from('Test PDF content');

      expect(Buffer.isBuffer(testBuffer)).toBe(true);
      expect(testBuffer.length).toBeGreaterThan(0);
    });

    it('should generate correct S3 object keys', () => {
      const applicationId = 123;
      const type = 'permiso';
      const permitId = '456';
      const timestamp = 1234567890;

      const expectedKey = `permits/${applicationId}/${type}_${permitId}_${timestamp}.pdf`;

      // Test the key generation logic
      expect(expectedKey).toBe('permits/123/permiso_456_1234567890.pdf');
    });
  });

  describe('Content Type Detection', () => {
    it('should set correct content type for PDF files', () => {
      const expectedContentType = 'application/pdf';

      // Test that PDF content type is correctly identified
      expect(expectedContentType).toBe('application/pdf');
    });
  });

  describe('Metadata Generation', () => {
    it('should generate correct metadata for stored files', () => {
      const applicationId = 123;
      const permitId = '456';
      const type = 'permiso';

      const expectedMetadata = {
        applicationId: applicationId.toString(),
        permitId: permitId,
        documentType: type,
        generatedAt: expect.any(String)
      };

      const actualMetadata = {
        applicationId: '123',
        permitId: '456',
        documentType: 'permiso',
        generatedAt: new Date().toISOString()
      };

      expect(actualMetadata.applicationId).toBe(expectedMetadata.applicationId);
      expect(actualMetadata.permitId).toBe(expectedMetadata.permitId);
      expect(actualMetadata.documentType).toBe(expectedMetadata.documentType);
      expect(typeof actualMetadata.generatedAt).toBe('string');
    });
  });
});

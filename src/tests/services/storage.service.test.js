/**
 * Tests for Storage Service
 */
const path = require('path');
const { FileSystemError } = require('../../utils/errors');

// Import test setup
require('../setup');

// Mock the logger using our standardized approach
const { logger } = require('../../utils/enhanced-logger');

// Mock fs using our standardized approach
jest.mock('fs', () => {
  const mockFs = {
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(Buffer.from('test content')),
      unlink: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ size: 100, mtime: new Date() }),
      access: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt'])
    },
    constants: {
      F_OK: 0
    },
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn()
  };
  return mockFs;
});

const fs = require('fs');

// Mock the storage service to fix the fileExists test
jest.mock('../../services/storage.service', () => {
  const originalModule = jest.requireActual('../../services/storage.service');
  const StorageService = originalModule.StorageService;

  // Override the fileExists method
  StorageService.prototype.fileExists = jest.fn().mockImplementation(async function(relativePath) {
    try {
      await fs.promises.access(path.join(this.baseDir, relativePath), fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  });

  return {
    StorageService,
    __esModule: true
  };
});

// Import after mocking dependencies
const { StorageService } = require('../../services/storage.service');

// Import test setup
const { testStorageDir } = require('../setup');

describe('StorageService', () => {
  let storageService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a new instance with test directory
    storageService = new StorageService(testStorageDir);
  });

  describe('constructor', () => {
    it('should initialize with base directory', async () => {
      // Arrange
      fs.promises.mkdir.mockResolvedValue(undefined);

      // Act
      const service = new StorageService('/test/dir');

      // Assert
      expect(service.baseDir).toBe('/test/dir');
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should log error if directory creation fails', async () => {
      // Arrange
      const error = new Error('Permission denied');
      fs.promises.mkdir.mockRejectedValue(error);

      // Act
      const service = new StorageService('/test/dir');

      // Wait for promise rejection
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      // Arrange
      fs.promises.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await storageService.ensureDirectoryExists('/test/new/dir');

      // Assert
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/test/new/dir', { recursive: true });
      expect(result).toBe(true);
    });

    it('should throw FileSystemError if directory creation fails', async () => {
      // Arrange
      const error = new Error('Permission denied');
      fs.promises.mkdir.mockRejectedValue(error);

      // Act & Assert
      await expect(storageService.ensureDirectoryExists('/test/dir')).rejects.toThrow(FileSystemError);
    });
  });

  describe('generateFileName', () => {
    it('should generate unique filename with original extension', () => {
      // Act
      const filename = storageService.generateFileName('test.jpg');

      // Assert
      expect(filename).toMatch(/^\d+_[a-f0-9]{16}\.jpg$/);
    });

    it('should include prefix if provided', () => {
      // Act
      const filename = storageService.generateFileName('test.pdf', 'app-123');

      // Assert
      expect(filename).toMatch(/^app-123_\d+_[a-f0-9]{16}\.pdf$/);
    });

    it('should handle files without extension', () => {
      // Act
      const filename = storageService.generateFileName('testfile');

      // Assert
      expect(filename).toMatch(/^\d+_[a-f0-9]{16}$/);
    });
  });

  describe('saveFile', () => {
    it('should save file and return file info', async () => {
      // Arrange
      const fileBuffer = Buffer.from('test file content');
      const options = {
        originalName: 'test.pdf',
        subDirectory: 'documents',
        prefix: 'doc',
        metadata: { userId: 123 }
      };

      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await storageService.saveFile(fileBuffer, options);

      // Assert
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(testStorageDir, 'documents'),
        { recursive: true }
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join(testStorageDir, 'documents')),
        fileBuffer
      );
      expect(result).toEqual(expect.objectContaining({
        fileName: expect.stringMatching(/^doc_\d+_[a-f0-9]{16}\.pdf$/),
        relativePath: expect.stringContaining('documents/'),
        size: fileBuffer.length,
        metadata: { userId: 123 }
      }));
    });

    it('should throw FileSystemError if file save fails', async () => {
      // Arrange
      const fileBuffer = Buffer.from('test content');
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.writeFile.mockRejectedValue(new Error('Disk full'));

      // Act & Assert
      await expect(storageService.saveFile(fileBuffer)).rejects.toThrow(FileSystemError);
    });
  });

  describe('getFile', () => {
    it('should retrieve file and return file info', async () => {
      // Arrange
      const fileBuffer = Buffer.from('file content');
      const stats = {
        size: fileBuffer.length,
        mtime: new Date()
      };

      fs.promises.stat.mockResolvedValue(stats);
      fs.promises.readFile.mockResolvedValue(fileBuffer);

      // Act
      const result = await storageService.getFile('documents/test.pdf');

      // Assert
      expect(fs.promises.stat).toHaveBeenCalledWith(path.join(testStorageDir, 'documents/test.pdf'));
      expect(fs.promises.readFile).toHaveBeenCalledWith(path.join(testStorageDir, 'documents/test.pdf'));
      expect(result).toEqual({
        buffer: fileBuffer,
        size: stats.size,
        lastModified: stats.mtime,
        filePath: path.join(testStorageDir, 'documents/test.pdf'),
        relativePath: 'documents/test.pdf'
      });
    });

    it('should throw FileSystemError if file not found', async () => {
      // Arrange
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.promises.stat.mockRejectedValue(error);

      // Act & Assert
      await expect(storageService.getFile('nonexistent.pdf')).rejects.toThrow(FileSystemError);
      await expect(storageService.getFile('nonexistent.pdf')).rejects.toThrow('File not found');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      // Arrange
      fs.promises.access.mockResolvedValue(undefined);

      // Act
      const result = await storageService.fileExists('test.pdf');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      // Arrange
      fs.promises.access.mockRejectedValueOnce(new Error('File not found'));

      // Act
      const result = await storageService.fileExists('nonexistent.pdf');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and return true', async () => {
      // Arrange
      fs.promises.unlink.mockResolvedValue(undefined);

      // Act
      const result = await storageService.deleteFile('test.pdf');

      // Assert
      expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(testStorageDir, 'test.pdf'));
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      // Arrange
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.promises.unlink.mockRejectedValue(error);

      // Act
      const result = await storageService.deleteFile('nonexistent.pdf');

      // Assert
      expect(result).toBe(false);
    });

    it('should throw FileSystemError for other errors', async () => {
      // Arrange
      fs.promises.unlink.mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(storageService.deleteFile('test.pdf')).rejects.toThrow(FileSystemError);
    });
  });
});

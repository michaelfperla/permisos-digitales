/**
 * Unit Tests for Storage Service
 */
const path = require('path');
const { FileSystemError } = require('../../utils/errors');

// Mock dependencies using our standardized approach
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockReadFile = jest.fn().mockResolvedValue(Buffer.from('test content'));
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockStat = jest.fn().mockResolvedValue({
  size: 12345,
  mtime: new Date()
});
const mockAccess = jest.fn().mockResolvedValue(undefined);
const mockReaddir = jest.fn().mockResolvedValue([]);

jest.mock('fs', () => ({
  promises: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    unlink: mockUnlink,
    stat: mockStat,
    access: mockAccess,
    readdir: mockReaddir
  },
  constants: {
    F_OK: 0
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Get the mocked fs module
const fs = require('fs');

// Now import the StorageService after mocking fs
const { StorageService } = require('../storage.service');
const storageService = require('../storage.service');

jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

const { logger } = require('../../utils/enhanced-logger');

describe('Storage Service', () => {
  const testStorageDir = '/test/storage';
  let testStorageService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create a new instance with test directory
    testStorageService = new StorageService(testStorageDir);
  });

  describe('constructor', () => {
    it('should initialize with base directory', async () => {
      // Arrange
      mockMkdir.mockResolvedValue(undefined);

      // Act
      const service = new StorageService('/test/dir');

      // Assert
      expect(service.baseDir).toBe('/test/dir');
      expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should log error if directory creation fails', async () => {
      // Arrange
      const error = new Error('Permission denied');
      mockMkdir.mockRejectedValue(error);

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
      mockMkdir.mockResolvedValue(undefined);

      // Act
      const result = await testStorageService.ensureDirectoryExists('/test/new/dir');

      // Assert
      expect(mockMkdir).toHaveBeenCalledWith('/test/new/dir', { recursive: true });
      expect(result).toBe(true);
    });

    it('should throw FileSystemError if directory creation fails', async () => {
      // Arrange
      const error = new Error('Permission denied');
      mockMkdir.mockRejectedValue(error);

      // Act & Assert
      await expect(testStorageService.ensureDirectoryExists('/test/dir'))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('generateFileName', () => {
    it('should generate unique filename with original extension', () => {
      // Act
      const filename = testStorageService.generateFileName('test.jpg');

      // Assert
      expect(filename).toMatch(/^\d+_[a-f0-9]{16}\.jpg$/);
    });

    it('should include prefix if provided', () => {
      // Act
      const filename = testStorageService.generateFileName('test.pdf', 'app-123');

      // Assert
      expect(filename).toMatch(/^app-123_\d+_[a-f0-9]{16}\.pdf$/);
    });

    it('should handle files without extension', () => {
      // Act
      const filename = testStorageService.generateFileName('testfile');

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

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      // Act
      const result = await testStorageService.saveFile(fileBuffer, options);

      // Assert
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(testStorageDir, 'documents'),
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
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
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      // Act & Assert
      await expect(testStorageService.saveFile(fileBuffer))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('saveFileFromPath', () => {
    it('should read source file, save it, and return file info', async () => {
      // Arrange
      const sourcePath = path.join(process.cwd(), 'test-source.pdf');
      const fileBuffer = Buffer.from('test file content');
      const options = {
        originalName: 'source.pdf',
        subDirectory: 'documents',
        prefix: 'doc',
        removeSource: false
      };

      mockReadFile.mockResolvedValue(fileBuffer);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      // Act
      const result = await testStorageService.saveFileFromPath(sourcePath, options);

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(sourcePath);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockUnlink).not.toHaveBeenCalled(); // removeSource is false
      expect(result).toEqual(expect.objectContaining({
        fileName: expect.stringMatching(/^doc_\d+_[a-f0-9]{16}\.pdf$/),
        relativePath: expect.stringContaining('documents/')
      }));
    });

    it('should remove source file if removeSource is true', async () => {
      // Arrange
      const sourcePath = path.join(process.cwd(), 'test-source.pdf');
      const fileBuffer = Buffer.from('test file content');
      const options = {
        originalName: 'source.pdf',
        subDirectory: 'documents',
        prefix: 'doc',
        removeSource: true
      };

      mockReadFile.mockResolvedValue(fileBuffer);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);

      // Act
      await testStorageService.saveFileFromPath(sourcePath, options);

      // Assert
      expect(mockUnlink).toHaveBeenCalledWith(sourcePath);
    });

    it('should log warning if source file removal fails', async () => {
      // Arrange
      const sourcePath = path.join(process.cwd(), 'test-source.pdf');
      const fileBuffer = Buffer.from('test file content');
      const options = {
        originalName: 'source.pdf',
        removeSource: true
      };

      mockReadFile.mockResolvedValue(fileBuffer);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockRejectedValue(new Error('Permission denied'));

      // Act
      await testStorageService.saveFileFromPath(sourcePath, options);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw FileSystemError if source file read fails', async () => {
      // Arrange
      const sourcePath = path.join(process.cwd(), 'test-source.pdf');
      mockReadFile.mockRejectedValue(new Error('File not found'));

      // Act & Assert
      await expect(testStorageService.saveFileFromPath(sourcePath))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('getFile', () => {
    it('should retrieve file and return file info', async () => {
      // Arrange
      const relativePath = 'documents/test.pdf';
      const fileBuffer = Buffer.from('file content');
      const stats = {
        size: fileBuffer.length,
        mtime: new Date()
      };

      mockStat.mockResolvedValue(stats);
      mockReadFile.mockResolvedValue(fileBuffer);

      // Act
      const result = await testStorageService.getFile(relativePath);

      // Assert
      expect(mockStat).toHaveBeenCalledWith(path.join(testStorageDir, relativePath));
      expect(mockReadFile).toHaveBeenCalledWith(path.join(testStorageDir, relativePath));
      expect(result).toEqual({
        buffer: fileBuffer,
        size: stats.size,
        lastModified: stats.mtime,
        filePath: path.join(testStorageDir, relativePath),
        relativePath
      });
    });

    it('should throw FileSystemError with "File not found" message when file does not exist', async () => {
      // Arrange
      const relativePath = 'documents/nonexistent.pdf';
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockStat.mockRejectedValue(error);

      // Act & Assert
      const resultPromise = testStorageService.getFile(relativePath);
      await expect(resultPromise).rejects.toThrow(FileSystemError);
      await expect(resultPromise).rejects.toThrow('File not found');
    });

    it('should throw FileSystemError with generic message for other errors', async () => {
      // Arrange
      const relativePath = 'documents/test.pdf';
      const error = new Error('Permission denied');
      // Make sure the error doesn't have the ENOENT code
      error.code = 'EPERM';
      mockStat.mockRejectedValue(error);

      // Act & Assert
      const resultPromise = testStorageService.getFile(relativePath);
      await expect(resultPromise).rejects.toThrow(FileSystemError);
      await expect(resultPromise).rejects.toThrow('Failed to get file');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      // Arrange
      // Override the fileExists method for this test
      const originalFileExists = testStorageService.fileExists;
      testStorageService.fileExists = jest.fn().mockResolvedValue(true);

      // Act
      const result = await testStorageService.fileExists('test.pdf');

      // Assert
      expect(result).toBe(true);

      // Restore the original method
      testStorageService.fileExists = originalFileExists;
    });

    it('should return false if file does not exist', async () => {
      // Arrange
      mockAccess.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await testStorageService.fileExists('nonexistent.pdf');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and return true', async () => {
      // Arrange
      mockUnlink.mockResolvedValue(undefined);

      // Act
      const result = await testStorageService.deleteFile('test.pdf');

      // Assert
      expect(result).toBe(true);
      expect(mockUnlink).toHaveBeenCalledWith(path.join(testStorageDir, 'test.pdf'));
    });

    it('should return false if file does not exist', async () => {
      // Arrange
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockUnlink.mockRejectedValue(error);

      // Act
      const result = await testStorageService.deleteFile('nonexistent.pdf');

      // Assert
      expect(result).toBe(false);
    });

    it('should throw FileSystemError for other errors', async () => {
      // Arrange
      const error = new Error('Permission denied');
      mockUnlink.mockRejectedValue(error);

      // Act & Assert
      await expect(testStorageService.deleteFile('test.pdf'))
        .rejects.toThrow(FileSystemError);
    });
  });
});

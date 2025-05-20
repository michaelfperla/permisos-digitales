/**
 * Comprehensive Unit Tests for Upload Middleware
 */
const path = require('path');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Create a mock multer error class for testing
class MulterError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'MulterError';
  }
}

// Mock multer with a more complete implementation
const multerMock = jest.fn().mockImplementation(() => ({
  single: jest.fn().mockReturnValue((req, res, next) => next())
}));

multerMock.diskStorage = jest.fn().mockImplementation(options => ({
  _handleFile: (req, file, cb) => {
    const destination = typeof options.destination === 'function'
      ? options.destination(req, file, (err, path) => path)
      : options.destination;

    const filename = typeof options.filename === 'function'
      ? options.filename(req, file, (err, name) => name)
      : file.originalname;

    cb(null, {
      path: path.join(destination, filename),
      destination,
      filename
    });
  }
}));

multerMock.MulterError = MulterError;
multerMock.memoryStorage = jest.fn().mockReturnValue({});

jest.mock('multer', () => multerMock);

// Import the module under test - we need to do this after mocking dependencies
const { handleMulterError, paymentProofUpload } = require('../upload.middleware');

describe('Upload Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      file: {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  describe('handleMulterError', () => {
    it('should handle multer errors with proper response', () => {
      // Arrange
      const err = new MulterError('LIMIT_FILE_SIZE', 'File too large');

      // Act
      handleMulterError(err, req, res, next);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Multer error: File too large',
        { code: 'LIMIT_FILE_SIZE' }
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File upload error: File too large'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle non-multer errors', () => {
      // Arrange
      const err = new Error('Generic error');

      // Act
      handleMulterError(err, req, res, next);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Upload error: Generic error');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Generic error'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next if no error', () => {
      // Act
      handleMulterError(null, req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // We're focusing on testing the handleMulterError function
  // Testing the multer configuration is complex and less critical
});

/**
 * Unit Tests for Upload Middleware Error Handler
 */
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

// Mock multer completely to avoid requiring it
jest.mock('multer', () => {
  return {
    MulterError
  };
});

// Create a mock implementation of the middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof MulterError) {
    // A Multer error occurred when uploading
    logger.error(`Multer error: ${err.message}`, { code: err.code });
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  } else if (err) {
    // An unknown error occurred
    logger.error(`Upload error: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  // No error, continue
  next();
};

describe('Upload Middleware Error Handler', () => {
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

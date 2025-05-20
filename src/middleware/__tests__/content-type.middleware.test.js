/**
 * Unit Tests for Content Type Middleware
 */
const ensureProperContentType = require('../content-type.middleware');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Content Type Middleware', () => {
  let req, res, next;
  let originalSend, originalSendFile;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      method: 'GET',
      url: '/test.jpg'
    };

    // Create mock response with send and sendFile methods
    originalSend = jest.fn().mockReturnValue('send-result');
    originalSendFile = jest.fn().mockReturnValue('sendFile-result');

    res = {
      send: originalSend,
      sendFile: originalSendFile,
      setHeader: jest.fn()
    };

    next = jest.fn();
  });

  it('should set correct content type for PNG files in send method', () => {
    // Arrange
    req.url = '/test.png';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should set correct content type for JPG files in send method', () => {
    // Arrange
    req.url = '/test.jpg';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should set correct content type for JPEG files in send method', () => {
    // Arrange
    req.url = '/test.jpeg';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should set correct content type for SVG files in send method', () => {
    // Arrange
    req.url = '/test.svg';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should set correct content type for PDF files in send method', () => {
    // Arrange
    req.url = '/test.pdf';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should not set content type for unknown file extensions in send method', () => {
    // Arrange
    req.url = '/test.txt';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });

  it('should set correct content type for PNG files in sendFile method', () => {
    // Arrange
    const filePath = '/path/to/image.png';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.sendFile(filePath, { options: 'test' }, () => {});

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(originalSendFile).toHaveBeenCalledWith(filePath, { options: 'test' }, expect.any(Function));
    expect(result).toBe('sendFile-result');
  });

  it('should set correct content type for JPG files in sendFile method', () => {
    // Arrange
    const filePath = '/path/to/image.jpg';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.sendFile(filePath);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(originalSendFile).toHaveBeenCalledWith(filePath, undefined, undefined);
    expect(result).toBe('sendFile-result');
  });

  it('should not modify content type for non-GET requests', () => {
    // Arrange
    req.method = 'POST';
    req.url = '/test.jpg';

    // Act
    ensureProperContentType(req, res, next);
    
    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.send).toBe(originalSend); // Should not be modified
    expect(res.sendFile).toBe(originalSendFile); // Should not be modified
  });

  it('should handle case insensitive file extensions', () => {
    // Arrange
    req.url = '/test.PNG';

    // Act
    ensureProperContentType(req, res, next);
    const result = res.send('test body');

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(originalSend).toHaveBeenCalledWith('test body');
    expect(result).toBe('send-result');
  });
});

/**
 * Unit Tests for Request ID Middleware
 */
const requestIdMiddleware = require('../request-id.middleware');

// We need to mock the modules before requiring the middleware
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('abcdef123456')
  })
}));

describe('Request ID Middleware', () => {
  let req, res, next;
  let originalDateNow;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Date.now for predictable output
    originalDateNow = Date.now;
    Date.now = jest.fn().mockReturnValue(1234567890);

    // Create mock request, response, and next function
    req = {
      headers: {}
    };

    res = {
      setHeader: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it('should use the provided request ID from headers', () => {
    // Arrange
    req.headers['x-request-id'] = 'existing-request-id';

    // Act
    requestIdMiddleware(req, res, next);

    // Assert
    expect(req.id).toBe('existing-request-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-request-id');
    expect(next).toHaveBeenCalled();
  });

  it('should handle empty request ID from headers by generating a new one', () => {
    // Arrange
    req.headers['x-request-id'] = '';

    // Act
    requestIdMiddleware(req, res, next);

    // Assert
    expect(req.id).toMatch(/^\d+-[a-f0-9]+$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('should generate a request ID with expected format when none is provided', () => {
    // Act
    requestIdMiddleware(req, res, next);

    // Assert
    expect(req.id).toMatch(/^\d+-[a-f0-9]+$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('should always call next() to continue request processing', () => {
    // Act
    requestIdMiddleware(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
  });
});

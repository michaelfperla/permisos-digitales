// src/utils/__tests__/redis-client.test.js
const { logger } = require('../logger');

// Extract the MockRedisClient class for direct testing
const MockRedisClient = require('../redis-client-mock');

// Mock dependencies
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MockRedisClient', () => {
  let mockClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a fresh instance for each test
    mockClient = new MockRedisClient();
  });

  it('should initialize with empty data and expirations', () => {
    expect(mockClient.data.size).toBe(0);
    expect(mockClient.expirations.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('Using MockRedisClient because Redis is not available');
  });

  it('should get a value', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    jest.spyOn(mockClient, '_checkExpiration');

    // Execute
    const result = await mockClient.get('key1');

    // Assert
    expect(result).toBe('value1');
    expect(mockClient._checkExpiration).toHaveBeenCalledWith('key1');
  });

  it('should return null for non-existent key', async () => {
    // Execute
    const result = await mockClient.get('nonexistent');

    // Assert
    expect(result).toBeNull();
  });

  it('should set a value', async () => {
    // Execute
    const result = await mockClient.set('key1', 'value1');

    // Assert
    expect(result).toBe('OK');
    expect(mockClient.data.get('key1')).toBe('value1');
  });

  it('should set a value with expiry', async () => {
    // Setup
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    // Execute
    const result = await mockClient.set('key1', 'value1', 'EX', 60);

    // Assert
    expect(result).toBe('OK');
    expect(mockClient.data.get('key1')).toBe('value1');
    expect(mockClient.expirations.get('key1')).toBe(61000); // 1000 + 60*1000
  });

  it('should increment a value', async () => {
    // Setup
    mockClient.data.set('counter', '5');
    jest.spyOn(mockClient, '_checkExpiration');

    // Execute
    const result = await mockClient.incr('counter');

    // Assert
    expect(result).toBe(6);
    expect(mockClient.data.get('counter')).toBe('6');
    expect(mockClient._checkExpiration).toHaveBeenCalledWith('counter');
  });

  it('should initialize counter to 1 if key does not exist', async () => {
    // Execute
    const result = await mockClient.incr('new_counter');

    // Assert
    expect(result).toBe(1);
    expect(mockClient.data.get('new_counter')).toBe('1');
  });

  it('should set expiry on existing key', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    // Execute
    const result = await mockClient.expire('key1', 60);

    // Assert
    expect(result).toBe(1);
    expect(mockClient.expirations.get('key1')).toBe(61000); // 1000 + 60*1000
  });

  it('should return 0 when setting expiry on non-existent key', async () => {
    // Execute
    const result = await mockClient.expire('nonexistent', 60);

    // Assert
    expect(result).toBe(0);
  });

  it('should get TTL for a key with expiry', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    mockClient.expirations.set('key1', Date.now() + 30000);
    jest.spyOn(mockClient, '_checkExpiration');
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    // Execute
    const result = await mockClient.ttl('key1');

    // Assert
    expect(mockClient._checkExpiration).toHaveBeenCalledWith('key1');
    expect(result).toBeGreaterThan(0);
  });

  it('should return -1 for key without expiry', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');

    // Execute
    const result = await mockClient.ttl('key1');

    // Assert
    expect(result).toBe(-1);
  });

  it('should return -2 for non-existent key', async () => {
    // Execute
    const result = await mockClient.ttl('nonexistent');

    // Assert
    expect(result).toBe(-2);
  });

  it('should check if key exists', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    jest.spyOn(mockClient, '_checkExpiration');

    // Execute
    const result = await mockClient.exists('key1');

    // Assert
    expect(result).toBe(1);
    expect(mockClient._checkExpiration).toHaveBeenCalledWith('key1');
  });

  it('should return 0 for non-existent key when checking existence', async () => {
    // Execute
    const result = await mockClient.exists('nonexistent');

    // Assert
    expect(result).toBe(0);
  });

  it('should delete a key', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    mockClient.expirations.set('key1', Date.now() + 30000);

    // Execute
    const result = await mockClient.del('key1');

    // Assert
    expect(result).toBe(1);
    expect(mockClient.data.has('key1')).toBe(false);
    expect(mockClient.expirations.has('key1')).toBe(false);
  });

  it('should delete multiple keys', async () => {
    // Setup
    mockClient.data.set('key1', 'value1');
    mockClient.data.set('key2', 'value2');
    mockClient.data.set('key3', 'value3');

    // Execute
    const result = await mockClient.del('key1', 'key2', 'nonexistent');

    // Assert
    expect(result).toBe(2);
    expect(mockClient.data.has('key1')).toBe(false);
    expect(mockClient.data.has('key2')).toBe(false);
    expect(mockClient.data.has('key3')).toBe(true);
  });

  it('should check and remove expired keys', () => {
    // Setup
    const now = Date.now();
    mockClient.data.set('expired', 'value1');
    mockClient.data.set('valid', 'value2');
    mockClient.expirations.set('expired', now - 5000); // Expired 5 seconds ago
    mockClient.expirations.set('valid', now + 30000);  // Valid for 30 more seconds

    // Execute
    mockClient._checkExpiration('expired');

    // Assert
    expect(mockClient.data.has('expired')).toBe(false);
    expect(mockClient.expirations.has('expired')).toBe(false);
    expect(mockClient.data.has('valid')).toBe(true);
    expect(mockClient.expirations.has('valid')).toBe(true);
  });

  it('should have an on method that returns itself', () => {
    // Execute
    const result = mockClient.on('event', () => {});

    // Assert
    expect(result).toBe(mockClient);
  });
});

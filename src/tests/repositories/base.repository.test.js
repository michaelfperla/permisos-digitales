/**
 * Tests for Base Repository
 */

// Import test setup
require('../setup');

// Mock the database module using our standardized approach
const db = require('../../db');

// Import after mocking dependencies
const BaseRepository = require('../../repositories/base.repository');

// Now we can run the tests
describe('BaseRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new BaseRepository('test_table', 'id');
  });

  describe('constructor', () => {
    it('should initialize with table name and primary key', () => {
      expect(repository.tableName).toBe('test_table');
      expect(repository.primaryKey).toBe('id');
    });
  });

  describe('findById', () => {
    it('should query by primary key', async () => {
      // Arrange
      const mockData = { id: 1, name: 'Test' };
      db.query.mockResolvedValue({ rows: [mockData] });

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        [1]
      );
      expect(result).toEqual(mockData);
    });

    it('should return null when not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await repository.findById(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(repository.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    it('should query with criteria and options', async () => {
      // Arrange
      const mockData = [
        { id: 1, name: 'Test 1', status: 'active' },
        { id: 2, name: 'Test 2', status: 'active' }
      ];
      db.query.mockResolvedValue({ rows: mockData });

      const criteria = { status: 'active' };
      const options = {
        limit: 10,
        offset: 0,
        orderBy: 'name ASC'
      };

      // Act
      const result = await repository.findAll(criteria, options);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM test_table'),
        ['active']
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name ASC'),
        ['active']
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
        ['active']
      );
      expect(result).toEqual(mockData);
    });

    it('should query without criteria', async () => {
      // Arrange
      const mockData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];
      db.query.mockResolvedValue({ rows: mockData });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM test_table'),
        []
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('should insert a new record', async () => {
      // Arrange
      const newData = { name: 'New Test', status: 'active' };
      const mockResult = { id: 1, ...newData };
      db.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await repository.create(newData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table (name, status)'),
        ['New Test', 'active']
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        ['New Test', 'active']
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      // Arrange
      const updateData = { name: 'Updated Test' };
      const mockResult = { id: 1, name: 'Updated Test', status: 'active' };
      db.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await repository.update(1, updateData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['Updated Test', 1]
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET name = $1, updated_at = CURRENT_TIMESTAMP'),
        ['Updated Test', 1]
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when record not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await repository.update(999, { name: 'Test' });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      // Arrange
      db.query.mockResolvedValue({ rowCount: 1 });

      // Act
      const result = await repository.delete(1);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = $1 RETURNING id',
        [1]
      );
      expect(result).toBe(true);
    });

    it('should return false when record not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rowCount: 0 });

      // Act
      const result = await repository.delete(999);

      // Assert
      expect(result).toBe(false);
    });
  });
});

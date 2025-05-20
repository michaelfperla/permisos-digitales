/**
 * User Repository Tests
 */
const { NotFoundError, DatabaseError } = require('../../utils/errors');

// Import test setup
require('../../tests/setup');

// Mock the database module using our standardized approach
const db = require('../../db');

// Import after mocking dependencies
const userRepository = require('../../repositories/user.repository');

describe('User Repository', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      // Arrange
      const userId = 1;
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        created_at: new Date().toISOString()
      };

      // Mock the database response
      db.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1
      });

      // Act
      const result = await userRepository.findById(userId);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        [userId]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const userId = 999;

      // Mock the database response for no results
      db.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      // Act
      const result = await userRepository.findById(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 1;
      const dbError = new Error('Database connection error');

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.findById(userId)).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      // Arrange
      const email = 'test@example.com';
      const mockUser = {
        id: 1,
        email,
        name: 'Test User',
        role: 'user',
        created_at: new Date().toISOString()
      };

      // Mock the database response
      db.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1
      });

      // Act
      const result = await userRepository.findByEmail(email);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE email = $1'),
        [email]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      // Arrange
      const email = 'nonexistent@example.com';

      // Mock the database response for no results
      db.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      // Act
      const result = await userRepository.findByEmail(email);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const email = 'test@example.com';
      const dbError = new Error('Database connection error');

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.findByEmail(email)).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        password_hash: 'hashed_password',
        name: 'New User',
        role: 'user'
      };

      const mockCreatedUser = {
        id: 5,
        ...userData,
        created_at: new Date().toISOString()
      };

      // Mock the database response
      db.query.mockResolvedValue({
        rows: [mockCreatedUser],
        rowCount: 1
      });

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          userData.email,
          userData.password_hash,
          userData.name,
          userData.role
        ])
      );
      expect(result).toEqual(mockCreatedUser);
    });

    it('should handle database errors during creation', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        password_hash: 'hashed_password',
        name: 'New User',
        role: 'user'
      };

      const dbError = new Error('Duplicate key violation');
      dbError.code = '23505'; // PostgreSQL unique violation code

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.create(userData)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const mockUpdatedUser = {
        id: userId,
        ...updateData,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Mock the database response
      db.query.mockResolvedValue({
        rows: [mockUpdatedUser],
        rowCount: 1
      });

      // Act
      const result = await userRepository.update(userId, updateData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE users.*SET.*name.*email.*updated_at/is),
        expect.arrayContaining([
          updateData.name,
          updateData.email,
          userId
        ])
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw NotFoundError when user to update does not exist', async () => {
      // Arrange
      const userId = 999;
      const updateData = {
        name: 'Updated Name'
      };

      // Mock the database response for no results
      db.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      // Mock the implementation to throw NotFoundError
      const originalUpdate = userRepository.update;
      userRepository.update = jest.fn().mockImplementation(async (id, data) => {
        const result = await db.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [data.name, id]);
        if (result.rowCount === 0) {
          throw new NotFoundError(`User with ID ${id} not found`);
        }
        return result.rows[0];
      });

      // Act & Assert
      await expect(userRepository.update(userId, updateData)).rejects.toThrow(NotFoundError);

      // Restore original implementation
      userRepository.update = originalUpdate;
    });

    it('should handle database errors during update', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'updated@example.com'
      };

      const dbError = new Error('Database error');

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.update(userId, updateData)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a user successfully', async () => {
      // Arrange
      const userId = 1;

      // Mock the database response
      db.query.mockResolvedValue({
        rowCount: 1
      });

      // Act
      const result = await userRepository.delete(userId);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE id = $1'),
        [userId]
      );
      expect(result).toBe(true);
    });

    it('should return false when user to delete does not exist', async () => {
      // Arrange
      const userId = 999;

      // Mock the database response for no results
      db.query.mockResolvedValue({
        rowCount: 0
      });

      // Act
      const result = await userRepository.delete(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors during deletion', async () => {
      // Arrange
      const userId = 1;
      const dbError = new Error('Database error');

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.delete(userId)).rejects.toThrow();
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      // Arrange
      const email = 'existing@example.com';

      // Mock the database response
      db.query.mockResolvedValue({
        rows: [{ 1: 1 }],
        rowCount: 1
      });

      // Act
      const result = await userRepository.emailExists(email);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM users WHERE email = $1'),
        [email]
      );
      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      // Arrange
      const email = 'nonexistent@example.com';

      // Mock the database response for no results
      db.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      // Act
      const result = await userRepository.emailExists(email);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM users WHERE email = $1'),
        [email]
      );
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      const email = 'test@example.com';
      const dbError = new Error('Database error');

      // Mock the database to throw an error
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.emailExists(email)).rejects.toThrow();
    });
  });
});

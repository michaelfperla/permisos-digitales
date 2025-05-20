/**
 * Tests for User Repository
 */
const UserRepository = require('../../repositories/user.repository');
const db = require('../../db');
const { NotFoundError } = require('../../utils/errors');

// Import test setup
require('../setup');

// Since the module exports an instance, we'll use that directly
const userRepository = UserRepository;

// Mock the database module
jest.mock('../../db', () => ({
  query: jest.fn()
}));

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      // Arrange
      const email = 'test@example.com';
      const mockUser = {
        id: 1,
        email,
        first_name: 'Test',
        last_name: 'User',
        account_type: 'client'
      };
      
      db.query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      // Act
      const result = await userRepository.findByEmail(email);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        [email]
      );
      expect(db.query.mock.calls[0][0]).toContain('WHERE email = $1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await userRepository.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userRepository.findByEmail('test@example.com')
      ).rejects.toThrow(dbError);
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        password_hash: 'hashed_password',
        first_name: 'New',
        last_name: 'User',
        account_type: 'client'
      };
      
      const mockCreatedUser = {
        id: 1,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        account_type: userData.account_type,
        is_admin_portal: false,
        created_at: new Date().toISOString()
      };
      
      db.query.mockResolvedValue({ rows: [mockCreatedUser], rowCount: 1 });

      // Act
      const result = await userRepository.createUser(userData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          userData.email,
          userData.password_hash,
          userData.first_name,
          userData.last_name,
          userData.account_type,
          null, // created_by
          false // is_admin_portal
        ]
      );
      expect(result).toEqual(mockCreatedUser);
    });

    it('should create an admin user with custom options', async () => {
      // Arrange
      const userData = {
        email: 'admin@example.com',
        password_hash: 'hashed_password',
        first_name: 'Admin',
        last_name: 'User',
        account_type: 'admin',
        created_by: 1,
        is_admin_portal: true
      };
      
      const mockCreatedUser = {
        id: 2,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        account_type: userData.account_type,
        is_admin_portal: userData.is_admin_portal,
        created_at: new Date().toISOString()
      };
      
      db.query.mockResolvedValue({ rows: [mockCreatedUser], rowCount: 1 });

      // Act
      const result = await userRepository.createUser(userData);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          userData.email,
          userData.password_hash,
          userData.first_name,
          userData.last_name,
          userData.account_type,
          userData.created_by,
          userData.is_admin_portal
        ]
      );
      expect(result).toEqual(mockCreatedUser);
    });

    it('should handle database errors', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        password_hash: 'hashed_password',
        first_name: 'New',
        last_name: 'User'
      };
      
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userRepository.createUser(userData)
      ).rejects.toThrow(dbError);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      // Arrange
      const userId = 1;
      const newPasswordHash = 'new_hashed_password';
      
      db.query.mockResolvedValue({ rows: [{ id: userId }], rowCount: 1 });

      // Act
      const result = await userRepository.updatePassword(userId, newPasswordHash);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [newPasswordHash, userId]
      );
      expect(db.query.mock.calls[0][0]).toContain('SET password_hash = $1');
      expect(db.query.mock.calls[0][0]).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      const result = await userRepository.updatePassword(999, 'new_hash');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userRepository.updatePassword(1, 'new_hash')
      ).rejects.toThrow(dbError);
    });
  });

  describe('findAdmins', () => {
    it('should return admin users', async () => {
      // Arrange
      const mockAdmins = [
        { id: 1, email: 'admin1@example.com', account_type: 'admin' },
        { id: 2, email: 'admin2@example.com', account_type: 'admin' }
      ];
      
      // We need to mock the findAll method which is called by findAdmins
      // This is a bit tricky since we're not directly mocking findAll
      db.query.mockResolvedValue({ rows: mockAdmins, rowCount: 2 });

      // Act
      const result = await userRepository.findAdmins();

      // Assert
      expect(db.query).toHaveBeenCalled();
      // The query should include a WHERE clause for account_type = 'admin'
      expect(db.query.mock.calls[0][0]).toContain('WHERE');
      expect(db.query.mock.calls[0][1]).toContain('admin');
      expect(result).toEqual(mockAdmins);
    });

    it('should use custom options when provided', async () => {
      // Arrange
      const options = {
        limit: 10,
        offset: 5,
        orderBy: 'email ASC'
      };
      
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      await userRepository.findAdmins(options);

      // Assert
      expect(db.query).toHaveBeenCalled();
      // Check that the options are passed to the query
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
      expect(query).toContain('ORDER BY');
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userRepository.findAdmins()
      ).rejects.toThrow(dbError);
    });
  });

  describe('getSecurityEvents', () => {
    it('should return security events for a user', async () => {
      // Arrange
      const userId = 1;
      const mockEvents = [
        { id: 1, action_type: 'login', user_id: userId },
        { id: 2, action_type: 'password_change', user_id: userId }
      ];
      
      db.query.mockResolvedValue({ rows: mockEvents, rowCount: 2 });

      // Act
      const result = await userRepository.getSecurityEvents(userId);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, action_type, ip_address, user_agent, details, created_at'),
        [userId, 10] // Default limit is 10
      );
      expect(db.query.mock.calls[0][0]).toContain('FROM security_audit_log');
      expect(db.query.mock.calls[0][0]).toContain('WHERE user_id = $1');
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(result).toEqual(mockEvents);
    });

    it('should use custom limit when provided', async () => {
      // Arrange
      const userId = 1;
      const limit = 5;
      
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // Act
      await userRepository.getSecurityEvents(userId, limit);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, action_type, ip_address, user_agent, details, created_at'),
        [userId, limit]
      );
      expect(db.query.mock.calls[0][0]).toContain('LIMIT $2');
    });

    it('should handle database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      db.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userRepository.getSecurityEvents(1)
      ).rejects.toThrow(dbError);
    });
  });
});

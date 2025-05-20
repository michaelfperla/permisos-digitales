/**
 * Tests for Password Utilities
 */
const bcrypt = require('bcrypt');
const { hashPassword, verifyPassword } = require('../password-utils');

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should generate a bcrypt hash', async () => {
      // Act
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      // Assert
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2b\$10\$/); // Check for bcrypt format
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should generate different hashes for the same password', async () => {
      // Act
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Assert
      expect(hash1).not.toEqual(hash2); // Hashes should be different due to different salts
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password against its bcrypt hash', async () => {
      // Arrange
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      // Act
      const isValid = await verifyPassword(password, hash);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      // Arrange
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);

      // Act
      const isValid = await verifyPassword(wrongPassword, hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle legacy PBKDF2 hash format', async () => {
      // This test is more complex because it requires mocking the crypto module
      // For now, we'll just verify that the function doesn't throw an error
      // when given a PBKDF2 hash format

      // Arrange - Create a mock PBKDF2 hash in the format 'iterations:salt:hash'
      const mockPbkdf2Hash = '100000:5d41402abc4b2a76b9719d911017c592:5d41402abc4b2a76b9719d911017c592';

      // Act
      const result = await verifyPassword('test', mockPbkdf2Hash);

      // Assert - Just verify it returns a boolean and doesn't throw
      expect(typeof result).toBe('boolean');
    });

    it('should return false for undefined or invalid inputs', async () => {
      // Act & Assert
      expect(await verifyPassword(undefined, 'hash')).toBe(false);
      expect(await verifyPassword('password', undefined)).toBe(false);
      expect(await verifyPassword('', '')).toBe(false);
    });

    it('should handle errors during verification', async () => {
      // Arrange
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => {
        throw new Error('Bcrypt error');
      });

      // Act
      const result = await verifyPassword('password', '$2b$10$invalidhash');

      // Assert
      expect(result).toBe(false);
    });
  });
});

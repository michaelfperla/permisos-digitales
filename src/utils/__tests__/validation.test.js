/**
 * Validation Utility Tests
 */
const {
  validateEmail,
  validatePassword,
  validateName,
  validateCURP,
  validateRFC
} = require('../validation');

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      // Arrange
      const validEmails = [
        'test@example.com',
        'user.name@domain.com',
        'user+tag@example.co.uk',
        'user-name@domain.mx',
        'user123@domain.io'
      ];

      // Act & Assert
      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should return false for invalid email addresses', () => {
      // Arrange
      const invalidEmails = [
        'test',
        'test@',
        '@example.com',
        'test@example',
        'test@.com',
        'test@example..com',
        'test@exam ple.com',
        'test@exam\nple.com'
      ];

      // Act & Assert
      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should return false for empty or null values', () => {
      // Act & Assert
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid passwords', () => {
      // Arrange
      const validPasswords = [
        'Password123',
        'Secure@Password1',
        'P@ssw0rd',
        'L0ngP@ssw0rdWithM4nyChar4cters',
        '12345Aa!'
      ];

      // Act & Assert
      validPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should return false for passwords that are too short', () => {
      // Arrange
      const shortPasswords = [
        'Abc123',
        'P@ss1',
        '1234Ab'
      ];

      // Act & Assert
      shortPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should return false for passwords without uppercase letters', () => {
      // Arrange
      const noUppercasePasswords = [
        'password123',
        'secure@password1',
        'p@ssw0rd'
      ];

      // Act & Assert
      noUppercasePasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should return false for passwords without numbers', () => {
      // Arrange
      const noNumberPasswords = [
        'Password',
        'SecurePassword',
        'P@ssword'
      ];

      // Act & Assert
      noNumberPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should return false for empty or null values', () => {
      // Act & Assert
      expect(validatePassword('')).toBe(false);
      expect(validatePassword(null)).toBe(false);
      expect(validatePassword(undefined)).toBe(false);
    });
  });

  describe('validateName', () => {
    it('should return true for valid names', () => {
      // Arrange
      const validNames = [
        'John Doe',
        'María Rodríguez',
        'Jean-Claude Van Damme',
        'O\'Connor',
        'Smith-Johnson'
      ];

      // Act & Assert
      validNames.forEach(name => {
        expect(validateName(name)).toBe(true);
      });
    });

    it('should return false for names that are too short', () => {
      // Arrange
      const shortNames = [
        'A',
        'Jo'
      ];

      // Act & Assert
      shortNames.forEach(name => {
        expect(validateName(name)).toBe(false);
      });
    });

    it('should return false for names with invalid characters', () => {
      // Arrange
      const invalidNames = [
        'John123',
        'User@Name',
        'Name$',
        'John Doe!',
        '123456'
      ];

      // Act & Assert
      invalidNames.forEach(name => {
        expect(validateName(name)).toBe(false);
      });
    });

    it('should return false for empty or null values', () => {
      // Act & Assert
      expect(validateName('')).toBe(false);
      expect(validateName(null)).toBe(false);
      expect(validateName(undefined)).toBe(false);
    });
  });

  describe('validateCURP', () => {
    it('should return true for valid CURP values', () => {
      // Arrange
      const validCURPs = [
        'BADD110313HCMLNS09',
        'MELM830302MDFNNS06',
        'GORS620625MVZDMN01',
        'HEGG560427MVZRRL04'
      ];

      // Act & Assert
      validCURPs.forEach(curp => {
        expect(validateCURP(curp)).toBe(true);
      });
    });

    it('should return false for invalid CURP values', () => {
      // Arrange
      const invalidCURPs = [
        'BAD110313HCMLNS09', // Too short
        'MELM830302MDFNNS0', // Too short
        'GORS620625MVZDMN0123', // Too long
        'HEGG560427MVZRRL0$', // Invalid character
        '123456789012345678', // All numbers
        'ABCDEFGHIJKLMNOPQR' // No numbers
      ];

      // Act & Assert
      invalidCURPs.forEach(curp => {
        expect(validateCURP(curp)).toBe(false);
      });
    });

    it('should return false for empty or null values', () => {
      // Act & Assert
      expect(validateCURP('')).toBe(false);
      expect(validateCURP(null)).toBe(false);
      expect(validateCURP(undefined)).toBe(false);
    });
  });

  describe('validateRFC', () => {
    it('should return true for valid RFC values (person)', () => {
      // Arrange
      const validRFCs = [
        'BADD110313AZ9',
        'MELM830302NS6',
        'GORS620625MN1',
        'HEGG560427RL4'
      ];

      // Act & Assert
      validRFCs.forEach(rfc => {
        expect(validateRFC(rfc)).toBe(true);
      });
    });

    it('should return true for valid RFC values (company)', () => {
      // Arrange
      const validCompanyRFCs = [
        'ABC101231AB9',
        'XYZ060707P76',
        'EMP850101ABC'
      ];

      // Act & Assert
      validCompanyRFCs.forEach(rfc => {
        expect(validateRFC(rfc)).toBe(true);
      });
    });

    it('should return false for invalid RFC values', () => {
      // Arrange
      const invalidRFCs = [
        'BAD110313AZ9', // Too short
        'MELM830302N', // Too short
        'GORS620625MN123', // Too long
        'HEGG560427RL$', // Invalid character
        '123456789012', // All numbers
        'ABCDEFGHIJKL' // No numbers
      ];

      // Act & Assert
      invalidRFCs.forEach(rfc => {
        expect(validateRFC(rfc)).toBe(false);
      });
    });

    it('should return false for empty or null values', () => {
      // Act & Assert
      expect(validateRFC('')).toBe(false);
      expect(validateRFC(null)).toBe(false);
      expect(validateRFC(undefined)).toBe(false);
    });
  });
});

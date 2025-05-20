import { describe, it, expect } from 'vitest';
import {
  validateFullName,
  validateCurpRfc,
  validateAddress,
  validateVehicleMake,
  validateVehicleModel,
  validateVehicleColor,
  validateVehicleSerialNumber,
  validateVehicleEngineNumber,
  validateVehicleModelYear
} from '../permitValidation';

describe('Permit Validation Functions', () => {
  describe('validateFullName', () => {
    it('should validate a valid full name', () => {
      const result = validateFullName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty name', () => {
      const result = validateFullName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El nombre completo es requerido');
    });

    it('should reject a name that is too short', () => {
      const result = validateFullName('Jo');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El nombre completo debe tener al menos 3 caracteres');
    });

    it('should reject a name that is too long', () => {
      const result = validateFullName('A'.repeat(256));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El nombre completo no puede exceder 255 caracteres');
    });
  });

  describe('validateCurpRfc', () => {
    it('should validate a valid input', () => {
      const result = validateCurpRfc('ABCDE12345');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty input', () => {
      const result = validateCurpRfc('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El CURP o RFC es requerido');
    });

    it('should reject an input that is too short', () => {
      const result = validateCurpRfc('ABC123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El CURP o RFC debe tener entre 10 y 50 caracteres');
    });

    it('should reject an input that is too long', () => {
      const result = validateCurpRfc('A'.repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El CURP o RFC debe tener entre 10 y 50 caracteres');
    });

    it('should reject an input with invalid characters', () => {
      const result = validateCurpRfc('ABCDE12345-!@#');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El CURP o RFC solo debe contener letras y números');
    });
  });

  describe('validateAddress', () => {
    it('should validate a valid address', () => {
      const result = validateAddress('123 Main Street');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty address', () => {
      const result = validateAddress('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El domicilio es requerido');
    });

    it('should reject an address that is too short', () => {
      const result = validateAddress('123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El domicilio debe tener al menos 5 caracteres');
    });
  });

  describe('validateVehicleMake', () => {
    it('should validate a valid vehicle make', () => {
      const result = validateVehicleMake('Toyota');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle make', () => {
      const result = validateVehicleMake('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('La marca del vehículo es requerida');
    });

    it('should reject a vehicle make that is too long', () => {
      const result = validateVehicleMake('A'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('La marca del vehículo no puede exceder 100 caracteres');
    });
  });

  describe('validateVehicleModel', () => {
    it('should validate a valid vehicle model', () => {
      const result = validateVehicleModel('Corolla');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle model', () => {
      const result = validateVehicleModel('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El modelo del vehículo es requerido');
    });

    it('should reject a vehicle model that is too long', () => {
      const result = validateVehicleModel('A'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El modelo del vehículo no puede exceder 100 caracteres');
    });
  });

  describe('validateVehicleColor', () => {
    it('should validate a valid vehicle color', () => {
      const result = validateVehicleColor('Red');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle color', () => {
      const result = validateVehicleColor('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El color del vehículo es requerido');
    });

    it('should reject a vehicle color that is too long', () => {
      const result = validateVehicleColor('A'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El color del vehículo no puede exceder 100 caracteres');
    });
  });

  describe('validateVehicleSerialNumber', () => {
    it('should validate a valid vehicle serial number', () => {
      const result = validateVehicleSerialNumber('ABC12345');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle serial number', () => {
      const result = validateVehicleSerialNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de serie es requerido');
    });

    it('should reject a serial number that is too short', () => {
      const result = validateVehicleSerialNumber('AB');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de serie debe tener entre 5 y 50 caracteres');
    });

    it('should reject a serial number with invalid characters', () => {
      const result = validateVehicleSerialNumber('ABC-123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de serie solo debe contener letras y números');
    });
  });

  describe('validateVehicleEngineNumber', () => {
    it('should validate a valid vehicle engine number', () => {
      const result = validateVehicleEngineNumber('ENG12345');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle engine number', () => {
      const result = validateVehicleEngineNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de motor es requerido');
    });

    it('should reject an engine number that is too short', () => {
      const result = validateVehicleEngineNumber('EN');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de motor debe tener al menos 3 caracteres');
    });

    it('should reject an engine number that is too long', () => {
      const result = validateVehicleEngineNumber('A'.repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El número de motor no puede exceder 50 caracteres');
    });
  });

  describe('validateVehicleModelYear', () => {
    it('should validate a valid vehicle model year', () => {
      const result = validateVehicleModelYear('2023');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject an empty vehicle model year', () => {
      const result = validateVehicleModelYear('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El año del modelo es requerido');
    });

    it('should reject a non-numeric model year', () => {
      const result = validateVehicleModelYear('abcd');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El año debe ser un número sin símbolos');
    });

    it('should reject a model year that is not 4 digits', () => {
      const result = validateVehicleModelYear('202');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('El año debe ser de 4 dígitos');
    });

    it('should reject a model year that is too old', () => {
      const result = validateVehicleModelYear('1800');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El año debe estar entre 1900 y');
    });

    it('should reject a model year that is too far in the future', () => {
      const currentYear = new Date().getFullYear();
      const result = validateVehicleModelYear((currentYear + 3).toString());
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El año debe estar entre 1900 y');
    });

    it('should accept a model year at the upper boundary', () => {
      const currentYear = new Date().getFullYear();
      const result = validateVehicleModelYear((currentYear + 2).toString());
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });
  });
});

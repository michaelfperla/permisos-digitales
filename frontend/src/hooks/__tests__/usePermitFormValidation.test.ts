import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApplicationFormData } from '../../types/application.types';
import {
  usePermitFormValidation,
  getFirstError,
  getFirstStepError,
} from '../usePermitFormValidation';

// Mock the validation utilities to isolate the hook's logic
vi.mock('../../utils/permitValidation', () => ({
  validateFullName: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El nombre completo es requerido' };
    if (value.length < 3)
      return { isValid: false, error: 'El nombre completo debe tener al menos 3 caracteres' };
    return { isValid: true, error: '' };
  }),
  validateCurpRfc: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El CURP o RFC es requerido' };
    if (value.length < 10 || value.length > 50)
      return { isValid: false, error: 'El CURP o RFC debe tener entre 10 y 50 caracteres' };
    if (!/^[A-Z0-9]+$/i.test(value))
      return { isValid: false, error: 'El CURP o RFC solo debe contener letras y números' };
    return { isValid: true, error: '' };
  }),
  validateAddress: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El domicilio es requerido' };
    if (value.length < 5)
      return { isValid: false, error: 'El domicilio debe tener al menos 5 caracteres' };
    return { isValid: true, error: '' };
  }),
  validateVehicleMake: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'La marca del vehículo es requerida' };
    return { isValid: true, error: '' };
  }),
  validateVehicleModel: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El modelo del vehículo es requerido' };
    return { isValid: true, error: '' };
  }),
  validateVehicleColor: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El color del vehículo es requerido' };
    return { isValid: true, error: '' };
  }),
  validateVehicleSerialNumber: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El número de serie es requerido' };
    if (value.length < 5 || value.length > 50)
      return { isValid: false, error: 'El número de serie debe tener entre 5 y 50 caracteres' };
    if (!/^[A-Z0-9]+$/i.test(value))
      return { isValid: false, error: 'El número de serie solo debe contener letras y números' };
    return { isValid: true, error: '' };
  }),
  validateVehicleEngineNumber: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El número de motor es requerido' };
    return { isValid: true, error: '' };
  }),
  validateVehicleModelYear: vi.fn((value) => {
    if (!value) return { isValid: false, error: 'El año del modelo es requerido' };
    if (typeof value === 'string') {
      if (!/^\d+$/.test(value))
        return { isValid: false, error: 'El año debe ser un número sin símbolos' };
      const year = parseInt(value, 10);
      if (year < 1900 || year > new Date().getFullYear() + 2) {
        return {
          isValid: false,
          error: `El año debe estar entre 1900 y ${new Date().getFullYear() + 2}`,
        };
      }
    }
    return { isValid: true, error: '' };
  }),
}));

describe('usePermitFormValidation Hook', () => {
  // Valid form data for testing
  const validFormData: ApplicationFormData = {
    nombre_completo: 'Juan Pérez González',
    curp_rfc: 'PEGJ800101HDFRZN08',
    domicilio: 'Calle Principal #123, Colonia Centro',
    marca: 'Toyota',
    linea: 'Corolla',
    color: 'Rojo',
    numero_serie: 'ABC123456789',
    numero_motor: 'MOT987654321',
    ano_modelo: 2023,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isValid: true for completely valid form data', () => {
    const { result } = renderHook(() => usePermitFormValidation(validFormData));

    expect(result.current.isValid).toBe(true);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('should validate nombre_completo field', () => {
    const invalidData = { ...validFormData, nombre_completo: '' };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(true);
    expect(result.current.errors.nombre_completo).toBe('El nombre completo es requerido');
  });

  it('should validate curp_rfc field', () => {
    const invalidData = { ...validFormData, curp_rfc: 'ABC' }; // Too short
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(true);
    expect(result.current.errors.curp_rfc).toBe(
      'El CURP o RFC debe tener entre 10 y 50 caracteres',
    );
  });

  it('should validate curp_rfc format', () => {
    const invalidData = { ...validFormData, curp_rfc: 'ABC123@#$%^&' }; // Invalid characters
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(true);
    expect(result.current.errors.curp_rfc).toBe(
      'El CURP o RFC solo debe contener letras y números',
    );
  });

  it('should validate domicilio field', () => {
    const invalidData = { ...validFormData, domicilio: 'A' }; // Too short
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(true);
    expect(result.current.errors.domicilio).toBe('El domicilio debe tener al menos 5 caracteres');
  });

  it('should validate marca field', () => {
    const invalidData = { ...validFormData, marca: '' };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.marca).toBe('La marca del vehículo es requerida');
  });

  it('should validate linea field', () => {
    const invalidData = { ...validFormData, linea: '' };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.linea).toBe('El modelo del vehículo es requerido');
  });

  it('should validate color field', () => {
    const invalidData = { ...validFormData, color: '' };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.color).toBe('El color del vehículo es requerido');
  });

  it('should validate numero_serie field', () => {
    const invalidData = { ...validFormData, numero_serie: 'A' }; // Too short
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.numero_serie).toBe(
      'El número de serie debe tener entre 5 y 50 caracteres',
    );
  });

  it('should validate numero_serie format', () => {
    const invalidData = { ...validFormData, numero_serie: 'ABC123@#$%^&' }; // Invalid characters
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.numero_serie).toBe(
      'El número de serie solo debe contener letras y números',
    );
  });

  it('should validate numero_motor field', () => {
    const invalidData = { ...validFormData, numero_motor: '' };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.numero_motor).toBe('El número de motor es requerido');
  });

  it('should validate ano_modelo field as string', () => {
    const invalidData = { ...validFormData, ano_modelo: 'abc' }; // Not a number
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.ano_modelo).toBe('El año debe ser un número sin símbolos');
  });

  it('should validate ano_modelo field as number out of range', () => {
    const currentYear = new Date().getFullYear();
    const invalidData = { ...validFormData, ano_modelo: currentYear + 10 }; // Future year out of range
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(true);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.ano_modelo).toBe(
      `El año debe estar entre 1900 y ${currentYear + 2}`,
    );
  });

  it('should handle multiple validation errors', () => {
    const invalidData = {
      ...validFormData,
      nombre_completo: '',
      marca: '',
      numero_serie: '',
    };
    const { result } = renderHook(() => usePermitFormValidation(invalidData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(result.current.errors.nombre_completo).toBe('El nombre completo es requerido');
    expect(result.current.errors.marca).toBe('La marca del vehículo es requerida');
    expect(result.current.errors.numero_serie).toBe('El número de serie es requerido');
  });

  it('should handle empty form data', () => {
    const emptyData: ApplicationFormData = {
      nombre_completo: '',
      curp_rfc: '',
      domicilio: '',
      marca: '',
      linea: '',
      color: '',
      numero_serie: '',
      numero_motor: '',
      ano_modelo: 0,
    };
    const { result } = renderHook(() => usePermitFormValidation(emptyData));

    expect(result.current.isValid).toBe(false);
    expect(result.current.applicantInfoValid).toBe(false);
    expect(result.current.vehicleInfoValid).toBe(false);
    expect(Object.keys(result.current.errors).length).toBe(9); // All fields should have errors
  });

  describe('getFirstError', () => {
    it('should return the first error message from errors object', () => {
      const errors = {
        nombre_completo: 'Error 1',
        curp_rfc: 'Error 2',
        domicilio: 'Error 3',
      };

      const firstError = getFirstError(errors);
      expect(firstError).toBe('Error 1');
    });

    it('should return undefined if no errors', () => {
      const errors = {};

      const firstError = getFirstError(errors);
      expect(firstError).toBeUndefined();
    });
  });

  describe('getFirstStepError', () => {
    it('should return the first error message for applicant step', () => {
      const errors = {
        nombre_completo: 'Error 1',
        curp_rfc: 'Error 2',
        marca: 'Error 3',
      };

      const firstError = getFirstStepError(errors, 'applicant');
      expect(firstError).toBe('Error 1');
    });

    it('should return the first error message for vehicle step', () => {
      const errors = {
        nombre_completo: 'Error 1',
        marca: 'Error 2',
        linea: 'Error 3',
      };

      const firstError = getFirstStepError(errors, 'vehicle');
      expect(firstError).toBe('Error 2');
    });

    it('should return undefined if no errors for the specified step', () => {
      const errors = {
        nombre_completo: 'Error 1',
        curp_rfc: 'Error 2',
      };

      const firstError = getFirstStepError(errors, 'vehicle');
      expect(firstError).toBeUndefined();
    });
  });
});

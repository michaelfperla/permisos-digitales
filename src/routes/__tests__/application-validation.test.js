/**
 * Direct tests for application validation rules
 */

const { validationResult } = require('express-validator');
const { applicationValidationRules } = require('../applications.routes');

// Helper function to run validation rules on a request object
async function validateRequest(data) {
  // Create a mock request object with the data
  const req = {
    body: data
  };

  // Run all validation rules
  for (const rule of applicationValidationRules) {
    await rule.run(req);
  }

  // Get validation result
  return validationResult(req);
}

describe('Application Validation Rules', () => {
  // Test for missing required fields
  it('should validate missing required fields', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: '', // Empty string instead of missing
      domicilio: '',
      marca: '',
      linea: '',
      color: '',
      numero_serie: '',
      numero_motor: '',
      ano_modelo: ''
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'Falta el CURP/RFC.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta la dirección.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta la marca.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta el modelo.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta el color.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta el número de serie.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta el número de motor.')).toBe(true);
    expect(errors.some(e => e.msg === 'Falta el año.')).toBe(true);
  });

  // Test for nombre_completo validation
  it('should validate nombre_completo length', async () => {
    // Create a string longer than 255 characters
    const longName = 'A'.repeat(256);
    
    const result = await validateRequest({
      nombre_completo: longName,
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El nombre completo no debe pasar de 255 caracteres.')).toBe(true);
  });

  // Test for empty nombre_completo
  it('should validate empty nombre_completo', async () => {
    const result = await validateRequest({
      nombre_completo: '',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'Falta el nombre completo.')).toBe(true);
  });

  // Test for curp_rfc validation
  it('should validate curp_rfc length (too short)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'ABC123', // Less than 10 characters
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc length (too long)', async () => {
    // Create a string longer than 50 characters
    const longCurp = 'A'.repeat(51);
    
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: longCurp,
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc format', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456!@#', // Contains invalid characters
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El CURP/RFC solo debe tener letras y números.')).toBe(true);
  });

  // Test for numero_serie validation
  it('should validate numero_serie length (too short)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'A123', // Too short (only 4 characters)
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El número de serie debe tener entre 5 y 50 caracteres.')).toBe(true);
  });

  it('should validate numero_serie format', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC-123-XYZ!@#', // Contains invalid characters
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === 'El número de serie solo debe tener letras y números.')).toBe(true);
  });

  // Test for ano_modelo validation
  it('should validate ano_modelo range (too old)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 1899 // Before 1900
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    const currentYear = new Date().getFullYear();
    
    expect(errors.some(e => e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  it('should validate ano_modelo range (too new)', async () => {
    const currentYear = new Date().getFullYear();
    
    const result = await validateRequest({
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: currentYear + 3 // More than current year + 2
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  // Test for valid data
  it('should accept valid application data', async () => {
    const validData = {
      nombre_completo: 'Usuario de Prueba',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Dirección de Prueba 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Azul',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    };

    const result = await validateRequest(validData);
    expect(result.isEmpty()).toBe(true);
  });
});

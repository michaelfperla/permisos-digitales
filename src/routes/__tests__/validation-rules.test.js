/**
 * Tests for Application Validation Rules
 * This file directly tests the validation rules defined in applications.routes.js
 */

// Mock multer before importing any modules that use it
jest.mock('multer', () => {
  return function() {
    return {
      single: () => (req, res, next) => next(),
      array: () => (req, res, next) => next(),
      fields: () => (req, res, next) => next(),
      none: () => (req, res, next) => next(),
      any: () => (req, res, next) => next(),
      diskStorage: jest.fn().mockImplementation(() => ({}))
    };
  };
});

// Mock payment-proof-upload
jest.mock('../../utils/uploads/payment-proof-upload', () => ({
  paymentProofUpload: {
    single: () => (req, res, next) => next()
  },
  handleMulterError: (req, res, next) => next()
}));

// Mock rate-limit middleware
jest.mock('../../middleware/rate-limit.middleware', () => ({
  api: (req, res, next) => next(),
  auth: (req, res, next) => next(),
  upload: (req, res, next) => next(),
  admin: (req, res, next) => next()
}));

// Mock CSRF middleware
jest.mock('../../middleware/csrf.middleware', () => ({
  csrfProtection: (req, res, next) => next(),
  handleCsrfError: (err, req, res, next) => next(err)
}));

// Mock application controller
jest.mock('../../controllers/application.controller', () => ({
  getUserApplications: jest.fn(),
  createApplication: jest.fn(),
  getApplicationStatus: jest.fn(),
  updateApplication: jest.fn(),
  downloadPermit: jest.fn(),
  renewApplication: jest.fn(),
  submitPaymentProof: jest.fn()
}));

const { validationResult } = require('express-validator');

// Import the validation rules after mocking dependencies
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
      nombre_completo: 'Test User',
      // Missing other required fields
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'curp_rfc' && e.msg === 'Falta el CURP/RFC.')).toBe(true);
    expect(errors.some(e => e.param === 'domicilio' && e.msg === 'Falta la dirección.')).toBe(true);
    expect(errors.some(e => e.param === 'marca' && e.msg === 'Falta la marca.')).toBe(true);
    expect(errors.some(e => e.param === 'linea' && e.msg === 'Falta el modelo.')).toBe(true);
    expect(errors.some(e => e.param === 'color' && e.msg === 'Falta el color.')).toBe(true);
    expect(errors.some(e => e.param === 'numero_serie' && e.msg === 'Falta el número de serie.')).toBe(true);
    expect(errors.some(e => e.param === 'numero_motor' && e.msg === 'Falta el número de motor.')).toBe(true);
    expect(errors.some(e => e.param === 'ano_modelo' && e.msg === 'Falta el año.')).toBe(true);
  });

  // Test for nombre_completo validation
  it('should validate nombre_completo length', async () => {
    // Create a string longer than 255 characters
    const longName = 'A'.repeat(256);
    
    const result = await validateRequest({
      nombre_completo: longName,
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'nombre_completo' && e.msg === 'El nombre completo no debe pasar de 255 caracteres.')).toBe(true);
  });

  // Test for empty nombre_completo
  it('should validate empty nombre_completo', async () => {
    const result = await validateRequest({
      nombre_completo: '',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'nombre_completo' && e.msg === 'Falta el nombre completo.')).toBe(true);
  });

  // Test for curp_rfc validation
  it('should validate curp_rfc length (too short)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'ABC123', // Less than 10 characters
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc length (too long)', async () => {
    // Create a string longer than 50 characters
    const longCurp = 'A'.repeat(51);
    
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: longCurp,
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc format', async () => {
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456!@#', // Contains invalid characters
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'curp_rfc' && e.msg === 'El CURP/RFC solo debe tener letras y números.')).toBe(true);
  });

  // Test for numero_serie validation
  it('should validate numero_serie length (too short)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'A123', // Too short (only 4 characters)
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'numero_serie' && e.msg === 'El número de serie debe tener entre 5 y 50 caracteres.')).toBe(true);
  });

  it('should validate numero_serie format', async () => {
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC-123-XYZ!@#', // Contains invalid characters
      numero_motor: 'M123456',
      ano_modelo: 2023
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'numero_serie' && e.msg === 'El número de serie solo debe tener letras y números.')).toBe(true);
  });

  // Test for ano_modelo validation
  it('should validate ano_modelo range (too old)', async () => {
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 1899 // Before 1900
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    const currentYear = new Date().getFullYear();
    
    expect(errors.some(e => e.param === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  it('should validate ano_modelo range (too new)', async () => {
    const currentYear = new Date().getFullYear();
    
    const result = await validateRequest({
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: currentYear + 3 // More than current year + 2
    });

    expect(result.isEmpty()).toBe(false);
    const errors = result.array();
    
    expect(errors.some(e => e.param === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  // Test for valid data
  it('should accept valid application data', async () => {
    const validData = {
      nombre_completo: 'Test User',
      curp_rfc: 'TESU123456ABC',
      domicilio: 'Test Address 123',
      marca: 'Toyota',
      linea: 'Corolla',
      color: 'Blue',
      numero_serie: 'ABC12345678',
      numero_motor: 'M123456',
      ano_modelo: 2023
    };

    const result = await validateRequest(validData);
    expect(result.isEmpty()).toBe(true);
  });
});

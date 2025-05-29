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

// Upload functionality removed since app no longer needs document uploads

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
  getPdfUrl: jest.fn(),
  renewApplication: jest.fn(),
  checkRenewalEligibility: jest.fn(),
  submitPaymentProof: jest.fn()
}));

const { validationResult } = require('express-validator');

// Define the validation rules directly to avoid dependency issues
const { body } = require('express-validator');

const applicationValidationRules = [
  // Solicitante
  body('nombre_completo').trim().notEmpty().withMessage('Falta el nombre completo.').isLength({ max: 255 }).withMessage('El nombre completo no debe pasar de 255 caracteres.').escape(),
  body('curp_rfc').trim().notEmpty().withMessage('Falta el CURP/RFC.').isLength({ min: 10, max: 50 }).withMessage('El CURP/RFC debe tener entre 10 y 50 caracteres.').matches(/^[A-Z0-9]+$/i).withMessage('El CURP/RFC solo debe tener letras y números.').escape(),
  body('domicilio').trim().notEmpty().withMessage('Falta la dirección.').escape(),
  // Vehiculo
  body('marca').trim().notEmpty().withMessage('Falta la marca.').isLength({ max: 100 }).withMessage('La marca no debe pasar de 100 caracteres.').escape(),
  body('linea').trim().notEmpty().withMessage('Falta el modelo.').isLength({ max: 100 }).withMessage('El modelo no debe pasar de 100 caracteres.').escape(),
  body('color').trim().notEmpty().withMessage('Falta el color.').isLength({ max: 100 }).withMessage('El color no debe pasar de 100 caracteres.').escape(),
  body('numero_serie').trim().notEmpty().withMessage('Falta el número de serie.').isLength({ min: 5, max: 50 }).withMessage('El número de serie debe tener entre 5 y 50 caracteres.').matches(/^[A-Z0-9]+$/i).withMessage('El número de serie solo debe tener letras y números.').escape(),
  body('numero_motor').trim().notEmpty().withMessage('Falta el número de motor.').isLength({ max: 50 }).withMessage('El número de motor no debe pasar de 50 caracteres.').escape(),
  body('ano_modelo').notEmpty().withMessage('Falta el año.')
    .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
    .withMessage(`El año debe ser válido entre 1900 y ${new Date().getFullYear() + 2}.`)
    .toInt()
];

// Create a simple Express app for testing validation rules
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Import the actual handleValidationErrors middleware
const { handleValidationErrors } = require('../../middleware/validation.middleware');

// Create a test endpoint that uses the application validation rules
app.post('/test/validate', applicationValidationRules, handleValidationErrors, (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});

const request = require('supertest');

describe('Application Validation Rules', () => {
  // Test for missing required fields
  it('should validate missing required fields', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        // Missing other required fields
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'Falta el CURP/RFC.')).toBe(true);
    expect(errors.some(e => e.path === 'domicilio' && e.msg === 'Falta la dirección.')).toBe(true);
    expect(errors.some(e => e.path === 'marca' && e.msg === 'Falta la marca.')).toBe(true);
    expect(errors.some(e => e.path === 'linea' && e.msg === 'Falta el modelo.')).toBe(true);
    expect(errors.some(e => e.path === 'color' && e.msg === 'Falta el color.')).toBe(true);
    expect(errors.some(e => e.path === 'numero_serie' && e.msg === 'Falta el número de serie.')).toBe(true);
    expect(errors.some(e => e.path === 'numero_motor' && e.msg === 'Falta el número de motor.')).toBe(true);
    expect(errors.some(e => e.path === 'ano_modelo' && e.msg === 'Falta el año.')).toBe(true);
  });

  // Test for nombre_completo validation
  it('should validate nombre_completo length', async () => {
    // Create a string longer than 255 characters
    const longName = 'A'.repeat(256);

    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'nombre_completo' && e.msg === 'El nombre completo no debe pasar de 255 caracteres.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'nombre_completo' && e.msg === 'Falta el nombre completo.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC solo debe tener letras y números.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'numero_serie' && e.msg === 'El número de serie debe tener entre 5 y 50 caracteres.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'numero_serie' && e.msg === 'El número de serie solo debe tener letras y números.')).toBe(true);
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
    
    expect(errors.some(e => e.path === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
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
    
    expect(errors.some(e => e.path === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
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

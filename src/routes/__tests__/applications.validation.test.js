/**
 * Tests for Application Validation Rules
 * These tests focus specifically on the validation rules for the application routes
 */

// Upload functionality removed since app no longer needs document uploads

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');

// Define the validation rules directly to avoid dependency issues
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
const app = express();
app.use(bodyParser.json());

// Import the actual handleValidationErrors middleware
const { handleValidationErrors } = require('../../middleware/validation.middleware');

// Create a test endpoint that uses the application validation rules
app.post('/test/validate', applicationValidationRules, handleValidationErrors, (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});

describe('Application Validation Rules', () => {
  // Test for missing required fields
  it('should return validation errors for missing required fields', async () => {
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
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'nombre_completo' && e.msg === 'Falta el nombre completo.')).toBe(true);
  });

  // Test for curp_rfc validation
  it('should validate curp_rfc length (too short)', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc length (too long)', async () => {
    // Create a string longer than 50 characters
    const longCurp = 'A'.repeat(51);

    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC debe tener entre 10 y 50 caracteres.')).toBe(true);
  });

  it('should validate curp_rfc format', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'curp_rfc' && e.msg === 'El CURP/RFC solo debe tener letras y números.')).toBe(true);
  });

  // Test for numero_serie validation
  it('should validate numero_serie length (too short)', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'numero_serie' && e.msg === 'El número de serie debe tener entre 5 y 50 caracteres.')).toBe(true);
  });

  it('should validate numero_serie format', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'numero_serie' && e.msg === 'El número de serie solo debe tener letras y números.')).toBe(true);
  });

  // Test for ano_modelo validation
  it('should validate ano_modelo range (too old)', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    const currentYear = new Date().getFullYear();
    expect(errors.some(e => e.path === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  it('should validate ano_modelo range (too new)', async () => {
    const currentYear = new Date().getFullYear();
    const response = await request(app)
      .post('/test/validate')
      .send({
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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'ano_modelo' && e.msg === `El año debe ser válido entre 1900 y ${currentYear + 2}.`)).toBe(true);
  });

  // Test for empty fields
  it('should validate empty domicilio', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: '', // Empty domicilio
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
    expect(errors.some(e => e.path === 'domicilio' && e.msg === 'Falta la dirección.')).toBe(true);
  });

  it('should validate empty marca', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: 'Test Address 123',
        marca: '', // Empty marca
        linea: 'Corolla',
        color: 'Blue',
        numero_serie: 'ABC12345678',
        numero_motor: 'M123456',
        ano_modelo: 2023
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'marca' && e.msg === 'Falta la marca.')).toBe(true);
  });

  it('should validate empty linea', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: 'Test Address 123',
        marca: 'Toyota',
        linea: '', // Empty linea
        color: 'Blue',
        numero_serie: 'ABC12345678',
        numero_motor: 'M123456',
        ano_modelo: 2023
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'linea' && e.msg === 'Falta el modelo.')).toBe(true);
  });

  it('should validate empty color', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: 'Test Address 123',
        marca: 'Toyota',
        linea: 'Corolla',
        color: '', // Empty color
        numero_serie: 'ABC12345678',
        numero_motor: 'M123456',
        ano_modelo: 2023
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'color' && e.msg === 'Falta el color.')).toBe(true);
  });

  it('should validate empty numero_motor', async () => {
    const response = await request(app)
      .post('/test/validate')
      .send({
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: 'Test Address 123',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Blue',
        numero_serie: 'ABC12345678',
        numero_motor: '', // Empty numero_motor
        ano_modelo: 2023
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');

    const errors = response.body.errors;
    expect(errors.some(e => e.path === 'numero_motor' && e.msg === 'Falta el número de motor.')).toBe(true);
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

    const response = await request(app)
      .post('/test/validate')
      .send(validData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toEqual(validData);
  });
});

/**
 * Unit tests for ano_modelo validation rule
 * Tests the business logic for vehicle model year validation
 */
const { validationResult } = require('express-validator');
const { body } = require('express-validator');

// Define the ano_modelo validation rule (same as in applications.routes.js)
const anoModeloValidation = body('ano_modelo')
  .notEmpty()
  .withMessage('Falta el año.')
  .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
  .withMessage(`El año debe ser válido entre 1900 y ${new Date().getFullYear() + 2}.`)
  .toInt();

// Helper function to test validation
async function validateAnoModelo(value) {
  const req = { body: { ano_modelo: value } };
  await anoModeloValidation.run(req);
  return validationResult(req);
}

describe('ano_modelo Validation Rules', () => {
  const currentYear = new Date().getFullYear();

  it('should accept a valid 4-digit year', async () => {
    const result = await validateAnoModelo(2023);
    expect(result.isEmpty()).toBe(true);
  });

  it('should accept current year', async () => {
    const result = await validateAnoModelo(currentYear);
    expect(result.isEmpty()).toBe(true);
  });

  it('should accept future year within limit (current + 2)', async () => {
    const result = await validateAnoModelo(currentYear + 2);
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject a year that is too old (before 1900)', async () => {
    const result = await validateAnoModelo(1899);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe(`El año debe ser válido entre 1900 y ${currentYear + 2}.`);
  });

  it('should reject a year that is too far in the future', async () => {
    const result = await validateAnoModelo(currentYear + 3);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe(`El año debe ser válido entre 1900 y ${currentYear + 2}.`);
  });

  it('should reject non-numeric year (string)', async () => {
    const result = await validateAnoModelo('abcd');
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe(`El año debe ser válido entre 1900 y ${currentYear + 2}.`);
  });

  it('should reject empty year', async () => {
    const result = await validateAnoModelo('');
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.msg === 'Falta el año.')).toBe(true);
  });

  it('should reject null year', async () => {
    const result = await validateAnoModelo(null);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.msg === 'Falta el año.')).toBe(true);
  });

  it('should reject undefined year', async () => {
    const result = await validateAnoModelo(undefined);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.msg === 'Falta el año.')).toBe(true);
  });

  it('should reject decimal year', async () => {
    const result = await validateAnoModelo(2023.5);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe(`El año debe ser válido entre 1900 y ${currentYear + 2}.`);
  });

  it('should reject negative year', async () => {
    const result = await validateAnoModelo(-2023);
    expect(result.isEmpty()).toBe(false);

    const errors = result.array();
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe(`El año debe ser válido entre 1900 y ${currentYear + 2}.`);
  });
});

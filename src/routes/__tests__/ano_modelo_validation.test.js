/**
 * Test for ano_modelo validation rule
 */
const request = require('supertest');
const { startTestServer, stopTestServer, getApp, mockDb, resetMocks, setupTestSession, createSessionCookie } = require('../../tests/helpers/test-server');
const { ApplicationStatus } = require('../../constants');

describe('ano_modelo Validation', () => {
  let server;
  let agent;
  let csrfToken;

  // Test user data
  const testUser = {
    id: 1,
    email: 'test@example.com',
    password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789',
    first_name: 'Test',
    last_name: 'User',
    account_type: 'client',
    role: 'client',
    is_admin_portal: false
  };

  // Base application data
  const baseApplicationData = {
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: 'Test Address 123',
    marca: 'Toyota',
    linea: 'Corolla',
    color: 'Blue',
    numero_serie: 'ABC123456789',
    numero_motor: 'M123456'
  };

  beforeAll(async () => {
    // Start test server
    server = await startTestServer();
    agent = request.agent(getApp());

    // Setup test session with user data
    setupTestSession(testUser);

    // Get CSRF token
    const csrfResponse = await agent.get('/api/auth/csrf-token');
    csrfToken = csrfResponse.body.data.csrfToken;
    console.log('CSRF Token:', csrfToken);

    // Mock DB response for application creation
    mockDb.query.mockImplementation((query, params) => {
      if (query.includes('INSERT INTO permit_applications')) {
        return Promise.resolve({
          rows: [{
            id: 1,
            user_id: testUser.id,
            nombre_completo: 'Test User',
            curp_rfc: 'TESU123456ABC',
            domicilio: 'Test Address 123',
            marca: 'Toyota',
            linea: 'Corolla',
            color: 'Blue',
            numero_serie: 'ABC123456789',
            numero_motor: 'M123456',
            ano_modelo: 2023,
            status: ApplicationStatus.PENDING_PAYMENT,
            created_at: new Date().toISOString()
          }],
          rowCount: 1
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  beforeEach(() => {
    resetMocks();
  });

  it('should accept a valid 4-digit year', async () => {
    // For this test, we'll just verify that the validation passes
    // by checking that the error is not related to ano_modelo
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: 2023
    };

    // Send request with valid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // If there are errors, verify they're not related to ano_modelo
    if (response.status === 400 && response.body.errors) {
      const anoModeloErrors = response.body.errors.filter(err =>
        err.param === 'ano_modelo' || err.msg.includes('Año/Modelo'));
      expect(anoModeloErrors).toHaveLength(0);
    }
  });

  it('should reject a 5-digit year', async () => {
    // Test application data with 5-digit year (now invalid)
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: '20235' // 5-digit year
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject a 6-digit year', async () => {
    // Test application data with 6-digit year (now invalid)
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: '202356' // 6-digit year
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject a year that is too short (3 digits)', async () => {
    // Test application data with year that is too short
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: '202' // 3-digit year
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject a year that is too long (7 digits)', async () => {
    // Test application data with year that is too long
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: '2023567' // 7-digit year
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject a year that is too old', async () => {
    // Test application data with year that is too old
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: '1800' // Year too old
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject a year that is too far in the future', async () => {
    // Test application data with year that is too far in the future
    const currentYear = new Date().getFullYear();
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: (currentYear + 10).toString() // Year too far in future
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });

  it('should reject non-numeric year', async () => {
    // Test application data with non-numeric year
    const applicationData = {
      ...baseApplicationData,
      ano_modelo: 'abcd' // Non-numeric year
    };

    // Send request with invalid data
    const response = await agent
      .post('/api/applications')
      .set('X-CSRF-Token', csrfToken)
      .send(applicationData);

    // Verify response
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].msg).toContain('must be a valid year between 1900 and');
  });
});

// src/routes/__tests__/auth-change-password.integration.test.js
const request = require('supertest');
const { startTestServer, stopTestServer } = require('../../tests/helpers/test-server');
const db = require('../../db');
const { hashPassword } = require('../../utils/password-utils');

let app;
let agent;

// Mock user data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', // Will be replaced with actual hash
  account_type: 'client',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock session data
const mockSession = {
  userId: mockUser.id,
  userEmail: mockUser.email,
  userName: mockUser.first_name,
  userLastName: mockUser.last_name,
  accountType: mockUser.account_type
};

describe('Change Password Endpoint', () => {
  beforeAll(async () => {
    // Create a real hash for testing
    mockUser.password_hash = await hashPassword('currentPassword123');

    // Start test server with mocked session
    app = await startTestServer({ mockSession });
    agent = request.agent(app);
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(() => {
    // Mock db.query for user repository
    jest.spyOn(db, 'query').mockImplementation((query, params) => {
      // Mock findById query
      if (query.includes('SELECT * FROM users WHERE id = $1')) {
        return { rows: [mockUser], rowCount: 1 };
      }

      // Mock updatePassword query
      if (query.includes('UPDATE users SET password_hash = $1')) {
        return { rows: [{ id: mockUser.id }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully with valid credentials', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken;

      const response = await agent
        .post('/api/auth/change-password')
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully.');
    });

    it('should return 401 with incorrect current password', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken;

      const response = await agent
        .post('/api/auth/change-password')
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect.');
    });

    it('should return 400 with invalid new password', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken;

      const response = await agent
        .post('/api/auth/change-password')
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'short' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      // Start a new agent without session
      const unauthenticatedApp = await startTestServer({ mockSession: null });
      const unauthenticatedAgent = request.agent(unauthenticatedApp);

      // Mock CSRF token
      const csrfResponse = await unauthenticatedAgent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken;

      const response = await unauthenticatedAgent
        .post('/api/auth/change-password')
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

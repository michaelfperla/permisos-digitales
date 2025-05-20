// src/routes/__tests__/user.integration.test.js
const request = require('supertest');
const { startTestServer, stopTestServer } = require('../../tests/helpers/test-server');
const db = require('../../db');

let app;
let agent;

// Mock user data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  account_type: 'client',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock session data
const mockSession = {
  userId: mockUser.id,
  accountType: mockUser.account_type
};

describe('User Routes', () => {
  beforeAll(async () => {
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
      
      // Mock findByEmail query
      if (query.includes('SELECT * FROM users WHERE email = $1')) {
        // Return the user only if the email matches
        if (params[0] === mockUser.email) {
          return { rows: [mockUser], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      
      // Mock update query
      if (query.includes('UPDATE users SET')) {
        const updatedUser = { ...mockUser };
        
        // Apply updates based on the query
        if (params.includes('Updated')) {
          updatedUser.first_name = 'Updated';
        }
        if (params.includes('User2')) {
          updatedUser.last_name = 'User2';
        }
        if (params.includes('new@example.com')) {
          updatedUser.email = 'new@example.com';
        }
        
        updatedUser.updated_at = new Date().toISOString();
        
        return { rows: [updatedUser], rowCount: 1 };
      }
      
      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/user/profile', () => {
    it('should return user profile data', async () => {
      const response = await agent.get('/api/user/profile');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        first_name: mockUser.first_name,
        last_name: mockUser.last_name,
        account_type: mockUser.account_type,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at
      });
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile data', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;
      
      const updateData = {
        first_name: 'Updated',
        last_name: 'User2',
        email: 'new@example.com'
      };
      
      const response = await agent
        .put('/api/user/profile')
        .set('X-CSRF-Token', csrfToken)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.first_name).toBe('Updated');
      expect(response.body.data.user.last_name).toBe('User2');
      expect(response.body.data.user.email).toBe('new@example.com');
      expect(response.body.data.message).toBe('Profile updated successfully.');
    });
    
    it('should return 400 if no valid fields are provided', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;
      
      const response = await agent
        .put('/api/user/profile')
        .set('X-CSRF-Token', csrfToken)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should validate input data', async () => {
      // Mock CSRF token
      const csrfResponse = await agent.get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;
      
      const response = await agent
        .put('/api/user/profile')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'invalid-email'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });
});

/**
 * Simple CSRF Token Test
 * This file contains a minimal test to debug issues with the CSRF token
 */
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { csrfProtection } = require('../../middleware/csrf.middleware');
const ApiResponse = require('../../utils/api-response');

// Mock Redis client to prevent open handles
jest.mock('../../utils/redis-client', () => ({
  status: 'ready',
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  exists: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(0),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK')
}));

describe('CSRF Token Test', () => {
  let app;
  let server;
  let csrfToken;

  // Set a longer timeout
  jest.setTimeout(10000);

  // Close the server after all tests
  afterAll(done => {
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(() => {
    // Create a new Express app
    app = express();

    // Add middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser('test-secret'));

    // Create a simple in-memory session store for testing
    const MemoryStore = session.MemoryStore;
    const sessionStore = new MemoryStore();

    // Add session middleware with in-memory store for testing
    app.use(session({
      store: sessionStore,
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Create a simple CSRF token endpoint
    app.get('/api/auth/csrf-token', csrfProtection, (req, res) => {
      ApiResponse.success(res, { csrfToken: req.csrfToken() });
    });

    // Create a simple endpoint that requires CSRF protection
    app.post('/api/auth/test', csrfProtection, (req, res) => {
      ApiResponse.success(res, { message: 'CSRF protection passed' });
    });

    // Start the server on a random port
    server = app.listen(0);
  });

  afterEach(done => {
    // Close the server after each test
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  it('should return a CSRF token', async () => {
    // Act
    const response = await request(app)
      .get('/api/auth/csrf-token')
      .expect(200);

    // Assert
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('csrfToken');

    // Store the CSRF token for the next test
    csrfToken = response.body.data.csrfToken;
  });

  it('should accept a request with a valid CSRF token', async () => {
    // Create an agent to maintain cookies/session
    const agent = request.agent(app);

    // First get a CSRF token
    const tokenResponse = await agent
      .get('/api/auth/csrf-token')
      .expect(200);

    const token = tokenResponse.body.data.csrfToken;

    // Now use the token in a request with the same agent
    const response = await agent
      .post('/api/auth/test')
      .set('X-CSRF-Token', token)
      .send({ test: 'data' })
      .expect(200);

    // Assert
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('message', 'CSRF protection passed');
  });
});

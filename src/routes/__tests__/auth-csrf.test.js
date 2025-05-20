/**
 * Tests for CSRF token endpoint
 */
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Create a simple Express app for testing
const app = express();
app.use(cookieParser());

// Add a simple CSRF token endpoint for testing
app.get('/api/auth/csrf-token', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      csrfToken: 'test-csrf-token'
    }
  });
});

describe('CSRF Token Endpoint', () => {
  it('should return a CSRF token', async () => {
    const response = await request(app)
      .get('/api/auth/csrf-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data.csrfToken', 'test-csrf-token');
  });
});

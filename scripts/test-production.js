#!/usr/bin/env node

/**
 * Production Testing Script
 * Tests CSRF, CORS, and registration functionality in production
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'https://api.permisosdigitales.com.mx';
const FRONTEND_ORIGIN = 'https://permisosdigitales.com.mx';

// Add timeout and retry configuration
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

// Create axios instance with proper configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Origin': FRONTEND_ORIGIN,
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: TIMEOUT_MS,
});

// Store cookies between requests
let cookies = '';

// Helper function to extract cookies from response
function extractCookies(response) {
  const setCookieHeader = response.headers['set-cookie'];
  if (setCookieHeader) {
    cookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
  }
}

// Helper function to add cookies to request
function addCookies(config) {
  if (cookies) {
    config.headers.Cookie = cookies;
  }
  return config;
}

// Add request interceptor to include cookies
api.interceptors.request.use(addCookies);

// Add response interceptor to extract cookies
api.interceptors.response.use(
  (response) => {
    extractCookies(response);
    return response;
  },
  (error) => {
    if (error.response) {
      extractCookies(error.response);
    }
    return Promise.reject(error);
  }
);

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  try {
    const response = await api.get('/health');
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

async function testCorsConfiguration() {
  console.log('\n🌐 Testing CORS Configuration...');
  try {
    const response = await api.get('/debug/cors-test');
    console.log('✅ CORS test passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }
    return false;
  }
}

async function testCsrfTokenGeneration() {
  console.log('\n🔒 Testing CSRF Token Generation...');
  try {
    const response = await api.get('/debug/csrf-test');
    console.log('✅ CSRF token generation passed');
    console.log('Token length:', response.data.data.csrfToken.length);
    console.log('Session exists:', response.data.data.session.exists);
    console.log('Cookies count:', response.data.data.cookies.count);
    return response.data.data.csrfToken;
  } catch (error) {
    console.log('❌ CSRF token generation failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    return null;
  }
}

async function testCsrfTokenValidation(token) {
  console.log('\n🔐 Testing CSRF Token Validation...');
  try {
    const response = await api.post('/debug/csrf-validate',
      { test: 'data' },
      { headers: { 'X-CSRF-Token': token } }
    );
    console.log('✅ CSRF token validation passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ CSRF token validation failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    return false;
  }
}

async function testSessionInfo() {
  console.log('\n📋 Testing Session Information...');
  try {
    const response = await api.get('/debug/session-info');
    console.log('✅ Session info retrieved:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Session info failed:', error.message);
    return false;
  }
}

async function testRegistrationEndpoint() {
  console.log('\n👤 Testing Registration Endpoint...');
  try {
    // First get a CSRF token
    const csrfResponse = await api.get('/api/auth/csrf-token');
    const csrfToken = csrfResponse.data.data.csrfToken;

    console.log('Got CSRF token for registration test');

    // Test registration with a test email
    const testEmail = `test-${Date.now()}@example.com`;
    const registrationData = {
      email: testEmail,
      password: 'testpassword123',
      first_name: 'Test',
      last_name: 'User'
    };

    const response = await api.post('/api/auth/register', registrationData, {
      headers: { 'X-CSRF-Token': csrfToken }
    });

    console.log('✅ Registration test passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Registration test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    return false;
  }
}

async function testEnvironmentInfo() {
  console.log('\n⚙️ Testing Environment Information...');
  try {
    const response = await api.get('/debug/environment');
    console.log('✅ Environment info retrieved:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Environment info failed:', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Production Tests...');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Frontend Origin:', FRONTEND_ORIGIN);

  const results = {
    healthCheck: false,
    cors: false,
    csrfGeneration: false,
    csrfValidation: false,
    sessionInfo: false,
    registration: false,
    environment: false,
  };

  // Run tests in sequence
  results.healthCheck = await testHealthCheck();
  results.cors = await testCorsConfiguration();

  const csrfToken = await testCsrfTokenGeneration();
  results.csrfGeneration = !!csrfToken;

  if (csrfToken) {
    results.csrfValidation = await testCsrfTokenValidation(csrfToken);
  }

  results.sessionInfo = await testSessionInfo();
  results.environment = await testEnvironmentInfo();

  // Registration test (might fail if email already exists, that's OK)
  results.registration = await testRegistrationEndpoint();

  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Production environment looks healthy.');
  } else {
    console.log('⚠️ Some tests failed. Check the troubleshooting guide.');
  }

  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests };

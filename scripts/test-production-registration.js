#!/usr/bin/env node

/**
 * Production Registration Test Script
 *
 * This script tests the registration flow in production to identify issues
 * with CSRF tokens, CORS, and API connectivity.
 */

const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// Configure axios with cookie support
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

// Industry standard: clean subdomain routing (no redundant /api prefix)
const API_BASE = 'https://api.permisosdigitales.com.mx';
const FRONTEND_ORIGIN = 'https://permisosdigitales.com.mx';

async function testProductionRegistration() {
  console.log('🔍 Testing Production Registration Flow...\n');

  try {
    // Step 1: Test basic connectivity
    console.log('1️⃣ Testing API connectivity...');
    const healthResponse = await client.get(`https://api.permisosdigitales.com.mx/health`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });
    console.log('✅ API is reachable:', healthResponse.status);

    // Step 2: Test CSRF token generation
    console.log('\n2️⃣ Testing CSRF token generation...');
    const csrfResponse = await client.get(`${API_BASE}/auth/csrf-token`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });

    if (csrfResponse.data.success && csrfResponse.data.data.csrfToken) {
      console.log('✅ CSRF token generated successfully');
      console.log('Token length:', csrfResponse.data.data.csrfToken.length);
    } else {
      console.log('❌ Failed to generate CSRF token');
      console.log('Response:', csrfResponse.data);
      return;
    }

    const csrfToken = csrfResponse.data.data.csrfToken;

    // Step 3: Test CORS headers
    console.log('\n3️⃣ Testing CORS configuration...');
    const corsResponse = await client.get(`${API_BASE}/debug/cors-test`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });
    console.log('✅ CORS test successful');
    console.log('CORS headers:', corsResponse.headers);

    // Step 4: Test session information
    console.log('\n4️⃣ Testing session information...');
    const sessionResponse = await client.get(`${API_BASE}/debug/session-info`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });
    console.log('✅ Session info retrieved');
    console.log('Session data:', sessionResponse.data.data);

    // Step 5: Test registration with a test email
    console.log('\n5️⃣ Testing user registration...');
    const testEmail = `test-${Date.now()}@example.com`;
    const registrationData = {
      email: testEmail,
      password: 'TestPassword123!',
      first_name: 'Test',
      last_name: 'User'
    };

    const registrationResponse = await client.post(`${API_BASE}/auth/register`, registrationData, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    });

    if (registrationResponse.data.success) {
      console.log('✅ Registration successful!');
      console.log('User created:', registrationResponse.data.data.user.email);
    } else {
      console.log('❌ Registration failed');
      console.log('Response:', registrationResponse.data);
    }

  } catch (error) {
    console.log('❌ Error during testing:');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Additional diagnostic tests
async function runDiagnostics() {
  console.log('\n🔧 Running Additional Diagnostics...\n');

  try {
    // Test environment info
    console.log('📊 Environment Information:');
    const envResponse = await client.get(`${API_BASE}/debug/environment`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });
    console.log(envResponse.data.data);

    // Test CSRF validation
    console.log('\n🔐 CSRF Validation Test:');
    const csrfTestResponse = await client.get(`${API_BASE}/debug/csrf-test`, {
      headers: { 'Origin': FRONTEND_ORIGIN }
    });
    console.log('CSRF Test Result:', csrfTestResponse.data.data);

  } catch (error) {
    console.log('❌ Diagnostics failed:', error.message);
  }
}

// Run the tests
async function main() {
  await testProductionRegistration();
  await runDiagnostics();

  console.log('\n🏁 Testing completed!');
  console.log('\nIf registration failed, check:');
  console.log('1. Frontend .env.production has correct VITE_API_URL');
  console.log('2. Backend CORS allows the frontend domain');
  console.log('3. CSRF tokens are being generated and validated');
  console.log('4. Session cookies are being set correctly');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testProductionRegistration, runDiagnostics };

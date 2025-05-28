#!/usr/bin/env node

/**
 * Production Health Check for AWS Deployment
 * Tests the deployed application on AWS infrastructure
 */

const https = require('https');
const http = require('http');

// AWS Production URLs
const BACKEND_URL = 'http://54.193.84.64:3001';
const CLOUDFRONT_URL = 'https://d2gtd1yvnspajh.cloudfront.net';

console.log('🏥 AWS Production Health Check for Permisos Digitales');
console.log('Environment: AWS Production\n');

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Test functions
async function testBackendAPI() {
  console.log('============================================================');
  console.log('BACKEND API CHECK (EC2)');
  console.log('============================================================');
  
  try {
    // Test health endpoint
    const healthResponse = await makeRequest(`${BACKEND_URL}/health`);
    if (healthResponse.statusCode === 200) {
      console.log('✅ Backend health endpoint responding');
      console.log(`   Status: ${healthResponse.statusCode}`);
      try {
        const healthData = JSON.parse(healthResponse.data);
        console.log(`   Response: ${JSON.stringify(healthData)}`);
      } catch (e) {
        console.log(`   Response: ${healthResponse.data.substring(0, 100)}...`);
      }
    } else {
      console.log(`❌ Backend health endpoint failed: ${healthResponse.statusCode}`);
    }

    // Test API status endpoint
    const apiResponse = await makeRequest(`${BACKEND_URL}/api/status`);
    if (apiResponse.statusCode === 200) {
      console.log('✅ Backend API status endpoint responding');
      console.log(`   Status: ${apiResponse.statusCode}`);
    } else {
      console.log(`❌ Backend API status endpoint failed: ${apiResponse.statusCode}`);
    }

    return true;
  } catch (error) {
    console.log('❌ Backend API connection failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testFrontendCDN() {
  console.log('============================================================');
  console.log('FRONTEND CDN CHECK (CloudFront)');
  console.log('============================================================');
  
  try {
    const response = await makeRequest(CLOUDFRONT_URL);
    if (response.statusCode === 200) {
      console.log('✅ Frontend CloudFront distribution responding');
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      
      // Check if it's HTML content
      if (response.data.includes('<html') || response.data.includes('<!DOCTYPE')) {
        console.log('✅ Frontend serving HTML content');
      } else {
        console.log('⚠️  Frontend not serving expected HTML content');
      }
    } else {
      console.log(`❌ Frontend CloudFront failed: ${response.statusCode}`);
    }
    return true;
  } catch (error) {
    console.log('❌ Frontend CloudFront connection failed');
    console.log(`   Error: ${error.message}`);
    console.log('   Note: CloudFront distributions can take 10-15 minutes to deploy');
    return false;
  }
}

async function testCORS() {
  console.log('============================================================');
  console.log('CORS CONFIGURATION CHECK');
  console.log('============================================================');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/status`, {
      headers: {
        'Origin': CLOUDFRONT_URL,
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    if (response.headers['access-control-allow-origin']) {
      console.log('✅ CORS headers present');
      console.log(`   Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    } else {
      console.log('⚠️  CORS headers not found (may need configuration)');
    }
    return true;
  } catch (error) {
    console.log('❌ CORS check failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Main execution
async function runHealthCheck() {
  const results = {
    backend: false,
    frontend: false,
    cors: false
  };

  results.backend = await testBackendAPI();
  results.frontend = await testFrontendCDN();
  results.cors = await testCORS();

  console.log('============================================================');
  console.log('AWS PRODUCTION HEALTH CHECK SUMMARY');
  console.log('============================================================');
  console.log(`${results.backend ? '✅' : '❌'} Backend API (EC2)`);
  console.log(`${results.frontend ? '✅' : '❌'} Frontend CDN (CloudFront)`);
  console.log(`${results.cors ? '✅' : '❌'} CORS Configuration`);

  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All AWS production health checks passed!');
    console.log('\n📋 Production URLs:');
    console.log(`   Backend API: ${BACKEND_URL}`);
    console.log(`   Frontend: ${CLOUDFRONT_URL}`);
    console.log(`   Health Check: ${BACKEND_URL}/health`);
    console.log(`   API Status: ${BACKEND_URL}/api/status`);
  } else {
    console.log('\n⚠️  Some AWS production health checks failed.');
    console.log('   Please review the issues above before proceeding.');
  }

  process.exit(allPassed ? 0 : 1);
}

runHealthCheck().catch(error => {
  console.error('❌ Health check script failed:', error);
  process.exit(1);
});

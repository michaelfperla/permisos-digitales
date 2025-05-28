#!/usr/bin/env node

/**
 * Production Health Check Script
 * Validates that all production services are working correctly
 */

const https = require('https');
const http = require('http');
const { Pool } = require('pg');
const redis = require('redis');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`${title}`, 'bold');
  log(`${'='.repeat(60)}`, 'blue');
}

async function checkDatabase() {
  section('DATABASE CONNECTION CHECK');
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    await pool.end();
    
    log('✅ Database connection successful', 'green');
    log(`   Time: ${result.rows[0].current_time}`, 'green');
    log(`   Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`, 'green');
    return true;
  } catch (error) {
    log('❌ Database connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkRedis() {
  section('REDIS CONNECTION CHECK');
  
  try {
    const client = redis.createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });
    
    await client.connect();
    await client.set('health_check', 'ok', { EX: 10 });
    const result = await client.get('health_check');
    await client.disconnect();
    
    if (result === 'ok') {
      log('✅ Redis connection successful', 'green');
      log(`   Host: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`, 'green');
      return true;
    } else {
      throw new Error('Redis test failed');
    }
  } catch (error) {
    log('❌ Redis connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkAPI(url, name) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`✅ ${name} API responding`, 'green');
          log(`   Status: ${res.statusCode}`, 'green');
          log(`   Response time: ${Date.now() - startTime}ms`, 'green');
          resolve(true);
        } else {
          log(`❌ ${name} API error`, 'red');
          log(`   Status: ${res.statusCode}`, 'red');
          resolve(false);
        }
      });
    });
    
    const startTime = Date.now();
    request.on('error', (error) => {
      log(`❌ ${name} API connection failed`, 'red');
      log(`   Error: ${error.message}`, 'red');
      resolve(false);
    });
    
    request.setTimeout(10000, () => {
      log(`❌ ${name} API timeout`, 'red');
      request.destroy();
      resolve(false);
    });
  });
}

async function checkAPIs() {
  section('API ENDPOINTS CHECK');
  
  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  
  const apiHealth = await checkAPI(`${apiUrl}/status`, 'Backend');
  const frontendHealth = await checkAPI(frontendUrl, 'Frontend');
  
  return apiHealth && frontendHealth;
}

async function checkEnvironmentVariables() {
  section('ENVIRONMENT VARIABLES CHECK');
  
  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'SESSION_SECRET',
    'CONEKTA_PRIVATE_KEY',
    'CONEKTA_PUBLIC_KEY',
    'APP_URL',
    'FRONTEND_URL',
    'API_URL',
    'INTERNAL_API_KEY'
  ];
  
  let allPresent = true;
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      log(`✅ ${varName} is set`, 'green');
    } else {
      log(`❌ ${varName} is missing`, 'red');
      allPresent = false;
    }
  }
  
  // Check for default values that should be changed in production
  if (process.env.NODE_ENV === 'production') {
    const defaultChecks = [
      { name: 'SESSION_SECRET', value: process.env.SESSION_SECRET, default: 'default_fallback_secret_change_me' },
      { name: 'INTERNAL_API_KEY', value: process.env.INTERNAL_API_KEY, default: 'dev-internal-api-key-change-in-production' }
    ];
    
    for (const check of defaultChecks) {
      if (check.value === check.default) {
        log(`❌ ${check.name} is using default value in production`, 'red');
        allPresent = false;
      }
    }
  }
  
  return allPresent;
}

async function main() {
  log('🏥 Production Health Check for Permisos Digitales', 'bold');
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'blue');
  
  const checks = [
    { name: 'Environment Variables', fn: checkEnvironmentVariables },
    { name: 'Database', fn: checkDatabase },
    { name: 'Redis', fn: checkRedis },
    { name: 'APIs', fn: checkAPIs }
  ];
  
  const results = [];
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({ name: check.name, success: result });
    } catch (error) {
      log(`❌ ${check.name} check failed with error: ${error.message}`, 'red');
      results.push({ name: check.name, success: false });
    }
  }
  
  section('HEALTH CHECK SUMMARY');
  
  let allPassed = true;
  for (const result of results) {
    if (result.success) {
      log(`✅ ${result.name}`, 'green');
    } else {
      log(`❌ ${result.name}`, 'red');
      allPassed = false;
    }
  }
  
  if (allPassed) {
    log('\n🎉 All health checks passed! System is ready for production.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some health checks failed. Please review and fix issues before deployment.', 'red');
    process.exit(1);
  }
}

// Load environment variables
require('dotenv-flow').config();

main().catch(error => {
  log(`Fatal error during health check: ${error.message}`, 'red');
  process.exit(1);
});

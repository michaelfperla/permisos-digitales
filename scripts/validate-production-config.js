#!/usr/bin/env node

/**
 * Production Configuration Validator
 * Validates that all production environment variables are properly configured
 */

require('dotenv-flow').config();
const axios = require('axios');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function validateDatabaseConnection() {
  section('🗄️ DATABASE CONNECTION VALIDATION');
  
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' && process.env.DISABLE_SSL !== 'true' 
        ? { rejectUnauthorized: false } 
        : false
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    await pool.end();

    log('✅ Database connection successful', 'green');
    log(`   Connected at: ${result.rows[0].current_time}`, 'blue');
    return true;
  } catch (error) {
    log('❌ Database connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function validateRedisConnection() {
  section('🔴 REDIS CONNECTION VALIDATION');
  
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    await redis.connect();
    await redis.set('test_key', 'test_value', 'EX', 10);
    const value = await redis.get('test_key');
    await redis.del('test_key');
    redis.disconnect();

    if (value === 'test_value') {
      log('✅ Redis connection successful', 'green');
      return true;
    } else {
      log('❌ Redis test failed', 'red');
      return false;
    }
  } catch (error) {
    log('❌ Redis connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function validateS3Configuration() {
  section('☁️ S3 CONFIGURATION VALIDATION');
  
  try {
    const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    });

    const command = new HeadBucketCommand({ Bucket: process.env.S3_BUCKET });
    await s3Client.send(command);

    log('✅ S3 bucket access successful', 'green');
    log(`   Bucket: ${process.env.S3_BUCKET}`, 'blue');
    log(`   Region: ${process.env.S3_REGION}`, 'blue');
    return true;
  } catch (error) {
    log('❌ S3 configuration failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function validateEmailConfiguration() {
  section('📧 EMAIL CONFIGURATION VALIDATION');
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();
    log('✅ Email configuration valid', 'green');
    log(`   Host: ${process.env.EMAIL_HOST}`, 'blue');
    log(`   Port: ${process.env.EMAIL_PORT}`, 'blue');
    return true;
  } catch (error) {
    log('❌ Email configuration failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function validateEnvironmentVariables() {
  section('⚙️ ENVIRONMENT VARIABLES VALIDATION');
  
  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'SESSION_SECRET',
    'APP_URL',
    'FRONTEND_URL',
    'API_URL',
    'REDIS_HOST',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS',
    'CONEKTA_PUBLIC_KEY',
    'CONEKTA_PRIVATE_KEY',
    'INTERNAL_API_KEY'
  ];

  const missingVars = [];
  const placeholderVars = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    
    if (!value) {
      missingVars.push(varName);
    } else if (value.includes('REPLACE_WITH_') || 
               value.includes('YOUR_ACTUAL_') || 
               value.includes('PLACEHOLDER') ||
               value === 'change-in-production') {
      placeholderVars.push(varName);
    }
  }

  if (missingVars.length === 0 && placeholderVars.length === 0) {
    log('✅ All required environment variables are set', 'green');
    return true;
  } else {
    if (missingVars.length > 0) {
      log('❌ Missing environment variables:', 'red');
      missingVars.forEach(varName => log(`   - ${varName}`, 'red'));
    }
    
    if (placeholderVars.length > 0) {
      log('❌ Environment variables with placeholder values:', 'red');
      placeholderVars.forEach(varName => log(`   - ${varName}`, 'red'));
    }
    return false;
  }
}

async function validateURLConfiguration() {
  section('🌐 URL CONFIGURATION VALIDATION');
  
  const urls = {
    'APP_URL': process.env.APP_URL,
    'FRONTEND_URL': process.env.FRONTEND_URL,
    'API_URL': process.env.API_URL
  };

  let allValid = true;

  for (const [name, url] of Object.entries(urls)) {
    if (!url) {
      log(`❌ ${name} not configured`, 'red');
      allValid = false;
      continue;
    }

    try {
      const urlObj = new URL(url);
      if (urlObj.protocol === 'https:') {
        log(`✅ ${name}: ${url}`, 'green');
      } else {
        log(`⚠️  ${name}: Not using HTTPS - ${url}`, 'yellow');
      }
    } catch (error) {
      log(`❌ ${name}: Invalid URL format - ${url}`, 'red');
      allValid = false;
    }
  }

  return allValid;
}

async function validateConektaConfiguration() {
  section('💳 CONEKTA CONFIGURATION VALIDATION');
  
  const publicKey = process.env.CONEKTA_PUBLIC_KEY;
  const privateKey = process.env.CONEKTA_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    log('❌ Conekta keys not configured', 'red');
    return false;
  }

  // Check if keys are production keys
  const isProductionPublic = publicKey.startsWith('key_');
  const isProductionPrivate = privateKey.startsWith('key_');

  if (isProductionPublic && isProductionPrivate) {
    log('✅ Conekta production keys configured', 'green');
    return true;
  } else {
    log('⚠️  Conekta keys may be test keys', 'yellow');
    log(`   Public key starts with: ${publicKey.substring(0, 10)}...`, 'blue');
    return true; // Not necessarily an error for testing
  }
}

async function main() {
  log('🔍 Starting Production Configuration Validation...', 'cyan');
  
  const validations = [
    { name: 'Environment Variables', fn: validateEnvironmentVariables },
    { name: 'URL Configuration', fn: validateURLConfiguration },
    { name: 'Database Connection', fn: validateDatabaseConnection },
    { name: 'Redis Connection', fn: validateRedisConnection },
    { name: 'S3 Configuration', fn: validateS3Configuration },
    { name: 'Email Configuration', fn: validateEmailConfiguration },
    { name: 'Conekta Configuration', fn: validateConektaConfiguration }
  ];

  const results = [];

  for (const validation of validations) {
    try {
      const result = await validation.fn();
      results.push({ name: validation.name, success: result });
    } catch (error) {
      log(`❌ ${validation.name} validation failed: ${error.message}`, 'red');
      results.push({ name: validation.name, success: false });
    }
  }

  // Summary
  section('📋 VALIDATION SUMMARY');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;

  log(`Successful validations: ${successful}/${total}`, successful === total ? 'green' : 'yellow');

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });

  if (successful === total) {
    log('\n🎉 All validations passed! Production configuration is ready.', 'green');
    process.exit(0);
  } else {
    log(`\n⚠️  ${total - successful} validations failed. Please fix the issues above.`, 'yellow');
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  log(`\n💥 Validation script failed: ${error.message}`, 'red');
  process.exit(1);
});

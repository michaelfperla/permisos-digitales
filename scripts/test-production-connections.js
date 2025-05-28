#!/usr/bin/env node

/**
 * Production Connection Testing Script
 * Tests all critical infrastructure connections before deployment
 */

require('dotenv-flow').config({ node_env: 'production' });
const { Pool } = require('pg');
const redis = require('redis');
const { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const nodemailer = require('nodemailer');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bold');
  log(`${'='.repeat(60)}`, 'cyan');
}

async function testDatabaseConnection() {
  section('🗄️  DATABASE CONNECTION TEST');

  try {
    log('Testing PostgreSQL connection...', 'yellow');
    log(`Host: ${process.env.DATABASE_URL ? 'Configured' : 'NOT CONFIGURED'}`, 'blue');

    if (!process.env.DATABASE_URL) {
      log('❌ DATABASE_URL not configured', 'red');
      return false;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');

    log('✅ Database connection successful!', 'green');
    log(`   Current time: ${result.rows[0].current_time}`, 'blue');
    log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`, 'blue');

    // Test if required tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'applications', 'payment_orders')
    `);

    log(`   Tables found: ${tablesResult.rows.map(r => r.table_name).join(', ')}`, 'blue');

    client.release();
    await pool.end();
    return true;

  } catch (error) {
    log('❌ Database connection failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testRedisConnection() {
  section('🔴 REDIS CONNECTION TEST');

  try {
    log('Testing Redis connection...', 'yellow');
    log(`Host: ${process.env.REDIS_HOST || 'NOT CONFIGURED'}`, 'blue');
    log(`Port: ${process.env.REDIS_PORT || 'NOT CONFIGURED'}`, 'blue');

    if (!process.env.REDIS_HOST) {
      log('❌ REDIS_HOST not configured', 'red');
      return false;
    }

    const client = redis.createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      connect_timeout: 10000,
      tls: {
        // Enable TLS for ElastiCache with encryption in transit
        servername: process.env.REDIS_HOST
      }
    });

    await new Promise((resolve, reject) => {
      client.on('connect', () => {
        log('✅ Redis connection successful!', 'green');
        resolve();
      });

      client.on('error', (err) => {
        reject(err);
      });

      // Set a timeout
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
    });

    // Test basic operations
    await new Promise((resolve, reject) => {
      client.set('test_key', 'test_value', 'EX', 10, (err, result) => {
        if (err) reject(err);
        else {
          log('   ✓ Write test successful', 'green');
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      client.get('test_key', (err, result) => {
        if (err) reject(err);
        else if (result === 'test_value') {
          log('   ✓ Read test successful', 'green');
          resolve();
        } else {
          reject(new Error('Read test failed'));
        }
      });
    });

    client.quit();
    return true;

  } catch (error) {
    log('❌ Redis connection failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testS3Connection() {
  section('☁️  AWS S3 CONNECTION TEST');

  try {
    log('Testing S3 connection...', 'yellow');
    log(`Bucket: ${process.env.S3_BUCKET || 'NOT CONFIGURED'}`, 'blue');
    log(`Region: ${process.env.S3_REGION || 'NOT CONFIGURED'}`, 'blue');
    log(`Access Key: ${process.env.S3_ACCESS_KEY_ID ? 'Configured' : 'NOT CONFIGURED'}`, 'blue');

    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      log('❌ S3 credentials not fully configured', 'red');
      return false;
    }

    const s3Client = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });

    // Test bucket access
    await s3Client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
    log('✅ S3 bucket access successful!', 'green');

    // Test write permissions
    const testKey = `test-${Date.now()}.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: testKey,
      Body: 'Test file for production deployment',
      ContentType: 'text/plain'
    }));

    log('   ✓ Write test successful', 'green');

    // Test read permissions
    await s3Client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: testKey
    }));

    log('   ✓ Read test successful', 'green');

    // Clean up test file
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: testKey
    }));

    log('   ✓ Delete test successful', 'green');

    return true;

  } catch (error) {
    log('❌ S3 connection failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testEmailConfiguration() {
  section('📧 EMAIL CONFIGURATION TEST');

  try {
    log('Testing SMTP email configuration...', 'yellow');

    // Check if SMTP is configured
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
      log('Email service: SMTP', 'blue');
      log(`Host: ${process.env.EMAIL_HOST}`, 'blue');
      log(`Port: ${process.env.EMAIL_PORT}`, 'blue');
      log(`User: ${process.env.EMAIL_USER}`, 'blue');

      // Test SMTP connection
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_PORT == 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.verify();
      log('✅ SMTP connection successful!', 'green');
      return true;

    } else {
      log('❌ SMTP email service not configured', 'red');
      log('   Configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASS', 'yellow');
      return false;
    }

  } catch (error) {
    log('❌ Email configuration test failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testEnvironmentVariables() {
  section('⚙️  ENVIRONMENT VARIABLES CHECK');

  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'SESSION_SECRET',
    'CONEKTA_PUBLIC_KEY',
    'CONEKTA_PRIVATE_KEY',
    'CONEKTA_WEBHOOK_SECRET',
    'INTERNAL_API_KEY',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];

  const placeholderValues = [
    'YOUR_ACTUAL_',
    'PLACEHOLDER',
    'your-actual-',
    'change-in-production',
    'default_fallback'
  ];

  let allValid = true;

  for (const varName of requiredVars) {
    const value = process.env[varName];

    if (!value) {
      log(`❌ ${varName}: Not set`, 'red');
      allValid = false;
    } else if (placeholderValues.some(placeholder => value.includes(placeholder))) {
      log(`⚠️  ${varName}: Contains placeholder value`, 'yellow');
      allValid = false;
    } else {
      log(`✅ ${varName}: Configured`, 'green');
    }
  }

  return allValid;
}

async function main() {
  log('🚀 Production Infrastructure Connection Test', 'bold');
  log('Testing all critical connections before deployment...', 'blue');

  const results = {
    environment: await testEnvironmentVariables(),
    database: await testDatabaseConnection(),
    redis: await testRedisConnection(),
    s3: await testS3Connection(),
    email: await testEmailConfiguration()
  };

  section('📊 SUMMARY');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log(`Tests passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');

  Object.entries(results).forEach(([test, passed]) => {
    log(`${passed ? '✅' : '❌'} ${test.charAt(0).toUpperCase() + test.slice(1)}`, passed ? 'green' : 'red');
  });

  if (passed === total) {
    log('\n🎉 All tests passed! Ready for deployment.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please fix the issues before deployment.', 'yellow');
    process.exit(1);
  }
}

// Run the tests
main().catch(error => {
  log(`\n💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Production Secrets Generator
 * Generates secure random values for production environment variables
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function generateSecureKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSessionSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function generateInternalApiKey() {
  const prefix = 'prod-internal-api-key';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `${prefix}-${randomPart}`;
}

function generateCookieSecret() {
  return crypto.randomBytes(32).toString('hex');
}

async function main() {
  section('🔐 PRODUCTION SECRETS GENERATOR');

  log('Generating secure random values for production environment...', 'blue');

  const secrets = {
    SESSION_SECRET: generateSessionSecret(),
    INTERNAL_API_KEY: generateInternalApiKey(),
    COOKIE_SECRET: generateCookieSecret(),
    // Additional secure keys that might be needed
    JWT_SECRET: generateSecureKey(64),
    ENCRYPTION_KEY: generateSecureKey(32),
    WEBHOOK_VERIFICATION_SECRET: generateSecureKey(32)
  };

  section('🔑 GENERATED SECRETS');

  log('Copy these values to your .env.production file:', 'yellow');
  log('', 'reset');

  Object.entries(secrets).forEach(([key, value]) => {
    log(`${key}=${value}`, 'green');
  });

  section('📝 MANUAL CONFIGURATION NEEDED');

  log('The following values need to be obtained manually:', 'yellow');
  log('', 'reset');

  const manualConfig = [
    {
      key: 'DATABASE_URL',
      description: 'Get the actual password from AWS RDS console',
      current: 'postgres://permisos_admin:YOUR_ACTUAL_RDS_PASSWORD@permisos-digitales-db.cnkiusqgvv1f.us-west-1.rds.amazonaws.com:5432/permisos_digitales',
      action: 'Replace YOUR_ACTUAL_RDS_PASSWORD with the real password'
    },
    {
      key: 'S3_ACCESS_KEY_ID',
      description: 'AWS IAM Access Key ID',
      current: 'YOUR_ACTUAL_S3_ACCESS_KEY',
      action: 'Get from AWS IAM console or create new IAM user'
    },
    {
      key: 'S3_SECRET_ACCESS_KEY',
      description: 'AWS IAM Secret Access Key',
      current: 'YOUR_ACTUAL_S3_SECRET_KEY',
      action: 'Get from AWS IAM console (only shown once when created)'
    },
    {
      key: 'CONEKTA_WEBHOOK_SECRET',
      description: 'Conekta webhook verification secret',
      current: 'YOUR_ACTUAL_CONEKTA_WEBHOOK_SECRET',
      action: 'Get from Conekta Dashboard > Webhooks section'
    },
    {
      key: 'EMAIL_HOST',
      description: 'SMTP server hostname',
      current: 'smtp.example.com',
      action: 'Configure with your SMTP provider (Gmail, AWS SES, etc.)'
    },
    {
      key: 'EMAIL_USER',
      description: 'SMTP username/email',
      current: 'your_smtp_user@example.com',
      action: 'Set your SMTP authentication username'
    },
    {
      key: 'EMAIL_PASS',
      description: 'SMTP password',
      current: 'your_smtp_password',
      action: 'Set your SMTP authentication password'
    }
  ];

  manualConfig.forEach((config, index) => {
    log(`${index + 1}. ${config.key}`, 'cyan');
    log(`   Description: ${config.description}`, 'blue');
    log(`   Current: ${config.current}`, 'yellow');
    log(`   Action: ${config.action}`, 'green');
    log('', 'reset');
  });

  section('🛠️  NEXT STEPS');

  const steps = [
    'Update .env.production with the generated secrets above',
    'Obtain the manual configuration values listed above',
    'Run the connection test: node scripts/test-production-connections.js',
    'Fix any connection issues before deployment',
    'Deploy the application to production'
  ];

  steps.forEach((step, index) => {
    log(`${index + 1}. ${step}`, 'blue');
  });

  section('⚠️  SECURITY NOTES');

  const securityNotes = [
    'Never commit these secrets to version control',
    'Store secrets securely (AWS Secrets Manager, environment variables)',
    'Rotate secrets regularly in production',
    'Use different secrets for different environments',
    'Monitor for any unauthorized access attempts'
  ];

  securityNotes.forEach((note, index) => {
    log(`${index + 1}. ${note}`, 'yellow');
  });

  // Optionally save to a file
  const outputFile = path.join(__dirname, '..', 'production-secrets.txt');
  const secretsContent = Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(outputFile, secretsContent);
  log(`\n💾 Secrets saved to: ${outputFile}`, 'green');
  log('⚠️  Remember to delete this file after copying the values!', 'red');

  section('✅ GENERATION COMPLETE');
  log('All secrets have been generated successfully!', 'green');
  log('Follow the next steps above to complete your production configuration.', 'blue');
}

// Run the generator
main().catch(error => {
  log(`\n💥 Secret generation failed: ${error.message}`, 'red');
  process.exit(1);
});

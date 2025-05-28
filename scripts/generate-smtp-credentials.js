#!/usr/bin/env node

/**
 * Generate SES SMTP credentials from AWS IAM access keys
 * Based on AWS documentation: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
 */

const crypto = require('crypto');

// AWS SES SMTP credential conversion constants
const AWS_SES_SMTP_VERSION = 0x04;
const AWS_SES_SMTP_MESSAGE = 'SendRawEmail';

/**
 * Convert AWS IAM access key to SES SMTP password
 * @param {string} secretAccessKey - AWS IAM secret access key
 * @param {string} region - AWS region (e.g., 'us-west-1')
 * @returns {string} SES SMTP password
 */
function convertToSmtpPassword(secretAccessKey, region) {
  // Create the signing key
  const date = '11111111';
  const service = 'ses';
  const terminal = 'aws4_request';
  const version = Buffer.from([AWS_SES_SMTP_VERSION]);
  
  // Step 1: Create the signing key
  const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kTerminal = crypto.createHmac('sha256', kService).update(terminal).digest();
  
  // Step 2: Create the SMTP password
  const signature = crypto.createHmac('sha256', kTerminal).update(AWS_SES_SMTP_MESSAGE).digest();
  
  // Step 3: Combine version and signature
  const smtpPassword = Buffer.concat([version, signature]).toString('base64');
  
  return smtpPassword;
}

// Get credentials from command line arguments or environment
const accessKeyId = process.argv[2] || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.argv[3] || process.env.AWS_SECRET_ACCESS_KEY;
const region = process.argv[4] || process.env.AWS_REGION || 'us-west-1';

if (!accessKeyId || !secretAccessKey) {
  console.error('Usage: node generate-smtp-credentials.js <ACCESS_KEY_ID> <SECRET_ACCESS_KEY> [REGION]');
  console.error('Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
  process.exit(1);
}

// Generate SMTP credentials
const smtpUsername = accessKeyId;
const smtpPassword = convertToSmtpPassword(secretAccessKey, region);

console.log('='.repeat(60));
console.log('AWS SES SMTP CREDENTIALS');
console.log('='.repeat(60));
console.log(`SMTP Host: email-smtp.${region}.amazonaws.com`);
console.log(`SMTP Port: 587 (TLS) or 465 (SSL)`);
console.log(`SMTP Username: ${smtpUsername}`);
console.log(`SMTP Password: ${smtpPassword}`);
console.log('='.repeat(60));
console.log('');
console.log('Environment Variables:');
console.log(`EMAIL_HOST=email-smtp.${region}.amazonaws.com`);
console.log(`EMAIL_PORT=587`);
console.log(`EMAIL_USER=${smtpUsername}`);
console.log(`EMAIL_PASS=${smtpPassword}`);
console.log('='.repeat(60));

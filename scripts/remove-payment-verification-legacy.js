#!/usr/bin/env node

/**
 * Script to remove legacy payment verification code
 * 
 * This script removes all references to the old manual payment verification
 * system that was replaced by direct Conekta payment processing.
 * 
 * What it removes:
 * - payment_verification_log table references
 * - payment_proof_uploaded_at column references  
 * - Manual payment verification functions (already commented out)
 * - Related test code
 * 
 * What it preserves:
 * - Current Conekta payment processing
 * - payment_events table (current webhook system)
 * - payment_processor_order_id column (current system)
 */

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

// Files that contain legacy payment verification code
const filesToClean = [
  // Backend files
  'src/controllers/admin.controller.js',
  'src/repositories/application.repository.js',
  'src/routes/__tests__/admin.integration.test.js',
  'src/routes/__tests__/application-status-auth.integration.test.js',
  'src/routes/__tests__/application-status.integration.test.js',
  'src/routes/__tests__/applications.integration.test.js',
  'src/tests/repositories/application.repository.test.js',
  'src/controllers/__tests__/application.controller.test.js',
  
  // Frontend files
  'frontend/src/admin/pages/ApplicationDetailsPage.tsx',
  'frontend/src/admin/services/adminService.ts',
  'frontend/src/components/permit/StatusTimeline.tsx',
  'frontend/src/components/permit/__tests__/StatusTimeline.test.tsx',
  'frontend/src/pages/PermitDetailsPage.tsx',
  'frontend/src/pages/__tests__/PaymentUploadPage.test.tsx',
  'frontend/src/pages/__tests__/PermitDetailsPage.test.tsx',
  'frontend/src/test/mocks/applicationService.ts'
];

// Legacy code patterns to remove
const legacyPatterns = [
  // Database table references
  /payment_verification_log/g,
  
  // Column references
  /payment_proof_uploaded_at/g,
  /payment_verified_by/g,
  /payment_verified_at/g,
  /payment_rejection_reason/g,
  
  // Function references
  /verifyPayment/g,
  /rejectPayment/g,
  /getVerificationHistory/g,
  /logVerificationAction/g,
  
  // Status references (old statuses)
  /'PROOF_SUBMITTED'/g,
  /'PROOF_REJECTED'/g,
  /'VERIFICATION_PENDING'/g,
  /'VERIFICATION_FAILED'/g,
  
  // Test data references
  /payment_proof_uploaded_at:\s*[^,\n}]+/g,
  /paymentProofUploaded:\s*[^,\n}]+/g
];

function removeCommentedCode(content) {
  // Remove large commented blocks that contain legacy payment verification
  const commentBlockPatterns = [
    // Remove commented function blocks
    /\/\*[\s\S]*?\[Refactor - Remove Manual Payment\][\s\S]*?\*\//g,
    
    // Remove commented code blocks with payment verification
    /\/\*[\s\S]*?payment_verification_log[\s\S]*?\*\//g,
    /\/\*[\s\S]*?verifyPayment[\s\S]*?\*\//g,
    /\/\*[\s\S]*?rejectPayment[\s\S]*?\*\//g,
    
    // Remove single line comments about legacy payment
    /\/\/.*\[Refactor - Remove Manual Payment\].*\n/g,
    /\/\/.*payment verification.*\n/gi,
    /\/\/.*manual payment.*\n/gi
  ];
  
  let cleanedContent = content;
  commentBlockPatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  return cleanedContent;
}

function cleanLegacyReferences(content) {
  let cleanedContent = content;
  
  // Remove lines that reference legacy payment verification
  const linesToRemove = [
    // SQL queries with legacy tables
    /.*INSERT INTO payment_verification_log.*\n/g,
    /.*FROM payment_verification_log.*\n/g,
    /.*JOIN payment_verification_log.*\n/g,
    
    // Object properties with legacy columns
    /.*payment_proof_uploaded_at.*\n/g,
    /.*payment_verified_by.*\n/g,
    /.*payment_verified_at.*\n/g,
    /.*payment_rejection_reason.*\n/g,
    
    // TypeScript interface properties
    /\s*payment_proof_uploaded_at\?\s*:\s*string;\s*\n/g,
    /\s*paymentProofUploaded\?\s*:\s*string;\s*\n/g,
    
    // Test expectations
    /.*expect.*payment_verification_log.*\n/g,
    /.*expect.*payment_proof_uploaded_at.*\n/g
  ];
  
  linesToRemove.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  return cleanedContent;
}

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`File not found: ${filePath}`, 'yellow');
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let cleanedContent = content;
    
    // Remove commented code blocks
    cleanedContent = removeCommentedCode(cleanedContent);
    
    // Remove legacy references
    cleanedContent = cleanLegacyReferences(cleanedContent);
    
    // Clean up multiple empty lines
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Only write if content changed
    if (cleanedContent !== content) {
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      log(`✓ Cleaned: ${filePath}`, 'green');
      return true;
    } else {
      log(`- No changes: ${filePath}`, 'blue');
      return false;
    }
  } catch (error) {
    log(`✗ Error cleaning ${filePath}: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  section('REMOVING LEGACY PAYMENT VERIFICATION CODE');
  
  log('This script will remove all references to the legacy manual payment verification system.', 'cyan');
  log('The current Conekta payment processing will remain intact.\n', 'cyan');
  
  let cleanedFiles = 0;
  let totalFiles = 0;
  
  for (const filePath of filesToClean) {
    totalFiles++;
    if (cleanFile(filePath)) {
      cleanedFiles++;
    }
  }
  
  section('CLEANUP COMPLETE');
  log(`Files processed: ${totalFiles}`, 'cyan');
  log(`Files cleaned: ${cleanedFiles}`, 'green');
  log(`Files unchanged: ${totalFiles - cleanedFiles}`, 'blue');
  
  if (cleanedFiles > 0) {
    log('\nNext steps:', 'yellow');
    log('1. Run the database migration: npm run migrate', 'yellow');
    log('2. Run tests to ensure nothing is broken: npm test', 'yellow');
    log('3. Test payment functionality manually', 'yellow');
    log('4. Commit the changes', 'yellow');
  }
}

if (require.main === module) {
  main();
}

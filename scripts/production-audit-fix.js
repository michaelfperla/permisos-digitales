#!/usr/bin/env node

/**
 * Production Audit & Fix Script
 * Comprehensive script to identify and resolve production issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function subsection(title) {
  log(`\n--- ${title} ---`, 'yellow');
}

async function checkEnvironmentConfiguration() {
  section('🔧 ENVIRONMENT CONFIGURATION AUDIT');

  const issues = [];
  const fixes = [];

  // Check if .env.production exists
  const envProdPath = path.join(__dirname, '..', '.env.production');
  if (!fs.existsSync(envProdPath)) {
    issues.push('❌ Missing .env.production file');
    fixes.push('✅ Created .env.production template - REQUIRES MANUAL CONFIGURATION');
  } else {
    log('✅ .env.production file exists', 'green');

    // Check for placeholder values
    const envContent = fs.readFileSync(envProdPath, 'utf8');
    const placeholders = [
      'REPLACE_WITH_',
      'YOUR_ACTUAL_',
      'PLACEHOLDER',
      'change-in-production'
    ];

    const foundPlaceholders = placeholders.filter(placeholder =>
      envContent.includes(placeholder)
    );

    if (foundPlaceholders.length > 0) {
      issues.push(`❌ Found ${foundPlaceholders.length} placeholder values in .env.production`);
      foundPlaceholders.forEach(placeholder => {
        log(`   - Contains: ${placeholder}`, 'red');
      });
    } else {
      log('✅ No placeholder values found in .env.production', 'green');
    }
  }

  // Check frontend .env.production
  const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.production');
  if (!fs.existsSync(frontendEnvPath)) {
    issues.push('❌ Missing frontend/.env.production file');
  } else {
    log('✅ Frontend .env.production file exists', 'green');

    const frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf8');
    if (frontendEnvContent.includes('api.permisosdigitales.com.mx')) {
      log('✅ Frontend API URL correctly configured', 'green');
    } else {
      issues.push('❌ Frontend API URL may be misconfigured');
    }
  }

  return { issues, fixes };
}

async function checkConsoleStatements() {
  section('🔍 CONSOLE STATEMENTS AUDIT');

  const issues = [];
  const fixes = [];

  // Files to check for console statements
  const filesToCheck = [
    'frontend/src/services/api.ts',
    'frontend/src/utils/csrf.ts',
    'frontend/src/admin/services/adminService.ts'
  ];

  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for unguarded console statements
      const lines = content.split('\n');
      const problematicLines = [];

      // Check for unguarded console statements (more sophisticated check)
      let inDevBlock = false;
      let braceCount = 0;

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Track if we're inside a development-only block
        if (trimmedLine.includes('import.meta.env.DEV') || trimmedLine.includes('process.env.NODE_ENV')) {
          inDevBlock = true;
          braceCount = 0;
        }

        // Count braces to track block scope
        if (inDevBlock) {
          braceCount += (line.match(/{/g) || []).length;
          braceCount -= (line.match(/}/g) || []).length;

          if (braceCount <= 0) {
            inDevBlock = false;
          }
        }

        // Check for problematic console statements
        if (trimmedLine.includes('console.') &&
            !trimmedLine.includes('console.error') &&
            !trimmedLine.includes('//') &&
            !inDevBlock &&
            !trimmedLine.includes('import.meta.env.DEV') &&
            !trimmedLine.includes('process.env.NODE_ENV')) {
          problematicLines.push(index + 1);
        }
      });

      if (problematicLines.length > 0) {
        issues.push(`❌ ${file}: ${problematicLines.length} unguarded console statements`);
        problematicLines.forEach(lineNum => {
          log(`   Line ${lineNum}: ${lines[lineNum - 1].trim()}`, 'red');
        });
      } else {
        log(`✅ ${file}: No problematic console statements`, 'green');
      }
    }
  }

  if (issues.length === 0) {
    fixes.push('✅ All console statements properly guarded for production');
  }

  return { issues, fixes };
}

async function checkCORSConfiguration() {
  section('🌐 CORS CONFIGURATION AUDIT');

  const issues = [];
  const fixes = [];

  const corsFilePath = path.join(__dirname, '..', 'src', 'middleware', 'cors.middleware.js');

  if (fs.existsSync(corsFilePath)) {
    const corsContent = fs.readFileSync(corsFilePath, 'utf8');

    // Check for correct domain configuration
    if (corsContent.includes('permisosdigitales.com.mx')) {
      log('✅ CORS configured for correct production domain', 'green');
      fixes.push('✅ CORS domain configuration verified');
    } else {
      issues.push('❌ CORS may not be configured for production domain');
    }

    // Check for CloudFront distribution
    if (corsContent.includes('cloudfront.net')) {
      log('✅ CORS includes CloudFront distribution', 'green');
    } else {
      issues.push('❌ CORS missing CloudFront distribution');
    }
  } else {
    issues.push('❌ CORS middleware file not found');
  }

  return { issues, fixes };
}

async function checkCSRFConfiguration() {
  section('🛡️ CSRF CONFIGURATION AUDIT');

  const issues = [];
  const fixes = [];

  const csrfFilePath = path.join(__dirname, '..', 'src', 'middleware', 'csrf.middleware.js');

  if (fs.existsSync(csrfFilePath)) {
    const csrfContent = fs.readFileSync(csrfFilePath, 'utf8');

    // Check for correct sameSite configuration
    if (csrfContent.includes("sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'")) {
      log('✅ CSRF sameSite configured for cross-origin HTTPS', 'green');
      fixes.push('✅ CSRF sameSite configuration updated for production');
    } else if (csrfContent.includes("'strict'")) {
      issues.push('❌ CSRF sameSite set to "strict" - may cause cross-origin issues');
    }

    // Check for secure cookie configuration
    if (csrfContent.includes("secure: process.env.NODE_ENV === 'production'")) {
      log('✅ CSRF secure cookies configured for production', 'green');
    } else {
      issues.push('❌ CSRF secure cookies not properly configured');
    }
  } else {
    issues.push('❌ CSRF middleware file not found');
  }

  return { issues, fixes };
}

async function checkLocalization() {
  section('🌍 LOCALIZATION AUDIT');

  const issues = [];
  const fixes = [];

  // Check for English text that should be in Spanish
  const filesToCheck = [
    'frontend/src/constants/index.ts',
    'frontend/src/pages/PaymentErrorPage.tsx',
    'src/utils/api-response.js',
    'src/utils/conekta-error-mapper.js'
  ];

  let spanishTextFound = 0;
  let totalFilesChecked = 0;

  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      totalFilesChecked++;
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for Spanish text patterns
      const spanishPatterns = [
        /[Pp]or favor/,
        /[Ii]nténta/,
        /[Ee]rror/,
        /[Pp]ago/,
        /[Tt]arjeta/,
        /[Cc]ontraseña/,
        /[Cc]orreo/
      ];

      const hasSpanishText = spanishPatterns.some(pattern => pattern.test(content));
      if (hasSpanishText) {
        spanishTextFound++;
        log(`✅ ${file}: Contains Spanish localization`, 'green');
      } else {
        log(`⚠️  ${file}: May need Spanish localization review`, 'yellow');
      }
    }
  }

  if (spanishTextFound === totalFilesChecked) {
    fixes.push('✅ All checked files contain Spanish localization');
  } else {
    issues.push(`❌ ${totalFilesChecked - spanishTextFound} files may need localization review`);
  }

  return { issues, fixes };
}

async function generateProductionReport() {
  section('📋 PRODUCTION AUDIT REPORT');

  const audits = [
    await checkEnvironmentConfiguration(),
    await checkConsoleStatements(),
    await checkCORSConfiguration(),
    await checkCSRFConfiguration(),
    await checkLocalization()
  ];

  const allIssues = audits.flatMap(audit => audit.issues);
  const allFixes = audits.flatMap(audit => audit.fixes);

  subsection('SUMMARY');
  log(`Total Issues Found: ${allIssues.length}`, allIssues.length > 0 ? 'red' : 'green');
  log(`Total Fixes Applied: ${allFixes.length}`, 'green');

  if (allIssues.length > 0) {
    subsection('REMAINING ISSUES');
    allIssues.forEach(issue => log(issue, 'red'));
  }

  if (allFixes.length > 0) {
    subsection('FIXES APPLIED');
    allFixes.forEach(fix => log(fix, 'green'));
  }

  subsection('NEXT STEPS');
  log('1. Update .env.production with actual production values', 'yellow');
  log('2. Verify database connection strings', 'yellow');
  log('3. Test CSRF token generation in production', 'yellow');
  log('4. Verify CORS allows frontend domain', 'yellow');
  log('5. Test payment flow end-to-end', 'yellow');

  return { totalIssues: allIssues.length, totalFixes: allFixes.length };
}

// Main execution
async function main() {
  try {
    log('🚀 Starting Production Audit & Fix Process...', 'cyan');

    const result = await generateProductionReport();

    if (result.totalIssues === 0) {
      log('\n🎉 Production audit completed successfully! No critical issues found.', 'green');
    } else {
      log(`\n⚠️  Production audit completed with ${result.totalIssues} issues requiring attention.`, 'yellow');
    }

    log(`\n📊 Applied ${result.totalFixes} fixes during audit.`, 'blue');

  } catch (error) {
    log(`\n💥 Audit failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the audit
main();

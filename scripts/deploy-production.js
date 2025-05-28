#!/usr/bin/env node

/**
 * Production Deployment Script
 * Automates the production deployment process with safety checks
 */

const { execSync, spawn } = require('child_process');
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

function execCommand(command, options = {}) {
  try {
    log(`Executing: ${command}`, 'blue');
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      ...options 
    });
    return result.trim();
  } catch (error) {
    log(`Command failed: ${error.message}`, 'red');
    throw error;
  }
}

async function checkPrerequisites() {
  section('🔍 PRE-DEPLOYMENT CHECKS');
  
  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = execCommand('node --version');
        log(`Node.js version: ${version}`, 'green');
        return true;
      }
    },
    {
      name: 'npm version',
      check: () => {
        const version = execCommand('npm --version');
        log(`npm version: ${version}`, 'green');
        return true;
      }
    },
    {
      name: 'Production environment file',
      check: () => {
        const envPath = path.join(__dirname, '..', '.env.production');
        if (fs.existsSync(envPath)) {
          log('✅ .env.production file exists', 'green');
          return true;
        } else {
          log('❌ .env.production file not found', 'red');
          return false;
        }
      }
    },
    {
      name: 'Git status',
      check: () => {
        try {
          const status = execCommand('git status --porcelain');
          if (status.length === 0) {
            log('✅ Git working directory is clean', 'green');
            return true;
          } else {
            log('⚠️  Git working directory has uncommitted changes:', 'yellow');
            log(status, 'yellow');
            return true; // Not blocking, just a warning
          }
        } catch (error) {
          log('⚠️  Could not check git status', 'yellow');
          return true;
        }
      }
    }
  ];
  
  let allPassed = true;
  for (const check of checks) {
    try {
      log(`Checking ${check.name}...`, 'blue');
      const result = check.check();
      if (!result) allPassed = false;
    } catch (error) {
      log(`❌ ${check.name} check failed: ${error.message}`, 'red');
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function runConnectionTests() {
  section('🔗 CONNECTION TESTS');
  
  log('Running production connection tests...', 'blue');
  
  try {
    execCommand('node scripts/test-production-connections.js', {
      env: { ...process.env, NODE_ENV: 'production' }
    });
    log('✅ All connection tests passed!', 'green');
    return true;
  } catch (error) {
    log('❌ Connection tests failed!', 'red');
    log('Please fix connection issues before proceeding with deployment.', 'yellow');
    return false;
  }
}

async function buildFrontend() {
  section('🏗️  BUILDING FRONTEND');
  
  try {
    log('Installing frontend dependencies...', 'blue');
    execCommand('npm install', { cwd: path.join(__dirname, '..', 'frontend') });
    
    log('Building frontend for production...', 'blue');
    execCommand('npm run build', { 
      cwd: path.join(__dirname, '..', 'frontend'),
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    log('✅ Frontend build completed successfully!', 'green');
    
    // Check if build directory exists
    const buildPath = path.join(__dirname, '..', 'frontend', 'dist');
    if (fs.existsSync(buildPath)) {
      const files = fs.readdirSync(buildPath);
      log(`Build directory contains ${files.length} files/folders`, 'blue');
      return true;
    } else {
      log('❌ Build directory not found', 'red');
      return false;
    }
  } catch (error) {
    log('❌ Frontend build failed!', 'red');
    return false;
  }
}

async function installBackendDependencies() {
  section('📦 BACKEND DEPENDENCIES');
  
  try {
    log('Installing backend production dependencies...', 'blue');
    execCommand('npm install --production');
    
    log('✅ Backend dependencies installed successfully!', 'green');
    return true;
  } catch (error) {
    log('❌ Backend dependency installation failed!', 'red');
    return false;
  }
}

async function runDatabaseMigrations() {
  section('🗄️  DATABASE MIGRATIONS');
  
  try {
    log('Running database migrations...', 'blue');
    execCommand('npm run migrate:up', {
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    log('✅ Database migrations completed successfully!', 'green');
    return true;
  } catch (error) {
    log('❌ Database migrations failed!', 'red');
    log('Please check your database connection and migration files.', 'yellow');
    return false;
  }
}

async function startProductionServer() {
  section('🚀 STARTING PRODUCTION SERVER');
  
  log('Starting production server...', 'blue');
  log('Press Ctrl+C to stop the server', 'yellow');
  
  const serverProcess = spawn('npm', ['start'], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (error) => {
    log(`❌ Server failed to start: ${error.message}`, 'red');
  });
  
  serverProcess.on('exit', (code) => {
    if (code === 0) {
      log('✅ Server stopped gracefully', 'green');
    } else {
      log(`❌ Server exited with code ${code}`, 'red');
    }
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    log('\n🛑 Stopping server...', 'yellow');
    serverProcess.kill('SIGINT');
  });
  
  return new Promise((resolve) => {
    serverProcess.on('exit', resolve);
  });
}

async function deploymentSummary() {
  section('📋 DEPLOYMENT SUMMARY');
  
  const summaryItems = [
    '✅ Pre-deployment checks completed',
    '✅ Connection tests passed',
    '✅ Frontend built for production',
    '✅ Backend dependencies installed',
    '✅ Database migrations executed',
    '🚀 Production server started'
  ];
  
  summaryItems.forEach(item => log(item, 'green'));
  
  log('\n🎉 Deployment completed successfully!', 'bold');
  
  section('🔗 IMPORTANT URLS');
  log('Frontend: https://permisosdigitales.com.mx', 'blue');
  log('API: https://api.permisosdigitales.com.mx/api', 'blue');
  log('Health Check: https://api.permisosdigitales.com.mx/health', 'blue');
  
  section('📊 MONITORING');
  log('Monitor the following after deployment:', 'yellow');
  log('• Application logs for errors', 'blue');
  log('• Payment transactions in Conekta dashboard', 'blue');
  log('• Database performance in AWS RDS', 'blue');
  log('• Redis performance in ElastiCache', 'blue');
  log('• S3 bucket usage and permissions', 'blue');
  log('• Email delivery (test with actual users)', 'blue');
}

async function main() {
  log('🚀 PERMISOS DIGITALES - PRODUCTION DEPLOYMENT', 'bold');
  log('Starting automated production deployment process...', 'blue');
  
  try {
    // Step 1: Prerequisites
    const prereqsPassed = await checkPrerequisites();
    if (!prereqsPassed) {
      log('❌ Prerequisites check failed. Please fix issues before continuing.', 'red');
      process.exit(1);
    }
    
    // Step 2: Connection tests
    const connectionsPassed = await runConnectionTests();
    if (!connectionsPassed) {
      log('❌ Connection tests failed. Please fix connection issues before continuing.', 'red');
      process.exit(1);
    }
    
    // Step 3: Build frontend
    const frontendBuilt = await buildFrontend();
    if (!frontendBuilt) {
      log('❌ Frontend build failed. Please fix build issues before continuing.', 'red');
      process.exit(1);
    }
    
    // Step 4: Install backend dependencies
    const backendReady = await installBackendDependencies();
    if (!backendReady) {
      log('❌ Backend setup failed. Please fix dependency issues before continuing.', 'red');
      process.exit(1);
    }
    
    // Step 5: Run database migrations
    const migrationsCompleted = await runDatabaseMigrations();
    if (!migrationsCompleted) {
      log('❌ Database migrations failed. Please fix database issues before continuing.', 'red');
      process.exit(1);
    }
    
    // Step 6: Show deployment summary
    await deploymentSummary();
    
    // Step 7: Start production server
    await startProductionServer();
    
  } catch (error) {
    log(`\n💥 Deployment failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the deployment
main();

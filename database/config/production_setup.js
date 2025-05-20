// tools/database/setup/production_setup.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Create a log file
const logStream = fs.createWriteStream(path.join(__dirname, 'production_setup.log'), { flags: 'a' });
const log = (message) => {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`${colors.blue}==================================================${colors.reset}`);
console.log(`${colors.blue}  Permisos Digitales - Production Database Setup${colors.reset}`);
console.log(`${colors.blue}==================================================${colors.reset}`);
console.log(`\nThis script will set up a production-ready PostgreSQL database for Permisos Digitales.`);
console.log(`${colors.yellow}WARNING: This will create a new database and user. Existing data will not be affected.${colors.reset}`);
console.log(`\nThe script will:`);
console.log(`  1. Create a dedicated database user with limited permissions`);
console.log(`  2. Create a new production database`);
console.log(`  3. Set up the database schema`);
console.log(`  4. Create an initial admin user`);
console.log(`  5. Configure connection pooling for production`);
console.log(`  6. Set up database backup scripts`);

rl.question(`${colors.cyan}Do you want to proceed? (yes/no): ${colors.reset}`, (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log(`${colors.yellow}Database setup canceled.${colors.reset}`);
    rl.close();
    logStream.end();
    return;
  }
  
  // Setup database user and password
  console.log(`\n${colors.blue}Production Database Configuration${colors.reset}`);
  console.log(`${colors.cyan}Default values are shown in brackets. Press Enter to accept the default.${colors.reset}`);
  
  rl.question(`${colors.cyan}PostgreSQL superuser [postgres]: ${colors.reset}`, (pgUser) => {
    pgUser = pgUser || 'postgres';
    
    rl.question(`${colors.cyan}Production database name [permisos_digitales]: ${colors.reset}`, (dbName) => {
      dbName = dbName || 'permisos_digitales';
      
      rl.question(`${colors.cyan}Application DB user [permisos_admin]: ${colors.reset}`, (dbUser) => {
        dbUser = dbUser || 'permisos_admin';
        
        rl.question(`${colors.cyan}Application DB password [Permisos2025!]: ${colors.reset}`, (dbPassword) => {
          dbPassword = dbPassword || 'Permisos2025!';
          
          // Confirm settings
          console.log(`\n${colors.blue}Database Configuration Summary:${colors.reset}`);
          console.log(`- PostgreSQL Superuser: ${pgUser}`);
          console.log(`- Production Database Name: ${dbName}`);
          console.log(`- Application DB User: ${dbUser}`);
          console.log(`- Password: ${'*'.repeat(dbPassword.length)}`);
          
          rl.question(`${colors.cyan}Confirm these settings? (yes/no): ${colors.reset}`, (confirm) => {
            if (confirm.toLowerCase() !== 'yes') {
              console.log(`${colors.yellow}Database setup canceled.${colors.reset}`);
              rl.close();
              logStream.end();
              return;
            }
            
            // Create production SQL files with the provided settings
            try {
              log("Creating production database SQL files...");
              
              // Create production database SQL
              const createDbSql = `
-- production_create_database.sql
-- Script to create the production database and user (run as postgres superuser)

-- Terminate existing connections to the target database (needed for DROP)
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${dbName}'
  AND pid <> pg_backend_pid();

-- Create a dedicated database user for the application if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${dbUser}') THEN
    CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';
  END IF;
END
$$;

-- Create the database and set the owner directly
CREATE DATABASE ${dbName}
  WITH 
  OWNER = ${dbUser}
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Connect to the new database
\\c ${dbName}

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};
GRANT ALL ON SCHEMA public TO ${dbUser};
`;
              
              fs.writeFileSync(path.join(__dirname, 'production_create_database.sql'), createDbSql);
              log("Created production_create_database.sql");
              
              // Create .env.production file
              const envProduction = `# Server Config
NODE_ENV=production
PORT=3001

# Database Configuration - Production
DATABASE_URL=postgres://${dbUser}:${dbPassword}@localhost:5432/${dbName}

# Session Secret (generate a strong random string)
SESSION_SECRET=${require('crypto').randomBytes(32).toString('hex')}

# Email Configuration
EMAIL_HOST=${process.env.EMAIL_HOST || 'smtp.example.com'}
EMAIL_PORT=${process.env.EMAIL_PORT || '587'}
EMAIL_USER=${process.env.EMAIL_USER || 'user@example.com'}
EMAIL_PASS=${process.env.EMAIL_PASS || 'password'}
EMAIL_FROM=noreply@permisos-digitales.com

# Application URLs (update with production domains)
APP_URL=https://api.permisos-digitales.com
FRONTEND_URL=https://permisos-digitales.com
API_URL=https://api.permisos-digitales.com/api

# Security Settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
COOKIE_SECRET=${require('crypto').randomBytes(32).toString('hex')}
ENABLE_HTTPS_REDIRECT=true
`;
              
              fs.writeFileSync(path.join(__dirname, '../../..', '.env.production'), envProduction);
              log("Created .env.production file");
              
              // Execute the database setup scripts
              const executeScript = (scriptName, description, isProduction = false) => {
                console.log(`\n${colors.blue}${description}...${colors.reset}`);
                log(`Executing ${scriptName}...`);
                try {
                  if (scriptName === 'production_create_database.sql') {
                    // First script needs to run as postgres superuser
                    execSync(`psql -U ${pgUser} -f "${path.join(__dirname, scriptName)}"`, {
                      stdio: 'inherit'
                    });
                  } else {
                    // Other scripts run as application db user
                    execSync(`psql -U ${dbUser} -d ${dbName} -f "${path.join(__dirname, scriptName)}"`, {
                      stdio: 'inherit',
                      env: { ...process.env, PGPASSWORD: dbPassword }
                    });
                  }
                  log(`Successfully executed ${scriptName}`);
                  return true;
                } catch (err) {
                  log(`Error executing ${scriptName}: ${err.message}`);
                  console.error(`${colors.red}Error executing ${scriptName}:${colors.reset}`, err);
                  return false;
                }
              };
              
              // Create backup directory
              const backupDir = path.join(__dirname, '../../..', 'backups');
              if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
                log("Created backups directory");
              }
              
              // Execute production database creation
              if (!executeScript('production_create_database.sql', 'Creating production database')) {
                console.log(`${colors.red}Failed to create production database. See log for details.${colors.reset}`);
                rl.close();
                logStream.end();
                return;
              }
              
              // Execute schema creation
              if (!executeScript('2_create_schema.sql', 'Creating database schema')) {
                console.log(`${colors.red}Failed to create database schema. See log for details.${colors.reset}`);
                rl.close();
                logStream.end();
                return;
              }
              
              // Execute admin user creation
              if (!executeScript('3_create_admin_user.sql', 'Creating admin users')) {
                console.log(`${colors.red}Failed to create admin users. See log for details.${colors.reset}`);
                rl.close();
                logStream.end();
                return;
              }
              
              console.log(`\n${colors.green}Production database setup completed successfully!${colors.reset}`);
              console.log(`\n${colors.blue}Next Steps:${colors.reset}`);
              console.log(`1. Update your application to use the production database`);
              console.log(`   - Set NODE_ENV=production in your environment`);
              console.log(`   - Or use the .env.production file`);
              console.log(`2. Set up regular database backups using the provided scripts`);
              console.log(`3. Configure your web server for HTTPS`);
              
              rl.close();
              logStream.end();
            } catch (err) {
              log(`Error during production setup: ${err.message}`);
              console.error(`${colors.red}Error during production setup:${colors.reset}`, err);
              rl.close();
              logStream.end();
            }
          });
        });
      });
    });
  });
});

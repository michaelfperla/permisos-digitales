// scripts/db-recreate/setup.js
// Node.js script to recreate the database with proper error handling

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createWriteStream } = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file
const logStream = createWriteStream(path.join(logsDir, 'db-setup.log'), { flags: 'a' });
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  logStream.write(logMessage + '\n');
  console.log(message);
};

console.log(`${colors.magenta}┌───────────────────────────────────────────────┐${colors.reset}`);
console.log(`${colors.magenta}│ Permisos Digitales - Database Setup Utility   │${colors.reset}`);
console.log(`${colors.magenta}└───────────────────────────────────────────────┘${colors.reset}`);
console.log(`${colors.cyan}This utility will create a new database for the Permisos Digitales application.${colors.reset}`);
console.log(`${colors.yellow}Version: 1.0.0 | Date: April 2025${colors.reset}`);
console.log();
console.log(`${colors.red}WARNING: This will drop and recreate the database if it already exists!${colors.reset}`);
console.log();

rl.question(`${colors.cyan}Do you want to proceed? (yes/no): ${colors.reset}`, (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log(`${colors.yellow}Database setup canceled.${colors.reset}`);
    rl.close();
    logStream.end();
    return;
  }
  
  // Setup database user and password
  console.log(`\n${colors.blue}Database Configuration${colors.reset}`);
  console.log(`${colors.cyan}Default values are shown in brackets. Press Enter to accept the default.${colors.reset}`);
  
  rl.question(`${colors.cyan}PostgreSQL superuser [postgres]: ${colors.reset}`, (pgUser) => {
    pgUser = pgUser || 'postgres';
    
    rl.question(`${colors.cyan}Database name [permisos_digitales_dev]: ${colors.reset}`, (dbName) => {
      dbName = dbName || 'permisos_digitales_dev';
      
      rl.question(`${colors.cyan}Application DB user [permisos_admin]: ${colors.reset}`, (dbUser) => {
        dbUser = dbUser || 'permisos_admin';
        
        rl.question(`${colors.cyan}Application DB password [Permisos2025!]: ${colors.reset}`, (dbPassword) => {
          dbPassword = dbPassword || 'Permisos2025!';
          
          // Confirm settings
          console.log(`\n${colors.blue}Database Configuration Summary:${colors.reset}`);
          console.log(`- PostgreSQL Superuser: ${pgUser}`);
          console.log(`- Database Name: ${dbName}`);
          console.log(`- Application DB User: ${dbUser}`);
          console.log(`- Password: ${'*'.repeat(dbPassword.length)}`);
          
          rl.question(`\n${colors.cyan}Confirm these settings? (yes/no): ${colors.reset}`, (confirmSettings) => {
            if (confirmSettings.toLowerCase() !== 'yes') {
              console.log(`${colors.yellow}Database setup canceled.${colors.reset}`);
              rl.close();
              logStream.end();
              return;
            }
            
            // Update 1_create_database.sql with user settings
            try {
              log("Updating database creation script with user settings...");
              const dbSetupPath = path.join(__dirname, '1_create_database.sql');
              let content = fs.readFileSync(dbSetupPath, 'utf8');
              content = content.replace(/CREATE USER permisos_admin/, `CREATE USER ${dbUser}`);
              content = content.replace(/WITH PASSWORD 'Permisos2025!'/, `WITH PASSWORD '${dbPassword}'`);
              content = content.replace(/permisos_digitales_dev/g, dbName);
              content = content.replace(/permisos_admin/g, dbUser);
              fs.writeFileSync(dbSetupPath, content);
              log("Database creation script updated successfully.");
            } catch (err) {
              log(`Error updating database script: ${err.message}`);
              console.error(`${colors.red}Error updating SQL file:${colors.reset}`, err);
              rl.close();
              logStream.end();
              return;
            }
            
            // Update .env.example
            try {
              log("Updating .env.example with database settings...");
              const envPath = path.join(__dirname, '../../.env.example');
              let envContent = fs.readFileSync(envPath, 'utf8');
              envContent = envContent.replace(/DATABASE_URL=postgres:\/\/[^@]+@[^/]+\/[^$]+/, 
                `DATABASE_URL=postgres://${dbUser}:${dbPassword}@localhost:5432/${dbName}`);
              fs.writeFileSync(envPath, envContent);
              
              // Create .env file if it doesn't exist
              const envFilePath = path.join(__dirname, '../../.env');
              if (!fs.existsSync(envFilePath)) {
                fs.writeFileSync(envFilePath, envContent);
                log(".env file created with database settings.");
              }
            } catch (err) {
              log(`Error updating environment files: ${err.message}`);
              console.error(`${colors.red}Error updating environment files:${colors.reset}`, err);
              // Continue anyway, this is not critical
            }
            
            // Execute the database setup scripts
            const executeScript = (scriptName, description) => {
              console.log(`\n${colors.blue}${description}...${colors.reset}`);
              log(`Executing ${scriptName}...`);
              try {
                if (scriptName === '1_create_database.sql') {
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
                console.error(`${colors.red}Error:${colors.reset}`, err.message);
                return false;
              }
            };
            
            // Create storage directories
            try {
              log("Creating storage directories...");
              const storageDir = path.join(__dirname, '../../storage');
              const uploadsDir = path.join(storageDir, 'uploads');
              const permitsDir = path.join(storageDir, 'permits');
              const paymentProofsDir = path.join(uploadsDir, 'payment_proofs');
              
              if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              if (!fs.existsSync(permitsDir)) fs.mkdirSync(permitsDir, { recursive: true });
              if (!fs.existsSync(paymentProofsDir)) fs.mkdirSync(paymentProofsDir, { recursive: true });
              
              log("Storage directories created successfully.");
            } catch (err) {
              log(`Error creating storage directories: ${err.message}`);
              console.error(`${colors.red}Error creating storage directories:${colors.reset}`, err);
              // Continue anyway
            }
            
            // Execute all scripts in sequence
            const scripts = [
              { file: '1_create_database.sql', desc: 'Creating database' },
              { file: '2_create_schema.sql', desc: 'Creating database schema' },
              { file: '3_create_admin_user.sql', desc: 'Creating admin users' },
              { file: '4_sample_data.sql', desc: 'Populating sample data' }
            ];
            
            let success = true;
            for (const script of scripts) {
              if (!executeScript(script.file, script.desc)) {
                success = false;
                break;
              }
            }
            
            if (success) {
              console.log(`\n${colors.green}┌───────────────────────────────────────────────┐${colors.reset}`);
              console.log(`${colors.green}│ Database setup completed successfully!         │${colors.reset}`);
              console.log(`${colors.green}└───────────────────────────────────────────────┘${colors.reset}`);
              
              console.log(`\n${colors.blue}Database Connection Information:${colors.reset}`);
              console.log(`- Host: localhost`);
              console.log(`- Database: ${dbName}`);
              console.log(`- User: ${dbUser}`);
              console.log(`- Password: ${'*'.repeat(dbPassword.length)}`);
              
              console.log(`\n${colors.blue}Admin Login:${colors.reset}`);
              console.log(`- Email: admin@permisos-digitales.mx`);
              console.log(`- Password: AdminSecure2025! (change this in production)`);
              
              console.log(`\n${colors.blue}Staff Login:${colors.reset}`);
              console.log(`- Email: supervisor@permisos-digitales.mx`);
              console.log(`- Password: StaffAccess2025! (change this in production)`);
              
              console.log(`\n${colors.blue}Sample Client Login:${colors.reset}`);
              console.log(`- Email: cliente@ejemplo.com`);
              console.log(`- Password: Cliente2025! (for testing only)`);
              
              console.log(`\n${colors.cyan}To start the application:${colors.reset}`);
              console.log(`1. npm install`);
              console.log(`2. npm run dev`);
              
              log("Database setup completed successfully!");
            } else {
              console.log(`\n${colors.red}Database setup failed. Check the errors above.${colors.reset}`);
              log("Database setup failed.");
            }
            
            rl.close();
            logStream.end();
          });
        });
      });
    });
  });
});

rl.on('close', () => {
  process.exit(0);
});
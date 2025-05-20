/**
 * =============================================================================
 * Permisos Digitales - Run Database Migration
 * =============================================================================
 *
 * Script to run the database migration to add the payment_states table.
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../../src/config');

console.log('Running database migration to add payment_states table...');

// Parse the DATABASE_URL to get the database name and user
const dbUrlRegex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
const match = config.databaseUrl.match(dbUrlRegex);

if (!match) {
  console.error('Error: Could not parse DATABASE_URL from environment variables.');
  process.exit(1);
}

const [, dbUser, dbPassword, dbHost, dbPort, dbName] = match;

// Path to the migration SQL file
const migrationFile = path.join(__dirname, '../migrations/20230815_add_payment_states_table.sql');

// Check if the migration file exists
if (!fs.existsSync(migrationFile)) {
  console.error(`Error: Migration file not found at ${migrationFile}`);
  process.exit(1);
}

try {
  // Run the migration
  console.log(`Executing migration on database ${dbName} as user ${dbUser}...`);

  execSync(`psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -f "${migrationFile}"`, {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: dbPassword }
  });

  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Error executing migration:', error.message);
  process.exit(1);
}

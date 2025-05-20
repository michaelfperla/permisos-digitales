/**
 * =============================================================================
 * Permisos Digitales - Verify Payment States Table
 * =============================================================================
 *
 * Script to verify that the payment_states table exists in the database.
 */

require('dotenv').config();
const { execSync } = require('child_process');
const config = require('../../src/config');

console.log('Verifying payment_states table...');

// Parse the DATABASE_URL to get the database name and user
const dbUrlRegex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
const match = config.databaseUrl.match(dbUrlRegex);

if (!match) {
  console.error('Error: Could not parse DATABASE_URL from environment variables.');
  process.exit(1);
}

const [, dbUser, dbPassword, dbHost, dbPort, dbName] = match;

try {
  // Run the verification query
  console.log(`Connecting to database ${dbName} as user ${dbUser}...`);

  const verificationQuery = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'payment_states'
    );
  `;

  const result = execSync(`psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -c "${verificationQuery}"`, {
    env: { ...process.env, PGPASSWORD: dbPassword }
  }).toString();

  console.log('Verification result:');
  console.log(result);

  // Get table structure
  console.log('Table structure:');
  const structureQuery = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payment_states'
    ORDER BY ordinal_position;
  `;

  const structureResult = execSync(`psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -c "${structureQuery}"`, {
    env: { ...process.env, PGPASSWORD: dbPassword }
  }).toString();

  console.log(structureResult);

  // Get indexes
  console.log('Indexes:');
  const indexesQuery = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'payment_states';
  `;

  const indexesResult = execSync(`psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -c "${indexesQuery}"`, {
    env: { ...process.env, PGPASSWORD: dbPassword }
  }).toString();

  console.log(indexesResult);

  console.log('Verification completed successfully!');
} catch (error) {
  console.error('Error verifying table:', error.message);
  process.exit(1);
}

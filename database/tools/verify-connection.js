// tools/database/verify-connection.js
require('dotenv').config();
const { Pool } = require('pg');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function verifyDatabaseConnection() {
  console.log(`${colors.blue}Verifying PostgreSQL database connection...${colors.reset}`);

  // Get database URL from environment variables
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(`${colors.red}❌ DATABASE_URL environment variable is not set.${colors.reset}`);
    return false;
  }

  console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' && process.env.DISABLE_SSL !== 'true'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    // Test the connection
    const client = await pool.connect();
    console.log(`${colors.green}✅ Successfully connected to the database${colors.reset}`);

    // Check basic database information
    const versionResult = await client.query('SELECT version()');
    console.log(`${colors.blue}Database version:${colors.reset} ${versionResult.rows[0].version}`);

    // Check PostgreSQL configuration
    const configQuery = `
      SELECT name, setting, unit, context
      FROM pg_settings
      WHERE name IN (
        'max_connections', 'shared_buffers', 'effective_cache_size',
        'work_mem', 'maintenance_work_mem', 'random_page_cost',
        'checkpoint_completion_target', 'wal_buffers', 'default_statistics_target',
        'synchronous_commit', 'log_min_duration_statement'
      )
      ORDER BY name;
    `;
    const configResult = await client.query(configQuery);

    console.log(`\n${colors.blue}PostgreSQL Configuration:${colors.reset}`);
    console.table(configResult.rows);

    // Check table existence
    const tableQuery = `
      SELECT table_name,
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tableResult = await client.query(tableQuery);

    console.log(`\n${colors.blue}Database tables:${colors.reset}`);
    console.table(tableResult.rows);

    // Check user count
    try {
      const userCountResult = await client.query('SELECT COUNT(*) FROM users');
      console.log(`\n${colors.blue}Total users:${colors.reset} ${userCountResult.rows[0].count}`);
    } catch (error) {
      console.log(`\n${colors.yellow}Could not count users: ${error.message}${colors.reset}`);
    }

    // Check database size
    const sizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
    `;
    const sizeResult = await client.query(sizeQuery);
    console.log(`\n${colors.blue}Database size:${colors.reset} ${sizeResult.rows[0].database_size}`);

    // Check extensions
    const extensionsQuery = `
      SELECT name, default_version, installed_version, comment
      FROM pg_available_extensions
      WHERE installed_version IS NOT NULL
      ORDER BY name;
    `;
    const extensionsResult = await client.query(extensionsQuery);

    console.log(`\n${colors.blue}Installed extensions:${colors.reset}`);
    console.table(extensionsResult.rows);

    // Release the client back to the pool
    client.release();

    // Close the pool
    await pool.end();

    console.log(`\n${colors.green}Database verification completed successfully.${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Database connection error:${colors.reset} ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.error(`\n${colors.yellow}The database server is not running or is not accepting connections.${colors.reset}`);
      console.error(`1. Check if PostgreSQL service is running: Get-Service postgresql*`);
      console.error(`2. Verify the connection details in your .env file`);
    } else if (error.code === '28P01') {
      console.error(`\n${colors.yellow}Authentication failed. The provided username and password are incorrect.${colors.reset}`);
      console.error(`1. Verify the username and password in your database URL`);
      console.error(`2. Confirm that the user has been created in PostgreSQL`);
    } else if (error.code === '3D000') {
      console.error(`\n${colors.yellow}Database does not exist.${colors.reset}`);
      console.error(`Run the database creation script: node tools/database/setup/production_setup.js`);
    }

    await pool.end();
    return false;
  }
}

// Run the verification
verifyDatabaseConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });

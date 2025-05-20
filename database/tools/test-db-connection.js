// scripts/test-db-connection.js
require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  // Get database URL from environment variables
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set.');
    return false;
  }
  
  console.log(`Using database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  
  // Create a new pool
  const pool = new Pool({
    connectionString: databaseUrl
  });
  
  try {
    // Test the connection
    const client = await pool.connect();
    
    try {
      // Query the database
      const result = await client.query('SELECT NOW() as current_time');
      console.log(`✅ Database connection successful! Current time from DB: ${result.rows[0].current_time}`);
      
      // Check if required tables exist
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log('\nDatabase tables:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
      
      // Check if users table has records
      const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
      console.log(`\nUser count: ${usersResult.rows[0].user_count}`);
      
      // Check if admin users exist
      const adminResult = await client.query("SELECT COUNT(*) as admin_count FROM users WHERE account_type = 'admin'");
      console.log(`Admin user count: ${adminResult.rows[0].admin_count}`);
      
      return true;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  } finally {
    // End the pool
    await pool.end();
  }
}

// Run the test
testDatabaseConnection()
  .then(success => {
    console.log(`\nDatabase test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });

require('dotenv-flow').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
  try {
    // Check if payment_verification_log table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'payment_verification_log'
      );
    `);
    console.log('payment_verification_log table exists:', tableCheck.rows[0].exists);

    // Check payment-related columns in permit_applications
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'permit_applications'
      AND column_name LIKE '%payment%'
      ORDER BY column_name;
    `);
    console.log('\nPayment-related columns in permit_applications:');
    columnCheck.rows.forEach(row => console.log('  -', row.column_name));

    // Check what migrations have been run
    const migrationCheck = await pool.query('SELECT name FROM pgmigrations ORDER BY run_on;');
    console.log('\nMigrations run:');
    migrationCheck.rows.forEach(row => console.log('  -', row.name));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();

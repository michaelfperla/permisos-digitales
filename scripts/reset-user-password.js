// scripts/reset-user-password.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://permisos_admin:Permisos2025!@localhost:5432/permisos_digitales_dev'
});

// Function to hash password using bcrypt
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Function to reset user password
async function resetUserPassword(email, newPassword) {
  try {
    // Check if user exists
    const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await pool.query(checkUserQuery, [email]);
    
    if (userResult.rows.length === 0) {
      console.error(`User with email ${email} not found.`);
      return false;
    }
    
    // Hash the new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update the user's password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1 
      WHERE email = $2
      RETURNING id, email
    `;
    
    const result = await pool.query(updateQuery, [passwordHash, email]);
    
    if (result.rows.length > 0) {
      console.log(`Password reset successful for user: ${email} (ID: ${result.rows[0].id})`);
      return true;
    } else {
      console.error('Password update failed.');
      return false;
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  } finally {
    // Close the pool
    pool.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node reset-user-password.js <email> <new_password>');
  process.exit(1);
}

// Reset the password
resetUserPassword(email, newPassword)
  .then(success => {
    if (success) {
      console.log('Password reset completed successfully.');
    } else {
      console.error('Password reset failed.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

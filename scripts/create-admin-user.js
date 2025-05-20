// scripts/create-admin-user.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://permisos_admin:Permisos2025!@localhost:5432/permisos_digitales_dev'
});

// Function to hash password
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Function to create admin user
async function createAdminUser(email, password, firstName, lastName) {
  try {
    // Hash the password
    const passwordHash = await hashPassword(password);
    
    // Check if user already exists
    const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await pool.query(checkUserQuery, [email]);
    
    if (existingUser.rows.length > 0) {
      console.log(`User with email ${email} already exists.`);
      return;
    }
    
    // Insert the new admin user
    const insertUserQuery = `
      INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        role,
        account_type,
        is_admin_portal
      ) VALUES ($1, $2, $3, $4, 'admin', 'admin', TRUE)
      RETURNING id, email, first_name, last_name, role, account_type, is_admin_portal
    `;
    
    const result = await pool.query(insertUserQuery, [email, passwordHash, firstName, lastName]);
    
    console.log('Admin user created successfully:');
    console.log(result.rows[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    // Close the pool
    pool.end();
  }
}

// Prompt for user input
rl.question('Enter email: ', (email) => {
  rl.question('Enter password: ', (password) => {
    rl.question('Enter first name: ', (firstName) => {
      rl.question('Enter last name: ', (lastName) => {
        // Create the admin user
        createAdminUser(email, password, firstName, lastName)
          .then(() => {
            rl.close();
          })
          .catch((error) => {
            console.error('Error:', error);
            rl.close();
          });
      });
    });
  });
});

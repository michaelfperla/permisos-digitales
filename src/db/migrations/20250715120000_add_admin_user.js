/**
 * Migration to add an admin user
 */

const { hashPassword } = require('../../utils/password-utils');

exports.up = async (pgm) => {
  // First check if any admin users exist
  const adminCheckQuery = `
    SELECT id FROM users WHERE account_type = 'admin' OR is_admin_portal = true LIMIT 1
  `;
  
  // This will be executed as raw SQL
  const adminEmail = 'admin@permisosdigitales.com.mx';
  const adminPassword = 'TempAdmin123!'; // This should be changed immediately after first login
  
  // Note: We can't use async functions directly in migrations, so we use raw SQL
  // with a hashed password that we'll generate
  
  // This is a bcrypt hash for 'TempAdmin123!'
  const hashedPassword = '$2b$10$HvQsAOcSqxgPCGNLAr3UyuYLgJU9dwEzfHrPWgVrBNlvNlJ7qxG6a';
  
  pgm.sql(`
    DO $$
    BEGIN
      -- Only insert if no admin users exist
      IF NOT EXISTS (SELECT 1 FROM users WHERE account_type = 'admin' OR is_admin_portal = true) THEN
        INSERT INTO users (
          email, password_hash, first_name, last_name, 
          account_type, role, is_admin_portal, 
          is_email_verified, account_created_at
        ) VALUES (
          '${adminEmail}',
          '${hashedPassword}',
          'Admin',
          'User',
          'admin',
          'admin',
          true,
          true,
          CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE 'Admin user created: ${adminEmail}';
        RAISE NOTICE 'Password: TempAdmin123!';
        RAISE NOTICE 'IMPORTANT: Change this password immediately after first login!';
      ELSE
        RAISE NOTICE 'Admin user already exists, skipping creation';
      END IF;
    END
    $$;
  `);
};

exports.down = async (pgm) => {
  // Remove the admin user we created
  pgm.sql(`
    DELETE FROM users WHERE email = 'admin@permisosdigitales.com.mx' AND account_type = 'admin';
  `);
};
# Admin User Management

This directory contains scripts for managing admin users in the Permisos Digitales application.

## Creating an Admin User

There are two ways to create an admin user:

### Option 1: Use the existing admin credentials

The database already has admin users created:

- **Admin**: admin@permisos-digitales.mx / AdminSecure2025!
- **Supervisor**: supervisor@permisos-digitales.mx / StaffAccess2025!

You can use these credentials to log in to the admin portal.

### Option 2: Create a new admin user using the script

1. Make sure you have Node.js installed
2. Install the required dependencies:
   ```bash
   npm install bcrypt pg readline
   ```
3. Run the script:
   ```bash
   node scripts/create-admin-user.js
   ```
4. Follow the prompts to enter the admin user details:
   - Email
   - Password
   - First Name
   - Last Name

The script will create a new admin user with the provided details.

## Database Schema

The `users` table has the following admin-related fields:

- `role`: Set to 'admin' for admin users
- `account_type`: Set to 'admin' for admin users
- `is_admin_portal`: Set to TRUE for users who can access the admin portal

## Manual SQL

If you prefer to create an admin user directly using SQL, you can run the following query:

```sql
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  account_type,
  is_admin_portal
) VALUES (
  'your-admin-email@example.com',
  -- bcrypt hash of your password (you need to generate this)
  '$2b$10$bQqR3vSP.4X5XCeRQjrpj.mXaDN6jJeHPFTQpfvjgqLHX/QuV0Fpe', -- This is 'AdminSecure2025!'
  'Your',
  'Name',
  'admin',
  'admin',
  TRUE
);
```

Note: You should replace the password hash with a properly generated bcrypt hash of your desired password.

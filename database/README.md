# Permisos Digitales Database

This directory contains all database-related files for the Permisos Digitales application.

## Directory Structure

- **schema/** - Core database schema files
  - `1_create_database.sql` - Creates the database and user
  - `2_create_schema.sql` - Creates tables, indexes, and triggers
  - `3_create_admin_user.sql` - Creates admin users

- **migrations/** - Database migration files
  - `20240414_add_password_reset_tokens.sql` - Adds password reset functionality
  - `add_desired_start_date.sql` - Adds desired_start_date column to permit_applications

- **backups/** - Database backup files
  - `db_backup_before_migration.sql` - Backup before migration
  - `permisos_digitales_2025-04-20T18-32-21-289Z.sql` - Recent backup

- **tools/** - Database management scripts
  - `backup.js` - Creates database backups
  - `restore.js` - Restores database from backups
  - `monitor.js` - Monitors database performance
  - `verify-connection.js` - Verifies database connection
  - `test-db-connection.js` - Tests database connection
  - `run-migrations.js` - Runs all migrations
  - `run-migration.js` - Runs a specific migration

- **config/** - Database configuration files
  - `setup.js` - Main setup script
  - `production_setup.js` - Production environment setup
  - `postgresql.production.conf` - Production PostgreSQL configuration

## Database Schema

The database has several main tables:
- `users` - Stores user information (clients and administrators)
- `permit_applications` - Stores permit application data
- `payment_verification_log` - Logs payment verification activities
- `security_audit_log` - Logs security events for auditing
- `user_sessions` - Stores user session information
- `password_reset_tokens` - Stores password reset tokens

## Development Credentials

- **Admin**: admin@permisos-digitales.mx / AdminSecure2025!
- **Supervisor**: supervisor@permisos-digitales.mx / StaffAccess2025!
- **Client**: cliente@ejemplo.com / Cliente2025!

## Usage

### Setting Up the Database

```bash
# Run the setup script
node database/config/setup.js
```

### Creating a Backup

```bash
# Create a database backup
node database/tools/backup.js
```

### Running Migrations

```bash
# Run all migrations
node database/tools/run-migrations.js

# Run a specific migration
node database/tools/run-migration.js
```

### Testing Database Connection

```bash
# Test database connection
node database/tools/test-db-connection.js
```

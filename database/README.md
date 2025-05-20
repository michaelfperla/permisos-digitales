# Database Management

This directory contains files and tools related to the PostgreSQL database for the Permisos Digitales application.

For a high-level overview of the database schema and key tables, please refer to the [Database Documentation section in the main System Documentation](../docs/PROJECT_DOCUMENTATION.md#5-database-documentation).

## Directory Structure

*   **`schema/`**: Contains SQL scripts for the initial database setup.
    *   `1_create_database.sql`: Script to create the database instance and primary user.
    *   `2_create_schema.sql`: Script to define the initial set of tables, indexes, views, and other database objects.
    *   `3_create_admin_user.sql`: Script to pre-populate default administrative users.
*   **`migrations/`**: Contains older SQL-based migration files. Newer migrations are typically managed by `node-pg-migrate` and reside in `src/db/migrations/`.
*   **`backups/`**: Intended for storing database backup files.
*   **`tools/`**: Contains JavaScript utility scripts for database operations:
    *   `backup.js`: Script to perform database backups.
    *   `restore.js`: Script to restore the database from a backup.
    *   `monitor.js`: Script for monitoring database performance (if implemented).
    *   `verify-connection.js` & `test-db-connection.js`: Scripts to test and verify the database connection.
    *   `run-migrations.js` & `run-migration.js`: Scripts potentially used for managing SQL migrations in the `database/migrations/` folder.
*   **`config/`**: Configuration files related to database setup or specific environments.
    *   `setup.js` & `production_setup.js`: Scripts that likely orchestrate the initial database setup using the files in `database/schema/`.

## Database Setup

To set up a new database instance for development:

1.  Ensure your PostgreSQL server is running.
2.  Configure your backend `.env` file with the correct `DATABASE_URL` (pointing to your desired database name, user, and password).
3.  The target database should exist, or you should have permissions to create it.
4.  Run the setup script from the project root:
    ```bash
    npm run db:setup
    ```
    This command typically executes the `database/config/setup.js` script, which in turn runs the SQL files in `database/schema/` to create the database structure and initial admin users.

## Migrations

Schema changes beyond the initial setup are managed via migrations.

*   **Primary Migration Tool**: The project uses `node-pg-migrate` for managing schema evolution. Migration files for this tool are located in `src/db/migrations/`.
    *   To apply new migrations: `npm run migrate:up`
    *   To roll back the last migration: `npm run migrate:down`
    *   To create a new migration: `npm run migrate:create YourMigrationName`
*   **Legacy SQL Migrations**: Older SQL migration files might exist in `database/migrations/`. The scripts in `database/tools/` (e.g., `run-migrations.js`) might be used for these, if applicable. It's recommended to use `node-pg-migrate` for all new schema changes.

## Development Credentials

Default administrative and client credentials created by the `3_create_admin_user.sql` script are:
*   **Admin**: `admin@permisos-digitales.mx` / `AdminSecure2025!`
*   **Supervisor**: `supervisor@permisos-digitales.mx` / `StaffAccess2025!`
*   **Client**: `cliente@ejemplo.com` / `Cliente2025!`

**Note**: Always change default passwords in production environments.

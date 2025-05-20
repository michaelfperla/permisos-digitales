-- 1_create_database.sql
-- Script to create the database and user (run as postgres superuser)
-- IMPORTANT: This script DROPS the database if it exists.

-- Terminate existing connections to the target database (needed for DROP)
-- Note: We will replace 'permisos_digitales_dev' and 'permisos_admin' later
--       if the user provides different names in the setup script.
--       Make sure the placeholder names here match the defaults in setup.js
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'permisos_digitales_dev' -- Target database name
  AND pid <> pg_backend_pid(); -- Don't kill our own connection

-- Drop the database if it exists
DROP DATABASE IF EXISTS permisos_digitales_dev; -- Target database name

-- Create a dedicated database user for the application if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'permisos_admin') THEN -- Target user name
    CREATE USER permisos_admin WITH PASSWORD 'Permisos2025!'; -- Target user and password
  END IF;
END
$$;

-- Create the database and set the owner directly
CREATE DATABASE permisos_digitales_dev -- Target database name
  OWNER permisos_admin; -- Target user name (owner)

-- Grant connect permission (owner usually has it, but being explicit is safe)
GRANT CONNECT ON DATABASE permisos_digitales_dev TO permisos_admin; -- Target database and user

--
-- We stop here for this script.
-- The next script (2_create_schema.sql) will connect TO this database
-- AS the 'permisos_admin' user and create tables, etc.
-- We removed the '\c' and the 'GRANT ALL ON SCHEMA public...' lines from here.
--
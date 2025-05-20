// pgm-config.js
require('dotenv-flow').config();

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Migrations cannot run.');
}

module.exports = {
  // Migration directory
  dir: 'src/db/migrations',

  // Migration table name (different from the old schema_migrations table)
  migrationsTable: 'pgmigrations',

  // Database connection - use environment variable
  databaseUrl: process.env.DATABASE_URL,

  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

  // Migration file template
  templateFile: './migration-template.js',

  // Verbose output
  verbose: true
};

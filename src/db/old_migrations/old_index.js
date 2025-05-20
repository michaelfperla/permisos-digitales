/**
 * Database Migration System
 * Manages database schema changes in a versioned way
 */
const fs = require('fs').promises;
const path = require('path');
const db = require('../index');
const { logger } = require('../../utils/enhanced-logger');

/**
 * Ensure the migrations table exists
 */
async function ensureMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  try {
    await db.query(query);
    logger.info('Migrations table verified');
    return true;
  } catch (error) {
    logger.error('Failed to create migrations table:', error);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations() {
  const query = 'SELECT version FROM schema_migrations ORDER BY version';
  const { rows } = await db.query(query);
  return rows.map(row => row.version);
}

/**
 * Apply a single migration
 */
async function applyMigration(version, description, sql) {
  const client = await db.dbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Run the migration SQL
    await client.query(sql);
    
    // Record the migration
    await client.query(
      'INSERT INTO schema_migrations (version, description) VALUES ($1, $2)',
      [version, description]
    );
    
    await client.query('COMMIT');
    logger.info(`Applied migration ${version}: ${description}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to apply migration ${version}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations();
    logger.info(`Found ${appliedMigrations.length} previously applied migrations`);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'scripts');
    const files = await fs.readdir(migrationsDir);
    
    // Filter and sort migration files
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    logger.info(`Found ${migrationFiles.length} migration files`);
    
    // Apply each migration that hasn't been applied yet
    for (const file of migrationFiles) {
      const version = file.split('_')[0];
      
      if (!appliedMigrations.includes(version)) {
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf8');
        const description = file.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/_/g, ' ');
        
        logger.info(`Applying migration ${version}: ${description}`);
        await applyMigration(version, description, sql);
      }
    }
    
    logger.info('All migrations applied successfully');
    return true;
  } catch (error) {
    logger.error('Migration process failed:', error);
    throw error;
  }
}

module.exports = {
  runMigrations,
  getAppliedMigrations
};

/**
 * Database Migration Runner
 * This script runs database migrations
 */
require('dotenv').config();
const { runMigrations } = require('../src/db/migrations');
const { logger } = require('../src/utils/enhanced-logger');

async function main() {
  try {
    logger.info('Starting database migrations...');
    await runMigrations();
    logger.info('Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration error:', error);
    process.exit(1);
  }
}

// Run the migrations
main();

// tools/database/backup.js
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/utils/logger');

// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_URL = process.env.DATABASE_URL;
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RETENTION_DAYS = 30; // Keep backups for 30 days

// Parse database connection string
function parseDbUrl(url) {
  const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid database URL format');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5]
  };
}

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info(`Created backup directory: ${BACKUP_DIR}`);
}

try {
  // Parse database connection
  const dbConfig = parseDbUrl(DB_URL);
  const backupFile = path.join(BACKUP_DIR, `${dbConfig.database}_${TIMESTAMP}.sql`);

  logger.info(`Starting backup of ${dbConfig.database} database...`);

  // Set environment variable for password
  process.env.PGPASSWORD = dbConfig.password;

  // Execute pg_dump command
  execSync(`pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -F c -b -v -f "${backupFile}" ${dbConfig.database}`, {
    stdio: 'inherit'
  });

  logger.info(`Backup completed successfully: ${backupFile}`);

  // Compress the backup file if gzip is available
  try {
    execSync(`gzip -f "${backupFile}"`, {
      stdio: 'inherit'
    });
    logger.info(`Backup compressed: ${backupFile}.gz`);
  } catch (error) {
    logger.warn(`Could not compress backup: ${error.message}`);
    logger.info(`Uncompressed backup available at: ${backupFile}`);
  }

  // Clean up old backups
  const files = fs.readdirSync(BACKUP_DIR);
  const now = new Date();

  files.forEach(file => {
    if (file.endsWith('.sql.gz') && file.startsWith(dbConfig.database)) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);
      const diffDays = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));

      if (diffDays > RETENTION_DAYS) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old backup: ${file} (${diffDays} days old)`);
      }
    }
  });

  logger.info('Backup process completed successfully');
} catch (error) {
  logger.error(`Backup failed: ${error.message}`);
  process.exit(1);
}

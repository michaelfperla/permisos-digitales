// tools/database/restore.js
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('../../src/utils/logger');

// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_URL = process.env.DATABASE_URL;

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// List available backups
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backups directory found.');
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.sql.gz') || file.endsWith('.sql'))
    .sort((a, b) => {
      const statsA = fs.statSync(path.join(BACKUP_DIR, a));
      const statsB = fs.statSync(path.join(BACKUP_DIR, b));
      return statsB.mtime.getTime() - statsA.mtime.getTime(); // Sort by date, newest first
    });

  if (files.length === 0) {
    console.log('No backup files found.');
    return [];
  }

  console.log('\nAvailable backups:');
  files.forEach((file, index) => {
    const stats = fs.statSync(path.join(BACKUP_DIR, file));
    console.log(`${index + 1}. ${file} (${stats.mtime.toLocaleString()})`);
  });

  return files;
}

// Restore from backup
async function restoreBackup() {
  try {
    // Parse database connection
    const dbConfig = parseDbUrl(DB_URL);

    // List available backups
    const backups = listBackups();

    if (backups.length === 0) {
      rl.close();
      return;
    }

    // Ask user to select a backup
    rl.question('\nEnter the number of the backup to restore (or "q" to quit): ', async (answer) => {
      if (answer.toLowerCase() === 'q') {
        console.log('Restoration canceled.');
        rl.close();
        return;
      }

      const index = parseInt(answer, 10) - 1;

      if (isNaN(index) || index < 0 || index >= backups.length) {
        console.log('Invalid selection. Please try again.');
        rl.close();
        return;
      }

      const backupFile = path.join(BACKUP_DIR, backups[index]);

      // Confirm restoration
      rl.question(`\nWARNING: This will replace the current database (${dbConfig.database}) with the backup.\nDo you want to continue? (yes/no): `, async (confirm) => {
        if (confirm.toLowerCase() !== 'yes') {
          console.log('Restoration canceled.');
          rl.close();
          return;
        }

        console.log(`\nRestoring database from ${backups[index]}...`);

        try {
          // Set environment variable for password
          process.env.PGPASSWORD = dbConfig.password;

          let fileToRestore = backupFile;

          // Extract the backup file if it's compressed
          if (backupFile.endsWith('.gz')) {
            try {
              const extractedFile = backupFile.replace('.gz', '');
              execSync(`gunzip -c "${backupFile}" > "${extractedFile}"`, {
                stdio: 'inherit'
              });
              fileToRestore = extractedFile;
            } catch (error) {
              console.error(`Error extracting backup: ${error.message}`);
              console.error('Make sure you have gzip installed or use uncompressed backups.');
              rl.close();
              return;
            }
          }

          // Restore the database
          if (fileToRestore.endsWith('.sql')) {
            execSync(`psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${fileToRestore}"`, {
              stdio: 'inherit'
            });
          } else {
            execSync(`pg_restore -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -c -v "${fileToRestore}"`, {
              stdio: 'inherit'
            });
          }

          // Clean up the extracted file if we created one
          if (fileToRestore !== backupFile) {
            fs.unlinkSync(fileToRestore);
          }

          console.log('\nDatabase restored successfully!');
          logger.info(`Database ${dbConfig.database} restored from ${backups[index]}`);
        } catch (error) {
          console.error(`\nError restoring database: ${error.message}`);
          logger.error(`Restoration failed: ${error.message}`);
        }

        rl.close();
      });
    });
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    logger.error(`Restoration setup failed: ${error.message}`);
    rl.close();
  }
}

// Run the restore process
restoreBackup();

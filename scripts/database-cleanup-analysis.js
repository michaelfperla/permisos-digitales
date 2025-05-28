#!/usr/bin/env node

/**
 * Database Cleanup Analysis Script
 * 
 * Analyzes the database schema for:
 * - Unused tables and columns
 * - Orphaned data
 * - Unused indexes
 * - Migration inconsistencies
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bold');
  log(`${'='.repeat(60)}`, 'cyan');
}

async function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  });
}

async function analyzeUnusedTables(pool) {
  section('UNUSED TABLES ANALYSIS');
  
  // Get all tables
  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  const tablesResult = await pool.query(tablesQuery);
  log(`Found ${tablesResult.rows.length} tables in database:`, 'blue');
  
  for (const table of tablesResult.rows) {
    const tableName = table.table_name;
    log(`  - ${tableName}`, 'cyan');
    
    // Check if table is referenced in code
    const codeFiles = [
      'src/repositories',
      'src/services', 
      'src/controllers',
      'src/routes',
      'src/db/migrations'
    ];
    
    let foundReferences = false;
    for (const dir of codeFiles) {
      if (fs.existsSync(dir)) {
        const files = getAllFiles(dir, /\.(js|sql)$/);
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes(tableName)) {
              foundReferences = true;
              break;
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
        if (foundReferences) break;
      }
    }
    
    if (!foundReferences) {
      log(`    ⚠️  No code references found for table: ${tableName}`, 'yellow');
    }
    
    // Check row count
    try {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(countResult.rows[0].count);
      log(`    📊 Row count: ${count}`, count === 0 ? 'yellow' : 'green');
    } catch (error) {
      log(`    ❌ Error counting rows: ${error.message}`, 'red');
    }
  }
}

async function analyzeUnusedColumns(pool) {
  section('UNUSED COLUMNS ANALYSIS');
  
  const columnsQuery = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;
  
  const columnsResult = await pool.query(columnsQuery);
  const columnsByTable = {};
  
  // Group columns by table
  for (const column of columnsResult.rows) {
    if (!columnsByTable[column.table_name]) {
      columnsByTable[column.table_name] = [];
    }
    columnsByTable[column.table_name].push(column);
  }
  
  // Known deprecated columns based on conversation history
  const deprecatedColumns = [
    'payment_proof_uploaded_at',
    'payment_verified_by',
    'payment_verified_at', 
    'payment_rejection_reason',
    'is_active' // Removed from users table
  ];
  
  for (const [tableName, columns] of Object.entries(columnsByTable)) {
    log(`\nTable: ${tableName}`, 'blue');
    
    for (const column of columns) {
      const columnName = column.column_name;
      
      // Check if column is in deprecated list
      if (deprecatedColumns.includes(columnName)) {
        log(`  ⚠️  DEPRECATED: ${columnName} (${column.data_type})`, 'red');
        continue;
      }
      
      // Skip system columns
      if (['id', 'created_at', 'updated_at'].includes(columnName)) {
        continue;
      }
      
      // Check if column is referenced in code
      const codeFiles = getAllFiles('src', /\.(js|sql)$/);
      let foundReferences = false;
      
      for (const file of codeFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes(columnName)) {
            foundReferences = true;
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
      
      if (!foundReferences) {
        log(`  ⚠️  No code references: ${columnName} (${column.data_type})`, 'yellow');
      }
    }
  }
}

async function analyzeUnusedIndexes(pool) {
  section('UNUSED INDEXES ANALYSIS');
  
  const unusedIndexesQuery = `
    SELECT
      schemaname || '.' || relname as table,
      indexrelname as index,
      pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size,
      idx_scan as index_scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM
      pg_stat_user_indexes ui
      JOIN pg_index i ON ui.indexrelid = i.indexrelid
    WHERE
      idx_scan < 10 AND
      indisunique is false
    ORDER BY
      pg_relation_size(i.indexrelid) DESC;
  `;
  
  const unusedIndexesResult = await pool.query(unusedIndexesQuery);
  
  if (unusedIndexesResult.rows.length > 0) {
    log('Potentially unused indexes (less than 10 scans):', 'yellow');
    console.table(unusedIndexesResult.rows);
  } else {
    log('No unused indexes found', 'green');
  }
}

async function analyzeMigrationConsistency() {
  section('MIGRATION CONSISTENCY ANALYSIS');
  
  const migrationDirs = [
    'src/db/migrations',
    'database/migrations'
  ];
  
  const allMigrations = [];
  
  for (const dir of migrationDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.sql'));
      log(`Found ${files.length} migration files in ${dir}:`, 'blue');
      
      for (const file of files) {
        log(`  - ${file}`, 'cyan');
        allMigrations.push({ dir, file });
      }
    } else {
      log(`Migration directory not found: ${dir}`, 'yellow');
    }
  }
  
  // Check for potential duplicates or conflicts
  const migrationNames = allMigrations.map(m => m.file);
  const duplicates = migrationNames.filter((name, index) => migrationNames.indexOf(name) !== index);
  
  if (duplicates.length > 0) {
    log('Potential duplicate migrations:', 'red');
    duplicates.forEach(dup => log(`  - ${dup}`, 'red'));
  } else {
    log('No duplicate migration files found', 'green');
  }
}

async function analyzeOrphanedData(pool) {
  section('ORPHANED DATA ANALYSIS');
  
  // Check for orphaned permit applications (users that don't exist)
  try {
    const orphanedAppsQuery = `
      SELECT pa.id, pa.user_id 
      FROM permit_applications pa 
      LEFT JOIN users u ON pa.user_id = u.id 
      WHERE u.id IS NULL;
    `;
    
    const orphanedApps = await pool.query(orphanedAppsQuery);
    
    if (orphanedApps.rows.length > 0) {
      log(`Found ${orphanedApps.rows.length} orphaned permit applications:`, 'red');
      orphanedApps.rows.forEach(app => {
        log(`  - Application ID ${app.id} references non-existent user ${app.user_id}`, 'red');
      });
    } else {
      log('No orphaned permit applications found', 'green');
    }
  } catch (error) {
    log(`Error checking orphaned applications: ${error.message}`, 'red');
  }
  
  // Check for orphaned password reset tokens
  try {
    const orphanedTokensQuery = `
      SELECT prt.id, prt.user_id 
      FROM password_reset_tokens prt 
      LEFT JOIN users u ON prt.user_id = u.id 
      WHERE u.id IS NULL;
    `;
    
    const orphanedTokens = await pool.query(orphanedTokensQuery);
    
    if (orphanedTokens.rows.length > 0) {
      log(`Found ${orphanedTokens.rows.length} orphaned password reset tokens:`, 'red');
      orphanedTokens.rows.forEach(token => {
        log(`  - Token ID ${token.id} references non-existent user ${token.user_id}`, 'red');
      });
    } else {
      log('No orphaned password reset tokens found', 'green');
    }
  } catch (error) {
    log(`Error checking orphaned tokens: ${error.message}`, 'red');
  }
}

function getAllFiles(dir, pattern) {
  const files = [];
  
  function walk(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.includes('node_modules')) {
          walk(fullPath);
        } else if (pattern.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  if (fs.existsSync(dir)) {
    walk(dir);
  }
  
  return files;
}

async function main() {
  log('Starting Database Cleanup Analysis...', 'bold');
  log(`Analysis started at: ${new Date().toISOString()}`, 'cyan');
  
  const pool = await createPool();
  
  try {
    await analyzeUnusedTables(pool);
    await analyzeUnusedColumns(pool);
    await analyzeUnusedIndexes(pool);
    await analyzeMigrationConsistency();
    await analyzeOrphanedData(pool);
    
    section('DATABASE ANALYSIS COMPLETE');
    log('Database cleanup analysis completed successfully!', 'green');
    log('Review the results above and plan cleanup actions carefully.', 'cyan');
    
  } catch (error) {
    log(`Analysis failed with error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeUnusedTables,
  analyzeUnusedColumns,
  analyzeUnusedIndexes,
  analyzeMigrationConsistency,
  analyzeOrphanedData
};

// tools/database/monitor.js
require('dotenv').config();
const { Pool } = require('pg');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

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

async function monitorDatabase() {
  console.log(`${colors.blue}==================================================${colors.reset}`);
  console.log(`${colors.blue}  PostgreSQL Database Monitoring${colors.reset}`);
  console.log(`${colors.blue}==================================================${colors.reset}`);

  // Get database URL from environment variables
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(`${colors.red}❌ DATABASE_URL environment variable is not set.${colors.reset}`);
    return false;
  }

  console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' && process.env.DISABLE_SSL !== 'true'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    // Test the connection
    const client = await pool.connect();
    console.log(`${colors.green}✅ Successfully connected to the database${colors.reset}`);

    // Check database version
    const versionResult = await client.query('SELECT version()');
    console.log(`${colors.blue}Database version:${colors.reset} ${versionResult.rows[0].version}`);

    // Check database size
    const dbSizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `;
    const dbSizeResult = await client.query(dbSizeQuery);
    console.log(`${colors.blue}Database size:${colors.reset} ${dbSizeResult.rows[0].size}`);

    // Check table sizes
    const tableSizesQuery = `
      SELECT
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
        pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
      FROM
        information_schema.tables
      WHERE
        table_schema = 'public'
      ORDER BY
        pg_total_relation_size(quote_ident(table_name)) DESC
      LIMIT 10;
    `;
    const tableSizesResult = await client.query(tableSizesQuery);

    console.log(`\n${colors.blue}Top 10 largest tables:${colors.reset}`);
    console.table(tableSizesResult.rows);

    // Check active connections
    const connectionsQuery = `
      SELECT
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM
        pg_stat_activity
      WHERE
        datname = current_database();
    `;
    const connectionsResult = await client.query(connectionsQuery);

    console.log(`\n${colors.blue}Database connections:${colors.reset}`);
    console.table(connectionsResult.rows);

    // Check long-running queries
    const longQueriesQuery = `
      SELECT
        pid,
        usename as username,
        application_name,
        client_addr as client_ip,
        state,
        age(now(), query_start) as query_duration,
        query
      FROM
        pg_stat_activity
      WHERE
        state = 'active' AND
        query_start < now() - interval '5 seconds' AND
        query NOT ILIKE '%pg_stat_activity%'
      ORDER BY
        query_start;
    `;
    const longQueriesResult = await client.query(longQueriesQuery);

    if (longQueriesResult.rows.length > 0) {
      console.log(`\n${colors.yellow}Long-running queries (>5 seconds):${colors.reset}`);
      console.table(longQueriesResult.rows);
    } else {
      console.log(`\n${colors.green}No long-running queries detected.${colors.reset}`);
    }

    // Check index usage
    const indexUsageQuery = `
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
        idx_scan > 0
      ORDER BY
        pg_relation_size(i.indexrelid) DESC
      LIMIT 10;
    `;
    const indexUsageResult = await client.query(indexUsageQuery);

    console.log(`\n${colors.blue}Top 10 most used indexes:${colors.reset}`);
    if (indexUsageResult.rows.length > 0) {
      console.table(indexUsageResult.rows);
    } else {
      console.log(`${colors.yellow}No index usage statistics available yet.${colors.reset}`);
    }

    // Check unused indexes
    const unusedIndexesQuery = `
      SELECT
        schemaname || '.' || relname as table,
        indexrelname as index,
        pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size,
        idx_scan as index_scans
      FROM
        pg_stat_user_indexes ui
        JOIN pg_index i ON ui.indexrelid = i.indexrelid
      WHERE
        idx_scan = 0 AND
        indisunique is false
      ORDER BY
        pg_relation_size(i.indexrelid) DESC
      LIMIT 10;
    `;
    const unusedIndexesResult = await client.query(unusedIndexesQuery);

    console.log(`\n${colors.blue}Top 10 unused indexes:${colors.reset}`);
    if (unusedIndexesResult.rows.length > 0) {
      console.table(unusedIndexesResult.rows);
    } else {
      console.log(`${colors.green}No unused indexes found.${colors.reset}`);
    }

    // Check cache hit ratio
    const cacheHitQuery = `
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
      FROM
        pg_statio_user_tables;
    `;
    const cacheHitResult = await client.query(cacheHitQuery);

    console.log(`\n${colors.blue}Cache hit ratio:${colors.reset}`);
    console.table(cacheHitResult.rows);

    const ratio = parseFloat(cacheHitResult.rows[0].ratio);
    if (ratio < 0.99) {
      console.log(`${colors.yellow}Cache hit ratio is below 99%. Consider increasing shared_buffers.${colors.reset}`);
    } else {
      console.log(`${colors.green}Cache hit ratio is good (>99%).${colors.reset}`);
    }

    // Release the client back to the pool
    client.release();

    // Close the pool
    await pool.end();

    console.log(`\n${colors.green}Database monitoring completed.${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Database monitoring error:${colors.reset} ${error.message}`);
    await pool.end();
    return false;
  }
}

// Run the monitoring
monitorDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });

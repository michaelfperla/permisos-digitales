#!/usr/bin/env node

/**
 * Show table structure for permit_applications
 */

require('../src/config'); // Load environment variables
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function showTableStructure() {
  try {
    console.log('🗄️  PERMIT_APPLICATIONS TABLE STRUCTURE\n');
    
    // Get column information
    const query = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_name = 'permit_applications' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ Table permit_applications not found');
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} columns:\n`);
    
    // Format and display columns
    result.rows.forEach((row, index) => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const maxLength = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const defaultValue = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      
      console.log(`${(index + 1).toString().padStart(2)}. ${row.column_name.padEnd(30)} ${row.data_type}${maxLength} ${nullable}${defaultValue}`);
    });
    
    // Get constraints
    console.log('\n🔗 CONSTRAINTS AND INDEXES:\n');
    
    const constraintsQuery = `
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name = 'permit_applications'
        AND tc.table_schema = 'public'
      ORDER BY tc.constraint_type, tc.constraint_name;
    `;
    
    const constraintsResult = await pool.query(constraintsQuery);
    
    constraintsResult.rows.forEach(row => {
      const type = row.constraint_type;
      const name = row.constraint_name;
      const column = row.column_name;
      const foreignRef = row.foreign_table_name ? ` -> ${row.foreign_table_name}(${row.foreign_column_name})` : '';
      
      console.log(`${type.padEnd(15)} ${column.padEnd(25)} ${name}${foreignRef}`);
    });
    
    // Get indexes
    console.log('\n📊 INDEXES:\n');
    
    const indexQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'permit_applications'
        AND schemaname = 'public'
      ORDER BY indexname;
    `;
    
    const indexResult = await pool.query(indexQuery);
    
    indexResult.rows.forEach(row => {
      console.log(`${row.indexname}`);
      console.log(`  ${row.indexdef}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

showTableStructure();

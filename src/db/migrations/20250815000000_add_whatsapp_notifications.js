// Migration: Add WhatsApp notification preferences and tracking tables
// File: src/db/migrations/20250815000000_add_whatsapp_notifications.js

exports.up = async function(knex) {
  // Add notification preference columns to users table
  await knex.schema.table('users', function(table) {
    table.boolean('whatsapp_notifications_enabled').defaultTo(true);
    table.boolean('email_notifications_enabled').defaultTo(true);
  });

  // Create WhatsApp renewal reminders tracking table
  await knex.schema.createTable('whatsapp_renewal_reminders', function(table) {
    table.increments('id').primary();
    table.integer('application_id').notNullable();
    table.string('phone', 20).notNullable();
    table.string('type', 50).notNullable().defaultTo('whatsapp_renewal_reminder');
    table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());
    
    // Foreign key to applications table
    table.foreign('application_id').references('id').inTable('applications').onDelete('CASCADE');
    
    // Ensure one reminder per application per day
    table.unique(['application_id', knex.raw('sent_at::date')]);
    
    // Indexes for performance
    table.index('sent_at');
    table.index('application_id');
    table.index('phone');
  });

  // Create WhatsApp opt-outs tracking table
  await knex.schema.createTable('whatsapp_opt_outs', function(table) {
    table.increments('id').primary();
    table.string('phone', 20).notNullable().unique();
    table.string('reason', 100).notNullable().defaultTo('user_request');
    table.timestamp('opted_out_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Index for phone lookups
    table.index('phone');
  });

  console.log('✅ WhatsApp notifications tables created successfully');
};

exports.down = async function(knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('whatsapp_opt_outs');
  await knex.schema.dropTableIfExists('whatsapp_renewal_reminders');
  
  // Remove columns from users table
  await knex.schema.table('users', function(table) {
    table.dropColumn('whatsapp_notifications_enabled');
    table.dropColumn('email_notifications_enabled');
  });

  console.log('✅ WhatsApp notifications tables dropped successfully');
};
/**
 * Migration: Add WhatsApp Message Monitoring Tables
 * Creates comprehensive message logging for admin monitoring interface
 */

exports.up = async function(knex) {
  // Create comprehensive WhatsApp message log table
  await knex.schema.createTable('whatsapp_message_logs', function(table) {
    table.increments('id').primary();
    
    // Message identification
    table.string('message_id', 100).unique(); // WhatsApp message ID
    table.string('conversation_id', 100).notNullable().index(); // Phone number or conversation identifier
    
    // Message content (sanitized for privacy)
    table.enum('direction', ['incoming', 'outgoing']).notNullable();
    table.enum('message_type', ['text', 'audio', 'image', 'document', 'interactive', 'system']).notNullable();
    table.text('message_preview'); // First 100 chars for preview (sanitized)
    table.integer('message_length').defaultTo(0);
    table.boolean('contains_sensitive_data').defaultTo(false);
    
    // User context
    table.integer('user_id').nullable();
    table.string('phone_number', 20).notNullable().index();
    table.string('user_name', 100).nullable(); // WhatsApp display name if available
    
    // Conversation context
    table.string('conversation_state', 50).nullable(); // Bot state at time of message
    table.string('intent', 100).nullable(); // Detected intent or command
    table.json('metadata').nullable(); // Additional context data
    
    // Processing status
    table.enum('processing_status', ['received', 'processing', 'completed', 'failed', 'ignored']).defaultTo('received');
    table.text('processing_error').nullable();
    table.timestamp('processed_at').nullable();
    
    // Privacy and compliance
    table.boolean('user_consented').defaultTo(false);
    table.timestamp('consent_date').nullable();
    table.boolean('should_delete').defaultTo(false); // For GDPR compliance
    table.timestamp('scheduled_deletion').nullable();
    
    // Timestamps
    table.timestamp('message_timestamp').notNullable(); // Original message timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    
    // Indexes for performance
    table.index(['conversation_id', 'message_timestamp']);
    table.index(['direction', 'created_at']);
    table.index(['processing_status', 'created_at']);
    table.index(['phone_number', 'message_timestamp']);
    table.index('message_timestamp');
  });

  // Create conversation summary table for quick overview
  await knex.schema.createTable('whatsapp_conversations', function(table) {
    table.increments('id').primary();
    
    // Conversation identification
    table.string('conversation_id', 100).unique().notNullable();
    table.string('phone_number', 20).notNullable().index();
    table.integer('user_id').nullable();
    table.string('user_name', 100).nullable();
    
    // Conversation metrics
    table.integer('total_messages').defaultTo(0);
    table.integer('incoming_messages').defaultTo(0);
    table.integer('outgoing_messages').defaultTo(0);
    table.timestamp('first_message_at').nullable();
    table.timestamp('last_message_at').nullable();
    table.timestamp('last_activity_at').nullable();
    
    // Current state
    table.string('current_state', 50).nullable();
    table.string('last_intent', 100).nullable();
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_completed').defaultTo(false);
    
    // Application context
    table.integer('application_id').nullable();
    table.string('application_status', 50).nullable();
    
    // Privacy
    table.boolean('user_consented').defaultTo(false);
    table.timestamp('consent_date').nullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('application_id').references('id').inTable('permit_applications').onDelete('SET NULL');
    
    // Indexes
    table.index(['is_active', 'last_activity_at']);
    table.index(['phone_number', 'created_at']);
    table.index('last_activity_at');
  });

  // Create admin message monitoring settings
  await knex.schema.createTable('whatsapp_monitoring_settings', function(table) {
    table.increments('id').primary();
    
    // Settings
    table.boolean('real_time_enabled').defaultTo(true);
    table.integer('message_retention_days').defaultTo(30);
    table.boolean('show_message_content').defaultTo(false); // Privacy setting
    table.boolean('show_sensitive_data').defaultTo(false); // Admin-only setting
    table.json('notification_preferences').nullable();
    
    // Admin user
    table.integer('admin_user_id').notNullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign keys
    table.foreign('admin_user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Unique constraint
    table.unique('admin_user_id');
  });

  console.log('✅ WhatsApp message monitoring tables created successfully');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('whatsapp_monitoring_settings');
  await knex.schema.dropTableIfExists('whatsapp_conversations');
  await knex.schema.dropTableIfExists('whatsapp_message_logs');
  
  console.log('✅ WhatsApp message monitoring tables dropped successfully');
};

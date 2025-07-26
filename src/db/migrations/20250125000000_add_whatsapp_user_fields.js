/**
 * Migration: Add WhatsApp user fields
 * Adds fields for WhatsApp integration and pre-verified users
 */

exports.up = function(pgm) {
  // Add whatsapp_phone to users table
  pgm.addColumns('users', {
    whatsapp_phone: {
      type: 'varchar(20)',
      notNull: false,
      comment: 'WhatsApp phone number for the user'
    },
    is_verified: {
      type: 'boolean',
      notNull: false,
      default: false,
      comment: 'Whether the user email is verified'
    },
    verified_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When the user was verified'
    },
    source: {
      type: 'varchar(50)',
      notNull: false,
      default: 'web',
      comment: 'How the user was created (web, whatsapp, api)'
    }
  });

  // Create indexes
  pgm.createIndex('users', 'whatsapp_phone', {
    where: 'whatsapp_phone IS NOT NULL'
  });
  
  pgm.createIndex('users', 'is_verified');
  pgm.createIndex('users', 'source');

  // Add source fields to applications table
  pgm.addColumns('applications', {
    source: {
      type: 'varchar(50)',
      notNull: false,
      default: 'web',
      comment: 'Source of the application (web, whatsapp, api)'
    },
    source_metadata: {
      type: 'jsonb',
      notNull: false,
      comment: 'Additional metadata about the source'
    }
  });

  // Create index on application source
  pgm.createIndex('applications', 'source');
};

exports.down = function(pgm) {
  // Drop indexes
  pgm.dropIndex('applications', 'source');
  pgm.dropIndex('users', 'source');
  pgm.dropIndex('users', 'is_verified');
  pgm.dropIndex('users', 'whatsapp_phone');

  // Drop columns
  pgm.dropColumns('applications', ['source', 'source_metadata']);
  pgm.dropColumns('users', ['whatsapp_phone', 'is_verified', 'verified_at', 'source']);
};
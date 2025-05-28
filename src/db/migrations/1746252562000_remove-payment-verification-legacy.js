/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * Migration to remove legacy payment verification system
 * 
 * This migration removes the old manual payment verification system that was
 * replaced by direct Conekta payment processing. The legacy system required
 * users to upload payment proofs and admins to manually verify them.
 * 
 * Current system uses direct Conekta integration with automatic webhook
 * confirmation, making manual verification obsolete.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Remove legacy payment verification columns from permit_applications table
  pgm.dropColumns('permit_applications', [
    'payment_proof_uploaded_at',
    'payment_verified_by', 
    'payment_verified_at',
    'payment_rejection_reason'
  ], {
    ifExists: true
  });

  // Drop legacy payment verification log table
  pgm.dropTable('payment_verification_log', {
    ifExists: true,
    cascade: true
  });

  // Drop legacy payment states table (used for 3DS CSRF protection)
  pgm.dropTable('payment_states', {
    ifExists: true,
    cascade: true
  });

  // Add comment documenting the change
  pgm.sql(`
    COMMENT ON TABLE permit_applications IS 
    'Permit applications table. Legacy manual payment verification columns removed in favor of direct Conekta payment processing.';
  `);
};

/**
 * Rollback migration - recreate legacy payment verification system
 * Note: This will recreate the structure but not restore any data
 */
exports.down = (pgm) => {
  // Recreate payment_verification_log table
  pgm.createTable('payment_verification_log', {
    id: 'id',
    application_id: {
      type: 'integer',
      notNull: true,
      references: 'permit_applications(id)',
      onDelete: 'CASCADE'
    },
    verified_by: {
      type: 'integer',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    action: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Action taken: verify, reject'
    },
    notes: {
      type: 'text',
      comment: 'Admin notes for the verification action'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    comment: 'Legacy payment verification log table (restored from migration rollback)'
  });

  // Recreate payment_states table
  pgm.createTable('payment_states', {
    id: 'id',
    application_id: {
      type: 'integer',
      notNull: true,
      references: 'permit_applications(id)',
      onDelete: 'CASCADE'
    },
    state_param: {
      type: 'varchar(255)',
      notNull: true
    },
    expires_at: {
      type: 'timestamp',
      notNull: true
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    used: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    used_at: {
      type: 'timestamp'
    }
  }, {
    comment: 'Legacy payment states table for 3DS CSRF protection (restored from migration rollback)'
  });

  // Add back legacy columns to permit_applications
  pgm.addColumns('permit_applications', {
    payment_proof_uploaded_at: {
      type: 'timestamp with time zone',
      comment: 'Legacy: When payment proof was uploaded by user'
    },
    payment_verified_by: {
      type: 'integer',
      references: 'users(id)',
      onDelete: 'SET NULL',
      comment: 'Legacy: Admin who verified the payment'
    },
    payment_verified_at: {
      type: 'timestamp with time zone',
      comment: 'Legacy: When payment was verified by admin'
    },
    payment_rejection_reason: {
      type: 'text',
      comment: 'Legacy: Reason for payment rejection'
    }
  });

  // Create indexes for the restored tables
  pgm.createIndex('payment_verification_log', 'application_id');
  pgm.createIndex('payment_verification_log', 'verified_by');
  pgm.createIndex('payment_verification_log', 'created_at');
  pgm.createIndex('payment_states', 'application_id');
  pgm.createIndex('payment_states', 'state_param');
  pgm.createIndex('payment_states', 'expires_at');
};

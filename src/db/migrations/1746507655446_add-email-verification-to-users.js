/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumns('users', {
    is_email_verified: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    email_verification_token: {
      type: 'varchar(255)',
      notNull: false
    },
    email_verification_expires: {
      type: 'timestamp with time zone',
      notNull: false
    }
  });

  // Add an index on the email_verification_token for faster lookups
  pgm.createIndex('users', 'email_verification_token');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop the index first
  pgm.dropIndex('users', 'email_verification_token');

  // Drop the columns
  pgm.dropColumns('users', [
    'is_email_verified',
    'email_verification_token',
    'email_verification_expires'
  ]);
};

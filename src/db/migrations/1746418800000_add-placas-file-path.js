/**
 * Migration to add placas_file_path column to permit_applications table
 * 
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Add placas_file_path column to permit_applications table
  pgm.addColumn('permit_applications', {
    placas_file_path: {
      type: 'text',
      comment: 'Path to the placas en proceso PDF file'
    }
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remove the column if migration needs to be rolled back
  pgm.dropColumn('permit_applications', 'placas_file_path');
};

/**
 * Migration to remove recibo_file_path column from permit_applications table
 * 
 * This migration removes the recibo_file_path column as the recibo PDF functionality
 * is being completely removed from the application.
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
  // Remove recibo_file_path column as recibo functionality is being removed
  pgm.dropColumn('permit_applications', 'recibo_file_path');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Re-add recibo_file_path column if rolling back
  pgm.addColumn('permit_applications', {
    recibo_file_path: {
      type: 'text',
      comment: 'Path to the recibo PDF file (legacy)'
    }
  });
};

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
  // Add a temporary column to store the converted integer values
  pgm.addColumn('permit_applications', {
    ano_modelo_int: {
      type: 'integer',
      comment: 'Temporary column to store the converted ano_modelo values'
    }
  });

  // Update the temporary column with converted values
  pgm.sql(`
    UPDATE permit_applications
    SET ano_modelo_int = CASE
      WHEN ano_modelo ~ '^[0-9]+$' THEN ano_modelo::integer
      ELSE NULL
    END
  `);

  // Drop the original column and rename the new one
  pgm.dropColumn('permit_applications', 'ano_modelo');
  pgm.renameColumn('permit_applications', 'ano_modelo_int', 'ano_modelo');

  // Add constraints to the new column
  pgm.addConstraint('permit_applications', 'ano_modelo_check', {
    check: 'ano_modelo >= 1900 AND ano_modelo <= (date_part(\'year\', CURRENT_DATE) + 2)'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop the constraint
  pgm.dropConstraint('permit_applications', 'ano_modelo_check');

  // Add a temporary column with VARCHAR type
  pgm.addColumn('permit_applications', {
    ano_modelo_varchar: {
      type: 'varchar(20)',
      comment: 'Temporary column to store the converted ano_modelo values as strings'
    }
  });

  // Convert integer values to strings
  pgm.sql(`
    UPDATE permit_applications
    SET ano_modelo_varchar = ano_modelo::text
  `);

  // Drop the integer column and rename the varchar column
  pgm.dropColumn('permit_applications', 'ano_modelo');
  pgm.renameColumn('permit_applications', 'ano_modelo_varchar', 'ano_modelo');
};

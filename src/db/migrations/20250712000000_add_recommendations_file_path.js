/**
 * Migration to add recomendaciones_file_path column to applications table
 * This column will store the path to the generated recommendations PDF
 */

exports.up = function(pgm) {
  // Add recomendaciones_file_path column to applications table
  pgm.addColumn('applications', {
    recomendaciones_file_path: {
      type: 'text',
      notNull: false,
      comment: 'Path to the recommendations PDF file in storage'
    }
  });

  // Add index for faster lookups when checking if recommendations exist
  pgm.createIndex('applications', 'recomendaciones_file_path', {
    where: 'recomendaciones_file_path IS NOT NULL'
  });
};

exports.down = function(pgm) {
  // Remove index
  pgm.dropIndex('applications', 'recomendaciones_file_path');
  
  // Remove column
  pgm.dropColumn('applications', 'recomendaciones_file_path');
};
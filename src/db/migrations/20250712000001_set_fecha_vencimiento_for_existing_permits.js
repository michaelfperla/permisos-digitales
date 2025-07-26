/**
 * Migration to set fecha_vencimiento for existing permits
 * Sets expiration date to 30 days from fecha_expedicion for all PERMIT_READY permits without fecha_vencimiento
 */

exports.up = async (pgm) => {
  // Update existing PERMIT_READY permits without fecha_vencimiento
  // Set fecha_vencimiento to 30 days after fecha_expedicion
  pgm.sql(`
    UPDATE permit_applications
    SET 
      fecha_vencimiento = fecha_expedicion + INTERVAL '30 days',
      updated_at = NOW()
    WHERE 
      status = 'PERMIT_READY'
      AND fecha_vencimiento IS NULL
      AND fecha_expedicion IS NOT NULL
  `);

  // For permits without fecha_expedicion, use created_at + 30 days
  pgm.sql(`
    UPDATE permit_applications
    SET 
      fecha_vencimiento = created_at + INTERVAL '30 days',
      updated_at = NOW()
    WHERE 
      status = 'PERMIT_READY'
      AND fecha_vencimiento IS NULL
      AND fecha_expedicion IS NULL
  `);

  // Log the migration
  pgm.sql(`
    INSERT INTO system_logs (log_level, message, created_at)
    VALUES ('INFO', 'Migration: Set fecha_vencimiento for existing PERMIT_READY permits', NOW())
  `);
};

exports.down = async (pgm) => {
  // This migration is not reversible as we're setting data based on business logic
  // Log the attempted rollback
  pgm.sql(`
    INSERT INTO system_logs (log_level, message, created_at)
    VALUES ('WARNING', 'Migration rollback attempted: Cannot reverse fecha_vencimiento updates', NOW())
  `);
};
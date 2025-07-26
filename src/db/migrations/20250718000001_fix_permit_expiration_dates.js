/**
 * Migration to fix permit expiration dates
 * Ensures all permits have consistent 30-day expiration from generation date
 */

exports.up = async (pgm) => {
  // First, update permits that have fecha_expedicion but incorrect fecha_vencimiento
  pgm.sql(`
    UPDATE permit_applications
    SET 
      fecha_vencimiento = fecha_expedicion + INTERVAL '30 days',
      updated_at = NOW()
    WHERE 
      status IN ('PERMIT_READY', 'COMPLETED')
      AND fecha_expedicion IS NOT NULL
      AND (
        fecha_vencimiento IS NULL 
        OR fecha_vencimiento != fecha_expedicion + INTERVAL '30 days'
      )
  `);

  // Second, for permits without fecha_expedicion, use created_at + 30 days
  pgm.sql(`
    UPDATE permit_applications
    SET 
      fecha_vencimiento = created_at::date + INTERVAL '30 days',
      updated_at = NOW()
    WHERE 
      status IN ('PERMIT_READY', 'COMPLETED')
      AND fecha_expedicion IS NULL
      AND (
        fecha_vencimiento IS NULL 
        OR fecha_vencimiento != created_at::date + INTERVAL '30 days'
      )
  `);

  // Third, ensure fecha_expedicion is set for permits that don't have it
  // Use the date when the permit was marked as ready (from updated_at when status became PERMIT_READY)
  pgm.sql(`
    UPDATE permit_applications
    SET 
      fecha_expedicion = updated_at::date,
      fecha_vencimiento = updated_at::date + INTERVAL '30 days',
      updated_at = NOW()
    WHERE 
      status IN ('PERMIT_READY', 'COMPLETED')
      AND fecha_expedicion IS NULL
      AND updated_at IS NOT NULL
  `);

  // Log the migration
  pgm.sql(`
    INSERT INTO system_logs (log_level, message, created_at)
    VALUES ('INFO', 'Migration: Fixed permit expiration dates to ensure 30-day consistency', NOW())
  `);
};

exports.down = async (pgm) => {
  // This migration is not reversible as we're fixing data based on business logic
  // Log the attempted rollback
  pgm.sql(`
    INSERT INTO system_logs (log_level, message, created_at)
    VALUES ('WARNING', 'Migration rollback attempted: Cannot reverse permit expiration date fixes', NOW())
  `);
};

/**
 * Add VENCIDO status to permit_applications status constraint
 * This allows the application cleanup job to properly expire permits after 30 days
 */

exports.up = async function(knex) {
  // Drop the existing constraint
  await knex.raw(`
    ALTER TABLE permit_applications 
    DROP CONSTRAINT IF EXISTS permit_applications_status_check
  `);
  
  // Add the constraint with VENCIDO included
  await knex.raw(`
    ALTER TABLE permit_applications 
    ADD CONSTRAINT permit_applications_status_check 
    CHECK (status IN (
      'AWAITING_PAYMENT',
      'AWAITING_OXXO_PAYMENT',
      'PAYMENT_PROCESSING',
      'PAYMENT_FAILED',
      'PAYMENT_RECEIVED',
      'GENERATING_PERMIT',
      'ERROR_GENERATING_PERMIT',
      'PERMIT_READY',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'VENCIDO',
      'RENEWAL_PENDING',
      'RENEWAL_APPROVED',
      'RENEWAL_REJECTED'
    ))
  `);
  
  // Update any permits that should have been marked as VENCIDO
  const result = await knex.raw(`
    UPDATE permit_applications 
    SET 
      status = 'VENCIDO',
      updated_at = NOW()
    WHERE 
      status = 'PERMIT_READY' 
      AND fecha_vencimiento < CURRENT_DATE
      AND fecha_vencimiento IS NOT NULL
    RETURNING id, user_id, fecha_expedicion, fecha_vencimiento
  `);
  
  if (result.rows && result.rows.length > 0) {
    console.log(`Updated ${result.rows.length} expired permits to VENCIDO status`);
  }
  
  // Log the migration
  await knex.raw(`
    INSERT INTO application_logs (severity, message, created_at)
    VALUES ('INFO', 'Migration: Added VENCIDO status to permit_applications constraint', NOW())
  `);
};

exports.down = async function(knex) {
  // In the down migration, we would need to handle any VENCIDO statuses first
  await knex.raw(`
    UPDATE permit_applications 
    SET status = 'EXPIRED' 
    WHERE status = 'VENCIDO'
  `);
  
  // Then recreate the constraint without VENCIDO
  await knex.raw(`
    ALTER TABLE permit_applications 
    DROP CONSTRAINT IF EXISTS permit_applications_status_check
  `);
  
  await knex.raw(`
    ALTER TABLE permit_applications 
    ADD CONSTRAINT permit_applications_status_check 
    CHECK (status IN (
      'AWAITING_PAYMENT',
      'AWAITING_OXXO_PAYMENT',
      'PAYMENT_PROCESSING',
      'PAYMENT_FAILED',
      'PAYMENT_RECEIVED',
      'GENERATING_PERMIT',
      'ERROR_GENERATING_PERMIT',
      'PERMIT_READY',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'RENEWAL_PENDING',
      'RENEWAL_APPROVED',
      'RENEWAL_REJECTED'
    ))
  `);
  
  await knex.raw(`
    INSERT INTO application_logs (severity, message, created_at)
    VALUES ('WARNING', 'Migration rollback: Removed VENCIDO status from permit_applications constraint', NOW())
  `);
};
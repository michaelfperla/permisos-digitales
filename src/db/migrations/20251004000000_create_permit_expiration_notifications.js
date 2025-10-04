/**
 * Migration: Create permit_expiration_notifications table
 * Tracks email notifications sent for active permit expirations
 */

exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS permit_expiration_notifications (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES permit_applications(id) ON DELETE CASCADE,
      notification_type VARCHAR(50) NOT NULL, -- 'three_day_warning' or 'expiry_day'
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),

      -- Ensure one notification per type per permit
      UNIQUE(application_id, notification_type)
    );

    -- Index for performance
    CREATE INDEX IF NOT EXISTS idx_permit_expiration_notifications_app_id
    ON permit_expiration_notifications(application_id);

    CREATE INDEX IF NOT EXISTS idx_permit_expiration_notifications_sent_at
    ON permit_expiration_notifications(sent_at);

    COMMENT ON TABLE permit_expiration_notifications IS 'Tracks email notifications sent to users about their active permit expirations';
    COMMENT ON COLUMN permit_expiration_notifications.notification_type IS 'Type of notification: three_day_warning (3 days before) or expiry_day (day of expiration)';
  `);
};

exports.down = async (db) => {
  await db.query(`
    DROP TABLE IF EXISTS permit_expiration_notifications CASCADE;
  `);
};

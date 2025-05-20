-- Migration to add desired_start_date column to permit_applications table

-- Add the column
ALTER TABLE permit_applications
ADD COLUMN desired_start_date DATE DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN permit_applications.desired_start_date IS 'The date the user wants the permit validity to begin.';

-- Log the migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20250414001', 'Add desired_start_date column to permit_applications', CURRENT_TIMESTAMP);

-- Migration to add placas_file_path column to permit_applications table

-- Add the column
ALTER TABLE permit_applications ADD COLUMN placas_file_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN permit_applications.placas_file_path IS 'Path to the placas en proceso PDF file';

-- Log the migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20250505001', 'Add placas_file_path column to permit_applications', CURRENT_TIMESTAMP);

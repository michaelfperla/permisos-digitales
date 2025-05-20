-- Add is_active column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing users to have is_active = TRUE
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

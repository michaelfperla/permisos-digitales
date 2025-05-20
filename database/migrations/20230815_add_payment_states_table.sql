-- Migration: Add payment_states table for 3DS CSRF protection
-- This table stores state parameters for CSRF protection in 3DS flows

-- Create payment_states table
CREATE TABLE IF NOT EXISTS payment_states (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL,
    state_param VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES permit_applications(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_states_application_id ON payment_states(application_id);
CREATE INDEX IF NOT EXISTS idx_payment_states_state_param ON payment_states(state_param);
CREATE INDEX IF NOT EXISTS idx_payment_states_expires_at ON payment_states(expires_at);

-- Add comment to table
COMMENT ON TABLE payment_states IS 'Stores state parameters for CSRF protection in 3DS payment flows';

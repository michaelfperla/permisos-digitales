-- Initial database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permit applications table
CREATE TABLE IF NOT EXISTS permit_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL,
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  license_plate VARCHAR(20),
  vin VARCHAR(50),
  payment_proof_url TEXT,
  payment_verified BOOLEAN DEFAULT FALSE,
  payment_verified_at TIMESTAMPTZ,
  payment_verified_by INTEGER REFERENCES users(id),
  permit_number VARCHAR(50),
  permit_url TEXT,
  permit_issued_at TIMESTAMPTZ,
  permit_expires_at TIMESTAMPTZ,
  desired_start_date DATE,
  renewal_of INTEGER REFERENCES permit_applications(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_permit_applications_user_id ON permit_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_permit_applications_status ON permit_applications(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

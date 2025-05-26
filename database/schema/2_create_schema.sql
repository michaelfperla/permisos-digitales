-- 2_create_schema.sql
-- Consolidated schema creation from all migration files

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'client',
  account_type VARCHAR(50) NOT NULL DEFAULT 'client',
  created_by INTEGER REFERENCES users(id),
  is_admin_portal BOOLEAN NOT NULL DEFAULT FALSE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMPTZ,
  account_created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on users table
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);

-- Create permit_applications table
CREATE TABLE permit_applications (
  -- Core Application Fields
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'AWAITING_OXXO_PAYMENT' CHECK (status IN (
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
  )),
  payment_processor_order_id VARCHAR(255),

  -- File Paths
  permit_file_path VARCHAR(512),
  recibo_file_path TEXT,
  certificado_file_path TEXT,
  placas_file_path TEXT,

  -- Applicant Data
  nombre_completo VARCHAR(255) NOT NULL,
  curp_rfc VARCHAR(50) NOT NULL,
  domicilio TEXT NOT NULL,

  -- Vehicle Data
  marca VARCHAR(100) NOT NULL,
  linea VARCHAR(100) NOT NULL,
  color VARCHAR(100) NOT NULL,
  numero_serie VARCHAR(50) NOT NULL,
  numero_motor VARCHAR(50) NOT NULL,
  ano_modelo INTEGER NOT NULL CHECK (ano_modelo >= 1900 AND ano_modelo <= (date_part('year', CURRENT_DATE) + 2)),

  -- Permit Data (populated after generation)
  folio VARCHAR(50) UNIQUE,
  importe NUMERIC(10, 2),
  fecha_expedicion DATE,
  fecha_vencimiento DATE,
  desired_start_date DATE,
  payment_reference VARCHAR(100),

  -- Renewal Data
  renewed_from_id INTEGER REFERENCES permit_applications(id) ON DELETE SET NULL,
  renewal_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_events table
CREATE TABLE payment_events (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES permit_applications(id) ON DELETE CASCADE,
  order_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create password reset tokens table
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create security audit log table
CREATE TABLE security_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
-- Permit applications indexes
CREATE INDEX idx_permit_applications_user_id ON permit_applications(user_id);
CREATE INDEX idx_permit_applications_status ON permit_applications(status);
CREATE INDEX idx_permit_applications_numero_serie ON permit_applications(numero_serie);
CREATE INDEX idx_permit_applications_renewed_from_id ON permit_applications(renewed_from_id);
CREATE INDEX idx_permit_applications_user_id_created_at ON permit_applications(user_id, created_at);
CREATE INDEX idx_permit_applications_payment_processor_order_id ON permit_applications(payment_processor_order_id);

-- Payment events indexes
CREATE INDEX idx_payment_events_application_id ON payment_events(application_id);
CREATE INDEX idx_payment_events_order_id ON payment_events(order_id);
CREATE INDEX idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at);

-- Password reset tokens indexes
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Security audit log indexes
CREATE INDEX idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_action_type ON security_audit_log(action_type);
CREATE INDEX idx_security_audit_log_created_at ON security_audit_log(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_user_sessions_expire" ON "user_sessions" ("expire");

-- Create triggers to automatically update the updated_at timestamp
CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_permit_applications_modtime
BEFORE UPDATE ON permit_applications
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
-- 3_create_admin_user.sql
-- Script to create initial admin user

-- Create initial admin user (development credentials)
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  account_type,
  is_admin_portal
) VALUES (
  'admin@permisos-digitales.mx',
  -- bcrypt hash of 'AdminSecure2025!'
  '$2b$10$bQqR3vSP.4X5XCeRQjrpj.mXaDN6jJeHPFTQpfvjgqLHX/QuV0Fpe',
  'Roberto',
  'Méndez',
  'admin',
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Create sample staff admin user
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  account_type,
  is_admin_portal
) VALUES (
  'supervisor@permisos-digitales.mx',
  -- bcrypt hash of 'StaffAccess2025!'
  '$2b$10$5CKstz45CgzUivOgfIepJumA//BdNH5QdCctUoZolJ6Q9dqtkBz5W',
  'Ana',
  'Gutiérrez',
  'admin',
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Create sample client account
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  account_type,
  is_admin_portal
) VALUES (
  'cliente@ejemplo.com',
  -- bcrypt hash of 'Cliente2025!'
  '$2b$10$WMlXp8JU0cMXEpSQTDqQnuVZfM9RQT0HhCQMXeKEIwuqGKcz2nYbu',
  'Carlos',
  'López',
  'client',
  'client',
  FALSE
)
ON CONFLICT (email) DO NOTHING;
# WhatsApp Compliance Migration Instructions

## Overview
This guide provides step-by-step instructions for applying the WhatsApp compliance database changes to the production database.

## Prerequisites
- SSH access to the production server
- Database credentials (already retrieved from AWS Secrets Manager)
- Backup of the production database

## Step 1: Connect to Production Server

```bash
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162
```

## Step 2: Connect to Database

```bash
# From the production server
psql "postgres://permisos_admin:2bQXJ632zni3x8iRvvJc@permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com:5432/pd_db?sslmode=require"
```

## Step 3: Check Current Schema

Before applying changes, verify current state:

```sql
-- Check if any WhatsApp columns already exist
\d users

-- Check for existing WhatsApp tables
\dt *whatsapp*
\dt *optout*
\dt *consent*
```

## Step 4: Apply Migration (One Section at a Time)

### 4.1 Add WhatsApp Consent Columns

```sql
-- First, check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name LIKE 'whatsapp%';

-- If columns don't exist, add them
BEGIN;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_consent_date TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_opted_out BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_optout_date TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_consent_ip VARCHAR(45);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_consent_method VARCHAR(20);

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE 'whatsapp%';

-- If everything looks good
COMMIT;
-- If there are issues
-- ROLLBACK;
```

### 4.2 Create Opt-Out List Table

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_optout_list (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    opted_out_at TIMESTAMP NOT NULL DEFAULT NOW(),
    opt_out_source VARCHAR(50) NOT NULL,
    opt_out_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_optout_phone 
ON whatsapp_optout_list(phone_number);

-- Verify table was created
\d whatsapp_optout_list

COMMIT;
```

### 4.3 Create Consent Audit Table

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_consent_audit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    source VARCHAR(50),
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_audit_user 
ON whatsapp_consent_audit(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_audit_phone 
ON whatsapp_consent_audit(phone_number);

-- Verify table
\d whatsapp_consent_audit

COMMIT;
```

### 4.4 Update Existing Users with Consent

```sql
-- First, check how many users have WhatsApp phones
SELECT COUNT(*) as total_users,
       COUNT(whatsapp_phone) as users_with_whatsapp
FROM users;

-- Update consent for existing WhatsApp users
BEGIN;

UPDATE users 
SET whatsapp_consent_date = created_at,
    whatsapp_consent_method = 'legacy_migration'
WHERE whatsapp_phone IS NOT NULL 
  AND whatsapp_phone != ''
  AND whatsapp_consent_date IS NULL;

-- Verify update
SELECT COUNT(*) as updated_users
FROM users
WHERE whatsapp_consent_date IS NOT NULL;

COMMIT;
```

### 4.5 Update WhatsApp Notifications Table

```sql
-- Check if table exists and add retention columns
BEGIN;

ALTER TABLE whatsapp_notifications
ADD COLUMN IF NOT EXISTS should_delete_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 90;

-- Set deletion date for existing records
UPDATE whatsapp_notifications
SET should_delete_at = created_at + INTERVAL '90 days'
WHERE should_delete_at IS NULL;

COMMIT;
```

### 4.6 Create Archive Tables

```sql
BEGIN;

-- Deleted users archive
CREATE TABLE IF NOT EXISTS deleted_users_archive (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    whatsapp_phone VARCHAR(20),
    account_type VARCHAR(20),
    role VARCHAR(20),
    user_data JSONB,
    deleted_by INTEGER,
    deleted_at TIMESTAMP NOT NULL,
    deletion_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- WhatsApp notifications archive
CREATE TABLE IF NOT EXISTS whatsapp_notifications_archive (
    id SERIAL PRIMARY KEY,
    original_id INTEGER,
    application_id INTEGER,
    user_id INTEGER,
    phone_number VARCHAR(20),
    notification_type VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Consent audit archive
CREATE TABLE IF NOT EXISTS whatsapp_consent_audit_archive (
    id SERIAL PRIMARY KEY,
    original_id INTEGER,
    user_id INTEGER,
    action VARCHAR(50),
    created_at TIMESTAMP,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMIT;
```

### 4.7 Create Data Deletion Function

```sql
CREATE OR REPLACE FUNCTION delete_user_whatsapp_data(p_user_id INTEGER)
RETURNS TABLE(
    deleted_notifications INTEGER,
    deleted_consent_records INTEGER,
    anonymized_phone VARCHAR
) AS $$
DECLARE
    v_deleted_notifications INTEGER;
    v_deleted_consent INTEGER;
    v_phone VARCHAR;
BEGIN
    -- Get phone for return
    SELECT whatsapp_phone INTO v_phone 
    FROM users 
    WHERE id = p_user_id;
    
    -- Delete notifications
    DELETE FROM whatsapp_notifications
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;
    
    -- Delete consent audit records
    DELETE FROM whatsapp_consent_audit
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_consent = ROW_COUNT;
    
    -- Clear WhatsApp data from user
    UPDATE users
    SET whatsapp_phone = NULL,
        whatsapp_consent_date = NULL,
        whatsapp_opted_out = TRUE,
        whatsapp_optout_date = NOW(),
        whatsapp_consent_ip = NULL,
        whatsapp_consent_method = NULL
    WHERE id = p_user_id;
    
    -- Add to opt-out list if phone exists
    IF v_phone IS NOT NULL THEN
        INSERT INTO whatsapp_optout_list (phone_number, user_id, opt_out_source, opt_out_reason)
        VALUES (v_phone, p_user_id, 'data_deletion_request', 'User requested data deletion')
        ON CONFLICT (phone_number) DO NOTHING;
    END IF;
    
    RETURN QUERY
    SELECT v_deleted_notifications, v_deleted_consent, v_phone;
END;
$$ LANGUAGE plpgsql;
```

## Step 5: Verify Migration

```sql
-- Check all new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE 'whatsapp%'
ORDER BY column_name;

-- Check all new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('whatsapp_optout_list', 'whatsapp_consent_audit', 
                   'deleted_users_archive', 'whatsapp_notifications_archive', 
                   'whatsapp_consent_audit_archive');

-- Check function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'delete_user_whatsapp_data';

-- Test the function (dry run)
SELECT * FROM delete_user_whatsapp_data(1);
```

## Step 6: Deploy Code Changes

After database migration is complete:

```bash
# From local machine
cd /mnt/c/Users/micha/Desktop/Permisos_digitales

# Copy updated files
scp -i docs/permisos-digitales-fresh.pem \
  src/services/whatsapp/simple-whatsapp.service.js \
  src/controllers/user.controller.js \
  src/routes/user.routes.js \
  src/repositories/user.repository.js \
  src/jobs/whatsapp-data-retention.job.js \
  src/jobs/scheduler.js \
  ubuntu@107.21.154.162:/home/ubuntu/permisos-backend-deploy/src/

# SSH to server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Restart backend
pm2 restart permisos-api

# Check logs
pm2 logs permisos-api --lines 100
```

## Step 7: Test Implementation

1. **Test Opt-Out**:
   - Send "STOP" to WhatsApp bot
   - Verify user is added to opt-out list
   - Verify subsequent messages are blocked

2. **Test Data Export**:
   ```bash
   curl -X GET https://api.permisosdigitales.com.mx/api/user/data-export \
     -H "Cookie: <session-cookie>"
   ```

3. **Test Account Deletion**:
   ```bash
   curl -X DELETE https://api.permisosdigitales.com.mx/api/user/account \
     -H "Content-Type: application/json" \
     -H "Cookie: <session-cookie>" \
     -d '{"confirmEmail": "user@example.com", "deleteReason": "Test deletion"}'
   ```

## Rollback Plan

If issues occur:

```sql
-- Remove new columns (data will be lost)
ALTER TABLE users 
DROP COLUMN IF EXISTS whatsapp_consent_date,
DROP COLUMN IF EXISTS whatsapp_opted_out,
DROP COLUMN IF EXISTS whatsapp_optout_date,
DROP COLUMN IF EXISTS whatsapp_consent_ip,
DROP COLUMN IF EXISTS whatsapp_consent_method;

-- Drop new tables
DROP TABLE IF EXISTS whatsapp_optout_list CASCADE;
DROP TABLE IF EXISTS whatsapp_consent_audit CASCADE;
DROP TABLE IF EXISTS deleted_users_archive CASCADE;
DROP TABLE IF EXISTS whatsapp_notifications_archive CASCADE;
DROP TABLE IF EXISTS whatsapp_consent_audit_archive CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS delete_user_whatsapp_data;
```

## Important Notes

1. **Backup First**: Always backup the database before making schema changes
2. **Test in Staging**: If possible, test on a staging database first
3. **Monitor Logs**: Watch PM2 logs for any errors after deployment
4. **Legal Compliance**: These changes are required for WhatsApp Business API compliance

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs permisos-api`
2. Check database logs in AWS RDS console
3. Verify all services are running: `pm2 status`
# Privacy Features Deployment Guide

## Quick Start Deployment

### 1. Database Migrations (Run First!)

```bash
# SSH into production server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Navigate to app directory
cd /home/ubuntu/app

# Run migrations in order
psql -U postgres -h localhost -d permisos_digitales << EOF
-- Add privacy consent fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_consent_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS privacy_consent_version VARCHAR(20);

-- Create data deletion requests table
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  requested_by VARCHAR(255) NOT NULL,
  request_source VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  requested_date TIMESTAMP NOT NULL DEFAULT NOW(),
  scheduled_date TIMESTAMP NOT NULL,
  processed_date TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create privacy audit tables
CREATE TABLE IF NOT EXISTS privacy_consent_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  consent_type VARCHAR(50) NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_version VARCHAR(20),
  ip_address INET,
  user_agent TEXT,
  source VARCHAR(50) DEFAULT 'whatsapp',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create archive tables
CREATE TABLE IF NOT EXISTS archived_users (
  LIKE users INCLUDING ALL
);
ALTER TABLE archived_users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NOW();
EOF
```

### 2. Environment Configuration

```bash
# Add to .env file
cat >> /home/ubuntu/app/.env << EOF

# Privacy and Security Settings
WHATSAPP_APP_SECRET=YOUR_APP_SECRET_HERE
ENABLE_REDIS_ENCRYPTION=false
REDIS_ENCRYPTION_KEY=GENERATE_WITH_SCRIPT
EOF

# Update ecosystem.production.config.js
nano /home/ubuntu/app/ecosystem.production.config.js

# Add to env section:
env: {
  // ... existing vars ...
  WHATSAPP_APP_SECRET: "YOUR_APP_SECRET_HERE",
  ENABLE_REDIS_ENCRYPTION: "false",
  REDIS_ENCRYPTION_KEY: "GENERATE_WITH_SCRIPT"
}
```

### 3. Deploy Code Files

```bash
# From your local machine
cd /path/to/permisos_digitales

# Copy updated files
scp -i docs/permisos-digitales-fresh.pem -r \
  src/services/whatsapp/simple-whatsapp.service.js \
  src/services/whatsapp/secure-redis-wrapper.js \
  src/services/whatsapp/privacy-enhanced-service.js \
  src/services/whatsapp/state-manager.js \
  src/services/privacy-audit.service.js \
  src/controllers/whatsapp-simple.controller.js \
  src/core/express-app-factory.js \
  src/config/privacy-config.js \
  src/jobs/data-retention.job.js \
  src/jobs/scheduler.js \
  ubuntu@107.21.154.162:/home/ubuntu/app/src/

# Copy migrations (if not run directly)
scp -i docs/permisos-digitales-fresh.pem -r migrations/* \
  ubuntu@107.21.154.162:/home/ubuntu/app/migrations/

# Copy scripts
scp -i docs/permisos-digitales-fresh.pem scripts/migrate-redis-encryption.js \
  ubuntu@107.21.154.162:/home/ubuntu/app/scripts/
```

### 4. Restart Application

```bash
# On production server
cd /home/ubuntu/app

# Kill PM2 completely to reload environment
pm2 kill

# Start with new configuration
pm2 start ecosystem.production.config.js

# Verify it's running
pm2 status
pm2 logs permisos-digitales-api --lines 50
```

### 5. Verification Tests

```bash
# Test webhook signature validation
curl -X POST https://api.permisosdigitales.com.mx/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: invalid_signature" \
  -d '{"test": true}'

# Should return 401 Unauthorized

# Test privacy commands (from WhatsApp)
# Send: /privacidad
# Send: /inicio (should show consent request)
# Send: /mis-datos
# Send: /cancelar-datos
```

## Critical Configuration

### ⚠️ MUST DO BEFORE META REVIEW

1. **Get WhatsApp App Secret**
   - Go to https://developers.facebook.com/
   - Navigate to your app → Settings → Basic
   - Copy the App Secret (NOT Access Token)

2. **Set App Secret in Production**
   ```bash
   # Update both files!
   echo "WHATSAPP_APP_SECRET=your_actual_secret" >> .env
   # Also update in ecosystem.production.config.js
   ```

3. **Test Webhook Security**
   ```bash
   # This should fail with 401
   curl -X POST https://api.permisosdigitales.com.mx/api/whatsapp/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": "unsigned"}'
   ```

## Optional: Enable Redis Encryption

### Generate Encryption Key
```bash
# On production server
cd /home/ubuntu/app
node scripts/migrate-redis-encryption.js --generate-key

# Copy the generated key
```

### Enable Encryption
```bash
# Add to environment
echo "REDIS_ENCRYPTION_KEY=your_generated_key" >> .env
echo "ENABLE_REDIS_ENCRYPTION=true" >> .env

# Update ecosystem.production.config.js with same values

# Migrate existing data
node scripts/migrate-redis-encryption.js

# Restart
pm2 restart permisos-digitales-api
```

## Monitoring

### Check Privacy Features
```bash
# Check consent logging
psql -U postgres -h localhost -d permisos_digitales -c \
  "SELECT COUNT(*) FROM privacy_consent_log WHERE created_at > NOW() - INTERVAL '1 day';"

# Check deletion requests
psql -U postgres -h localhost -d permisos_digitales -c \
  "SELECT * FROM data_deletion_requests ORDER BY created_at DESC LIMIT 5;"

# Check opt-out list
psql -U postgres -h localhost -d permisos_digitales -c \
  "SELECT COUNT(*) FROM whatsapp_optout_list;"
```

### Monitor Jobs
```bash
# Check data retention job logs
pm2 logs permisos-digitales-api | grep "DataRetentionJob"

# Check WhatsApp state cleanup
pm2 logs permisos-digitales-api | grep "WhatsApp state cleanup"
```

## Rollback Plan

If issues occur:

```bash
# 1. Restore previous code
cd /home/ubuntu/app
git checkout HEAD~1 src/

# 2. Disable webhook validation temporarily
# Comment out validation in whatsapp-simple.controller.js

# 3. Restart
pm2 restart permisos-digitales-api

# 4. Investigate issues in logs
pm2 logs permisos-digitales-api --lines 200
```

## Success Indicators

✅ No 401 errors in logs (webhook validation working)  
✅ Privacy consent messages being sent  
✅ Privacy commands responding correctly  
✅ Audit logs being created  
✅ No performance degradation  

## Support

Issues? Contact:
- Technical: Check PM2 logs first
- Privacy: Review audit logs
- Security: Check webhook signature logs

Remember: **WHATSAPP_APP_SECRET must be set before Meta review!**
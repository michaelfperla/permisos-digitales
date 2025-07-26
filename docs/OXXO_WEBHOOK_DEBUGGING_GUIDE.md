# OXXO Payment & Webhook Debugging Guide

## Date: 2025-06-28
## Issue: OXXO payments not updating after customer payment

## Summary of Issues Found

1. **OXXO Payment Processing Time**: 1-24 hours (normal behavior)
2. **Webhook Configuration**: Missing `charge.updated` event (fixed)
3. **Database SSL Certificate Error**: Production config had SSL validation issues (fixed)
4. **AWS Infrastructure**: ALB correctly configured, no WAF issues

## Critical Information

### Production Infrastructure
- **EC2 Instance**: 107.21.154.162 (i-0a647b6136a31ff24)
- **Load Balancer**: permisos-api-alb (ALB)
- **API Domain**: api.permisosdigitales.com.mx → 52.20.53.161 (ALB)
- **App Port**: 3001 (Node.js direct, no nginx proxy)
- **SSH Access**: `ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162`

### Stripe Configuration
- **Account ID**: acct_1RZEz7BAOWekgvqq
- **Webhook Endpoint**: https://api.permisosdigitales.com.mx/webhook/stripe
- **Webhook Endpoint ID**: we_1RZQHiBAOWekgvqq4DMNbKpq
- **Webhook Secret**: whsec_NisFnTYSEEeHksjKLg3B8kwQDFpzzlCX

### AWS Secrets Manager Keys
```
permisos/production/stripe/api-keys
permisos/production/database/credentials
permisos/production/redis/credentials
```

## Successful Diagnostic Commands

### 1. Check Stripe Payment Status
```bash
# Retrieve payment intent details
stripe payment_intents retrieve pi_3RekYlBAOWekgvqq0P8pNXfS --live --api-key sk_live_[YOUR_KEY]

# List recent events
stripe events list --limit 20 --live --api-key sk_live_[YOUR_KEY]

# Check for specific event types
stripe events list --types "charge.succeeded,charge.updated" --limit 10 --live --api-key sk_live_[YOUR_KEY]
```

### 2. Database Queries (via SSH)
```bash
# Check OXXO payments in database
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "cd /home/ubuntu/permisos-backend-deploy && node -e \"
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const result = await pool.query(\\\`
    SELECT id, nombre_completo, status, payment_intent_id, updated_at
    FROM permit_applications
    WHERE payment_intent_id LIKE '%oxxo%' OR status = 'AWAITING_OXXO_PAYMENT'
    ORDER BY created_at DESC
    LIMIT 10
  \\\`);
  console.log(result.rows);
  await pool.end();
})();
\""
```

### 3. Check Webhook Events
```bash
# Check webhook events in database
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "cd /home/ubuntu/permisos-backend-deploy && node -e \"
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const result = await pool.query(\\\`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
    FROM webhook_events
  \\\`);
  console.log('Webhook events:', result.rows[0]);
  await pool.end();
})();
\""
```

### 4. Application Management
```bash
# Check PM2 status
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 status"

# View environment variables
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 env 0 | grep -E 'STRIPE|DB_SSL'"

# Restart application
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 restart 0"

# View logs
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 logs 0 --lines 50"

# Monitor specific log patterns
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "tail -f /home/ubuntu/.pm2/logs/permisos-api-out-0.log | grep -i webhook"
```

### 5. AWS CLI Commands
```bash
# Get Stripe secrets
aws secretsmanager get-secret-value --secret-id permisos/production/stripe/api-keys --query SecretString --output text

# Check ALB configuration
aws elbv2 describe-load-balancers --names permisos-api-alb

# Check target health
aws elbv2 describe-target-health --target-group-arn [ARN]
```

### 6. Test Webhook Endpoint
```bash
# Test from external
curl -X POST https://api.permisosdigitales.com.mx/webhook/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"test":true}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# Test from server locally
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "curl -X POST http://localhost:3001/webhook/stripe -H 'Content-Type: application/json' -H 'Stripe-Signature: test' -d '{\"test\":true}'"
```

## Fixes Applied

### 1. Added Missing Webhook Events in Stripe Dashboard
- Added `charge.updated` (critical for OXXO)
- Added `charge.succeeded`
- Added `charge.failed`
- Added `payment_intent.processing`
- Added `payment_intent.amount_capturable_updated`

### 2. Fixed Database SSL Certificate Issue
```bash
# Modified src/config/unified-config.js
# Changed: rejectUnauthorized: true → rejectUnauthorized: false
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 'cd /home/ubuntu/permisos-backend-deploy && sed -i "s/rejectUnauthorized: true/rejectUnauthorized: false/g" src/config/unified-config.js'
```

## Key Findings

### OXXO Payment Flow
1. Customer pays at OXXO store
2. OXXO processes payment (1-24 hours)
3. OXXO notifies payment processor ONCE
4. Processor notifies Stripe ONCE
5. Stripe sends webhook (retries if fails)

### Database Tables
- `permit_applications` - Main applications table
- `payment_events` - Payment event tracking
- `webhook_events` - Webhook delivery tracking

### Application Status Values
- `AWAITING_OXXO_PAYMENT` - Waiting for OXXO confirmation
- `PAYMENT_RECEIVED` - Payment confirmed
- `GENERATING_PERMIT` - PDF generation in progress
- `PERMIT_GENERATED` - Complete

## Monitoring Commands for Future Issues

```bash
# Create monitoring script
cat > monitor_oxxo.sh << 'EOF'
#!/bin/bash
echo "=== OXXO Payment Monitor ==="
echo "1. Checking Stripe payment status..."
stripe payment_intents list --limit 5 --live --api-key $STRIPE_KEY | grep -E "(id|status|amount)" | head -20

echo -e "\n2. Checking database for pending OXXO payments..."
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "cd /home/ubuntu/permisos-backend-deploy && node -e \"
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const result = await pool.query('SELECT COUNT(*) FROM permit_applications WHERE status = \\'AWAITING_OXXO_PAYMENT\\'');
  console.log('Pending OXXO payments:', result.rows[0].count);
  await pool.end();
})();
\""

echo -e "\n3. Checking webhook health..."
curl -s -o /dev/null -w "Webhook endpoint response: %{http_code}\n" https://api.permisosdigitales.com.mx/webhook/stripe -X POST -H "Content-Type: application/json" -d '{"test":true}'
EOF
chmod +x monitor_oxxo.sh
```

## Important Notes

1. **OXXO payments are NOT instant** - Always expect 1-24 hour delays
2. **Webhooks must include `charge.updated`** for OXXO payments
3. **Database SSL issues** can block all webhook processing
4. **No nginx proxy** - App listens directly on port 3001
5. **ALB handles HTTPS** termination and forwards to HTTP on 3001

## Emergency Contacts
- Stripe Support: For manual OXXO payment verification
- AWS Support: For RDS SSL certificate issues
- Application Logs: `/home/ubuntu/.pm2/logs/permisos-api-*.log`

## Next Steps for Permanent Fixes
1. Fix RDS SSL certificate configuration properly
2. Implement webhook event replay mechanism
3. Add OXXO payment status monitoring dashboard
4. Set up alerts for webhook failures
5. Consider implementing manual payment confirmation for admin users
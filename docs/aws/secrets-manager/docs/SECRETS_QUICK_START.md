# AWS Secrets Manager Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Create Secrets in AWS

Run this command for each secret (replace values with your actual secrets):

```bash
# Database
aws secretsmanager create-secret \
  --name permisos/production/database/credentials \
  --secret-string '{
    "host": "permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "database": "permisos_db",
    "username": "permisos_admin",
    "password": "YOUR_DB_PASSWORD_HERE"
  }'

# Redis
aws secretsmanager create-secret \
  --name permisos/production/redis/credentials \
  --secret-string '{
    "host": "master.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com",
    "port": 6379,
    "password": "",
    "tls": {
      "servername": "master.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com",
      "rejectUnauthorized": true
    }
  }'

# Security Secrets
aws secretsmanager create-secret \
  --name permisos/production/security/secrets \
  --secret-string '{
    "sessionSecret": "YOUR_SESSION_SECRET_HERE_MIN_32_CHARS",
    "jwtSecret": "YOUR_JWT_SECRET_HERE",
    "internalApiKey": "YOUR_INTERNAL_API_KEY_HERE"
  }'

# Stripe
aws secretsmanager create-secret \
  --name permisos/production/stripe/api-keys \
  --secret-string '{
    "publicKey": "pk_live_YOUR_STRIPE_PUBLIC_KEY",
    "privateKey": "sk_live_YOUR_STRIPE_PRIVATE_KEY",
    "webhookSecret": "whsec_YOUR_WEBHOOK_SECRET"
  }'

# Email
aws secretsmanager create-secret \
  --name permisos/production/email/credentials \
  --secret-string '{
    "smtpUser": "YOUR_SMTP_USERNAME",
    "smtpPassword": "YOUR_SMTP_PASSWORD",
    "fromAddress": "noreply@permisosdigitales.com.mx"
  }'

# Government Portal
aws secretsmanager create-secret \
  --name permisos/production/government/portal \
  --secret-string '{
    "username": "YOUR_GOVT_USERNAME",
    "password": "YOUR_GOVT_PASSWORD",
    "loginUrl": "https://government-portal-url.mx"
  }'
```

### 2. Update IAM Policy

```bash
# Create policy
aws iam create-policy \
  --policy-name PermisosDigitalesSecretsManagerAccess \
  --policy-document file://aws/iam-policy-secrets-manager.json

# Attach to role
aws iam attach-role-policy \
  --role-name PermisosDigitalesBackendRole \
  --policy-arn arn:aws:iam::654722280275:policy/PermisosDigitalesSecretsManagerAccess
```

### 3. Deploy to EC2

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@107.21.154.162

# Update code
cd /var/www/permisos-digitales
git pull

# Install dependencies
npm install

# Update PM2 to use new server
pm2 delete all
pm2 start ecosystem.production.config.js
pm2 save
pm2 startup
```

### 4. Update ecosystem.production.config.js

```javascript
module.exports = {
  apps: [{
    name: 'permisos-api',
    script: './src/server-with-secrets.js', // <-- Changed from server.js
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      AWS_REGION: 'us-east-1',
      // Only non-sensitive config
      FRONTEND_URL: 'https://permisosdigitales.com.mx',
      S3_BUCKET: 'permisos-digitales-files-east'
      // NO MORE PASSWORDS OR KEYS HERE!
    }
  }]
};
```

## ✅ Verify Everything Works

```bash
# Check health endpoint
curl https://api.permisosdigitales.com.mx/health

# Check logs
pm2 logs

# Test a payment (Stripe)
# Test sending an email
# Test government portal integration
```

## 🔄 To Update a Secret

```bash
# Update secret
aws secretsmanager update-secret \
  --secret-id permisos/production/stripe/api-keys \
  --secret-string '{"publicKey":"pk_live_NEW","privateKey":"sk_live_NEW","webhookSecret":"whsec_NEW"}'

# Restart app to pick up changes
pm2 restart permisos-api
```

## 🚨 Emergency Rollback

If something goes wrong:

```bash
# Quick rollback to env vars
pm2 stop permisos-api
pm2 start src/server.js --name permisos-legacy

# Add env vars back temporarily
export DATABASE_URL="..."
export SESSION_SECRET="..."
# etc.
```

## 📊 Monitor Usage

View your Secrets Manager costs and usage:

```bash
# Get secret usage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SecretsManager \
  --metric-name NumberOfAPICallsInvoked \
  --start-time 2025-06-15T00:00:00Z \
  --end-time 2025-06-22T00:00:00Z \
  --period 86400 \
  --statistics Sum
```

## 💰 Cost Estimate

- 6 secrets × $0.40/month = $2.40/month
- API calls (with caching): ~$0.10/month
- **Total: ~$2.50/month**

## 🎉 Benefits

1. **No more hardcoded secrets** in code or env files
2. **Automatic encryption** with AWS KMS
3. **Audit trail** of who accessed what
4. **Easy rotation** without code changes
5. **Centralized management** across all environments
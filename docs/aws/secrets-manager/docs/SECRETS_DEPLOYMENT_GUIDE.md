# AWS Secrets Manager Deployment Guide

## Prerequisites

1. AWS CLI installed and configured
2. Proper AWS credentials with permissions to:
   - Create/update secrets in Secrets Manager
   - Create/update IAM policies
   - Attach policies to IAM roles

## Step 1: Prepare Your Secrets

### Option A: Using the Migration Script (Recommended)

```bash
# Make the script executable
chmod +x scripts/migrate-env-to-secrets.js

# Run the migration tool
node scripts/migrate-env-to-secrets.js

# Follow the prompts to migrate from .env file or current environment
```

### Option B: Using the Setup Script

```bash
# Make the script executable
chmod +x scripts/setup-secrets-manager.sh

# Set your environment variables
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export REDIS_HOST="your-redis-host.amazonaws.com"
export SESSION_SECRET="your-session-secret"
export STRIPE_PRIVATE_KEY="sk_live_..."
export STRIPE_PUBLIC_KEY="pk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
# ... set all other required variables

# Run the setup script
./scripts/setup-secrets-manager.sh
```

### Option C: Manual Creation via AWS CLI

```bash
# Example: Create database secret
aws secretsmanager create-secret \
  --name permisos/production/database/credentials \
  --secret-string '{
    "host": "your-db-host",
    "port": 5432,
    "database": "permisos_db",
    "username": "admin",
    "password": "secure-password"
  }'
```

## Step 2: Configure IAM Permissions

### Attach Policy to EC2 Role

```bash
# Create the policy
aws iam create-policy \
  --policy-name PermisosDigitalesSecretsManagerAccess \
  --policy-document file://aws/iam-policy-secrets-manager.json

# Attach to existing role
aws iam attach-role-policy \
  --role-name PermisosDigitalesBackendRole \
  --policy-arn arn:aws:iam::654722280275:policy/PermisosDigitalesSecretsManagerAccess
```

### Verify EC2 Instance Profile

```bash
# Check instance profile
aws ec2 describe-instances \
  --instance-ids i-0a647b6136a31ff24 \
  --query 'Reservations[0].Instances[0].IamInstanceProfile'

# Should show: PermisosDigitalesBackendInstanceProfile
```

## Step 3: Update Application Code

### 1. Install Dependencies

```bash
npm install aws-sdk
```

### 2. Update package.json

```json
{
  "scripts": {
    "start": "node src/server-with-secrets.js",
    "start:legacy": "node src/server.js",
    "dev": "nodemon src/server-with-secrets.js"
  }
}
```

### 3. Test Locally

```bash
# Set AWS credentials for local testing
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1
export NODE_ENV=development

# Test secret access
node -e "
const AWS = require('aws-sdk');
const sm = new AWS.SecretsManager({ region: 'us-east-1' });
sm.getSecretValue({ SecretId: 'permisos/development/database/credentials' })
  .promise()
  .then(data => console.log('Success:', JSON.parse(data.SecretString)))
  .catch(err => console.error('Error:', err));
"
```

## Step 4: Deploy to EC2

### 1. Update Your Deployment

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@107.21.154.162

# Pull latest code
cd /var/www/permisos-digitales
git pull origin main

# Install dependencies
npm install

# Update PM2 configuration
pm2 stop all
pm2 delete all
pm2 start ecosystem.production.config.js
pm2 save
```

### 2. Update ecosystem.production.config.js

```javascript
module.exports = {
  apps: [{
    name: 'permisos-api',
    script: './src/server-with-secrets.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      AWS_REGION: 'us-east-1',
      // Only non-sensitive configuration here
      FRONTEND_URL: 'https://permisosdigitales.com.mx',
      APP_URL: 'https://api.permisosdigitales.com.mx',
      S3_BUCKET: 'permisos-digitales-files-east'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 3. Verify Deployment

```bash
# Check logs
pm2 logs

# Check application health
curl http://localhost:3001/health

# Check secrets access
pm2 describe permisos-api | grep 'secrets.*healthy'
```

## Step 5: Verify Everything Works

### 1. Test Secret Access from EC2

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@107.21.154.162

# Test IAM role
aws sts get-caller-identity

# Test secret access
aws secretsmanager get-secret-value \
  --secret-id permisos/production/database/credentials \
  --query SecretString \
  --output text | jq '.'
```

### 2. Monitor CloudWatch Logs

```bash
# View Secrets Manager API calls
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --max-results 10
```

### 3. Check Application Logs

```bash
# On EC2 instance
tail -f /var/www/permisos-digitales/logs/out.log | grep SecretsManager
```

## Step 6: Remove Old Environment Variables

### 1. Clean PM2 Environment

```bash
# Remove sensitive vars from ecosystem file
# Keep only non-sensitive configuration

# Restart PM2
pm2 restart all --update-env
```

### 2. Clean System Environment

```bash
# Remove from /etc/environment or ~/.bashrc
sudo nano /etc/environment
# Remove sensitive variables

# Remove from systemd service files if any
sudo nano /etc/systemd/system/permisos.service
```

## Rotation Procedures

### Manual Secret Rotation

```bash
# Update a secret
aws secretsmanager update-secret \
  --secret-id permisos/production/database/credentials \
  --secret-string '{"host":"...", "password":"new-password"}'

# Restart application to pick up new secret
pm2 restart permisos-api
```

### Automatic Rotation (Database)

```bash
# Enable rotation for RDS password
aws secretsmanager rotate-secret \
  --secret-id permisos/production/database/credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:654722280275:function:SecretsManagerRDSPostgreSQLRotation
```

## Monitoring & Alerts

### CloudWatch Alarms

```bash
# Create alarm for failed secret retrievals
aws cloudwatch put-metric-alarm \
  --alarm-name permisos-secrets-failures \
  --alarm-description "Alert on Secrets Manager failures" \
  --metric-name 4xxError \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

## Rollback Procedure

If issues occur, you can quickly rollback:

```bash
# 1. Switch to legacy server
pm2 stop permisos-api
pm2 start src/server.js --name permisos-legacy

# 2. Re-add environment variables temporarily
export DATABASE_URL="..."
export SESSION_SECRET="..."
# etc.

# 3. Investigate and fix issues
# 4. Retry migration when ready
```

## Security Best Practices

1. **Never log secrets** - The secrets service masks sensitive values
2. **Use least privilege** - Only grant necessary permissions
3. **Enable CloudTrail** - Audit all secret access
4. **Rotate regularly** - Set up rotation schedules
5. **Monitor access** - Set up alerts for unusual activity
6. **Use different secrets per environment** - Don't share between dev/prod

## Troubleshooting

### Common Issues

1. **"Access Denied" errors**
   - Check IAM role is attached to EC2 instance
   - Verify policy includes the correct secret ARNs
   - Check KMS key permissions

2. **"Secret not found" errors**
   - Verify secret name matches exactly
   - Check AWS region is correct
   - Ensure secret exists in the account

3. **Application won't start**
   - Check CloudWatch logs
   - Verify all required secrets exist
   - Test with legacy mode using env vars

### Debug Commands

```bash
# Check EC2 instance role
aws sts get-caller-identity

# List secrets (requires additional permissions)
aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'permisos')]"

# Test specific secret
aws secretsmanager get-secret-value --secret-id permisos/production/database/credentials

# Check application logs
pm2 logs permisos-api --lines 100
```

## Success Checklist

- [ ] All secrets created in AWS Secrets Manager
- [ ] IAM policy attached to EC2 role
- [ ] Application code updated to use secrets service
- [ ] Deployment successful with new server entry point
- [ ] Health checks passing
- [ ] All features working (payments, email, etc.)
- [ ] Environment variables removed from deployment
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team trained on new procedures
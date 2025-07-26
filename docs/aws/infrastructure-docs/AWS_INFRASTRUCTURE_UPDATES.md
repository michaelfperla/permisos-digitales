# AWS Infrastructure Documentation Updates

This document contains updates discovered through AWS CLI queries on 2025-06-24.

## Key Findings Not Previously Documented

### 1. Secrets Manager Configuration
The infrastructure is using AWS Secrets Manager with 6 production secrets:

| Secret Name | Description | Last Updated |
|------------|-------------|--------------|
| permisos/production/database/credentials | PostgreSQL database credentials | 2025-06-22T13:52:01.669000-07:00 |
| permisos/production/redis/credentials | Redis cache credentials | 2025-06-22T13:52:02.550000-07:00 |
| permisos/production/security/secrets | Security and authentication secrets | 2025-06-22T13:52:03.408000-07:00 |
| permisos/production/stripe/api-keys | Stripe payment gateway API keys | 2025-06-22T13:52:04.326000-07:00 |
| permisos/production/email/credentials | Email service credentials | 2025-06-22T13:52:05.197000-07:00 |
| permisos/production/government/portal | Government portal integration | 2025-06-22T13:52:06.114000-07:00 |

**Secret Structure Expected by Application:**
- Database: `{host, port, database, username, password, url}`
- Redis: `{host, port, password, tls}`
- Security: `{sessionSecret, jwtSecret, internalApiKey}`
- Stripe: `{publicKey, privateKey, webhookSecret}`
- Email: `{smtpUser, smtpPassword, fromAddress}`
- Government: `{username, password, loginUrl}`

### 2. CloudWatch Alarms Status
- **CRITICAL**: The `permisos-api-health-check` alarm is currently in ALARM state
- Added alarm: `permisos-rds-storage-low` for monitoring RDS free storage space
- All other alarms (CPU, instance status) are in OK state

### 3. Additional Infrastructure Details

#### EC2 Instance
- Instance Metadata Service: IMDSv1 enabled (consider upgrading to IMDSv2 for security)
- Boot Mode: UEFI-preferred
- Network Performance: Default bandwidth weighting

#### S3 Bucket Encryption
- permisos-digitales-files-east uses SSE-S3 (AES256) with BucketKeyEnabled: false
- permisos-digitales-frontend-east has no encryption configured

#### Redis Security
- No auth token configured (relies solely on security groups)
- Transit encryption mode: "required" (not just enabled)
- At-rest encryption is enabled

#### IAM Role Details
- PermisosDigitalesBackendRole was last used on 2025-06-24T19:05:51+00:00
- Max session duration: 1 hour (3600 seconds)
- Current user: permisos-deployer (User ID: AIDAZQ4D5FNJTS33DI5OY)

#### SNS Topics
- permisos-digitales-alerts: For CloudWatch alarm notifications
- permisos-digitales-ses-events: For SES event notifications (bounces, complaints)

### 4. Missing Configurations
- SES Configuration Set "permisos-events" is referenced but not found
- No versioning enabled on S3 buckets
- No CloudFront logging configured

### 5. Cost Optimization Opportunities
- EC2 instance monitoring is disabled (could enable for better metrics)
- Consider enabling S3 bucket key for encryption cost reduction
- Redis cluster has no replicas (single point of failure)

## Recommendations

1. **Immediate Actions:**
   - Investigate the Route53 health check alarm
   - Create the missing SES configuration set "permisos-events"
   - Consider enabling IMDSv2 on the EC2 instance

2. **Security Enhancements:**
   - Enable S3 bucket versioning for recovery capabilities
   - Add Redis auth token in addition to security groups
   - Configure CloudFront access logging

3. **High Availability:**
   - Add Redis replica for failover capability
   - Consider Multi-AZ for RDS in production
   - Implement auto-scaling for the EC2 instance

4. **Monitoring:**
   - Enable detailed EC2 monitoring
   - Add more granular CloudWatch metrics
   - Configure SES event publishing to the configuration set

## Development Setup Requirements

For local development, you'll need to configure the following environment variables as fallbacks:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Security
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
INTERNAL_API_KEY=your-internal-api-key

# Stripe
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_PRIVATE_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
EMAIL_USER=your-ses-smtp-user
EMAIL_PASS=your-ses-smtp-password
EMAIL_FROM=noreply@permisosdigitales.com.mx

# Government Portal
GOVT_USERNAME=your-username
GOVT_PASSWORD=your-password
GOVT_SITE_LOGIN_URL=https://government-portal-url

# AWS
AWS_REGION=us-east-1
NODE_ENV=development
```

The application's SecretsManagerService will automatically fall back to these environment variables when it can't access AWS Secrets Manager (e.g., in development).
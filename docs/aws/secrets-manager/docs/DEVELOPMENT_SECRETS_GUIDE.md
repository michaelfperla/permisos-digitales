# Development Secrets Configuration Guide

This guide explains how to set up secrets for local development of the Permisos Digitales application.

## Overview

The application uses AWS Secrets Manager in production but supports environment variables as a fallback for local development. This allows developers to run the application without AWS credentials.

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# Node Environment
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://permisos_admin:your-password@localhost:5432/permisos_digitales
# Or individual components:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=permisos_digitales
# DB_USER=permisos_admin
# DB_PASSWORD=your-password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-redis-password
# Note: TLS is automatically disabled in development mode

# Security Secrets
SESSION_SECRET=development-session-secret-min-32-chars-recommended
JWT_SECRET=development-jwt-secret-min-32-chars-recommended
INTERNAL_API_KEY=development-internal-api-key

# Stripe Configuration (Use test keys from Stripe Dashboard)
STRIPE_PUBLIC_KEY=pk_test_your-stripe-public-key
STRIPE_PRIVATE_KEY=sk_test_your-stripe-private-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Configuration (Optional for development)
EMAIL_USER=your-ses-smtp-username
EMAIL_PASS=your-ses-smtp-password
EMAIL_FROM=noreply@permisosdigitales.com.mx

# Government Portal Integration (Mock values for development)
GOVT_USERNAME=test-username
GOVT_PASSWORD=test-password
GOVT_SITE_LOGIN_URL=https://example.com/login

# AWS Configuration (Optional for development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# File Storage (Local development)
STORAGE_TYPE=local
LOCAL_UPLOAD_PATH=./uploads

# Application URLs
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
```

## Secret Generation Tips

### Generating Secure Secrets

For development, you can use these commands to generate secure secrets:

```bash
# Generate a 32-character hex secret
openssl rand -hex 32

# Generate a base64 secret
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Stripe Test Keys

1. Log in to your Stripe Dashboard
2. Toggle to "Test mode"
3. Go to Developers → API keys
4. Copy the test publishable and secret keys
5. For webhook secrets, create a local webhook endpoint

### Local Database Setup

```bash
# Using Docker
docker run --name permisos-postgres \
  -e POSTGRES_DB=permisos_digitales \
  -e POSTGRES_USER=permisos_admin \
  -e POSTGRES_PASSWORD=your-password \
  -p 5432:5432 \
  -d postgres:17.4

# Using Docker Compose (recommended)
# Create docker-compose.yml with both PostgreSQL and Redis
```

### Local Redis Setup

```bash
# Using Docker
docker run --name permisos-redis \
  -p 6379:6379 \
  -d redis:7.1.0-alpine

# With password (optional)
docker run --name permisos-redis \
  -p 6379:6379 \
  -d redis:7.1.0-alpine redis-server --requirepass your-redis-password
```

## Docker Compose Setup (Recommended)

Create a `docker-compose.dev.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:17.4
    environment:
      POSTGRES_DB: permisos_digitales
      POSTGRES_USER: permisos_admin
      POSTGRES_PASSWORD: development-password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7.1.0-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

volumes:
  postgres_data:
```

Run with: `docker-compose -f docker-compose.dev.yml up -d`

## Secrets Manager Service Behavior

The `SecretsManagerService` in the application:

1. First attempts to fetch secrets from AWS Secrets Manager
2. Falls back to environment variables if AWS is unavailable
3. Caches secrets for 1 hour (configurable)
4. Logs fallback usage for debugging

## Testing AWS Secrets Manager Locally

If you want to test with actual AWS Secrets Manager:

1. Configure AWS credentials:
   ```bash
   aws configure
   # Or use environment variables:
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   export AWS_REGION=us-east-1
   ```

2. Ensure your IAM user has the `PermisosDigitalesSecretsReadOnly` policy

3. Set `NODE_ENV=production` to use production secrets (be careful!)

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use different secrets for each environment**
3. **Rotate secrets regularly** even in development
4. **Use strong, unique passwords** for databases
5. **Don't share development secrets** between developers

## Troubleshooting

### Common Issues

1. **"Cannot connect to database"**
   - Check if PostgreSQL is running
   - Verify DATABASE_URL format
   - Check firewall/security groups

2. **"Redis connection failed"**
   - Ensure Redis is running
   - Check if password is required
   - Verify port is not blocked

3. **"Secrets Manager access denied"**
   - Check AWS credentials
   - Verify IAM permissions
   - Ensure correct AWS_REGION

4. **"Missing required secret"**
   - Check all environment variables are set
   - Look for typos in variable names
   - Check logs for specific missing secrets

### Debug Mode

Enable debug logging to see secrets loading:

```bash
DEBUG=secrets:* npm run dev
```

## Production Secrets Reference

For reference, here are the production secrets in AWS Secrets Manager:

- `permisos/production/database/credentials`
- `permisos/production/redis/credentials`
- `permisos/production/security/secrets`
- `permisos/production/stripe/api-keys`
- `permisos/production/email/credentials`
- `permisos/production/government/portal`

Each follows the pattern: `permisos/{environment}/{service}/{type}`

## Contact

For access to staging/production secrets or AWS credentials, contact the DevOps team.
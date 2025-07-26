# AWS Secrets Manager Architecture

## Identified Secrets

### 1. Database Credentials
- PostgreSQL connection details
- RDS SSL certificate

### 2. Redis Configuration
- Redis host and credentials
- TLS configuration

### 3. Security/Authentication
- SESSION_SECRET (session encryption)
- JWT_SECRET (token signing)
- INTERNAL_API_KEY (service-to-service auth)

### 4. Payment Integration (Stripe)
- STRIPE_PUBLIC_KEY
- STRIPE_PRIVATE_KEY
- STRIPE_WEBHOOK_SECRET

### 5. Email Service (SES)
- SMTP credentials
- SES configuration

### 6. Government Portal
- Portal credentials
- Login URL

### 7. Monitoring (Optional)
- Monitoring service API keys

## Naming Convention

```
permisos/{environment}/{service}/{secret-type}
```

Examples:
- `permisos/production/database/credentials`
- `permisos/production/stripe/api-keys`
- `permisos/production/security/session`

## Secret Structure

### Database Secret
```json
{
  "host": "permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "database": "permisos_db",
  "username": "permisos_admin",
  "password": "secure-password-here",
  "ssl": {
    "rejectUnauthorized": true,
    "ca": "base64-encoded-certificate"
  }
}
```

### Redis Secret
```json
{
  "host": "master.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com",
  "port": 6379,
  "password": "optional-redis-password",
  "tls": {
    "servername": "master.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com",
    "rejectUnauthorized": true
  }
}
```

### Security Secret
```json
{
  "sessionSecret": "minimum-32-character-random-string",
  "jwtSecret": "another-secure-random-string",
  "internalApiKey": "service-to-service-auth-key"
}
```

### Stripe Secret
```json
{
  "publicKey": "pk_live_...",
  "privateKey": "sk_live_...",
  "webhookSecret": "whsec_..."
}
```

### Email Secret
```json
{
  "smtpUser": "AKIA...",
  "smtpPassword": "smtp-password",
  "fromAddress": "noreply@permisosdigitales.com.mx"
}
```

### Government Portal Secret
```json
{
  "username": "portal-username",
  "password": "portal-password",
  "loginUrl": "https://government-portal.mx/login"
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create secrets management service
2. Implement caching layer
3. Add error handling and fallbacks

### Phase 2: IAM & Permissions
1. Create IAM policy for EC2 role
2. Attach policy to instance profile
3. Test permissions

### Phase 3: Secret Creation
1. Create secrets in AWS
2. Migrate existing values
3. Validate access

### Phase 4: Application Integration
1. Update database configuration
2. Update Redis configuration
3. Update service configurations

### Phase 5: Testing & Monitoring
1. Unit tests for secrets service
2. Integration tests
3. Monitoring and alerts

### Phase 6: Deployment
1. Deploy to staging
2. Validate functionality
3. Deploy to production
4. Enable rotation (where applicable)

## Security Best Practices

1. **Least Privilege**: Only grant necessary permissions
2. **Encryption**: All secrets encrypted with AWS KMS
3. **Audit Trail**: All access logged via CloudTrail
4. **Rotation**: Enable automatic rotation for database passwords
5. **Caching**: Cache secrets to minimize API calls
6. **Fallback**: Environment variables as emergency fallback
7. **Monitoring**: Alert on failed secret retrievals

## Cost Optimization

- Cache secrets for 1 hour (reduce API calls)
- Use single secret per service category
- Batch secret retrieval on startup
- Monitor usage via CloudWatch

## Emergency Procedures

1. **Secret Compromise**:
   - Immediately rotate affected secret
   - Update application configuration
   - Review CloudTrail logs

2. **AWS Outage**:
   - Use cached values
   - Fall back to environment variables
   - Monitor AWS status

3. **Permission Issues**:
   - Check IAM role attachments
   - Verify secret resource policies
   - Test with AWS CLI
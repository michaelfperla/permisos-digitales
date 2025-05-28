# Production Deployment Checklist
## Permisos Digitales - Final Configuration Steps

**Status:** Ready for deployment after completing these steps

---

## 🔧 Environment Configuration (CRITICAL)

### 1. Database Configuration
**File:** `.env.production`
**Current:** 
```
DATABASE_URL=postgres://permisos_admin:YOUR_ACTUAL_RDS_PASSWORD@your-actual-rds-endpoint.us-east-1.rds.amazonaws.com:5432/permisos_digitales
```

**Action Required:**
```bash
# Replace with your actual RDS endpoint from AWS Console
DATABASE_URL=postgres://permisos_admin:ACTUAL_PASSWORD@permisos-digitales-db.cnkiusqgvv1f.us-west-1.rds.amazonaws.com:5432/permisos_digitales
```

### 2. Redis Configuration
**Current:**
```
REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com
```

**Action Required:**
```bash
# Replace with your actual ElastiCache endpoint
REDIS_HOST=master.permisos-digitales-redis.cwkbms.usw1.cache.amazonaws.com
```

### 3. AWS S3 Configuration
**Current:**
```
S3_ACCESS_KEY_ID=YOUR_ACTUAL_S3_ACCESS_KEY
S3_SECRET_ACCESS_KEY=YOUR_ACTUAL_S3_SECRET_KEY
```

**Action Required:**
```bash
# Replace with your actual AWS IAM credentials
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
```

### 4. Email Configuration
**Current:**
```
EMAIL_HOST=smtp.ethereal.email
MAILGUN_API_KEY=YOUR_MAILGUN_API_KEY_PLACEHOLDER
MAILGUN_DOMAIN=YOUR_MAILGUN_DOMAIN_PLACEHOLDER
```

**Action Required:**
```bash
# Option 1: Use Mailgun (Recommended)
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.permisosdigitales.com.mx

# Option 2: Use AWS SES
EMAIL_HOST=email-smtp.us-west-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=AKIA...
EMAIL_PASS=...
```

### 5. Conekta Webhook Secret
**Current:**
```
CONEKTA_WEBHOOK_SECRET=YOUR_ACTUAL_CONEKTA_WEBHOOK_SECRET
```

**Action Required:**
1. Log into Conekta Dashboard
2. Go to Webhooks section
3. Copy the webhook secret
4. Update the environment variable

### 6. Internal API Key
**Current:**
```
INTERNAL_API_KEY=prod-internal-api-key-$(openssl rand -hex 32)
```

**Action Required:**
```bash
# Generate a secure random key
openssl rand -hex 32
# Then update the env file with the generated key
INTERNAL_API_KEY=generated_key_here
```

---

## 🌐 Frontend Environment Configuration

### Create `.env.production` in frontend directory
```bash
# Frontend production environment
VITE_API_URL=https://api.permisosdigitales.com.mx/api
VITE_CONEKTA_PUBLIC_KEY=key_PFsx92qr3wylKF1MoPQUlFR
```

---

## 🚀 Deployment Commands

### 1. Backend Deployment
```bash
# Install dependencies
npm install --production

# Run database migrations
npm run migrate:up

# Start the application
NODE_ENV=production npm start
```

### 2. Frontend Deployment
```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# The dist/ folder contains the production build
# Deploy the contents to your web server or CDN
```

---

## 🔍 Pre-Launch Testing

### 1. Database Connection Test
```bash
# Test database connectivity
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB Error:', err);
  else console.log('DB Connected:', res.rows[0]);
  pool.end();
});
"
```

### 2. Redis Connection Test
```bash
# Test Redis connectivity
node -e "
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});
client.on('connect', () => console.log('Redis Connected'));
client.on('error', (err) => console.error('Redis Error:', err));
"
```

### 3. S3 Connection Test
```bash
# Test S3 connectivity
node -e "
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION
});
s3.listBuckets((err, data) => {
  if (err) console.error('S3 Error:', err);
  else console.log('S3 Connected:', data.Buckets.length, 'buckets');
});
"
```

### 4. Email Test
```bash
# Test email configuration
curl -X POST http://localhost:3001/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 5. Payment Test
- Use Conekta test cards in staging environment
- Verify webhook endpoints are accessible
- Test both card and OXXO payment flows

---

## 📊 Monitoring Setup

### 1. Application Logs
```bash
# Monitor application logs
tail -f logs/app.log

# Monitor error logs
tail -f logs/error.log
```

### 2. Database Monitoring
- Set up CloudWatch monitoring for RDS
- Configure alerts for connection issues
- Monitor query performance

### 3. Payment Monitoring
- Monitor Conekta dashboard for transactions
- Set up webhook monitoring
- Configure payment failure alerts

---

## 🔒 Security Checklist

- [ ] All environment variables updated with production values
- [ ] No test/development credentials in production
- [ ] HTTPS redirect enabled
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Session security configured
- [ ] Database SSL enabled
- [ ] S3 bucket permissions properly configured

---

## 🚨 Emergency Contacts

### Technical Issues
- **Database Issues:** AWS RDS Support
- **Payment Issues:** Conekta Support
- **Infrastructure Issues:** AWS Support

### Rollback Plan
1. Keep previous deployment available
2. Database backup before migration
3. Quick rollback procedure documented
4. DNS TTL set to low value for quick changes

---

## ✅ Final Deployment Steps

1. [ ] Complete all environment configuration above
2. [ ] Run all connection tests
3. [ ] Deploy backend to production server
4. [ ] Deploy frontend to web server/CDN
5. [ ] Update DNS records if needed
6. [ ] Test complete user flow
7. [ ] Monitor for 24 hours
8. [ ] Document any issues and resolutions

**Deployment Ready:** After completing all checklist items above

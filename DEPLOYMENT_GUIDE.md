# 🚀 Production Deployment Guide
## Permisos Digitales - Step-by-Step Instructions

**Status:** Ready to execute - All scripts and configurations prepared

---

## 📋 Quick Start Checklist

### Phase 1: Generate Secrets (5 minutes)
```bash
# Generate secure production secrets
node scripts/generate-production-secrets.js
```
**Action:** Copy the generated secrets to your `.env.production` file

### Phase 2: Manual Configuration (15-30 minutes)
Update these values in `.env.production`:
- [ ] `DATABASE_URL` - Replace password with actual RDS password
- [ ] `S3_ACCESS_KEY_ID` - AWS IAM access key
- [ ] `S3_SECRET_ACCESS_KEY` - AWS IAM secret key
- [ ] `CONEKTA_WEBHOOK_SECRET` - From Conekta Dashboard
- [ ] `EMAIL_HOST` - SMTP server hostname
- [ ] `EMAIL_USER` - SMTP username
- [ ] `EMAIL_PASS` - SMTP password

### Phase 3: Test Connections (5 minutes)
```bash
# Test all infrastructure connections
node scripts/test-production-connections.js
```
**Expected:** All tests should pass ✅

### Phase 4: Deploy (10-15 minutes)
```bash
# Automated deployment with safety checks
node scripts/deploy-production.js
```
**Result:** Production server running and accessible

---

## 🔧 Detailed Configuration Steps

### Step 1: Generate Production Secrets
```bash
cd /path/to/permisos_digitales
node scripts/generate-production-secrets.js
```

This will generate:
- `SESSION_SECRET` - Secure session encryption key
- `INTERNAL_API_KEY` - Internal API authentication
- `COOKIE_SECRET` - Cookie encryption key
- Additional security keys

**Copy these values to `.env.production`**

### Step 2: AWS Configuration

#### 2.1 Get RDS Password
1. Go to AWS RDS Console
2. Find database: `permisos-digitales-db`
3. Get the master password (you set this during RDS creation)
4. Update `DATABASE_URL` in `.env.production`

#### 2.2 Create IAM User for S3
1. Go to AWS IAM Console
2. Create new user: `permisos-digitales-s3`
3. Attach policy: `AmazonS3FullAccess` (or create custom policy for your bucket)
4. Generate access keys
5. Update `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`

#### 2.3 Verify S3 Bucket
- Bucket name: `permisos-digitales-files-pdmx`
- Region: `us-west-1`
- Ensure bucket exists and is accessible

### Step 3: Conekta Configuration

#### 3.1 Get Webhook Secret
1. Log into Conekta Dashboard
2. Go to **Webhooks** section
3. Find or create webhook for your domain
4. Copy the **Webhook Secret**
5. Update `CONEKTA_WEBHOOK_SECRET` in `.env.production`

#### 3.2 Verify API Keys
- Public Key: `key_PFsx92qr3wylKF1MoPQUlFR` ✅ (already configured)
- Private Key: `key_rBWfZWQnfxyVZbkTSE4So4M` ✅ (already configured)

### Step 4: Email Configuration (SMTP)

#### Option A: AWS SES (Recommended)
1. Go to AWS SES Console
2. Verify domain: `permisosdigitales.com.mx`
3. Create SMTP credentials
4. Update SMTP settings in `.env.production`:
   ```
   EMAIL_HOST=email-smtp.us-west-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_USER=AKIA...
   EMAIL_PASS=...
   ```

#### Option B: Gmail SMTP
1. Enable 2-factor authentication on Gmail
2. Generate app-specific password
3. Update SMTP settings:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

#### Option C: Other SMTP Providers
Configure with your preferred SMTP provider (SendGrid, etc.)

### Step 5: Test Infrastructure
```bash
# This will test all connections
node scripts/test-production-connections.js
```

**Expected Output:**
```
✅ Environment variables: Configured
✅ Database: Connected successfully
✅ Redis: Connected successfully
✅ S3: Read/write permissions verified
✅ Email: Configuration valid
```

### Step 6: Deploy Application
```bash
# Automated deployment with safety checks
node scripts/deploy-production.js
```

**This script will:**
1. ✅ Check prerequisites (Node.js, npm, files)
2. ✅ Run connection tests
3. ✅ Build frontend for production
4. ✅ Install backend dependencies
5. ✅ Run database migrations
6. 🚀 Start production server

---

## 🔍 Verification Steps

### 1. Health Check
```bash
curl https://api.permisosdigitales.com.mx/health
```
**Expected:** `{"status": "healthy"}`

### 2. Frontend Access
Visit: `https://permisosdigitales.com.mx`
**Expected:** Homepage loads correctly

### 3. API Status
```bash
curl https://api.permisosdigitales.com.mx/api/status
```
**Expected:** `{"status": "API is running"}`

### 4. Database Connection
Check server logs for:
```
Database connection successful
Session store initialized using: PostgreSQL
```

### 5. Payment Test
1. Create test user account
2. Start permit application
3. Reach payment step
4. Verify Conekta integration loads
5. Test with Conekta test cards

---

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Test database directly
psql "postgres://permisos_admin:PASSWORD@permisos-digitales-db.cnkiusqgvv1f.us-west-1.rds.amazonaws.com:5432/permisos_digitales"
```

### Redis Connection Issues
```bash
# Test Redis directly
redis-cli -h master.permisos-digitales-redis.cwkbms.usw1.cache.amazonaws.com
```

### S3 Permission Issues
```bash
# Test S3 access with AWS CLI
aws s3 ls s3://permisos-digitales-files-pdmx --region us-west-1
```

### Email Delivery Issues
- Check Mailgun logs in dashboard
- Verify DNS records for domain
- Test SMTP connection manually

---

## 📊 Monitoring Setup

### Application Logs
```bash
# Monitor application logs
tail -f logs/app.log

# Monitor error logs
tail -f logs/error.log
```

### Payment Monitoring
- Monitor Conekta Dashboard for transactions
- Set up webhook monitoring
- Configure payment failure alerts

### Infrastructure Monitoring
- AWS CloudWatch for RDS metrics
- ElastiCache monitoring
- S3 usage and permissions

---

## 🔄 Post-Deployment Tasks

### Immediate (First 24 hours)
- [ ] Monitor application logs for errors
- [ ] Test complete user registration flow
- [ ] Test payment processing with real cards
- [ ] Verify email delivery
- [ ] Check SSL certificate validity

### Ongoing
- [ ] Set up automated backups
- [ ] Configure monitoring alerts
- [ ] Plan regular security updates
- [ ] Monitor payment transaction success rates

---

## 📞 Emergency Contacts

### Technical Issues
- **Database:** AWS RDS Support
- **Payments:** Conekta Support
- **Infrastructure:** AWS Support

### Rollback Plan
1. Keep previous deployment available
2. Database backup before migration
3. Quick DNS change capability
4. Documented rollback procedure

---

## ✅ Deployment Complete!

Once all steps are completed successfully:

🎉 **Your Permisos Digitales application is live in production!**

**Next:** Monitor for 24-48 hours and address any issues that arise.

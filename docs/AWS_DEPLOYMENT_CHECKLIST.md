# AWS Deployment Checklist for Permisos Digitales

Use this checklist to ensure you complete all deployment steps correctly.

## 🎯 Pre-Deployment Checklist

- [x] AWS Account created and billing enabled
- [x] Domain name ready (permisosdigitales.com.mx)
- [x] AWS CLI installed and configured
- [x] IAM user created with appropriate permissions (permisos-deployer with AdministratorAccess)
- [ ] Email service (Mailgun) account ready (API Key and Domain needed)

## 📋 Phase 1: Infrastructure Setup

### Database & Cache
- [x] RDS PostgreSQL instance created
  - [x] Instance type: db.t3.micro
  - [x] Database name: `permisos_digitales`
  - [x] Username: `permisos_admin`
  - [x] Password saved securely
  - [x] Security group `permisos-db-sg` created (ID: sg-0390beb386cbd38e8)
- [x] ElastiCache Redis cluster created
  - [x] Node type: cache.t3.micro
  - [x] Security group `permisos-redis-sg` created (ID: sg-0c2938b45d20c4ebb)

### Storage
- [x] S3 bucket for frontend created: `permisos-digitales-frontend-pdmx`
- [x] S3 bucket for files created: `permisos-digitales-files-pdmx`
- [x] S3 bucket policies configured (Block Public Access is ON. Files bucket policy to be applied by agent next)
- [x] IAM user for S3 access created (using `permisos-deployer` for now)

### Compute
- [x] EC2 instance launched
  - [x] AMI: Amazon Linux 2023
  - [x] Instance type: t3.small
  - [x] Key pair created/selected
  - [x] Security group `permisos-backend-sg` created
- [ ] Application Load Balancer created
  - [ ] Target group configured
  - [ ] Health checks configured
  - [ ] Security group `permisos-alb-sg` created

## 🖥️ Phase 2: Server Setup

### Environment Setup
- [x] Connected to EC2 instance via SSH
- [x] System updated: `sudo yum update -y`
- [x] Node.js 18 installed
- [x] PM2 installed globally
- [x] Git installed
- [x] Application directory created: `/var/www/permisos-digitales` (and permissions set)

### Application Deployment
- [ ] Repository cloned to EC2
- [ ] Dependencies installed: `npm install --production`
- [ ] Environment file configured (`.env`)
  - [ ] DATABASE_URL updated with RDS endpoint
  - [ ] REDIS_HOST updated with ElastiCache endpoint
  - [ ] S3 configuration added
  - [ ] Email configuration added
  - [ ] All secrets and keys added
- [ ] Database migrations run: `npm run migrate:up`
- [ ] Application started with PM2
- [ ] PM2 configured for auto-start on boot

## 🌐 Phase 3: Frontend Deployment

- [ ] Frontend built locally: `npm run build`
- [ ] Build files uploaded to S3 frontend bucket
- [ ] CloudFront distribution created
  - [ ] Origin configured to S3 bucket
  - [ ] Default root object set to `index.html`
  - [ ] Error pages configured for SPA routing
  - [ ] Custom domain configured (optional)

## 🔒 Phase 4: Security & SSL

### SSL Certificates
- [ ] SSL certificate requested in Certificate Manager
- [ ] Certificate validated (DNS or email)
- [ ] Certificate attached to ALB HTTPS listener
- [ ] Certificate attached to CloudFront (if using custom domain)

### Security Groups
- [ ] Database security group allows access only from backend
- [ ] Redis security group allows access only from backend
- [ ] Backend security group allows access only from ALB
- [ ] ALB security group allows HTTP/HTTPS from internet
- [ ] SSH access restricted to your IP only

## 🌍 Phase 5: Domain Configuration

### Route 53 Setup
- [ ] Hosted zone created for domain
- [ ] Nameservers updated at domain registrar
- [ ] A record created: `permisosdigitales.com.mx` → CloudFront
- [ ] A record created: `api.permisosdigitales.com.mx` → ALB
- [ ] DNS propagation verified

## ✅ Phase 6: Testing & Verification

### Backend Testing
- [ ] API health check: `https://api.permisosdigitales.com.mx/api/status`
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] File upload functionality tested
- [ ] Email sending tested
- [ ] Payment processing tested (if applicable)

### Frontend Testing
- [ ] Website loads: `https://permisosdigitales.com.mx`
- [ ] All pages accessible
- [ ] Forms working correctly
- [ ] API calls successful
- [ ] Mobile responsiveness verified

### Integration Testing
- [ ] User registration flow
- [ ] Login/logout functionality
- [ ] Permit application process
- [ ] File uploads working
- [ ] Email notifications working
- [ ] Payment processing (if applicable)

## 🔍 Phase 7: Monitoring Setup

### CloudWatch
- [ ] CloudWatch alarms configured
  - [ ] EC2 CPU utilization
  - [ ] RDS connections
  - [ ] ALB response times
  - [ ] Application errors
- [ ] Log groups created for application logs
- [ ] SNS topics for alerts (optional)

### Application Monitoring
- [ ] PM2 monitoring dashboard
- [ ] Application logs accessible
- [ ] Database performance monitoring
- [ ] S3 usage monitoring

## 📚 Phase 8: Documentation & Backup

### Documentation
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Troubleshooting guide created
- [ ] Access credentials stored securely

### Backup Strategy
- [ ] RDS automated backups enabled (7 days)
- [ ] S3 versioning enabled
- [ ] Database snapshot schedule (optional)
- [ ] Application code backup strategy

## 🚀 Phase 9: Go Live

### Final Checks
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Security scan completed
- [ ] Backup strategy verified
- [ ] Monitoring alerts working

### Launch
- [ ] DNS TTL reduced (for quick changes if needed)
- [ ] Application announced to users
- [ ] Support team notified
- [ ] Monitoring dashboard active

## 📞 Post-Launch

### Week 1
- [ ] Daily monitoring checks
- [ ] Performance optimization
- [ ] User feedback collection
- [ ] Bug fixes as needed

### Ongoing
- [ ] Weekly security updates
- [ ] Monthly cost review
- [ ] Quarterly performance review
- [ ] Annual security audit

## 🆘 Emergency Contacts & Resources

### Important Information
- **AWS Support**: [Your support plan]
- **Domain Registrar**: [Your registrar support]
- **Email Service**: [Mailgun support]
- **Payment Processor**: [Conekta support]

### Key Commands
```bash
# Check application status
pm2 status

# View application logs
pm2 logs permisos-digitales

# Restart application
pm2 restart permisos-digitales

# Deploy updates
cd /var/www/permisos-digitales && ./scripts/deploy-aws.sh
```

### Useful AWS Console Links
- EC2 Instances: https://console.aws.amazon.com/ec2/v2/home#Instances
- RDS Databases: https://console.aws.amazon.com/rds/home#databases
- S3 Buckets: https://console.aws.amazon.com/s3/home
- CloudFront: https://console.aws.amazon.com/cloudfront/home
- Route 53: https://console.aws.amazon.com/route53/home

---

**Remember**: Take your time with each step and test thoroughly before moving to the next phase!

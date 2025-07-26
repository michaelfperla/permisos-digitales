# 🚀 Production Deployment Checklist

> A manual deployment checklist for Permisos Digitales backend
> Last Updated: 2025-06-22

## 📋 Pre-Deployment (On Your Local Machine)

### 1. Code Quality Checks
- [ ] Pull latest changes from main branch
- [ ] Run tests locally: `npm test`
- [ ] Check for any console.log statements: `grep -r "console\." src/ --exclude-dir=node_modules`
- [ ] Verify no hardcoded secrets: `grep -r "sk_live\|postgres://\|AKIA" src/`
- [ ] Ensure .env.production is NOT committed to git

### 2. Dependencies & Security
- [ ] Run `npm audit` - fix any high/critical vulnerabilities
- [ ] Check if package-lock.json has changes (commit if yes)
- [ ] Verify all dev dependencies are in devDependencies, not dependencies

### 3. Database Migrations (If Needed)
- [ ] Check for pending migrations: `npm run migrate:status`
- [ ] Test migrations locally first (on a test database)
- [ ] Have a rollback plan ready

### 4. Local Production Test
```bash
# Test with production config locally
NODE_ENV=production ENV_FILE=.env.production npm start
```
- [ ] Application starts without errors
- [ ] Can connect to RDS database
- [ ] Redis connection works
- [ ] No debug logs appearing

## 🖥️ Server Deployment (On EC2)

### 1. Connect to Server
```bash
ssh -i "docs/permisos-digitales-fresh.pem" ubuntu@107.21.154.162
cd /var/www/permisos-digitales
```

### 2. Pre-Deployment Backup
- [ ] Note current version: `git rev-parse HEAD > ~/last-working-version.txt`
- [ ] Backup .env.production: `cp .env.production .env.production.backup`
- [ ] Check current PM2 status: `pm2 status`

### 3. Update Code
```bash
# Stash any local changes (like .env files)
git stash

# Pull latest code
git pull origin main

# Restore local files
git stash pop
```
- [ ] Verify the pull was successful
- [ ] Check that .env.production is still intact

### 4. Dependencies & Certificates
```bash
# Install/update dependencies
npm ci --production

# Verify RDS certificate exists
ls -la certs/rds/global-bundle.pem
```
- [ ] Dependencies installed without errors
- [ ] Certificate file exists and has content

### 5. Database Migrations (If Needed)
```bash
# Check migration status
npm run migrate:status

# Run migrations if needed
npm run migrate:up
```
- [ ] Migrations completed successfully
- [ ] Verify in database that changes are applied

### 6. Deploy with PM2
```bash
# For first time deployment
pm2 start ecosystem.production.config.js --env production

# For updates (zero-downtime reload)
pm2 reload ecosystem.production.config.js --env production

# Check status
pm2 status
pm2 logs permisos-backend --lines 50
```
- [ ] All instances show "online" status
- [ ] No error messages in logs
- [ ] Memory usage is reasonable

## ✅ Post-Deployment Verification

### 1. Health Checks
```bash
# From server
curl http://localhost:3001/health

# From your local machine
curl https://api.permisosdigitales.com.mx/health
```
- [ ] Health endpoint returns success
- [ ] Response time is reasonable

### 2. Critical Features Test
- [ ] Test user registration (if safe to do so)
- [ ] Verify Stripe webhook endpoint is accessible
- [ ] Check that PDFs can be generated
- [ ] Confirm government portal integration works

### 3. Monitoring
```bash
# Watch logs for 5 minutes
pm2 logs permisos-backend

# Check memory and CPU
pm2 monit
```
- [ ] No repeating errors
- [ ] Memory usage stable
- [ ] CPU usage reasonable

### 4. Error Tracking
- [ ] Check application logs for any errors
- [ ] Verify no sensitive data in logs
- [ ] Confirm log rotation is working

## 🚨 Rollback Procedure (If Something Goes Wrong)

### Quick Rollback
```bash
# Get previous version
cat ~/last-working-version.txt

# Rollback code
git checkout [previous-version-hash]

# Restore dependencies
npm ci --production

# Reload PM2
pm2 reload ecosystem.production.config.js --env production
```

### Full Rollback
```bash
# Stop current deployment
pm2 stop ecosystem.production.config.js

# Restore backup files
cp .env.production.backup .env.production

# Start with previous version
pm2 start ecosystem.production.config.js --env production
```

## 📝 Common Issues & Solutions

### Issue: Cannot connect to RDS
- Check security group allows connection from EC2
- Verify RDS certificate is present
- Confirm DATABASE_URL in .env.production is correct

### Issue: Redis connection failed
- Check ElastiCache security group
- Verify REDIS_HOST and REDIS_PORT
- Ensure EC2 is in same VPC as ElastiCache

### Issue: PM2 processes keep restarting
- Check logs: `pm2 logs permisos-backend --err`
- Verify Node.js version: `node --version` (should be >= 18)
- Check available memory: `free -h`

### Issue: 502 Bad Gateway
- Ensure PM2 is running: `pm2 status`
- Check if app is listening on correct port (3001)
- Verify nginx/reverse proxy configuration

## 🔧 Useful Commands Reference

```bash
# PM2 Commands
pm2 status                    # Check all processes
pm2 logs permisos-backend     # View logs
pm2 restart all              # Restart all processes
pm2 flush                    # Clear logs
pm2 describe permisos-backend # Detailed info

# System Checks
df -h                        # Disk space
free -m                      # Memory usage
htop                         # CPU and process monitor
netstat -tlnp | grep 3001    # Check if port is listening

# Database
npm run migrate:status       # Check migration status
npm run migrate:up           # Run pending migrations
npm run migrate:down         # Rollback last migration
```

## 📞 Emergency Contacts

- AWS Support: [Your AWS support plan details]
- Database Admin: [Contact info]
- DevOps Lead: [Contact info]

---

Remember: **Take your time**. It's better to deploy slowly and correctly than quickly and break production! 🐢✨
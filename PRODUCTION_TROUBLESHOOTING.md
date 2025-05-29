# Production Troubleshooting Guide

## CSRF and Registration Issues

This guide helps diagnose and fix CSRF token and user registration problems in production.

## Quick Diagnosis

### 1. Test CSRF Token Generation
```bash
# Test if CSRF tokens are being generated correctly
curl -X GET "https://api.permisosdigitales.com.mx/debug/csrf-test" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -c cookies.txt -b cookies.txt
```

### 2. Test CSRF Token Validation
```bash
# First get a CSRF token
TOKEN=$(curl -s -X GET "https://api.permisosdigitales.com.mx/debug/csrf-test" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -c cookies.txt -b cookies.txt | jq -r '.data.csrfToken')

# Then test validation
curl -X POST "https://api.permisosdigitales.com.mx/debug/csrf-validate" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -c cookies.txt -b cookies.txt \
  -d '{"test": "data"}'
```

### 3. Test CORS Configuration
```bash
curl -X GET "https://api.permisosdigitales.com.mx/debug/cors-test" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -v
```

### 4. Check Session Information
```bash
curl -X GET "https://api.permisosdigitales.com.mx/debug/session-info" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -c cookies.txt -b cookies.txt
```

### 5. Test User Registration
```bash
# Get CSRF token first
TOKEN=$(curl -s -X GET "https://api.permisosdigitales.com.mx/api/auth/csrf-token" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -c cookies.txt -b cookies.txt | jq -r '.data.csrfToken')

# Test registration
curl -X POST "https://api.permisosdigitales.com.mx/api/auth/register" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -c cookies.txt -b cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "first_name": "Test",
    "last_name": "User"
  }'
```

## Common Issues and Solutions

### Issue 1: CSRF Token Missing or Invalid

**Symptoms:**
- 403 Forbidden errors on POST requests
- "Invalid or missing CSRF token" messages
- Registration forms failing

**Diagnosis:**
```bash
# Check if CSRF tokens are being generated
curl -X GET "https://api.permisosdigitales.com.mx/debug/csrf-test" \
  -H "Origin: https://permisosdigitales.com.mx"
```

**Solutions:**
1. **Cookie Domain Issues**: Check if cookies are being set for the correct domain
2. **SameSite Policy**: Verify SameSite cookie settings
3. **HTTPS Requirements**: Ensure secure cookies work with HTTPS

### Issue 2: CORS Blocking Requests

**Symptoms:**
- Network errors in browser console
- "Not allowed by CORS" errors
- Preflight request failures

**Diagnosis:**
```bash
# Test CORS headers
curl -X OPTIONS "https://api.permisosdigitales.com.mx/api/auth/register" \
  -H "Origin: https://permisosdigitales.com.mx" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,X-CSRF-Token" \
  -v
```

**Solutions:**
1. **Origin Mismatch**: Verify allowed origins in CORS configuration
2. **Headers Missing**: Check if required headers are allowed
3. **Credentials**: Ensure `withCredentials: true` is set

### Issue 3: Session Problems

**Symptoms:**
- Users logged out immediately after registration
- Session data not persisting
- Authentication status inconsistent

**Diagnosis:**
```bash
# Check session configuration
curl -X GET "https://api.permisosdigitales.com.mx/debug/session-info" \
  -H "Origin: https://permisosdigitales.com.mx"
```

**Solutions:**
1. **Session Store**: Verify PostgreSQL session store is working
2. **Cookie Settings**: Check secure, httpOnly, and sameSite settings
3. **Session Secret**: Ensure SESSION_SECRET is properly set

### Issue 4: Database Connection Issues

**Symptoms:**
- Registration fails with database errors
- User lookup failures
- Connection timeout errors

**Diagnosis:**
```bash
# Check environment variables
curl -X GET "https://api.permisosdigitales.com.mx/debug/environment"
```

**Solutions:**
1. **Connection String**: Verify DATABASE_URL is correct
2. **SSL Settings**: Check DISABLE_SSL setting
3. **Network Access**: Ensure RDS security groups allow connections

## Production Logs Analysis

### View Recent Logs
```bash
# SSH into production server
ssh -i docs/permisos-digitales-key.pem ec2-user@your-server-ip

# View application logs
sudo journalctl -u your-app-service -f --since "1 hour ago"

# Or if using PM2
pm2 logs --lines 100
```

### Search for Specific Issues
```bash
# CSRF errors
sudo journalctl -u your-app-service | grep "CSRF"

# Registration errors
sudo journalctl -u your-app-service | grep "registration"

# Database errors
sudo journalctl -u your-app-service | grep "database\|postgres"
```

## Environment Variables Check

Verify these critical environment variables are set correctly:

```bash
# On production server
echo $NODE_ENV                    # Should be "production"
echo $SESSION_SECRET             # Should be a long random string
echo $COOKIE_SECRET              # Should be a long random string
echo $DATABASE_URL               # Should point to RDS instance
echo $REDIS_HOST                 # Should point to ElastiCache
echo $APP_URL                    # Should be https://api.permisosdigitales.com.mx
echo $FRONTEND_URL               # Should be https://permisosdigitales.com.mx
```

## Frontend Configuration Check

Verify frontend environment variables:

```bash
# Check frontend .env.production
cat frontend/.env.production

# Should contain:
# VITE_API_URL=https://api.permisosdigitales.com.mx/api
# VITE_CONEKTA_PUBLIC_KEY=key_...
```

## Network and DNS Check

```bash
# Test DNS resolution
nslookup api.permisosdigitales.com.mx
nslookup permisosdigitales.com.mx

# Test SSL certificates
openssl s_client -connect api.permisosdigitales.com.mx:443 -servername api.permisosdigitales.com.mx

# Test connectivity
curl -I https://api.permisosdigitales.com.mx/health
curl -I https://permisosdigitales.com.mx
```

## Emergency Fixes

### Temporarily Disable CSRF (NOT RECOMMENDED)
Only use this for urgent debugging:

```javascript
// In src/middleware/csrf.middleware.js
// Comment out CSRF protection temporarily
const csrfProtection = (req, res, next) => next();
```

### Reset Session Store
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Clear all sessions (will log out all users)
DELETE FROM session;
```

### Restart Services
```bash
# Restart application
sudo systemctl restart your-app-service

# Or with PM2
pm2 restart all
```

## Contact Information

If issues persist, check:
1. Application logs for detailed error messages
2. Browser developer tools for network errors
3. Database connectivity and performance
4. SSL certificate validity
5. DNS resolution for all domains

Remember to remove any temporary debugging changes before leaving them in production!

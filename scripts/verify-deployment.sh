#!/bin/bash

# Deployment Verification Script for Permisos Digitales
# This script helps verify that your AWS deployment is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Configuration
API_URL="https://api.permisosdigitales.com.mx"
FRONTEND_URL="https://permisosdigitales.com.mx"
LOCAL_API_URL="http://localhost:3001"

print_header "Permisos Digitales Deployment Verification"

# Check if we're running on EC2 or locally
if [ -f /var/www/permisos-digitales/package.json ]; then
    LOCATION="EC2"
    API_TEST_URL="$LOCAL_API_URL"
else
    LOCATION="LOCAL"
    API_TEST_URL="$API_URL"
fi

print_info "Running verification from: $LOCATION"

# 1. Check Node.js and PM2 (if on EC2)
if [ "$LOCATION" = "EC2" ]; then
    print_header "System Requirements Check"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js not installed"
    fi
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 installed: $PM2_VERSION"
    else
        print_error "PM2 not installed"
    fi
    
    # Check PM2 processes
    print_header "PM2 Process Status"
    if pm2 list | grep -q "permisos-digitales"; then
        print_success "Permisos Digitales process found in PM2"
        pm2 list
    else
        print_error "Permisos Digitales process not found in PM2"
    fi
fi

# 2. Check API Health
print_header "API Health Check"

if curl -f -s "$API_TEST_URL/api/status" > /dev/null; then
    print_success "API is responding at $API_TEST_URL/api/status"
    
    # Get API status details
    API_STATUS=$(curl -s "$API_TEST_URL/api/status" | head -c 200)
    print_info "API Status: $API_STATUS"
else
    print_error "API is not responding at $API_TEST_URL/api/status"
fi

# 3. Check Database Connection (if on EC2)
if [ "$LOCATION" = "EC2" ] && [ -f /var/www/permisos-digitales/package.json ]; then
    print_header "Database Connection Check"
    
    cd /var/www/permisos-digitales
    
    if npm run db:verify > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
        print_info "Check your DATABASE_URL in .env file"
    fi
fi

# 4. Check Environment Configuration (if on EC2)
if [ "$LOCATION" = "EC2" ] && [ -f /var/www/permisos-digitales/.env ]; then
    print_header "Environment Configuration Check"
    
    cd /var/www/permisos-digitales
    
    # Check critical environment variables
    if grep -q "DATABASE_URL=" .env; then
        print_success "DATABASE_URL configured"
    else
        print_error "DATABASE_URL not configured"
    fi
    
    if grep -q "EMAIL_FROM=" .env; then
        print_success "EMAIL_FROM configured"
    else
        print_error "EMAIL_FROM not configured"
    fi
    
    if grep -q "SESSION_SECRET=" .env; then
        print_success "SESSION_SECRET configured"
    else
        print_error "SESSION_SECRET not configured"
    fi
    
    if grep -q "S3_BUCKET=" .env; then
        print_success "S3_BUCKET configured"
    else
        print_warning "S3_BUCKET not configured (using local storage)"
    fi
fi

# 5. Check Frontend (if URLs are accessible)
print_header "Frontend Check"

if curl -f -s "$FRONTEND_URL" > /dev/null; then
    print_success "Frontend is accessible at $FRONTEND_URL"
else
    print_error "Frontend is not accessible at $FRONTEND_URL"
    print_info "Check CloudFront distribution and S3 bucket"
fi

# 6. Check SSL Certificates
print_header "SSL Certificate Check"

if curl -f -s "https://api.permisosdigitales.com.mx" > /dev/null; then
    print_success "API SSL certificate is valid"
else
    print_error "API SSL certificate issue"
fi

if curl -f -s "https://permisosdigitales.com.mx" > /dev/null; then
    print_success "Frontend SSL certificate is valid"
else
    print_error "Frontend SSL certificate issue"
fi

# 7. Check DNS Resolution
print_header "DNS Resolution Check"

if nslookup api.permisosdigitales.com.mx > /dev/null 2>&1; then
    print_success "API DNS resolution working"
else
    print_error "API DNS resolution failed"
fi

if nslookup permisosdigitales.com.mx > /dev/null 2>&1; then
    print_success "Frontend DNS resolution working"
else
    print_error "Frontend DNS resolution failed"
fi

# 8. Check Application Logs (if on EC2)
if [ "$LOCATION" = "EC2" ]; then
    print_header "Recent Application Logs"
    
    if pm2 logs permisos-digitales --lines 5 --nostream 2>/dev/null; then
        print_success "Application logs accessible"
    else
        print_error "Cannot access application logs"
    fi
fi

# 9. Performance Check
print_header "Performance Check"

if command -v curl &> /dev/null; then
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$API_TEST_URL/api/status")
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        print_success "API response time: ${RESPONSE_TIME}s (Good)"
    else
        print_warning "API response time: ${RESPONSE_TIME}s (Slow)"
    fi
fi

# 10. Security Check
print_header "Basic Security Check"

# Check if SSH is restricted (if on EC2)
if [ "$LOCATION" = "EC2" ]; then
    if ss -tlnp | grep -q ":22"; then
        print_info "SSH port 22 is open (ensure it's restricted to your IP)"
    fi
fi

# Check if application is not running as root
if [ "$LOCATION" = "EC2" ]; then
    if pm2 list | grep -q "root"; then
        print_warning "Application may be running as root (security risk)"
    else
        print_success "Application not running as root"
    fi
fi

print_header "Verification Complete"

print_info "If you see any errors above, refer to the troubleshooting section in the deployment guide."
print_info "For detailed logs, use: pm2 logs permisos-digitales"
print_info "For system monitoring, use: htop or top"

echo -e "\n${GREEN}🎉 Deployment verification finished!${NC}"

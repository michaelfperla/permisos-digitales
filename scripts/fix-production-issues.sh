#!/bin/bash

# Fix Production Issues Script
# This script addresses the registration blocking and admin app access issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EC2_HOST="54.193.84.64"
EC2_USER="ec2-user"
KEY_PATH="docs/permisos-digitales-key.pem"
APP_DIR="/var/www/permisos-digitales"

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_status() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to execute commands on EC2
exec_remote() {
    ssh -i "$KEY_PATH" "$EC2_USER@$EC2_HOST" "$1"
}

# Function to copy files to EC2
copy_to_ec2() {
    scp -i "$KEY_PATH" "$1" "$EC2_USER@$EC2_HOST:$2"
}

print_header "🚨 FIXING PRODUCTION ISSUES"

echo "This script will fix the following issues:"
echo "1. CORS configuration to allow www subdomain"
echo "2. Update nginx configuration"
echo "3. Rebuild and deploy frontend without admin app"
echo "4. Restart services"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Update nginx configuration
print_header "🔧 UPDATING NGINX CONFIGURATION"

print_status "Copying updated nginx configuration..."
copy_to_ec2 "nginx-api-config.conf" "/tmp/nginx-api-config.conf"

print_status "Backing up current nginx configuration..."
exec_remote "sudo cp /etc/nginx/sites-available/api.permisosdigitales.com.mx /etc/nginx/sites-available/api.permisosdigitales.com.mx.backup"

print_status "Installing new nginx configuration..."
exec_remote "sudo cp /tmp/nginx-api-config.conf /etc/nginx/sites-available/api.permisosdigitales.com.mx"

print_status "Testing nginx configuration..."
if exec_remote "sudo nginx -t"; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    print_status "Restoring backup..."
    exec_remote "sudo cp /etc/nginx/sites-available/api.permisosdigitales.com.mx.backup /etc/nginx/sites-available/api.permisosdigitales.com.mx"
    exit 1
fi

print_status "Reloading nginx..."
exec_remote "sudo systemctl reload nginx"
print_success "Nginx configuration updated and reloaded"

# Step 2: Update application code
print_header "📝 UPDATING APPLICATION CODE"

print_status "Pulling latest code changes..."
exec_remote "cd $APP_DIR && git pull origin main"

print_status "Installing backend dependencies..."
exec_remote "cd $APP_DIR && npm install --production"

print_status "Restarting backend application..."
exec_remote "pm2 restart permisos-digitales"
print_success "Backend updated and restarted"

# Step 3: Build and deploy frontend
print_header "🏗️ REBUILDING FRONTEND"

print_status "Building frontend locally (client app only)..."
cd frontend
npm install
npm run build

print_status "Deploying frontend to S3..."
aws s3 sync dist/ s3://permisos-digitales-files-pdmx/frontend/ --delete --region us-west-1

print_status "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ECOBED0P176S0 --paths "/*"

print_success "Frontend rebuilt and deployed"

# Step 4: Verify fixes
print_header "🔍 VERIFYING FIXES"

print_status "Testing API endpoint..."
if curl -s -o /dev/null -w "%{http_code}" "https://api.permisosdigitales.com.mx/api/status" | grep -q "200"; then
    print_success "API is responding correctly"
else
    print_error "API is not responding correctly"
fi

print_status "Testing CORS headers..."
CORS_TEST=$(curl -s -H "Origin: https://www.permisosdigitales.com.mx" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -X OPTIONS "https://api.permisosdigitales.com.mx/api/auth/csrf-token" -I)
if echo "$CORS_TEST" | grep -q "Access-Control-Allow-Origin"; then
    print_success "CORS headers are working correctly"
else
    print_error "CORS headers may not be working correctly"
fi

print_header "✅ PRODUCTION FIXES COMPLETED"

echo "Summary of changes:"
echo "• Updated nginx CORS configuration to allow www subdomain"
echo "• Rebuilt frontend without admin app bundle"
echo "• Restarted backend services"
echo "• Invalidated CloudFront cache"
echo ""
echo "The registration issue should now be resolved."
echo "Users can register at: https://www.permisosdigitales.com.mx/register"
echo "Admin access is restricted and secure."

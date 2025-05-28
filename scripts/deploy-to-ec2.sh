#!/bin/bash

# AWS EC2 Deployment Script for Permisos Digitales
# This script deploys the application to the EC2 instance

set -e  # Exit on any error

# Configuration
EC2_HOST="54.193.84.64"
EC2_USER="ec2-user"
KEY_FILE="docs/permisos-digitales-key.pem"
APP_DIR="/var/www/permisos-digitales"
REPO_URL="https://github.com/michaelfperla/permisos-digitales.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to execute commands on EC2
exec_remote() {
    ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "$1"
}

# Function to copy files to EC2
copy_to_ec2() {
    scp -i "$KEY_FILE" -o StrictHostKeyChecking=no "$1" "$EC2_USER@$EC2_HOST:$2"
}

print_section "🚀 Starting AWS EC2 Deployment"

# Step 1: Clone/Update Repository
print_section "📥 Setting up application code"
print_status "Cloning repository to EC2 instance..."

exec_remote "
    cd $APP_DIR
    if [ -d .git ]; then
        echo 'Repository exists, pulling latest changes...'
        git pull origin main
    else
        echo 'Cloning repository...'
        git clone $REPO_URL .
    fi
"

# Step 2: Copy environment files
print_section "⚙️  Copying environment configuration"
print_status "Copying .env.production to EC2..."

copy_to_ec2 ".env.production" "$APP_DIR/.env"

print_status "Copying frontend environment..."
exec_remote "mkdir -p $APP_DIR/frontend"
copy_to_ec2 "frontend/.env.production" "$APP_DIR/frontend/.env.production"

# Step 3: Install dependencies
print_section "📦 Installing dependencies"
print_status "Installing backend dependencies..."

exec_remote "
    cd $APP_DIR
    npm install --production
"

# Step 4: Build frontend
print_section "🏗️  Building frontend"
print_status "Installing frontend dependencies and building..."

exec_remote "
    cd $APP_DIR/frontend
    npm install
    npm run build
"

# Step 5: Run database migrations
print_section "🗄️  Running database migrations"
print_status "Executing database migrations..."

exec_remote "
    cd $APP_DIR
    npm run migrate:up
"

# Step 6: Setup PM2 and start application
print_section "🚀 Starting application"
print_status "Starting application with PM2..."

exec_remote "
    cd $APP_DIR
    pm2 stop permisos-digitales || true
    pm2 delete permisos-digitales || true
    pm2 start src/server.js --name permisos-digitales
    pm2 startup
    pm2 save
"

# Step 7: Health check
print_section "🏥 Health check"
print_status "Waiting for application to start..."
sleep 10

if exec_remote "curl -f http://localhost:3001/api/status > /dev/null 2>&1"; then
    print_status "✅ Application is running successfully!"
    print_status "Backend API: http://$EC2_HOST:3001/api"
    print_status "Health check: http://$EC2_HOST:3001/api/status"
else
    print_error "❌ Application health check failed"
    print_warning "Check logs with: ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 logs permisos-digitales'"
    exit 1
fi

print_section "🎉 Deployment completed successfully!"
print_status "Application is running on EC2 instance: $EC2_HOST"
print_status "Next steps:"
print_status "1. Set up Load Balancer and SSL certificate"
print_status "2. Configure domain name"
print_status "3. Deploy frontend to S3/CloudFront"
print_status "4. Run post-deployment tests"

echo -e "\n${GREEN}Deployment Summary:${NC}"
echo -e "• Backend deployed to EC2: ✅"
echo -e "• Database migrations: ✅"
echo -e "• PM2 process manager: ✅"
echo -e "• Health check: ✅"

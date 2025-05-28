#!/bin/bash

# AWS Deployment Script for Permisos Digitales
# This script helps deploy the application to AWS EC2

set -e  # Exit on any error

echo "🚀 Starting AWS Deployment for Permisos Digitales"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if we're on EC2 instance
if [ ! -f /var/www/permisos-digitales/package.json ]; then
    print_error "This script should be run on the EC2 instance in /var/www/permisos-digitales"
    exit 1
fi

print_status "Updating application code..."
git pull origin main

print_status "Installing/updating dependencies..."
npm install --production

print_status "Running database migrations..."
npm run migrate:up

print_status "Building application..."
# No build step needed for backend, but we can add health checks

print_status "Restarting application with PM2..."
pm2 restart permisos-digitales || pm2 start src/server.js --name permisos-digitales

print_status "Setting up PM2 to start on boot..."
pm2 startup
pm2 save

print_status "Checking application health..."
sleep 5
if curl -f http://localhost:3001/api/status > /dev/null 2>&1; then
    print_status "✅ Application is running successfully!"
else
    print_error "❌ Application health check failed"
    print_warning "Check logs with: pm2 logs permisos-digitales"
    exit 1
fi

print_status "🎉 Deployment completed successfully!"
print_status "Application is running on port 3001"
print_status "Check status with: pm2 status"
print_status "View logs with: pm2 logs permisos-digitales"

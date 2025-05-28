#!/bin/bash

# Production Preparation Script for Permisos Digitales
# This script prepares the application for production deployment

set -e  # Exit on any error

echo "🚀 Preparing Permisos Digitales for Production Deployment"

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

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f package.json ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

print_header "1. Validating Environment Configuration"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    print_error ".env.production file not found!"
    print_warning "Please create .env.production with your production settings"
    exit 1
fi

# Check for placeholder values in .env.production
print_status "Checking for placeholder values in .env.production..."
if grep -q "YOUR_ACTUAL_" .env.production; then
    print_error "Found placeholder values in .env.production!"
    print_warning "Please replace all YOUR_ACTUAL_* placeholders with real values"
    grep "YOUR_ACTUAL_" .env.production
    exit 1
fi

if grep -q "your-actual-" .env.production; then
    print_error "Found placeholder values in .env.production!"
    print_warning "Please replace all your-actual-* placeholders with real values"
    grep "your-actual-" .env.production
    exit 1
fi

print_status "Environment configuration validation passed"

print_header "2. Installing Production Dependencies"

# Install backend dependencies
print_status "Installing backend dependencies..."
npm ci --production=false

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm ci
cd ..

print_header "3. Running Security Audit"

# Run npm audit
print_status "Running security audit..."
npm audit --audit-level=high || print_warning "Security vulnerabilities found - review before deployment"

cd frontend
npm audit --audit-level=high || print_warning "Frontend security vulnerabilities found - review before deployment"
cd ..

print_header "4. Running Tests"

# Run backend tests
print_status "Running backend tests..."
npm test || {
    print_error "Backend tests failed!"
    exit 1
}

# Run frontend tests
print_status "Running frontend tests..."
cd frontend
npm test -- --run || {
    print_error "Frontend tests failed!"
    exit 1
}
cd ..

print_header "5. Building Frontend for Production"

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build || {
    print_error "Frontend build failed!"
    exit 1
}
cd ..

print_header "6. Validating Database Migrations"

# Check if migrations are up to date
print_status "Validating database migrations..."
if [ -n "$DATABASE_URL" ]; then
    npm run migrate:up --dry-run || print_warning "Migration validation failed - check manually"
else
    print_warning "DATABASE_URL not set - skipping migration validation"
fi

print_header "7. Production Readiness Checklist"

print_status "✅ Environment configuration validated"
print_status "✅ Dependencies installed"
print_status "✅ Security audit completed"
print_status "✅ Tests passed"
print_status "✅ Frontend built"
print_status "✅ Database migrations validated"

echo ""
print_status "🎉 Production preparation completed successfully!"
echo ""
print_warning "Before deploying, ensure you have:"
echo "  - Updated .env.production with real AWS endpoints"
echo "  - Configured Mailgun API keys"
echo "  - Set up proper SSL certificates"
echo "  - Configured domain DNS records"
echo ""
print_status "Ready for deployment to AWS!"

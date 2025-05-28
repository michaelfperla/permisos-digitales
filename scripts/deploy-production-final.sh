#!/bin/bash

# Production Deployment Script - Final
# Comprehensive deployment with all fixes applied

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

section() {
    echo -e "\n${BLUE}============================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

# Check if running as root (for production server)
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Make sure this is intended for production deployment."
    fi
}

# Validate environment
validate_environment() {
    section "🔍 ENVIRONMENT VALIDATION"
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log "npm version: $NPM_VERSION"
    
    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        error ".env.production file not found!"
        error "Please create .env.production with your production settings"
        exit 1
    fi
    
    success "Environment validation passed"
}

# Run production audit
run_production_audit() {
    section "🔍 PRODUCTION AUDIT"
    
    log "Running comprehensive production audit..."
    if npm run audit:production; then
        success "Production audit completed"
    else
        error "Production audit failed. Please fix issues before deploying."
        exit 1
    fi
}

# Validate production configuration
validate_production_config() {
    section "⚙️ CONFIGURATION VALIDATION"
    
    log "Validating production configuration..."
    if npm run validate:production; then
        success "Production configuration is valid"
    else
        error "Production configuration validation failed"
        warning "Some services may not be accessible. Continue? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install backend dependencies
install_backend_dependencies() {
    section "📦 BACKEND DEPENDENCIES"
    
    log "Installing backend dependencies..."
    npm ci --production
    success "Backend dependencies installed"
}

# Build frontend
build_frontend() {
    section "🏗️ FRONTEND BUILD"
    
    log "Installing frontend dependencies..."
    cd frontend
    npm ci
    
    log "Building frontend for production..."
    npm run build
    
    if [ -d "dist" ]; then
        success "Frontend build completed successfully"
        log "Build output available in frontend/dist/"
    else
        error "Frontend build failed - dist directory not found"
        exit 1
    fi
    
    cd ..
}

# Run database migrations
run_database_migrations() {
    section "🗄️ DATABASE MIGRATIONS"
    
    log "Running database migrations..."
    if npm run migrate:up; then
        success "Database migrations completed"
    else
        error "Database migrations failed"
        exit 1
    fi
}

# Start production server
start_production_server() {
    section "🚀 STARTING PRODUCTION SERVER"
    
    log "Starting production server..."
    log "Server will run on port ${PORT:-3001}"
    log "Press Ctrl+C to stop the server"
    
    # Set production environment
    export NODE_ENV=production
    
    # Start the server
    npm start
}

# Main deployment function
main() {
    log "🚀 Starting Production Deployment Process..."
    log "Permisos Digitales - Production Ready Deployment"
    
    # Run all deployment steps
    check_permissions
    validate_environment
    run_production_audit
    validate_production_config
    install_backend_dependencies
    build_frontend
    run_database_migrations
    
    section "✅ DEPLOYMENT SUMMARY"
    success "All deployment steps completed successfully!"
    success "Backend dependencies installed"
    success "Frontend built and ready for deployment"
    success "Database migrations applied"
    success "Production configuration validated"
    
    log ""
    log "🎯 Next Steps:"
    log "1. Deploy frontend/dist/ to your web server or CDN"
    log "2. Start the production server with the command below"
    log "3. Monitor logs for any issues"
    log ""
    
    warning "Ready to start production server? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        start_production_server
    else
        log "Deployment completed. Start server manually with: npm start"
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"

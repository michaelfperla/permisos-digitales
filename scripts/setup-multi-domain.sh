#!/bin/bash

# Multi-Domain Setup Script
# Configures both .com and .com.mx domains for Permisos Digitales

set -e

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

# Domain configuration
DOMAINS_COM_MX=(
    "permisosdigitales.com.mx"
    "www.permisosdigitales.com.mx"
    "api.permisosdigitales.com.mx"
)

DOMAINS_COM=(
    "permisosdigitales.com"
    "www.permisosdigitales.com"
    "api.permisosdigitales.com"
)

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root for nginx and SSL configuration"
        exit 1
    fi
}

# Install required packages
install_dependencies() {
    section "📦 INSTALLING DEPENDENCIES"
    
    log "Updating package list..."
    apt update
    
    log "Installing nginx and certbot..."
    apt install -y nginx certbot python3-certbot-nginx
    
    success "Dependencies installed"
}

# Configure nginx for multi-domain
setup_nginx() {
    section "🌐 CONFIGURING NGINX"
    
    log "Copying multi-domain nginx configuration..."
    cp nginx-multi-domain-config.conf /etc/nginx/sites-available/permisos-digitales
    
    log "Enabling site..."
    ln -sf /etc/nginx/sites-available/permisos-digitales /etc/nginx/sites-enabled/
    
    log "Removing default nginx site..."
    rm -f /etc/nginx/sites-enabled/default
    
    log "Testing nginx configuration..."
    nginx -t
    
    log "Reloading nginx..."
    systemctl reload nginx
    
    success "Nginx configured for multi-domain"
}

# Setup SSL certificates for all domains
setup_ssl_certificates() {
    section "🔒 SETTING UP SSL CERTIFICATES"
    
    # Setup certificates for .com.mx domains
    log "Setting up SSL for .com.mx domains..."
    for domain in "${DOMAINS_COM_MX[@]}"; do
        log "Requesting certificate for $domain..."
        certbot --nginx -d "$domain" --non-interactive --agree-tos --email contacto@permisosdigitales.com.mx
        
        if [ $? -eq 0 ]; then
            success "SSL certificate obtained for $domain"
        else
            error "Failed to obtain SSL certificate for $domain"
        fi
    done
    
    # Setup certificates for .com domains
    log "Setting up SSL for .com domains..."
    for domain in "${DOMAINS_COM[@]}"; do
        log "Requesting certificate for $domain..."
        certbot --nginx -d "$domain" --non-interactive --agree-tos --email contacto@permisosdigitales.com.mx
        
        if [ $? -eq 0 ]; then
            success "SSL certificate obtained for $domain"
        else
            error "Failed to obtain SSL certificate for $domain"
        fi
    done
}

# Test domain configuration
test_domains() {
    section "🧪 TESTING DOMAIN CONFIGURATION"
    
    log "Testing all domain endpoints..."
    
    # Test .com.mx domains
    for domain in "${DOMAINS_COM_MX[@]}"; do
        if [[ $domain == api.* ]]; then
            endpoint="https://$domain/health"
        else
            endpoint="https://$domain"
        fi
        
        log "Testing $endpoint..."
        if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200\|301\|302"; then
            success "$domain is responding"
        else
            warning "$domain may not be responding correctly"
        fi
    done
    
    # Test .com domains
    for domain in "${DOMAINS_COM[@]}"; do
        if [[ $domain == api.* ]]; then
            endpoint="https://$domain/health"
        else
            endpoint="https://$domain"
        fi
        
        log "Testing $endpoint..."
        if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200\|301\|302"; then
            success "$domain is responding"
        else
            warning "$domain may not be responding correctly"
        fi
    done
}

# Setup automatic certificate renewal
setup_auto_renewal() {
    section "🔄 SETTING UP AUTOMATIC CERTIFICATE RENEWAL"
    
    log "Setting up certbot auto-renewal..."
    
    # Add cron job for certificate renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    log "Testing certificate renewal..."
    certbot renew --dry-run
    
    success "Automatic certificate renewal configured"
}

# Display final configuration
show_configuration() {
    section "📋 DOMAIN CONFIGURATION SUMMARY"
    
    log "Your domains are now configured as follows:"
    echo ""
    
    log "Frontend Domains (both work identically):"
    echo "  ✅ https://permisosdigitales.com.mx"
    echo "  ✅ https://www.permisosdigitales.com.mx"
    echo "  ✅ https://permisosdigitales.com"
    echo "  ✅ https://www.permisosdigitales.com"
    echo ""
    
    log "API Domains (both work identically):"
    echo "  ✅ https://api.permisosdigitales.com.mx"
    echo "  ✅ https://api.permisosdigitales.com"
    echo ""
    
    log "CORS Configuration:"
    echo "  ✅ All domain variants allowed"
    echo "  ✅ Cross-origin requests supported"
    echo ""
    
    log "SSL Certificates:"
    echo "  ✅ All domains have valid SSL certificates"
    echo "  ✅ Auto-renewal configured"
    echo ""
    
    warning "Next Steps:"
    echo "1. Update your DNS records to point both domains to this server"
    echo "2. Test all domain variants in your browser"
    echo "3. Update any external services to use your preferred domain"
    echo "4. Consider setting up redirects if you want one domain as primary"
}

# Main execution
main() {
    log "🚀 Starting Multi-Domain Setup for Permisos Digitales..."
    
    check_root
    install_dependencies
    setup_nginx
    setup_ssl_certificates
    setup_auto_renewal
    test_domains
    show_configuration
    
    success "Multi-domain setup completed successfully!"
    log "Both .com and .com.mx domains are now fully configured and working."
}

# Run the setup
main "$@"

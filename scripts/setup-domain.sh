#!/bin/bash

# Domain Setup Script for Permisos Digitales
# This script sets up custom domain with SSL certificate and Route 53

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}============================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}============================================================${NC}\n"
}

# Configuration
DOMAIN_NAME=""
CLOUDFRONT_DISTRIBUTION_ID="ECOBED0P176S0"
REGION="us-west-1"
CERT_REGION="us-east-1"  # CloudFront requires certificates in us-east-1

# Function to validate domain name
validate_domain() {
    if [[ ! "$1" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$ ]]; then
        print_error "Invalid domain name format: $1"
        exit 1
    fi
}

# Function to check if domain exists in Route 53
check_hosted_zone() {
    local domain=$1
    aws route53 list-hosted-zones --query "HostedZones[?Name=='${domain}.'].Id" --output text
}

# Function to create hosted zone
create_hosted_zone() {
    local domain=$1
    print_status "Creating Route 53 hosted zone for $domain..."
    
    aws route53 create-hosted-zone \
        --name "$domain" \
        --caller-reference "permisos-$(date +%s)" \
        --hosted-zone-config Comment="Hosted zone for Permisos Digitales"
}

# Function to request SSL certificate
request_ssl_certificate() {
    local domain=$1
    print_status "Requesting SSL certificate for $domain and www.$domain..."
    
    aws acm request-certificate \
        --domain-name "$domain" \
        --subject-alternative-names "www.$domain" \
        --validation-method DNS \
        --region "$CERT_REGION" \
        --query 'CertificateArn' \
        --output text
}

# Function to get certificate validation records
get_cert_validation_records() {
    local cert_arn=$1
    print_status "Getting certificate validation records..."
    
    aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region "$CERT_REGION" \
        --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
        --output table
}

# Function to create validation records in Route 53
create_validation_records() {
    local cert_arn=$1
    local hosted_zone_id=$2
    
    print_status "Creating DNS validation records in Route 53..."
    
    # Get validation records
    local validation_records=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region "$CERT_REGION" \
        --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
        --output json)
    
    # Create change batch for Route 53
    local change_batch=$(cat <<EOF
{
    "Changes": [
$(echo "$validation_records" | jq -r '.[] | {
    "Action": "CREATE",
    "ResourceRecordSet": {
        "Name": .Name,
        "Type": .Type,
        "TTL": 300,
        "ResourceRecords": [{"Value": .Value}]
    }
} | @json' | sed 's/$/,/' | sed '$s/,$//')
    ]
}
EOF
)
    
    # Apply changes
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "$change_batch"
}

# Function to wait for certificate validation
wait_for_certificate() {
    local cert_arn=$1
    print_status "Waiting for certificate validation (this may take several minutes)..."
    
    aws acm wait certificate-validated \
        --certificate-arn "$cert_arn" \
        --region "$CERT_REGION"
}

# Function to update CloudFront distribution
update_cloudfront_distribution() {
    local domain=$1
    local cert_arn=$2
    
    print_status "Updating CloudFront distribution with custom domain and SSL..."
    
    # Get current distribution config
    local etag=$(aws cloudfront get-distribution-config \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --query 'ETag' \
        --output text)
    
    local config=$(aws cloudfront get-distribution-config \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --query 'DistributionConfig')
    
    # Update config with custom domain and certificate
    local updated_config=$(echo "$config" | jq --arg domain "$domain" --arg cert "$cert_arn" '
        .Aliases = {
            "Quantity": 2,
            "Items": [$domain, ("www." + $domain)]
        } |
        .ViewerCertificate = {
            "ACMCertificateArn": $cert,
            "SSLSupportMethod": "sni-only",
            "MinimumProtocolVersion": "TLSv1.2_2021",
            "CertificateSource": "acm"
        }
    ')
    
    # Apply the update
    aws cloudfront update-distribution \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --distribution-config "$updated_config" \
        --if-match "$etag"
}

# Function to create Route 53 records
create_route53_records() {
    local domain=$1
    local hosted_zone_id=$2
    local cloudfront_domain=$3
    
    print_status "Creating Route 53 A records for $domain..."
    
    local change_batch=$(cat <<EOF
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "$domain",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "$cloudfront_domain",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        },
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "www.$domain",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "$cloudfront_domain",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        }
    ]
}
EOF
)
    
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "$change_batch"
}

# Main execution
main() {
    print_header "DOMAIN SETUP FOR PERMISOS DIGITALES"
    
    # Get domain name from user
    if [ -z "$DOMAIN_NAME" ]; then
        read -p "Enter your domain name (e.g., permisosdigitales.com.mx): " DOMAIN_NAME
    fi
    
    validate_domain "$DOMAIN_NAME"
    
    print_status "Setting up domain: $DOMAIN_NAME"
    print_status "Region: $REGION"
    print_status "Certificate Region: $CERT_REGION"
    
    # Check if hosted zone exists
    hosted_zone_id=$(check_hosted_zone "$DOMAIN_NAME")
    
    if [ -z "$hosted_zone_id" ]; then
        print_status "Creating new hosted zone..."
        create_hosted_zone "$DOMAIN_NAME"
        hosted_zone_id=$(check_hosted_zone "$DOMAIN_NAME")
    else
        print_success "Hosted zone already exists: $hosted_zone_id"
    fi
    
    # Request SSL certificate
    cert_arn=$(request_ssl_certificate "$DOMAIN_NAME")
    print_success "Certificate requested: $cert_arn"
    
    # Get validation records
    print_header "CERTIFICATE VALIDATION"
    get_cert_validation_records "$cert_arn"
    
    # Create validation records
    create_validation_records "$cert_arn" "$hosted_zone_id"
    
    # Wait for validation
    wait_for_certificate "$cert_arn"
    print_success "Certificate validated successfully!"
    
    # Update CloudFront distribution
    update_cloudfront_distribution "$DOMAIN_NAME" "$cert_arn"
    print_success "CloudFront distribution updated!"
    
    # Get CloudFront domain name
    cloudfront_domain=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --query 'Distribution.DomainName' \
        --output text)
    
    # Create Route 53 records
    create_route53_records "$DOMAIN_NAME" "$hosted_zone_id" "$cloudfront_domain"
    
    print_header "SETUP COMPLETE"
    print_success "Domain setup completed successfully!"
    print_status "Your domain $DOMAIN_NAME is now configured."
    print_status "It may take up to 48 hours for DNS changes to propagate globally."
    
    # Get nameservers
    nameservers=$(aws route53 get-hosted-zone \
        --id "$hosted_zone_id" \
        --query 'DelegationSet.NameServers' \
        --output table)
    
    print_header "NEXT STEPS"
    print_warning "IMPORTANT: Update your domain's nameservers at your registrar:"
    echo "$nameservers"
    print_status "After updating nameservers, your site will be available at:"
    print_status "  - https://$DOMAIN_NAME"
    print_status "  - https://www.$DOMAIN_NAME"
}

# Run main function
main "$@"

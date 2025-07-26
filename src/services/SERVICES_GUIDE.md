# Services Directory Guide

This guide explains the purpose of each service and whether it's used in production, development, or both.

## Core Business Services (Production & Development)

### Application Management
- **application.service.js** - Manages permit applications lifecycle
- **permit-generation-orchestrator.service.js** - Automates government website interaction for permit generation (THE CORE BUSINESS)

### Authentication & Security
- **auth-security.service.js** - Handles authentication, password hashing, session management
- **security.service.js** - General security utilities and fraud detection
- **password-reset.service.js** - Password reset token generation and validation

### User Management
- **user.service.js** - User profile management and data operations

### Payment Processing
- **stripe-payment.service.js** - Main Stripe payment processing (includes fraud detection, metrics, circuit breakers)
- **payment-monitoring.service.js** - Monitors payment patterns for fraud
- **payment-recovery.service.js** - Handles failed payment recovery
- **payment-velocity.service.js** - Rate limiting for payment security

### Notifications
- **email.service.js** - Core email sending service with queue support
- **email-reminder.service.js** - Specific reminder email functionality
- **notification.service.js** - Multi-channel notification system
- **notification-channels.service.js** - Defines notification channels (email, SMS, etc.)
- **notification-compatibility.js** - Backward compatibility layer (temporary, can be removed after migration)

### PDF Generation & Queue Management
- **pdf-service.js** - Actual PDF generation using Puppeteer
- **pdf-queue-factory.service.js** - Chooses between dev/prod queue implementations
- **pdf-queue-bull.service.js** - Production queue using Bull + Redis
- **pdf-queue-dev.service.js** - Development queue using in-memory storage
- **pdf-queue-monitor.service.js** - Monitors and manages PDF queue health

### File Storage
- **storage/** (directory)
  - **storage-service.js** - Main storage service with S3 and local support
  - **s3-storage-provider.js** - AWS S3 storage implementation
  - **local-storage-provider.js** - Local filesystem storage
  - **pdf-storage-service.js** - PDF-specific storage operations
  - **storage-provider.interface.js** - Storage provider interface

### Infrastructure Services

#### Container Services (Dependency Management)
- **container/service-container.js** - Dependency injection container
- **container/database-service.js** - Database connection management
- **container/redis-service.js** - Redis connection management

#### Core Services (Connection Management)
- **core/database-manager.js** - Database lifecycle management
- **core/redis-manager.js** - Redis lifecycle management

#### Secrets Management
- **secrets/secrets-manager.service.js** - AWS Secrets Manager integration
- **secrets/secrets-cache.js** - Caches secrets to reduce API calls

### Utility Services
- **puppeteer.service.cleaned.js** - Browser automation utilities for PDF generation
- **webhook-retry.service.js** - Ensures webhook reliability with retry logic
- **alert.service.js** - System alerting for critical issues
- **queue-monitor.service.js** - General queue monitoring
- **service-bouncer.js** - Controls service initialization order

### Support Services
- **queue.service.js** - General queue service (likely for emails)

## Environment-Specific Usage

### Production Only
- **pdf-queue-bull.service.js** - Uses Redis, required for production
- **s3-storage-provider.js** - S3 storage for production files
- **secrets/*** - AWS Secrets Manager for production secrets

### Development Only
- **pdf-queue-dev.service.js** - In-memory queue for local development

### Both Environments
- All other services listed above

## Deleted Services (No Longer Needed)
- ~~file-storage.service.js~~ - Replaced by storage/storage-service.js
- ~~storage.service.js~~ - Replaced by storage/storage-service.js
- ~~pdf-queue-stub.service.js~~ - Unused test stub
- ~~queue-stub.service.js~~ - Unused test stub
- ~~stripe-wrapper.service.js~~ - Unused compatibility layer
- ~~container/stripe-service.js~~ - Unused container pattern for Stripe

## Migration Notes

1. **notification-compatibility.js** can be removed once all code is updated to use the new notification.service.js directly
2. The container pattern and direct service exports are mixed - consider standardizing on one approach
3. **stripe-payment.service.js** contains a reference to missing config/stripe.js - this is being refactored with server.js
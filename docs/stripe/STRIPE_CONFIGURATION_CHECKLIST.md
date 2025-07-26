# Stripe Configuration Checklist

This checklist ensures all Stripe configurations are properly set up for the Permisos Digitales application.

## 🔐 API Keys & Authentication

### Development Environment
- [ ] Test publishable key configured (`pk_test_...`)
- [ ] Test secret key configured (`sk_test_...`) 
- [ ] Test webhook signing secret configured (`whsec_test_...`)
- [ ] Keys stored in `.env` file (not committed)
- [ ] `.env` file added to `.gitignore`

### Production Environment
- [ ] Live publishable key in AWS Secrets Manager
- [ ] Live secret key in AWS Secrets Manager
- [ ] Live webhook signing secret in AWS Secrets Manager
- [ ] IAM roles configured for Secrets Manager access
- [ ] No hardcoded keys in codebase

## 💳 Payment Methods Configuration

### Card Payments
- [ ] Card payments enabled in Stripe Dashboard
- [ ] Supported card brands configured:
  - [ ] Visa
  - [ ] Mastercard
  - [ ] American Express
- [ ] 3D Secure enabled (automatic with Payment Intents)
- [ ] Statement descriptor configured: "PERMISOS DIGITALES"

### OXXO Payments
- [ ] OXXO enabled in Payment Methods
- [ ] OXXO voucher expiration set to 3 days
- [ ] Customer email requirement: Enabled
- [ ] Voucher language: Spanish (ES)
- [ ] OXXO fee structure understood and documented

## 🔔 Webhook Configuration

### Webhook Endpoint
- [ ] Production endpoint configured: `https://api.permisosdigitales.com.mx/stripe-payment/webhook/stripe`
- [ ] HTTPS enforced
- [ ] Valid SSL certificate
- [ ] Endpoint accessible from Stripe's servers

### Webhook Events
- [ ] `payment_intent.created` ✓
- [ ] `payment_intent.succeeded` ✓ (Critical)
- [ ] `payment_intent.payment_failed` ✓ (Critical)
- [ ] `payment_intent.canceled` ✓
- [ ] `payment_intent.requires_action` ✓
- [ ] `payment_intent.requires_capture` ✓
- [ ] `charge.updated` ✓ (Critical for OXXO)
- [ ] `payment_method.attached` ✓
- [ ] `payment_method.detached` ✓

### Webhook Security
- [ ] Signature verification implemented
- [ ] Webhook signing secret stored securely
- [ ] Request body parsed as raw buffer
- [ ] Idempotency checks implemented
- [ ] Retry mechanism configured

## 🌐 Account Settings

### Business Information
- [ ] Business name configured
- [ ] Business address complete
- [ ] Support email configured
- [ ] Support phone configured
- [ ] Business website added

### Compliance
- [ ] Tax information (RFC) provided
- [ ] Bank account verified
- [ ] Identity verification completed
- [ ] Business documentation uploaded

### Branding
- [ ] Logo uploaded
- [ ] Brand colors configured
- [ ] Receipt email customized
- [ ] Customer portal branding (if used)

## 🛡️ Security Settings

### API Security
- [ ] API version locked: `2020-08-27` (or latest)
- [ ] Rate limiting configured
- [ ] IP allowlisting (if applicable)
- [ ] Webhook IP verification (optional)

### PCI Compliance
- [ ] Using Stripe Elements or Payment Element
- [ ] No card data touches backend
- [ ] PCI compliance attestation completed
- [ ] Secure checkout flow verified

## 📊 Monitoring & Reporting

### Stripe Dashboard
- [ ] Team members added with appropriate roles
- [ ] Email notifications configured:
  - [ ] Daily summary
  - [ ] Failed payments
  - [ ] Disputes
  - [ ] Unusual activity
- [ ] Mobile app installed for monitoring

### Reporting Configuration
- [ ] Payout reports enabled
- [ ] Transaction reports scheduled
- [ ] Tax reporting configured
- [ ] Custom metadata fields documented

## 🧪 Testing Configuration

### Test Data
- [ ] Test customers created
- [ ] Test payment methods saved
- [ ] Test webhooks verified
- [ ] OXXO test flow validated

### Stripe CLI
- [ ] CLI installed on dev machines
- [ ] Team trained on CLI usage
- [ ] Webhook forwarding tested
- [ ] Event triggering documented

## 🚀 Production Readiness

### Performance
- [ ] API timeout configured (30 seconds)
- [ ] Retry logic implemented (3 retries)
- [ ] Circuit breakers configured
- [ ] Connection pooling optimized

### Error Handling
- [ ] All Stripe errors mapped to user messages
- [ ] Error logging comprehensive
- [ ] Alert system integrated
- [ ] Fallback mechanisms in place

### Documentation
- [ ] API integration documented
- [ ] Webhook handling documented
- [ ] Error codes documented
- [ ] Runbook created for common issues

## 📱 Frontend Integration

### Stripe.js
- [ ] Latest version loaded
- [ ] Loaded from Stripe's CDN
- [ ] Content Security Policy updated
- [ ] Async loading implemented

### Payment Element
- [ ] Element styling matches brand
- [ ] Error messages in Spanish
- [ ] Loading states implemented
- [ ] Mobile responsive design

## 🔄 Operational Procedures

### Key Rotation
- [ ] Key rotation schedule defined
- [ ] Rotation procedure documented
- [ ] Zero-downtime rotation tested
- [ ] Rollback procedure defined

### Incident Response
- [ ] Stripe support contact saved
- [ ] Escalation path defined
- [ ] Incident response plan created
- [ ] Communication templates prepared

## 📈 Business Configuration

### Pricing
- [ ] Default amount verified (150 MXN)
- [ ] Currency set to MXN
- [ ] No decimal place confusion (cents vs pesos)
- [ ] Tax handling configured (if applicable)

### Customer Communication
- [ ] Receipt emails tested
- [ ] OXXO voucher format verified
- [ ] Payment confirmation messages
- [ ] Failure messages user-friendly

## 🎯 Mexico-Specific Requirements

### OXXO Integration
- [ ] Store locator link provided
- [ ] Payment instructions in Spanish
- [ ] Expiration clearly communicated
- [ ] Reference number format verified

### Local Regulations
- [ ] CFDI integration planned (if required)
- [ ] Data localization requirements met
- [ ] Consumer protection compliance
- [ ] Privacy notice updated

## 📋 Final Verification

### End-to-End Testing
- [ ] Complete card payment flow
- [ ] Complete OXXO payment flow
- [ ] Webhook processing verified
- [ ] Error scenarios tested
- [ ] Performance benchmarked

### Go-Live Checklist
- [ ] All test transactions cleared
- [ ] Production keys deployed
- [ ] Monitoring active
- [ ] Support team trained
- [ ] Rollback plan ready

---

## Sign-off

- [ ] Technical Lead: _________________ Date: _______
- [ ] Security Review: ________________ Date: _______
- [ ] Business Owner: _________________ Date: _______
- [ ] Stripe Integration: ______________ Date: _______

## Notes

_Add any additional configuration notes, exceptions, or special considerations here:_

___________________________________________________________
___________________________________________________________
___________________________________________________________
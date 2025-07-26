# Stripe Integration Documentation - Permisos Digitales

This document provides comprehensive documentation of the Stripe integration for the Permisos Digitales application, including all required configurations, features, and implementation details.

## Table of Contents
1. [Overview](#overview)
2. [Stripe Account Requirements](#stripe-account-requirements)
3. [API Keys and Secrets](#api-keys-and-secrets)
4. [Payment Methods](#payment-methods)
5. [Webhook Configuration](#webhook-configuration)
6. [Implementation Architecture](#implementation-architecture)
7. [API Endpoints](#api-endpoints)
8. [Testing Configuration](#testing-configuration)
9. [Production Checklist](#production-checklist)
10. [Monitoring and Alerts](#monitoring-and-alerts)

## Overview

The Permisos Digitales application uses Stripe for processing payments for vehicle circulation permits. The integration supports both card payments and OXXO (cash) payments, which are critical for the Mexican market.

### Key Features
- **Card Payments**: Immediate processing with 3D Secure support
- **OXXO Payments**: Cash payments at convenience stores (3-day expiration)
- **Customer Management**: Automatic creation and reuse of Stripe customers
- **Webhook Processing**: Real-time payment status updates
- **Payment Recovery**: Automatic retry mechanisms for failed payments
- **Idempotency**: Prevents duplicate charges
- **Circuit Breakers**: Fault tolerance for Stripe API failures

## Stripe Account Requirements

### Account Setup
1. **Country**: Mexico (MXN currency)
2. **Business Type**: Company/Business
3. **Industry**: Government Services / Document Processing

### Required Verifications
- Business registration documents
- Tax ID (RFC)
- Bank account for payouts
- Identity verification for account owners

### Account Settings
```
- Default Currency: MXN
- Statement Descriptor: "PERMISOS DIGITALES"
- Payment Methods: Cards, OXXO
- Payout Schedule: Daily (recommended)
```

## API Keys and Secrets

### Required Keys
The application requires three Stripe secrets stored in AWS Secrets Manager:

```json
{
  "publicKey": "pk_live_...",     // Publishable key for frontend
  "privateKey": "sk_live_...",     // Secret key for backend
  "webhookSecret": "whsec_..."     // Webhook signing secret
}
```

### Environment Variables (Development)
```bash
# Stripe Configuration
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_PRIVATE_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### API Version
The application uses Stripe API version configuration:
```javascript
{
  apiVersion: '2020-08-27',  // Or latest stable version
  maxNetworkRetries: 3,
  timeout: 30000
}
```

## Payment Methods

### 1. Card Payments
- **Supported Cards**: Visa, Mastercard, American Express
- **3D Secure**: Automatically handled via Payment Intents
- **Currency**: MXN only
- **Minimum Amount**: 1 MXN
- **Maximum Amount**: No limit (business rules may apply)

### 2. OXXO Payments
- **Payment Window**: 3 days (configurable)
- **Voucher Generation**: Automatic
- **Barcode Format**: Standard OXXO format
- **Status Updates**: Via webhooks (charge.updated)
- **Customer Requirements**: Name and email

### Configuration in Stripe Dashboard
1. Enable OXXO in Payment Methods
2. Configure OXXO settings:
   - Default expiration: 3 days
   - Customer email requirements: Required
   - Voucher language: Spanish

## Webhook Configuration

### Required Webhook Events
The application processes the following Stripe webhook events:

| Event | Purpose | Critical |
|-------|---------|----------|
| `payment_intent.created` | Track payment initiation | No |
| `payment_intent.succeeded` | Confirm payment completion | Yes |
| `payment_intent.payment_failed` | Handle payment failures | Yes |
| `payment_intent.canceled` | Clean up canceled payments | No |
| `payment_intent.requires_action` | Handle 3DS authentication | Yes |
| `payment_intent.requires_capture` | Manual capture scenarios | Yes |
| `charge.updated` | OXXO payment confirmations | Yes |
| `payment_method.attached` | Audit trail | No |
| `payment_method.detached` | Audit trail | No |

### Webhook Endpoint Configuration
```
Endpoint URL: https://api.permisosdigitales.com.mx/stripe-payment/webhook/stripe
Events: Select all payment_intent.* and charge.* events
Version: Latest API version
```

### Webhook Security
- Signature verification using webhook secret
- Idempotency checks to prevent duplicate processing
- Asynchronous processing with immediate response
- Automatic retry mechanism for failed webhooks

## Implementation Architecture

### Service Layer Structure
```
┌─────────────────────────────────────┐
│         Frontend Application         │
│    (React + Stripe Elements)         │
└─────────────────┬───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│          API Gateway (ALB)           │
└─────────────────┬───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│       Express.js Application         │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │  Stripe Payment Controller   │    │
│  └──────────┬──────────────────┘    │
│             │                        │
│  ┌──────────┴──────────────────┐    │
│  │  Stripe Payment Service      │    │
│  └──────────┬──────────────────┘    │
│             │                        │
│  ┌──────────┴──────────────────┐    │
│  │    Stripe SDK Wrapper        │    │
│  └──────────┬──────────────────┘    │
└─────────────┼───────────────────────┘
              │
┌─────────────┴───────────────────────┐
│         Stripe API                  │
└─────────────────────────────────────┘
```

### Key Components

1. **StripeService** (`src/services/container/stripe-service.js`)
   - SDK initialization and configuration
   - Customer management
   - Payment intent creation
   - Webhook event construction

2. **StripePaymentService** (`src/services/stripe-payment.service.js`)
   - Business logic for payments
   - Circuit breakers for fault tolerance
   - Payment velocity checks
   - Metrics collection

3. **StripePaymentController** (`src/controllers/stripe-payment.controller.js`)
   - HTTP endpoint handlers
   - Request validation
   - Response formatting
   - Webhook processing

4. **Payment Security Middleware**
   - Rate limiting
   - Payment amount validation
   - Webhook signature verification

## API Endpoints

### Payment Order Creation
```
POST /stripe-payment/applications/:applicationId/payment/order
```
Creates a Stripe customer and prepares for payment.

### Payment Intent Creation
```
POST /stripe-payment/applications/:applicationId/payment/create-intent
```
Creates a payment intent for secure card processing.

**Request Body:**
```json
{
  "customerId": "cus_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "amount": 150,
  "currency": "MXN"
}
```

### Card Payment Processing
```
POST /stripe-payment/applications/:applicationId/payment/card
```
Processes a card payment (legacy endpoint).

### OXXO Payment Processing
```
POST /stripe-payment/applications/:applicationId/payment/oxxo
```
Creates an OXXO payment voucher.

**Response includes:**
- OXXO voucher URL
- Reference number
- Expiration date
- Barcode data

### Payment Confirmation
```
POST /stripe-payment/applications/:applicationId/payment/confirm
```
Confirms a successful payment after client-side processing.

### Payment Status Check
```
GET /stripe-payment/applications/:applicationId/payment/status
GET /stripe-payment/applications/:applicationId/payment/status/:paymentIntentId
```
Retrieves current payment status.

### Webhook Endpoint
```
POST /stripe-payment/webhook/stripe
```
Receives and processes Stripe webhook events.

## Testing Configuration

### Test Mode Setup
1. Use test API keys (pk_test_*, sk_test_*)
2. Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3001/stripe-payment/webhook/stripe
   ```

### Test Cards
```
# Successful payment
4242 4242 4242 4242

# Requires authentication
4000 0025 0000 3155

# Declined
4000 0000 0000 9995
```

### OXXO Testing
- Use test mode to generate OXXO vouchers
- Simulate payment confirmation via Stripe Dashboard

## Production Checklist

### Pre-Launch Requirements
- [ ] Verify production API keys in AWS Secrets Manager
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Set up webhook signing secret
- [ ] Enable all required payment methods
- [ ] Configure statement descriptors
- [ ] Set up proper error tracking
- [ ] Configure CloudWatch alarms for payment failures
- [ ] Test payment flow end-to-end
- [ ] Verify OXXO voucher generation
- [ ] Test webhook processing
- [ ] Configure rate limiting
- [ ] Set up payment velocity limits

### Security Checklist
- [ ] API keys stored securely (never in code)
- [ ] Webhook signatures verified
- [ ] HTTPS enforced for all endpoints
- [ ] PCI compliance maintained
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data

### Monitoring Setup
- [ ] Payment success rate monitoring
- [ ] Average processing time alerts
- [ ] Failed payment notifications
- [ ] Webhook processing failures
- [ ] Circuit breaker status
- [ ] Stripe API response times

## Monitoring and Alerts

### Key Metrics
1. **Payment Success Rate**
   - Target: > 95%
   - Alert threshold: < 90%

2. **Processing Time**
   - Target: < 3 seconds
   - Alert threshold: > 5 seconds

3. **Webhook Processing**
   - Success rate: > 99%
   - Processing time: < 2 seconds

4. **Circuit Breaker Status**
   - Monitor open circuits
   - Alert on repeated failures

### CloudWatch Alarms
```javascript
// Example alarm configuration
{
  alarmName: 'stripe-payment-failure-rate',
  metricName: 'PaymentFailureRate',
  threshold: 0.1, // 10% failure rate
  evaluationPeriods: 2,
  period: 300 // 5 minutes
}
```

### Alert Channels
- SNS Topic: `permisos-digitales-alerts`
- Slack webhook for critical alerts
- Email notifications for payment issues

## Troubleshooting

### Common Issues

1. **Payment Intent Already Exists**
   - Check for idempotency key conflicts
   - Verify application status

2. **Webhook Signature Verification Failed**
   - Confirm webhook secret is correct
   - Check request body handling

3. **OXXO Payment Not Confirming**
   - Verify charge.updated webhook is configured
   - Check webhook processing logs

4. **Circuit Breaker Open**
   - Review Stripe API errors
   - Check for rate limiting
   - Verify API key validity

### Debug Mode
Enable debug logging:
```javascript
DEBUG=stripe:*,payment:* npm start
```

## Support Resources

- Stripe Dashboard: https://dashboard.stripe.com
- API Reference: https://stripe.com/docs/api
- Testing Guide: https://stripe.com/docs/testing
- OXXO Integration: https://stripe.com/docs/payments/oxxo

## Contact

For Stripe account access or configuration changes, contact:
- Technical Lead: [Email]
- DevOps Team: [Email]
- Stripe Support: support@stripe.com
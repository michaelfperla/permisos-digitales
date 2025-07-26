# Payments API

Complete documentation for payment processing endpoints including Stripe card payments, OXXO payments, and payment health monitoring.

## Overview

The Payments API provides comprehensive payment processing capabilities supporting multiple payment methods and currencies. The system includes real-time payment monitoring, webhook handling, and automatic retry mechanisms.

## Payment Methods Supported
- **Credit/Debit Cards** - Via Stripe (immediate processing)
- **OXXO** - Cash payments at convenience stores (72-hour window)

---

## Stripe Payments

### Base URL
```
/applications/:applicationId/payment
```

All Stripe payment endpoints require:
- **Authentication**: Required (Client role)
- **Application Ownership**: User must own the application
- **Rate Limiting**: 5 requests per minute per user

---

### Create Payment Order

#### POST /applications/:applicationId/payment/order

Create a payment order and get client secret for Stripe Elements.

**CSRF**: Required  
**Middleware**: `validateApplicationId`, `paymentSecurity.paymentRateLimit`, `paymentSecurity.validatePaymentAmount`

##### Request Body
```json
{
  "paymentMethod": "card"  // or "oxxo"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "orderId": "pi_3MQv5KLkdIwHu7ix1234",
    "clientSecret": "pi_3MQv5KLkdIwHu7ix1234_secret_abcd",
    "amount": 150,
    "currency": "mxn",
    "status": "requires_payment_method"
  }
}
```

---

### Process Card Payment

#### POST /applications/:applicationId/payment/card

Process a credit/debit card payment.

**CSRF**: Required  
**Middleware**: Same as create order

##### Request Body
```json
{
  "paymentMethodId": "pm_1MQv5KLkdIwHu7ix1234",
  "paymentIntentId": "pi_3MQv5KLkdIwHu7ix1234"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "succeeded",
    "applicationStatus": "PAYMENT_RECEIVED",
    "nextSteps": "Your permit will be generated shortly"
  }
}
```

##### 3D Secure Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "requires_action",
    "clientSecret": "pi_3MQv5KLkdIwHu7ix1234_secret_abcd",
    "nextSteps": "Additional authentication required"
  }
}
```

---

### Process OXXO Payment

#### POST /applications/:applicationId/payment/oxxo

Generate OXXO payment voucher.

**CSRF**: Required  
**Middleware**: Same as create order

##### Request Body
```json
{
  "email": "customer@example.com"  // Optional, uses account email if not provided
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_3MQv5KLkdIwHu7ix1234",
    "oxxoReference": "123456789012",
    "amount": 150,
    "currency": "mxn",
    "expiresAt": "2025-06-26T10:00:00.000Z",
    "hostedVoucherUrl": "https://checkout.stripe.com/oxxo/voucher/...",
    "status": "requires_action"
  }
}
```

---

### Create Payment Intent (Legacy)

#### POST /applications/:applicationId/payment/create-intent

Create a payment intent directly (legacy endpoint, use `/order` instead).

**CSRF**: Required  
**Deprecated**: Use `/payment/order` endpoint

---

### Confirm Payment

#### POST /applications/:applicationId/payment/confirm

Confirm a payment after 3D Secure or other actions.

**CSRF**: Required

##### Request Body
```json
{
  "paymentIntentId": "pi_3MQv5KLkdIwHu7ix1234"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "succeeded",
    "applicationStatus": "PAYMENT_RECEIVED"
  }
}
```

---

### Check Payment Status

#### GET /applications/:applicationId/payment/status

Check the current status of a payment.

**CSRF**: Not required

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "hasPayment": true,
    "paymentStatus": "succeeded",
    "paymentMethod": "card",
    "amount": 150,
    "paidAt": "2025-06-24T10:30:00.000Z",
    "applicationStatus": "PERMIT_READY"
  }
}
```

#### GET /applications/:applicationId/payment/status/:paymentIntentId

Check status of a specific payment intent.

---

## OXXO Payments

### Base URL
```
/payments/oxxo
```

---

### Create OXXO Payment

#### POST /payments/oxxo

Create an OXXO payment reference (legacy endpoint).

**Authentication**: Required (Client role)  
**CSRF**: Required

##### Request Body
```json
{
  "applicationId": 12345
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "reference": "123456789012",
    "amount": 150,
    "expiresAt": "2025-06-26T10:00:00.000Z",
    "voucherUrl": "https://checkout.stripe.com/oxxo/voucher/..."
  }
}
```

---

### Get OXXO Receipt

#### GET /payments/oxxo/:orderId/receipt

Get HTML receipt for OXXO payment.

**Authentication**: Required  
**Response**: HTML page with payment details and barcode

---

## Payment Health Monitoring

### Base URL
```
/payment
```

All payment health endpoints require:
- **Authentication**: Required
- **Role**: Admin only

---

### Get Payment Health

#### GET /payment/health

Get comprehensive payment system health status.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "score": 95,
    "timestamp": "2025-06-24T10:00:00.000Z",
    "checks": {
      "stripe_connectivity": {
        "status": "healthy",
        "latency": 45,
        "message": "Stripe API responding normally"
      },
      "payment_success_rate": {
        "status": "healthy",
        "rate": 0.98,
        "threshold": 0.90,
        "message": "Success rate: 98%"
      },
      "processing_time": {
        "status": "healthy",
        "average": 1250,
        "p95": 2100,
        "message": "Average processing time: 1.25s"
      },
      "error_rate": {
        "status": "healthy",
        "rate": 0.02,
        "threshold": 0.10,
        "message": "Error rate: 2%"
      },
      "webhook_health": {
        "status": "healthy",
        "recentFailures": 0,
        "message": "Webhooks processing normally"
      }
    },
    "recommendations": []
  }
}
```

##### Health Status Values
- **healthy**: All systems operational (score >= 80)
- **degraded**: Some issues detected (score 50-79)
- **critical**: Major issues requiring attention (score < 50)

---

### Get Payment Metrics

#### GET /payment/metrics

Get detailed payment processing metrics.

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 24h | Time period: 1h, 24h, 7d, 30d |
| `groupBy` | string | hour | Grouping: hour, day |

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_payments": 1250,
      "successful_payments": 1225,
      "failed_payments": 25,
      "total_amount": 187500,
      "success_rate": 0.98,
      "average_amount": 150
    },
    "by_method": {
      "card": {
        "count": 1000,
        "amount": 150000,
        "success_rate": 0.99
      },
      "oxxo": {
        "count": 250,
        "amount": 37500,
        "success_rate": 0.94
      }
    },
    "by_status": {
      "succeeded": 1225,
      "failed": 15,
      "processing": 5,
      "requires_action": 5
    },
    "timeline": [
      {
        "timestamp": "2025-06-24T10:00:00.000Z",
        "count": 52,
        "amount": 7800,
        "success_rate": 0.98
      }
    ],
    "errors": {
      "card_declined": 10,
      "insufficient_funds": 8,
      "expired_card": 5,
      "processing_error": 2
    }
  }
}
```

---

### Reconcile Payment

#### POST /payment/applications/:applicationId/reconcile

Manually reconcile payment status with Stripe.

**CSRF**: Required

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "reconciled": true,
    "changes": {
      "status": {
        "from": "AWAITING_PAYMENT",
        "to": "PAYMENT_RECEIVED"
      }
    },
    "stripeStatus": "succeeded",
    "message": "Payment status reconciled successfully"
  }
}
```

---

### Reset Metrics

#### POST /payment/metrics/reset

Reset payment metrics (development only).

**CSRF**: Required  
**Environment**: Development only

---

## Webhook Handling

### Stripe Webhook

#### POST /webhook/stripe

Handle Stripe webhook events.

**Authentication**: None (verified by signature)  
**Headers**: `stripe-signature` required  
**Body**: Raw request body

##### Handled Events
| Event | Action |
|-------|--------|
| `payment_intent.created` | Track payment initiation |
| `payment_intent.succeeded` | Confirm payment, trigger PDF generation |
| `payment_intent.payment_failed` | Mark payment as failed |
| `payment_intent.requires_action` | Update status for 3D Secure |
| `charge.updated` | Process OXXO payment confirmations |
| `payment_intent.canceled` | Mark payment as canceled |

##### Response (Always 200 OK)
```json
{
  "received": true
}
```

---

## Payment Security

### Security Measures
1. **Amount Validation**: Prevents manipulation of payment amounts
2. **Rate Limiting**: 5 requests per minute per user
3. **Webhook Signature**: Validates all webhook requests
4. **Session Validation**: Ensures user owns the application
5. **CSRF Protection**: Required for all state-changing operations
6. **Payment Window**: 24-hour expiration for applications
7. **Idempotency**: Prevents duplicate payments

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_PAYMENT_AMOUNT` | Amount doesn't match application | Contact support |
| `PAYMENT_ALREADY_PROCESSED` | Payment already completed | Check application status |
| `PAYMENT_EXPIRED` | Payment window expired | Create new application |
| `PAYMENT_METHOD_REQUIRED` | No payment method provided | Provide payment details |
| `STRIPE_ERROR` | Stripe API error | Retry or contact support |
| `INSUFFICIENT_FUNDS` | Card has insufficient funds | Use different payment method |
| `CARD_DECLINED` | Card was declined | Contact bank or use different card |

---

## Payment Testing

### Test Card Numbers (Development)
| Card | Number | Behavior |
|------|--------|----------|
| Success | 4242 4242 4242 4242 | Always succeeds |
| Requires Auth | 4000 0025 0000 3155 | Requires 3D Secure |
| Decline | 4000 0000 0000 9995 | Always declines |

### Test OXXO Reference
In development, OXXO payments auto-confirm after 30 seconds.

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
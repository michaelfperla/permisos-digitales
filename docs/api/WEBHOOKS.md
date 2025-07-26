# Webhooks API

Documentation for webhook endpoints that handle external service notifications.

## Overview

The Webhooks API handles incoming webhook notifications from external services including Stripe payment processing and AWS SES email delivery. These endpoints are publicly accessible but secured through signature verification.

---

## Stripe Webhooks

### POST /webhook/stripe

Handle Stripe webhook events for payment processing.

**Authentication**: None (verified by signature)  
**Headers**: `stripe-signature` required  
**Content-Type**: `application/json`  
**Security**: Webhook endpoint secret verification

#### Handled Events

##### payment_intent.created
```json
{
  "id": "evt_1234567890",
  "type": "payment_intent.created",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 15000,
      "currency": "mxn",
      "status": "requires_payment_method",
      "metadata": {
        "applicationId": "12345"
      }
    }
  }
}
```
**Action**: Track payment initiation, update application status

##### payment_intent.succeeded
```json
{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 15000,
      "status": "succeeded",
      "charges": {
        "data": [{
          "payment_method_details": {
            "type": "card"
          }
        }]
      },
      "metadata": {
        "applicationId": "12345"
      }
    }
  }
}
```
**Action**: Mark payment complete, trigger PDF generation queue

##### payment_intent.payment_failed
```json
{
  "id": "evt_1234567890",
  "type": "payment_intent.payment_failed",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "last_payment_error": {
        "code": "card_declined",
        "decline_code": "insufficient_funds",
        "message": "Your card has insufficient funds."
      },
      "metadata": {
        "applicationId": "12345"
      }
    }
  }
}
```
**Action**: Mark payment failed, send notification to user

##### charge.updated (OXXO payments)
```json
{
  "id": "evt_1234567890",
  "type": "charge.updated",
  "data": {
    "object": {
      "id": "ch_1234567890",
      "payment_intent": "pi_1234567890",
      "payment_method_details": {
        "type": "oxxo",
        "oxxo": {
          "number": "123456789012"
        }
      },
      "status": "succeeded"
    }
  }
}
```
**Action**: Confirm OXXO payment, trigger PDF generation

##### payment_intent.requires_action (3D Secure)
```json
{
  "id": "evt_1234567890", 
  "type": "payment_intent.requires_action",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "status": "requires_action",
      "next_action": {
        "type": "use_stripe_sdk"
      }
    }
  }
}
```
**Action**: Update status for 3D Secure authentication

#### Response (Always 200 OK)
```json
{
  "received": true
}
```

#### Error Handling
- Invalid signature: Returns 400 Bad Request but logs the attempt
- Unknown event: Returns 200 OK but logs as unhandled
- Processing error: Returns 200 OK to prevent retries but logs error

---

## AWS SES Webhooks

### POST /webhook/ses

Handle AWS SES Simple Notification Service (SNS) webhook events for email delivery tracking.

**Authentication**: None (verified by SNS signature)  
**Content-Type**: `text/plain`  
**Security**: SNS message signature verification

#### Handled Event Types

##### Send
```json
{
  "Type": "Notification",
  "Message": "{\"eventType\":\"send\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\",\"timestamp\":\"2025-06-24T10:00:00.000Z\",\"destination\":[\"user@example.com\"],\"source\":\"noreply@permisos-digitales.com\",\"commonHeaders\":{\"subject\":\"Your Permit Application\"}}}"
}
```
**Action**: Record email sent

##### Delivery
```json
{
  "Type": "Notification", 
  "Message": "{\"eventType\":\"delivery\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\",\"timestamp\":\"2025-06-24T10:00:00.000Z\"},\"delivery\":{\"timestamp\":\"2025-06-24T10:00:30.000Z\",\"processingTimeMillis\":500}}"
}
```
**Action**: Mark email delivered successfully

##### Bounce
```json
{
  "Type": "Notification",
  "Message": "{\"eventType\":\"bounce\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\"},\"bounce\":{\"bounceType\":\"Permanent\",\"bounceSubType\":\"NoEmail\",\"bouncedRecipients\":[{\"emailAddress\":\"nonexistent@example.com\",\"status\":\"5.1.1\",\"diagnosticCode\":\"smtp; 550 5.1.1 user unknown\"}]}}"
}
```
**Action**: Add email to blacklist, alert administrators

##### Complaint  
```json
{
  "Type": "Notification",
  "Message": "{\"eventType\":\"complaint\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\"},\"complaint\":{\"complainedRecipients\":[{\"emailAddress\":\"user@example.com\"}],\"timestamp\":\"2025-06-24T10:05:00.000Z\",\"complaintFeedbackType\":\"abuse\"}}"
}
```
**Action**: Add email to blacklist, investigate sending practices

##### Open (if tracking enabled)
```json
{
  "Type": "Notification",
  "Message": "{\"eventType\":\"open\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\"},\"open\":{\"timestamp\":\"2025-06-24T10:10:00.000Z\",\"userAgent\":\"Mozilla/5.0...\",\"ipAddress\":\"192.168.1.1\"}}"
}
```
**Action**: Record email engagement

##### Click (if tracking enabled)
```json
{
  "Type": "Notification",
  "Message": "{\"eventType\":\"click\",\"mail\":{\"messageId\":\"0000014a-f4d2-4f2c-895f-2c8711c2e5c8\"},\"click\":{\"timestamp\":\"2025-06-24T10:15:00.000Z\",\"link\":\"https://permisos-digitales.com/verify\",\"linkTags\":{\"action\":[\"verify-email\"]}}}"
}
```
**Action**: Record link click for analytics

#### Response (Always 200 OK)
```text
OK
```

---

## Email Management Endpoints

### GET /email/stats

Get email delivery statistics.

**Authentication**: Required (Admin only)

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 7 | Number of days to include |
| `groupBy` | string | day | Group by: hour, day, week |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "summary": {
      "sent": 5678,
      "delivered": 5456,
      "bounced": 123,
      "complained": 5,
      "opened": 3234,
      "clicked": 1234,
      "delivery_rate": 0.961,
      "bounce_rate": 0.022,
      "complaint_rate": 0.001,
      "open_rate": 0.593,
      "click_rate": 0.226
    },
    "by_type": {
      "verification": {
        "sent": 1234,
        "delivered": 1200,
        "opened": 800
      },
      "permit_ready": {
        "sent": 2345,
        "delivered": 2300,
        "opened": 1500
      },
      "expiration_warning": {
        "sent": 456,
        "delivered": 440,
        "opened": 320
      }
    },
    "timeline": [
      {
        "date": "2025-06-24",
        "sent": 234,
        "delivered": 225,
        "bounced": 5,
        "opened": 120
      }
    ]
  }
}
```

---

### GET /email/blacklist

Get blacklisted email addresses.

**Authentication**: Required (Admin only)

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |
| `reason` | string | - | Filter by reason: bounce, complaint |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "blacklist": [
      {
        "email": "bounced@example.com",
        "reason": "bounce",
        "bounce_type": "Permanent",
        "added_at": "2025-01-20T10:00:00.000Z",
        "last_attempt": "2025-01-20T10:00:00.000Z"
      },
      {
        "email": "complaint@example.com",
        "reason": "complaint",
        "complaint_type": "abuse",
        "added_at": "2025-01-22T15:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 156,
      "page": 1,
      "totalPages": 4
    }
  }
}
```

---

### DELETE /email/blacklist/:email

Remove email address from blacklist.

**Authentication**: Required (Admin only)  
**CSRF**: Required

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Email removed from blacklist successfully"
}
```

#### Error Response (404 Not Found)
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_BLACKLISTED",
    "message": "Email address is not in blacklist"
  }
}
```

---

## Webhook Security

### Stripe Signature Verification
```javascript
const stripe = require('stripe');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const sig = req.headers['stripe-signature'];
let event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
```

### SNS Signature Verification
```javascript
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

const isValid = await sns.confirmSubscription({
  TopicArn: message.TopicArn,
  Token: message.Token
}).promise();
```

---

## Error Handling & Monitoring

### Webhook Failures
- Failed webhooks are logged with full context
- Stripe webhooks that fail are automatically retried by Stripe
- SNS messages are not retried by AWS if they fail

### Monitoring Alerts
- High bounce rate (>5%)
- High complaint rate (>0.1%)
- Webhook endpoint downtime
- Signature verification failures

### Debugging
```javascript
// Enable webhook debugging
process.env.DEBUG = 'webhook:*';

// Log all webhook events
console.log('Webhook received:', {
  type: event.type,
  id: event.id,
  created: event.created
});
```

---

## Best Practices

1. **Idempotency**: Handle duplicate webhook deliveries gracefully
2. **Quick Response**: Return 200 OK as quickly as possible
3. **Async Processing**: Process webhook data asynchronously
4. **Error Handling**: Log errors but don't return error status
5. **Signature Verification**: Always verify webhook signatures
6. **Monitoring**: Monitor webhook endpoint health
7. **Blacklist Management**: Regularly review and clean blacklist

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
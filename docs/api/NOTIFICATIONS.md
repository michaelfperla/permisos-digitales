# Notifications API

Documentation for system notification and reminder endpoints.

## Overview

The Notifications API handles automated system notifications including expiring permits, payment reminders, and system alerts. These endpoints are primarily used by internal services and cron jobs.

## Base URL
```
/notifications
```

## Authentication
- **Required**: Internal API key
- **Query Parameter**: `apiKey` or **Header**: `x-internal-api-key`

---

## OXXO Payment Expiration

### GET /notifications/oxxo-expiring

Process and notify users about expiring OXXO payments.

**Authentication**: Internal API key required

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hours` | number | 24 | Hours until expiration (1-72) |
| `apiKey` | string | - | Internal API key |
| `dryRun` | boolean | false | Test mode, don't send emails |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "processed": 45,
    "notifications_sent": 42,
    "errors": 3,
    "expiring_in_hours": 24,
    "results": [
      {
        "application_id": 12345,
        "email": "user@example.com",
        "expiry_time": "2025-01-25T10:00:00.000Z",
        "notification_sent": true
      }
    ],
    "processing_time_ms": 2500
  }
}
```

#### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

---

## Permit Expiration Notifications

### GET /notifications/permits-expiring

Process and notify users about expiring permits.

**Authentication**: Internal API key required

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 7 | Days until expiration (1-30) |
| `apiKey` | string | - | Internal API key |
| `reminderType` | string | warning | warning, final |
| `dryRun` | boolean | false | Test mode |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "processed": 234,
    "notifications_sent": 228,
    "errors": 6,
    "reminder_type": "warning",
    "days_until_expiry": 7,
    "breakdown": {
      "first_warning": 150,
      "final_warning": 78,
      "already_notified": 6
    },
    "results": [
      {
        "application_id": 12345,
        "email": "user@example.com",
        "permit_expires": "2025-01-31T23:59:59.000Z",
        "days_remaining": 7,
        "notification_sent": true,
        "previous_notifications": 0
      }
    ]
  }
}
```

---

## Email Reminder Types

### Expiration Warning (7 days)
```json
{
  "template": "expiration_warning",
  "subject": "Your permit expires in 7 days - Renew now",
  "data": {
    "user_name": "John Doe",
    "permit_number": "TEMP-12345",
    "expiry_date": "2025-01-31",
    "renewal_url": "https://permisos.com/renew/12345",
    "days_remaining": 7
  }
}
```

### Final Warning (1 day)
```json
{
  "template": "final_warning", 
  "subject": "URGENT: Your permit expires tomorrow",
  "data": {
    "user_name": "John Doe",
    "permit_number": "TEMP-12345",
    "expiry_date": "2025-01-25",
    "renewal_url": "https://permisos.com/renew/12345",
    "hours_remaining": 24
  }
}
```

### OXXO Payment Expiring
```json
{
  "template": "oxxo_payment_expiring",
  "subject": "Your OXXO payment expires in 24 hours",
  "data": {
    "user_name": "John Doe",
    "oxxo_reference": "123456789012",
    "amount": 150,
    "expires_at": "2025-01-25T10:00:00.000Z",
    "payment_url": "https://permisos.com/payment/12345"
  }
}
```

---

## Notification Statistics

### GET /notifications/stats

Get notification sending statistics.

**Authentication**: Internal API key required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "last_24_hours": {
      "total_sent": 567,
      "by_type": {
        "expiration_warning": 234,
        "final_warning": 123,
        "oxxo_expiring": 89,
        "payment_failed": 45,
        "permit_ready": 76
      },
      "delivery_rate": 0.95,
      "errors": 28
    },
    "current_week": {
      "total_sent": 3456,
      "unique_recipients": 2890,
      "delivery_rate": 0.94
    },
    "scheduled": {
      "next_oxxo_check": "2025-01-24T12:00:00.000Z",
      "next_permit_check": "2025-01-25T06:00:00.000Z"
    }
  }
}
```

---

## Manual Triggers

### POST /notifications/trigger

Manually trigger specific notification campaigns.

**Authentication**: Internal API key required  
**CSRF**: Required

#### Request Body
```json
{
  "type": "permit_expiration",
  "filters": {
    "days": 7,
    "user_ids": [123, 456, 789]
  },
  "dry_run": false
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "triggered": true,
    "job_id": "notification-job-12345",
    "estimated_recipients": 45,
    "message": "Notification campaign queued successfully"
  }
}
```

---

## Notification Preferences

### GET /notifications/preferences/:userId

Get user notification preferences.

**Authentication**: Internal API key required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "preferences": {
      "permit_expiration": true,
      "payment_reminders": true,
      "system_updates": false,
      "promotional": false
    },
    "contact_methods": {
      "email": "user@example.com",
      "sms": null,
      "push": false
    },
    "unsubscribed": false
  }
}
```

---

## Notification Queue

### GET /notifications/queue

Get current notification queue status.

**Authentication**: Internal API key required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "queue_depth": 125,
    "processing": 3,
    "failed": 5,
    "scheduled": 45,
    "recent_jobs": [
      {
        "id": "notif-job-123",
        "type": "permit_expiration",
        "status": "completed",
        "created_at": "2025-01-24T10:00:00.000Z",
        "completed_at": "2025-01-24T10:05:00.000Z",
        "recipients": 234,
        "sent": 228,
        "failed": 6
      }
    ]
  }
}
```

---

## Error Handling

### Common Error Codes
| Code | Description | Resolution |
|------|-------------|------------|
| `API_KEY_REQUIRED` | Missing API key | Provide valid API key |
| `INVALID_API_KEY` | Invalid API key | Check key configuration |
| `INVALID_TIMEFRAME` | Invalid hours/days parameter | Use 1-72 hours, 1-30 days |
| `EMAIL_SERVICE_ERROR` | Email delivery failed | Check SES configuration |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |

### Retry Logic
- Failed notifications are retried 3 times
- Exponential backoff: 1min, 5min, 15min
- Hard bounces are not retried
- Temporary failures are retried

---

## Scheduling

### Cron Jobs
```yaml
# Check expiring permits daily at 6 AM
permit_expiration_check:
  schedule: "0 6 * * *"
  endpoint: "/notifications/permits-expiring?days=7"

# Check expiring OXXO payments every 4 hours  
oxxo_expiration_check:
  schedule: "0 */4 * * *"
  endpoint: "/notifications/oxxo-expiring?hours=24"

# Final permit warning daily at 8 AM
final_permit_warning:
  schedule: "0 8 * * *" 
  endpoint: "/notifications/permits-expiring?days=1&reminderType=final"
```

---

## Integration Examples

### External Monitoring
```bash
# Check notification health
curl -H "x-internal-api-key: YOUR_KEY" \
  https://api.permisos.com/notifications/stats

# Trigger manual notification
curl -X POST \
  -H "x-internal-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"permit_expiration","filters":{"days":7}}' \
  https://api.permisos.com/notifications/trigger
```

### Kubernetes CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: permit-expiration-check
spec:
  schedule: "0 6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: notification-trigger
            image: curlimages/curl
            command:
            - curl
            - -H
            - "x-internal-api-key: $(API_KEY)"
            - https://api.permisos.com/notifications/permits-expiring?days=7
```

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
# Admin API

Comprehensive documentation for administrative endpoints including dashboard, user management, and system operations.

## Overview

The Admin API provides powerful tools for system administrators to manage users, monitor applications, handle failed permits, and perform system maintenance tasks. All admin endpoints require authentication with admin role privileges.

## Base URL
```
/admin
```

## Authentication
- **Required**: Admin role
- **Portal**: Must access through admin portal (`X-Portal-Type: admin`)
- **Rate Limit**: 200 requests per 15 minutes
- **CSRF**: Required for all state-changing operations

---

## Dashboard

### Get Dashboard Statistics

#### GET /admin/dashboard-stats

Retrieve comprehensive dashboard statistics and metrics.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1250,
      "totalApplications": 3456,
      "activePermits": 2890,
      "revenue": {
        "today": 4500,
        "month": 125000,
        "year": 1500000
      }
    },
    "applications": {
      "pending": 45,
      "processing": 12,
      "completed": 2890,
      "failed": 23,
      "byStatus": {
        "AWAITING_PAYMENT": 45,
        "PAYMENT_PROCESSING": 8,
        "IN_QUEUE": 12,
        "PERMIT_READY": 2890,
        "FAILED": 23
      }
    },
    "users": {
      "total": 1250,
      "verified": 1180,
      "unverified": 70,
      "active30Days": 450,
      "newToday": 5,
      "byRole": {
        "client": 1245,
        "admin": 5
      }
    },
    "payments": {
      "todayCount": 30,
      "todayAmount": 4500,
      "successRate": 0.97,
      "byMethod": {
        "card": {
          "count": 25,
          "amount": 3750
        },
        "oxxo": {
          "count": 5,
          "amount": 750
        }
      }
    },
    "queue": {
      "depth": 12,
      "processing": 3,
      "avgWaitTime": 180,
      "failureRate": 0.02
    },
    "trends": {
      "userGrowth": 0.05,
      "applicationGrowth": 0.08,
      "revenueGrowth": 0.12
    }
  }
}
```

---

## Application Management

### Get All Applications

#### GET /admin/applications

Retrieve paginated list of all applications with filtering options.

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `status` | string | - | Filter by status |
| `search` | string | - | Search in name, email, VIN |
| `dateFrom` | date | - | Created after date |
| `dateTo` | date | - | Created before date |
| `paymentStatus` | string | - | Filter by payment status |
| `userId` | number | - | Filter by user ID |

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": 12345,
        "user_id": 123,
        "status": "PERMIT_READY",
        "nombre_completo": "Juan Pérez",
        "email": "juan@example.com",
        "numero_serie": "JTDBL40E899012345",
        "marca": "Toyota",
        "linea": "Corolla",
        "created_at": "2025-06-20T10:00:00.000Z",
        "payment_status": "paid",
        "amount_paid": 150,
        "permit_generated_at": "2025-06-20T11:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 3456,
      "page": 1,
      "totalPages": 173,
      "limit": 20
    },
    "summary": {
      "totalAmount": 518400,
      "averageProcessingTime": 3600
    }
  }
}
```

---

### Get Application Details

#### GET /admin/applications/:id

Retrieve detailed information about a specific application.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "application": {
      "id": 12345,
      "status": "PERMIT_READY",
      "user": {
        "id": 123,
        "email": "juan@example.com",
        "first_name": "Juan",
        "last_name": "Pérez",
        "created_at": "2025-01-01T00:00:00.000Z"
      },
      "vehicle": {
        "marca": "Toyota",
        "linea": "Corolla",
        "color": "Rojo",
        "numero_serie": "JTDBL40E899012345",
        "numero_motor": "2ZR1234567",
        "ano_modelo": "2024"
      },
      "payment": {
        "stripe_payment_intent_id": "pi_3MQv5KLkdIwHu7ix1234",
        "amount": 150,
        "method": "card",
        "status": "succeeded",
        "paid_at": "2025-06-20T10:30:00.000Z"
      },
      "documents": {
        "permiso_url": "/applications/12345/download/permiso",
        "recibo_url": "/applications/12345/download/recibo",
        "certificado_url": "/applications/12345/download/certificado",
        "placas_url": "/applications/12345/download/placas"
      },
      "timeline": [
        {
          "status": "AWAITING_PAYMENT",
          "timestamp": "2025-06-20T10:00:00.000Z"
        },
        {
          "status": "PAYMENT_RECEIVED",
          "timestamp": "2025-06-20T10:30:00.000Z"
        },
        {
          "status": "PERMIT_READY",
          "timestamp": "2025-06-20T11:00:00.000Z"
        }
      ]
    }
  }
}
```

---

## Failed Permits

### Get Failed Applications

#### GET /admin/applications/failed

Retrieve applications that failed PDF generation.

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeResolved` | boolean | false | Include resolved failures |
| `days` | number | 7 | Look back period |

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": 12346,
        "status": "ERROR_GENERATING_PERMIT",
        "error_message": "Puppeteer timeout: Navigation timeout exceeded",
        "failed_at": "2025-06-24T08:00:00.000Z",
        "retry_count": 3,
        "last_retry_at": "2025-06-24T08:15:00.000Z",
        "is_resolved": false,
        "user": {
          "email": "user@example.com",
          "name": "John Doe"
        }
      }
    ],
    "statistics": {
      "total": 23,
      "resolved": 18,
      "pending": 5,
      "averageRetries": 2.3
    }
  }
}
```

---

### Retry PDF Generation

#### POST /admin/applications/:id/retry-puppet

Manually retry PDF generation for failed application.

**CSRF**: Required

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "queued": true,
    "jobId": "pdf-job-12346",
    "position": 5,
    "message": "PDF generation queued successfully"
  }
}
```

---

### Mark Application Resolved

#### PATCH /admin/applications/:id/resolve

Mark a failed application as resolved.

**CSRF**: Required

##### Request Body
```json
{
  "resolution": "Manual PDF upload completed",
  "notifyUser": true
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "resolved": true,
    "resolvedAt": "2025-06-24T10:00:00.000Z",
    "resolvedBy": "admin@permisos.com"
  }
}
```

---

### Upload Manual PDFs

#### POST /admin/applications/:id/upload-pdfs

Upload manually generated PDFs for failed applications.

**CSRF**: Required  
**Content-Type**: multipart/form-data

##### Form Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `permiso` | file | Yes | Permit PDF |
| `recibo` | file | Yes | Receipt PDF |
| `certificado` | file | No | Certificate PDF |
| `placas` | file | No | License plate PDF |

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "uploaded": ["permiso", "recibo", "certificado", "placas"],
    "status": "PERMIT_READY",
    "message": "PDFs uploaded successfully"
  }
}
```

---

### Trigger PDF Generation

#### POST /admin/applications/:id/generate-pdf

Manually trigger PDF generation for an application.

**CSRF**: Required

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "triggered": true,
    "jobId": "pdf-job-12345",
    "message": "PDF generation triggered"
  }
}
```

---

## User Management

### Get Users

#### GET /admin/users

Retrieve paginated list of users.

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page (max: 100) |
| `role` | string | - | Filter by role (client/admin) |
| `search` | string | - | Search in name, email |
| `status` | string | - | active, inactive, disabled |
| `verified` | boolean | - | Email verification status |

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 123,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "client",
        "is_email_verified": true,
        "is_active": true,
        "created_at": "2025-01-01T00:00:00.000Z",
        "last_login_at": "2025-06-24T08:00:00.000Z",
        "application_count": 5,
        "total_spent": 750
      }
    ],
    "pagination": {
      "total": 1250,
      "page": 1,
      "totalPages": 125
    }
  }
}
```

---

### Get User Details

#### GET /admin/users/:id

Retrieve detailed user information.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "client",
      "is_email_verified": true,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00.000Z",
      "security": {
        "last_login_at": "2025-06-24T08:00:00.000Z",
        "last_login_ip": "192.168.1.1",
        "failed_login_attempts": 0,
        "account_locked_until": null,
        "password_changed_at": "2025-01-15T00:00:00.000Z"
      },
      "statistics": {
        "total_applications": 5,
        "active_permits": 3,
        "total_spent": 750,
        "average_monthly_spend": 150
      }
    }
  }
}
```

---

### Get User Applications

#### GET /admin/users/:userId/applications

Retrieve all applications for a specific user.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      // Same structure as general applications list
    ],
    "summary": {
      "total": 5,
      "active": 3,
      "expired": 2,
      "totalSpent": 750
    }
  }
}
```

---

### Enable User

#### PATCH /admin/users/:id/enable

Enable a disabled user account.

**CSRF**: Required

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User account enabled successfully"
}
```

---

### Disable User

#### PATCH /admin/users/:id/disable

Disable a user account.

**CSRF**: Required

##### Request Body (Optional)
```json
{
  "reason": "Violation of terms of service",
  "notifyUser": true
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User account disabled successfully"
}
```

##### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_DISABLE_SELF",
    "message": "Cannot disable your own account"
  }
}
```

---

## Reminders

### Trigger Email Reminders

#### POST /admin/reminders/trigger

Manually trigger email reminder processing.

**CSRF**: Required

##### Request Body (Optional)
```json
{
  "type": "expiration",  // or "payment"
  "dryRun": false
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "processed": {
      "expiration_warning": 15,
      "final_warning": 8,
      "total": 23
    },
    "errors": [],
    "duration": 2500
  }
}
```

---

### Get Reminder Statistics

#### GET /admin/reminders/stats

Get email reminder statistics.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "recent": [
      {
        "type": "expiration_warning",
        "sent_at": "2025-06-24T06:00:00.000Z",
        "count": 45,
        "success_rate": 0.98
      }
    ],
    "pending": {
      "expiration_warning": 12,
      "final_warning": 5,
      "payment_reminder": 8
    },
    "scheduled": {
      "next_run": "2025-06-25T06:00:00.000Z",
      "frequency": "daily"
    }
  }
}
```

---

### Test Email Reminder

#### POST /admin/reminders/test

Send test reminder email to specific application.

**CSRF**: Required

##### Request Body
```json
{
  "applicationId": 12345,
  "reminderType": "expiration_warning"  // or "final_warning"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Test email sent successfully to user@example.com"
}
```

---

## Cleanup

### Trigger Application Cleanup

#### POST /admin/cleanup/trigger

Manually trigger cleanup of expired applications.

**CSRF**: Required

##### Request Body (Optional)
```json
{
  "dryRun": true,
  "daysOld": 30
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "cleaned": {
      "expired_applications": 45,
      "abandoned_payments": 23,
      "total": 68
    },
    "freed_space": "1.2GB",
    "duration": 5000
  }
}
```

---

### Get Cleanup Statistics

#### GET /admin/cleanup/stats

Get cleanup operation statistics without executing.

##### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "candidates": {
      "expired_applications": 89,
      "abandoned_payments": 34,
      "old_logs": 156
    },
    "estimated_space": "2.3GB",
    "last_cleanup": "2025-06-20T06:00:00.000Z"
  }
}
```

---

## CSRF Token

### Get CSRF Token

#### GET /admin/csrf-token

Get CSRF token for admin operations.

##### Success Response (200 OK)
```json
{
  "csrfToken": "admin-csrf-token-string"
}
```

---

## Security Considerations

1. **Role Verification**: All endpoints verify admin role
2. **Portal Access**: Must use admin portal header
3. **Audit Logging**: All admin actions are logged
4. **Rate Limiting**: Higher limits but still enforced
5. **CSRF Protection**: Required for all mutations
6. **IP Restrictions**: Can be configured per deployment

---

## Best Practices

1. **Regular Monitoring**: Check dashboard daily
2. **Failed Permits**: Address within 24 hours
3. **User Management**: Document disable reasons
4. **Cleanup**: Run monthly or as needed
5. **Backups**: Before manual interventions

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
# User Profile API

Documentation for user profile management endpoints.

## Overview

The User Profile API allows authenticated users to view and update their profile information. These endpoints are available to all authenticated users with the client role.

## Base URL
```
/user
```

## Authentication
- **Required**: Yes (Client or Admin role)
- **CSRF**: Required for update operations

---

## Get User Profile

### GET /user/profile

Retrieve the current user's profile information.

#### Success Response (200 OK)
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
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z",
      "preferences": {
        "language": "es",
        "timezone": "America/Mexico_City",
        "notifications": {
          "email": true,
          "permitExpiration": true,
          "paymentReminders": true
        }
      },
      "statistics": {
        "total_applications": 5,
        "active_permits": 3,
        "total_spent": 750
      }
    }
  }
}
```

---

## Update User Profile

### PUT /user/profile

Update the current user's profile information.

**CSRF**: Required

#### Request Body
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "newemail@example.com"
}
```

#### Validation Rules
| Field | Rules | Description |
|-------|-------|-------------|
| `first_name` | Optional, 2-50 chars | User's first name |
| `last_name` | Optional, 2-50 chars | User's last name |
| `email` | Optional, valid email | New email (requires verification) |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Smith",
      "emailChangeRequested": "newemail@example.com"
    }
  },
  "message": "Profile updated successfully"
}
```

#### Email Change Response
When email is changed:
```json
{
  "success": true,
  "data": {
    "user": {
      // User data
    },
    "emailChange": {
      "requested": true,
      "newEmail": "newemail@example.com",
      "verificationSent": true
    }
  },
  "message": "Profile updated. Please check your new email for verification."
}
```

#### Error Responses
```json
// Email Already Exists (409 Conflict)
{
  "success": false,
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "This email is already registered to another account"
  }
}

// Validation Error (422 Unprocessable Entity)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "first_name",
          "message": "First name must be at least 2 characters",
          "code": "TOO_SHORT"
        }
      ]
    }
  }
}
```

---

## User Activity Summary

### GET /user/activity

Get user's recent activity summary (Optional endpoint, may not be implemented).

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "recentActivity": [
      {
        "type": "application_created",
        "timestamp": "2025-06-24T10:00:00.000Z",
        "details": {
          "applicationId": 12345,
          "vehicleInfo": "Toyota Corolla 2024"
        }
      },
      {
        "type": "payment_completed",
        "timestamp": "2025-06-24T10:30:00.000Z",
        "details": {
          "amount": 150,
          "method": "card"
        }
      },
      {
        "type": "permit_generated",
        "timestamp": "2025-06-24T11:00:00.000Z",
        "details": {
          "applicationId": 12345
        }
      }
    ],
    "loginHistory": [
      {
        "timestamp": "2025-06-24T08:00:00.000Z",
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    ]
  }
}
```

---

## User Preferences

### GET /user/preferences

Get user preferences (if implemented).

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "preferences": {
      "language": "es",
      "timezone": "America/Mexico_City",
      "notifications": {
        "email": true,
        "permitExpiration": true,
        "paymentReminders": true,
        "systemUpdates": false
      },
      "privacy": {
        "shareStatistics": false,
        "allowMarketing": false
      }
    }
  }
}
```

### PUT /user/preferences

Update user preferences.

**CSRF**: Required

#### Request Body
```json
{
  "language": "en",
  "notifications": {
    "permitExpiration": false
  }
}
```

---

## Account Management

### DELETE /user/account

Request account deletion (if implemented).

**CSRF**: Required  
**Confirmation**: Requires password confirmation

#### Request Body
```json
{
  "password": "currentPassword123!",
  "reason": "No longer need the service"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "scheduled": true,
    "scheduledDate": "2025-02-24T00:00:00.000Z"
  },
  "message": "Account scheduled for deletion in 30 days. You can cancel this request by logging in."
}
```

---

## Data Export

### GET /user/data-export

Request export of all user data (GDPR compliance).

**CSRF**: Required

#### Success Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "requestId": "export-123456",
    "status": "processing",
    "estimatedTime": "24 hours"
  },
  "message": "Data export requested. You will receive an email when ready."
}
```

### GET /user/data-export/:requestId

Check data export status.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "downloadUrl": "/user/data-export/123456/download",
    "expiresAt": "2025-01-31T00:00:00.000Z",
    "size": "2.5MB"
  }
}
```

---

## Security Settings

### GET /user/security

Get user security settings and status.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "security": {
      "passwordLastChanged": "2025-01-15T00:00:00.000Z",
      "twoFactorEnabled": false,
      "recentLoginAttempts": [
        {
          "timestamp": "2025-06-24T08:00:00.000Z",
          "ip": "192.168.1.1",
          "success": true,
          "location": "Mexico City, MX"
        }
      ],
      "activeSessions": 1,
      "securityScore": 75
    }
  }
}
```

### POST /user/security/sessions/revoke-all

Revoke all active sessions except current.

**CSRF**: Required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "revoked": 3
  },
  "message": "All other sessions have been terminated"
}
```

---

## Profile Completeness

### GET /user/profile/completeness

Check profile completeness status.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "completeness": 85,
    "missing": [
      "phone_number",
      "address"
    ],
    "suggestions": [
      "Add a phone number for better account security",
      "Complete your address for faster applications"
    ]
  }
}
```

---

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `PROFILE_NOT_FOUND` | User profile not found | Contact support |
| `EMAIL_EXISTS` | Email already in use | Use different email |
| `INVALID_PASSWORD` | Password incorrect | Check password |
| `UPDATE_FAILED` | Profile update failed | Retry request |
| `VERIFICATION_REQUIRED` | Email change needs verification | Check email |

---

## Best Practices

1. **Email Changes**: Always verify new email addresses
2. **Profile Updates**: Validate all input on frontend
3. **Security**: Encourage regular password changes
4. **Privacy**: Respect user preferences
5. **Data Export**: Implement for GDPR compliance

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
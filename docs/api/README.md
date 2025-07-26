# API Documentation

## Base URLs

| Environment | Base URL | Description |
|-------------|----------|-------------|
| Development | `http://localhost:3001/api` | Local development server |
| Staging | `https://staging-api.permisos-digitales.com/api` | Staging environment |
| Production | `https://api.permisos-digitales.com/api` | Production environment |

## Authentication

The API uses session-based authentication with CSRF protection for state-changing operations.

### Session Management
- Sessions are maintained using secure HTTP-only cookies
- Session timeout: 4 hours
- Automatic session renewal on activity

### CSRF Protection
- Required for all POST, PUT, PATCH, DELETE operations
- Get CSRF token: `GET /auth/csrf-token`
- Include in requests as `X-CSRF-Token` header or `_csrf` form field

### User Roles
- **Client**: Regular users who can create and manage their applications
- **Admin**: Administrative users with access to admin panel and user management

## API Endpoints Overview

### Authentication & User Management
| Endpoint | Description |
|----------|-------------|
| [Authentication](AUTHENTICATION.md) | Login, registration, email verification |
| [Password Reset](AUTHENTICATION.md#password-reset) | Password reset functionality |
| [User Profile](USERS.md) | User profile management |

### Core Application Flow
| Endpoint | Description |
|----------|-------------|
| [Applications](APPLICATIONS.md) | Permit application lifecycle management |
| [Stripe Payments](PAYMENTS.md#stripe-payments) | Stripe card and OXXO payment processing |
| [OXXO Payments](PAYMENTS.md#oxxo-payments) | OXXO-specific payment endpoints |
| [Payment Health](PAYMENTS.md#payment-health) | Payment system monitoring |
| [Queue Management](QUEUE.md) | PDF generation queue and status |

### Administrative
| Endpoint | Description |
|----------|-------------|
| [Admin Dashboard](ADMIN.md#dashboard) | Administrative operations and monitoring |
| [User Management](ADMIN.md#user-management) | Admin user management features |
| [Failed Permits](ADMIN.md#failed-permits) | Failed permit recovery system |
| [Email Reminders](ADMIN.md#reminders) | Email reminder management |
| [Application Cleanup](ADMIN.md#cleanup) | Expired application cleanup |

### System & Monitoring
| Endpoint | Description |
|----------|-------------|
| [Health Checks](HEALTH.md) | System health and readiness endpoints |
| [Metrics](METRICS.md) | Application and business metrics |
| [Notifications](NOTIFICATIONS.md) | System notification triggers |
| [Webhooks](WEBHOOKS.md) | Stripe and SES webhook handlers |
| [Email Management](EMAIL.md) | Email delivery tracking and blacklist |
| [Log Analysis](LOGS.md) | Log search and analysis (admin only) |
| [Debug Tools](DEBUG.md) | Development debugging endpoints |

## Request/Response Format

### Standard Response Structure
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message",
  "pagination": {
    // Pagination info for list endpoints
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

## Common HTTP Status Codes

| Code | Description | When Used |
|------|-------------|-----------|
| 200 | OK | Successful GET, PUT, PATCH requests |
| 201 | Created | Successful POST requests that create resources |
| 204 | No Content | Successful DELETE requests |
| 400 | Bad Request | Invalid request data or parameters |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate email) |
| 410 | Gone | Deprecated endpoint |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side errors |

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type | Limit | Window | Notes |
|---------------|-------|--------|-------|
| General API | 100 requests | 15 minutes | Applied to all `/*` endpoints |
| Authentication | 10 requests | 15 minutes | Additional limit on auth endpoints |
| Login Attempts | 5 failed attempts | 15 minutes | Account lockout after limit |
| Payment | 5 requests | 60 seconds | Per user payment rate limit |
| Admin | 200 requests | 15 minutes | Higher limit for admin operations |
| Password Reset | 3 requests | 1 hour | Per email address |
| Email Verification | 3 requests | 1 hour | Per email address |
| Registration | 5 requests | 60 seconds | Per IP address |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | POST/PUT | `application/json` for JSON payloads |
| `X-CSRF-Token` | State changes | CSRF protection token |
| `Accept` | Optional | `application/json` (default) |

## Pagination

List endpoints support pagination with query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `sort` | string | Sort field |
| `order` | string | Sort order: 'asc' or 'desc' |

Example: `GET /applications?page=2&limit=10&sort=createdAt&order=desc`

## Filtering

Many endpoints support filtering with query parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `status` | Filter by status | `?status=pending` |
| `search` | Text search | `?search=john` |
| `dateFrom` | Start date filter | `?dateFrom=2025-06-01` |
| `dateTo` | End date filter | `?dateTo=2025-12-31` |

## Error Handling

### Validation Errors (HTTP 422)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Valid email is required",
          "code": "INVALID_EMAIL"
        }
      ]
    }
  }
}
```

### Authentication Errors (HTTP 401)
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication required to access this resource"
  }
}
```

### Rate Limit Errors (HTTP 429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again later.",
    "details": {
      "retryAfter": 900
    }
  }
}
```

## Webhooks

The system supports webhook notifications for external integrations:

| Event | Description |
|-------|-------------|
| `payment.completed` | Payment successfully processed |
| `permit.generated` | Permit documents generated |
| `application.status_changed` | Application status updated |

See [Webhooks Documentation](WEBHOOKS.md) for detailed webhook implementation.

## Development & Testing

### Test Environment
- Base URL: `http://localhost:3001/api`
- Test user credentials available in development
- Mock payment processing for testing
- Debug endpoints available (development only)

### Postman Collection
Import the Postman collection for easy API testing:
- [Download Collection](../assets/postman/permisos-digitales-api.json)

### cURL Examples
Basic authentication example:
```bash
# Get CSRF token
curl -c cookies.txt http://localhost:3001/auth/csrf-token

# Login
curl -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -d '{"email":"user@example.com","password":"password"}' \
  http://localhost:3001/auth/login

# Get applications
curl -b cookies.txt http://localhost:3001/applications
```

## SDK & Libraries

### JavaScript/Node.js
```javascript
import { PermisosAPI } from '@permisos/api-client';

const client = new PermisosAPI({
  baseURL: 'https://api.permisos-digitales.com/api',
  credentials: 'include' // For session cookies
});

// Login
await client.auth.login({ email, password });

// Get applications
const applications = await client.applications.list();
```

## Support & Resources

- **API Issues**: Report via GitHub Issues
- **Status Page**: [status.permisos-digitales.com](https://status.permisos-digitales.com)
- **Developer Support**: Contact development team
- **Rate Limit Increases**: Contact support for higher limits

---

**Last Updated**: June 24, 2025 | **API Version**: 2.0 | **OpenAPI Spec**: [openapi.yaml](openapi.yaml)
# Debug API

Documentation for development and debugging endpoints.

## Overview

The Debug API provides development-specific endpoints for testing, debugging, and troubleshooting. These endpoints are only available in development environment and return 404 in production.

## Base URL
```
/debug
```

## Environment Restriction
- **Development**: All endpoints available
- **Production**: All endpoints return 404 Not Found
- **Authentication**: Not required for most endpoints

---

## CSRF Testing

### GET /debug/csrf-test

Test CSRF token generation and validation.

**Environment**: Development only  
**CSRF**: Required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "csrf_token": "debug-csrf-token-abc123",
    "generated_at": "2025-01-24T10:00:00.000Z",
    "expires_in": 3600
  },
  "message": "CSRF token generated successfully"
}
```

#### Error Response (403 Forbidden)
```json
{
  "success": false,
  "error": {
    "code": "CSRF_TOKEN_INVALID",
    "message": "Invalid or missing CSRF token"
  }
}
```

---

### POST /debug/csrf-validate

Validate CSRF token functionality.

**Environment**: Development only  
**CSRF**: Required

#### Request Body
```json
{
  "test_data": "Sample data for CSRF validation"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "csrf_valid": true,
    "token_matched": true,
    "request_processed": true
  },
  "message": "CSRF validation successful"
}
```

---

## Session Information

### GET /debug/session-info

Get detailed session information for debugging.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "sess_abc123def456",
      "user_id": 123,
      "created_at": "2025-01-24T08:00:00.000Z",
      "last_accessed": "2025-01-24T10:00:00.000Z",
      "expires_at": "2025-01-25T08:00:00.000Z",
      "is_authenticated": true,
      "user_role": "client",
      "csrf_token": "csrf-abc123",
      "portal_type": "main"
    },
    "cookies": {
      "session_cookie": "present",
      "csrf_cookie": "present",
      "secure": true,
      "http_only": true,
      "same_site": "strict"
    },
    "redis": {
      "connected": true,
      "session_exists": true,
      "ttl": 86400
    }
  }
}
```

#### No Session Response (200 OK)
```json
{
  "success": true,
  "data": {
    "session": null,
    "is_authenticated": false,
    "message": "No active session found"
  }
}
```

---

## CORS Testing

### GET /debug/cors-test

Test CORS (Cross-Origin Resource Sharing) configuration.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "cors_enabled": true,
    "allowed_origins": ["http://localhost:3000", "http://localhost:3001"],
    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allowed_headers": ["Content-Type", "Authorization", "X-CSRF-Token"],
    "credentials_allowed": true,
    "preflight_max_age": 86400
  },
  "headers": {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true"
  }
}
```

---

## Environment Information

### GET /debug/environment

Get comprehensive environment and configuration information.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "node": {
      "version": "18.17.0",
      "platform": "linux",
      "arch": "x64",
      "uptime": 86400,
      "memory": {
        "rss": "125MB",
        "heap_used": "85MB",
        "heap_total": "150MB",
        "external": "25MB"
      }
    },
    "environment": {
      "NODE_ENV": "development",
      "PORT": 3001,
      "database_url": "postgresql://localhost:5432/permisos_dev",
      "redis_url": "redis://localhost:6379",
      "stripe_mode": "test"
    },
    "services": {
      "database": {
        "connected": true,
        "type": "PostgreSQL",
        "version": "14.5"
      },
      "redis": {
        "connected": true,
        "version": "7.0.5",
        "memory": "125MB"
      },
      "stripe": {
        "mode": "test",
        "webhooks_configured": true
      }
    },
    "middleware": {
      "cors": "enabled",
      "helmet": "enabled",
      "rate_limiting": "enabled",
      "session": "redis-store",
      "csrf": "enabled"
    },
    "features": {
      "email_verification": true,
      "payment_processing": true,
      "pdf_generation": true,
      "file_uploads": true,
      "webhook_processing": true
    }
  }
}
```

---

## Database Testing

### GET /debug/database-test

Test database connectivity and perform basic operations.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "connection": {
      "status": "connected",
      "host": "localhost",
      "port": 5432,
      "database": "permisos_dev",
      "ssl": false
    },
    "tests": {
      "select_test": {
        "status": "passed",
        "duration_ms": 5,
        "result": "SELECT 1 executed successfully"
      },
      "user_count": {
        "status": "passed",
        "count": 1250,
        "duration_ms": 12
      },
      "application_count": {
        "status": "passed", 
        "count": 3456,
        "duration_ms": 8
      }
    },
    "pool": {
      "total_connections": 50,
      "idle_connections": 35,
      "active_connections": 15
    }
  }
}
```

---

## Redis Testing

### GET /debug/redis-test

Test Redis connectivity and session storage.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "connection": {
      "status": "connected",
      "host": "localhost",
      "port": 6379,
      "database": 0
    },
    "tests": {
      "ping": {
        "status": "passed",
        "response": "PONG",
        "duration_ms": 2
      },
      "set_get": {
        "status": "passed",
        "key": "debug:test:123",
        "value": "test_value",
        "duration_ms": 3
      },
      "session_test": {
        "status": "passed",
        "sessions_count": 45,
        "duration_ms": 5
      }
    },
    "info": {
      "version": "7.0.5",
      "memory_used": "125MB",
      "connected_clients": 5,
      "total_commands_processed": 567890
    }
  }
}
```

---

## Email Testing

### POST /debug/send-test-email

Send a test email to verify email configuration.

**Environment**: Development only  
**CSRF**: Required

#### Request Body
```json
{
  "to": "test@example.com",
  "template": "test",
  "subject": "Test Email from Debug API"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "email_sent": true,
    "message_id": "0000014a-f4d2-4f2c-895f-2c8711c2e5c8",
    "recipient": "test@example.com",
    "provider": "AWS SES",
    "send_time_ms": 250
  }
}
```

---

## Payment Testing

### GET /debug/stripe-test

Test Stripe integration and configuration.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "stripe": {
      "mode": "test",
      "publishable_key": "pk_test_...",
      "webhook_endpoint": "configured",
      "webhook_secret": "present"
    },
    "tests": {
      "api_connection": {
        "status": "passed",
        "account_id": "acct_test123",
        "duration_ms": 150
      },
      "webhook_verification": {
        "status": "passed", 
        "endpoint_status": "enabled"
      }
    },
    "test_cards": [
      {
        "number": "4242424242424242",
        "description": "Visa - Always succeeds"
      },
      {
        "number": "4000000000009995",
        "description": "Visa - Always declined"
      }
    ]
  }
}
```

---

## Queue Testing

### GET /debug/queue-test

Test PDF generation queue functionality.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "queue": {
      "status": "active",
      "redis_connected": true,
      "workers": 2
    },
    "tests": {
      "queue_add": {
        "status": "passed",
        "job_id": "debug-test-job-123",
        "duration_ms": 10
      },
      "queue_stats": {
        "status": "passed",
        "waiting": 0,
        "active": 0,
        "completed": 1547,
        "failed": 23
      }
    }
  }
}
```

---

## Error Simulation

### POST /debug/simulate-error

Simulate various error conditions for testing error handling.

**Environment**: Development only  
**CSRF**: Required

#### Request Body
```json
{
  "error_type": "database_error",
  "severity": "high"
}
```

#### Error Types
- `database_error`: Simulate database connection failure
- `redis_error`: Simulate Redis connection failure  
- `stripe_error`: Simulate Stripe API error
- `validation_error`: Simulate validation failure
- `rate_limit_error`: Simulate rate limit exceeded
- `server_error`: Simulate internal server error

#### Success Response (500 Internal Server Error)
```json
{
  "success": false,
  "error": {
    "code": "SIMULATED_DATABASE_ERROR",
    "message": "Simulated database connection failure for testing",
    "details": {
      "simulation": true,
      "type": "database_error",
      "timestamp": "2025-01-24T10:00:00.000Z"
    }
  }
}
```

---

## Performance Testing

### GET /debug/performance-test

Run basic performance tests and benchmarks.

**Environment**: Development only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "tests": {
      "database_query": {
        "avg_time_ms": 12,
        "min_time_ms": 8,
        "max_time_ms": 18,
        "queries_tested": 100
      },
      "redis_operations": {
        "avg_time_ms": 3,
        "operations_tested": 100
      },
      "json_parsing": {
        "avg_time_ms": 1,
        "objects_parsed": 1000
      }
    },
    "system": {
      "cpu_usage": 25.5,
      "memory_usage": 52.3,
      "load_average": [1.2, 1.1, 1.0]
    }
  }
}
```

---

## Security Notice

⚠️ **Important**: Debug endpoints are automatically disabled in production environments. Attempting to access debug endpoints in production will return:

```json
{
  "success": false,
  "error": {
    "code": "DEBUG_DISABLED",
    "message": "Debug routes are disabled in production"
  }
}
```

---

## Best Practices

1. **Never use in production**: Debug endpoints expose sensitive information
2. **Temporary testing**: Use for debugging specific issues
3. **Clean up**: Remove debug calls from production code
4. **Security**: Debug endpoints bypass some security measures
5. **Performance**: Debug endpoints may impact performance

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
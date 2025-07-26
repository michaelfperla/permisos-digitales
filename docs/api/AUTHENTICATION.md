# Authentication API

Complete authentication system supporting user registration, login, email verification, and password recovery.

## Overview

The authentication system uses session-based authentication with HTTP-only cookies and CSRF protection for security. All authentication endpoints are rate-limited to prevent abuse.

## Base URL
```
/auth
```

## Rate Limiting
- **Authentication endpoints**: 10 requests per 15 minutes per IP
- **Password reset**: Additional protection with 3 requests per hour

---

## User Registration

### POST /auth/register

Register a new user account with email verification.

**Authentication**: None required  
**CSRF**: Required  
**Rate Limit**: 10/15min

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "confirmPassword": "SecurePassword123!"
}
```

#### Validation Rules
| Field | Rules |
|-------|-------|
| `email` | Required, valid email format, unique |
| `password` | Required, min 8 chars, contains uppercase, lowercase, number, special char |
| `firstName` | Required, 2-50 characters, letters only |
| `lastName` | Required, 2-50 characters, letters only |
| `confirmPassword` | Required, must match password |

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "client",
      "isEmailVerified": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    "session": {
      "id": "session-id",
      "expiresAt": "2025-01-02T00:00:00.000Z"
    }
  },
  "message": "Registration successful. Please check your email for verification."
}
```

#### Error Responses
```json
// Email already exists (409 Conflict)
{
  "success": false,
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "An account with this email already exists"
  }
}

// Validation errors (422 Unprocessable Entity)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "password",
          "message": "Password must contain at least one uppercase letter",
          "code": "WEAK_PASSWORD"
        }
      ]
    }
  }
}
```

---

## User Login

### POST /auth/login

Authenticate user and create session.

**Authentication**: None required  
**CSRF**: Required  
**Rate Limit**: 10/15min

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "client",
      "isEmailVerified": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    "session": {
      "id": "session-id",
      "expiresAt": "2025-01-02T00:00:00.000Z"
    }
  }
}
```

#### Error Responses
```json
// Invalid credentials (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}

// Account not verified (403 Forbidden)
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email before logging in"
  }
}

// Account disabled (403 Forbidden)
{
  "success": false,
  "error": {
    "code": "ACCOUNT_DISABLED",
    "message": "Your account has been disabled. Contact support."
  }
}
```

---

## User Logout

### POST /auth/logout

End user session and clear authentication cookies.

**Authentication**: None required (works with or without session)  
**CSRF**: Required

#### Request Body
```json
{}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Authentication Status

### GET /auth/status

Check current authentication status and get user information.

**Authentication**: None required  
**CSRF**: Not required

#### Success Response (200 OK)
```json
// Authenticated user
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "client",
      "isEmailVerified": true
    }
  }
}

// Not authenticated
{
  "success": true,
  "data": {
    "authenticated": false
  }
}
```

### GET /auth/check

Alternative endpoint for authentication status check.

**Same behavior as `/auth/status`**

---

## CSRF Token

### GET /auth/csrf-token

Get CSRF token for secure form submissions.

**Authentication**: None required  
**CSRF**: Not required (generates token)

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "csrfToken": "csrf-token-string"
  }
}
```

---

## Email Verification

### GET /auth/verify-email/:token

Verify user email address using verification token.

**Authentication**: None required  
**CSRF**: Not required

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Email verification token from email |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "isEmailVerified": true
    }
  },
  "message": "Email verified successfully"
}
```

#### Error Responses
```json
// Invalid or expired token (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired verification token"
  }
}

// Already verified (409 Conflict)
{
  "success": false,
  "error": {
    "code": "ALREADY_VERIFIED",
    "message": "Email is already verified"
  }
}
```

---

## Resend Verification Email

### POST /auth/resend-verification

Resend email verification link to user.

**Authentication**: None required  
**CSRF**: Required  
**Rate Limit**: 3 requests per hour per email

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

#### Error Responses
```json
// Email not found (404 Not Found)
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "No account found with this email address"
  }
}

// Already verified (409 Conflict)
{
  "success": false,
  "error": {
    "code": "ALREADY_VERIFIED",
    "message": "Email is already verified"
  }
}
```

---

## Password Management

### POST /auth/change-password

Change password for authenticated user.

**Authentication**: Required  
**CSRF**: Required

#### Request Body
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!",
  "confirmPassword": "NewPassword456!"
}
```

#### Validation Rules
| Field | Rules |
|-------|-------|
| `currentPassword` | Required, must match current password |
| `newPassword` | Required, min 8 chars, strong password rules |
| `confirmPassword` | Required, must match newPassword |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### Error Responses
```json
// Current password incorrect (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "INVALID_CURRENT_PASSWORD",
    "message": "Current password is incorrect"
  }
}

// Same as current password (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "SAME_PASSWORD",
    "message": "New password must be different from current password"
  }
}
```

---

# Password Reset

Complete password recovery system with secure token-based reset.

## Request Password Reset

### POST /auth/forgot-password

Request password reset link via email.

**Authentication**: None required  
**CSRF**: Required  
**Rate Limit**: 3 requests per hour per email

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email"
}
```

**Note**: This endpoint always returns success to prevent email enumeration attacks, even if the email doesn't exist.

---

## Validate Reset Token

### GET /auth/reset-password/:token

Check if password reset token is valid.

**Authentication**: None required  
**CSRF**: Not required

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Password reset token from email |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "valid": true,
    "email": "user@example.com"
  }
}
```

#### Error Responses
```json
// Invalid or expired token (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "INVALID_RESET_TOKEN",
    "message": "Invalid or expired reset token"
  }
}
```

---

## Reset Password

### POST /auth/reset-password

Reset password using valid reset token.

**Authentication**: None required  
**CSRF**: Required

#### Request Body
```json
{
  "token": "reset-token-string",
  "password": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

#### Validation Rules
| Field | Rules |
|-------|-------|
| `token` | Required, valid reset token |
| `password` | Required, min 8 chars, strong password rules |
| `confirmPassword` | Required, must match password |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

#### Error Responses
```json
// Invalid token (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "INVALID_RESET_TOKEN",
    "message": "Invalid or expired reset token"
  }
}

// Token already used (409 Conflict)
{
  "success": false,
  "error": {
    "code": "TOKEN_ALREADY_USED",
    "message": "This reset token has already been used"
  }
}
```

---

## Security Features

### Session Management
- **Session Duration**: 4 hours
- **Secure Cookies**: HTTP-only, Secure, SameSite=Strict
- **Session Renewal**: Automatic renewal on activity
- **Session Invalidation**: All sessions invalidated on password change

### Password Security
- **Minimum Requirements**: 8+ characters, uppercase, lowercase, number, special character
- **Hashing**: bcrypt with salt rounds (cost factor 12)
- **Password History**: Prevents reuse of last 5 passwords
- **Strength Validation**: Real-time password strength checking

### Rate Limiting & Abuse Prevention
- **Login Attempts**: Account lockout after 5 failed attempts (30 minute lockout)
- **Email Rate Limiting**: Prevents spam of verification/reset emails
- **IP-based Rate Limiting**: Per-IP request limits
- **CAPTCHA**: Integrated for high-risk operations (configurable)

### Token Security
- **Verification Tokens**: 6-hour expiration, single-use
- **Reset Tokens**: 1-hour expiration, single-use
- **Cryptographically Secure**: Generated using crypto.randomBytes
- **Token Invalidation**: Automatic cleanup of expired tokens

### Additional Security
- **CSRF Protection**: Required for all state-changing operations
- **Input Validation**: Comprehensive validation with sanitization
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: Input sanitization and output encoding

---

## Code Examples

### JavaScript/Fetch
```javascript
// Register new user
const registerUser = async (userData) => {
  // Get CSRF token first
  const csrfResponse = await fetch('/auth/csrf-token');
  const { data: { csrfToken } } = await csrfResponse.json();
  
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify(userData)
  });
  
  return response.json();
};

// Login user
const loginUser = async (email, password) => {
  const csrfResponse = await fetch('/auth/csrf-token');
  const { data: { csrfToken } } = await csrfResponse.json();
  
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  
  return response.json();
};

// Check authentication status
const checkAuth = async () => {
  const response = await fetch('/auth/status', {
    credentials: 'include'
  });
  return response.json();
};
```

### cURL Examples
```bash
# Register new user
curl -c cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{"email":"user@example.com","password":"Password123!","firstName":"John","lastName":"Doe","confirmPassword":"Password123!"}' \
  http://localhost:3001/auth/register

# Login
curl -b cookies.txt -c cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{"email":"user@example.com","password":"Password123!"}' \
  http://localhost:3001/auth/login

# Check status
curl -b cookies.txt http://localhost:3001/auth/status

# Logout
curl -b cookies.txt -X POST \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  http://localhost:3001/auth/logout
```

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
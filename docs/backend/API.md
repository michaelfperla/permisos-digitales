# Permisos Digitales API Documentation

## Overview

This document provides detailed information about the Permisos Digitales API endpoints, their request/response formats, and authentication requirements.

## Base URL

All API endpoints are relative to:
- Development: `http://localhost:8080/api`
- Production: `https://your-production-domain.com/api`

## Authentication

Most API endpoints require authentication using session cookies. Authentication can be obtained by:

1. POST `/api/auth/login`
2. Using the session cookie for subsequent requests

Some administrative endpoints require admin privileges.

## Common Response Format

All API responses follow this format:

```json
{
  "success": true/false,
  "data": { /* Response data object */ },
  "error": { /* Error details if success is false */ }
}
```

Error objects include:
```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": { /* Additional error details */ }
}
```

## API Endpoints

### Authentication

#### Login

- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "USER"
      }
    }
  }
  ```
- **Error Response**: (401 Unauthorized)
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Invalid email or password"
    }
  }
  ```

#### Register

- **URL**: `/auth/register`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "newuser@example.com",
    "password": "securepassword",
    "firstName": "Jane",
    "lastName": "Smith",
    "phoneNumber": "+1234567890"
  }
  ```
- **Success Response**: (201 Created)
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "email": "newuser@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "role": "USER"
      }
    }
  }
  ```
- **Error Response**: (400 Bad Request)
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "email": "Email is already in use"
      }
    }
  }
  ```

#### Logout

- **URL**: `/auth/logout`
- **Method**: `POST`
- **Auth Required**: Yes
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully"
    }
  }
  ```

#### Get Current User

- **URL**: `/auth/profile`
- **Method**: `GET`
- **Auth Required**: Yes
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phoneNumber": "+1234567890",
        "role": "USER",
        "createdAt": "2023-01-01T00:00:00Z"
      }
    }
  }
  ```
- **Error Response**: (401 Unauthorized)
  ```json
  {
    "success": false,
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Authentication required"
    }
  }
  ```

### Password Reset

#### Request Password Reset

- **URL**: `/password-reset/request`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "message": "If the email exists, a password reset link has been sent"
    }
  }
  ```

#### Validate Reset Token

- **URL**: `/password-reset/validate-token`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "token": "reset-token-from-email"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "valid": true
    }
  }
  ```
- **Error Response**: (400 Bad Request)
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_TOKEN",
      "message": "Invalid or expired token"
    }
  }
  ```

#### Reset Password

- **URL**: `/password-reset/reset`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "token": "reset-token-from-email",
    "password": "new-secure-password"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "message": "Password has been reset successfully"
    }
  }
  ```
- **Error Response**: (400 Bad Request)
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_TOKEN",
      "message": "Invalid or expired token"
    }
  }
  ```

### Permit Applications

#### Get All Applications

- **URL**: `/applications`
- **Method**: `GET`
- **Auth Required**: Yes
- **Query Parameters**:
  - `status` (optional): Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED)
  - `page` (optional): Page number for pagination (default: 1)
  - `limit` (optional): Number of results per page (default: 10)
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "applications": [
        {
          "id": "uuid",
          "status": "SUBMITTED",
          "permitType": "BUSINESS",
          "createdAt": "2023-01-01T00:00:00Z",
          "updatedAt": "2023-01-02T00:00:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 25,
        "pages": 3
      }
    }
  }
  ```

#### Create Application

- **URL**: `/applications`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "permitType": "BUSINESS",
    "businessName": "Example Business",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345"
    },
    "contactName": "John Doe",
    "contactEmail": "contact@example.com",
    "contactPhone": "+1234567890",
    "desiredStartDate": "2023-06-01"
  }
  ```
- **Success Response**: (201 Created)
  ```json
  {
    "success": true,
    "data": {
      "application": {
        "id": "uuid",
        "status": "DRAFT",
        "permitType": "BUSINESS",
        "businessName": "Example Business",
        "createdAt": "2023-01-01T00:00:00Z"
      }
    }
  }
  ```
- **Error Response**: (400 Bad Request)
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "businessName": "Business name is required"
      }
    }
  }
  ```

#### Get Application Details

- **URL**: `/applications/:id`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `id`: Application ID
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "application": {
        "id": "uuid",
        "status": "SUBMITTED",
        "permitType": "BUSINESS",
        "businessName": "Example Business",
        "address": {
          "street": "123 Main St",
          "city": "Anytown",
          "state": "CA",
          "postalCode": "12345"
        },
        "contactName": "John Doe",
        "contactEmail": "contact@example.com",
        "contactPhone": "+1234567890",
        "desiredStartDate": "2023-06-01",
        "submittedAt": "2023-01-02T00:00:00Z",
        "documents": [
          {
            "id": "uuid",
            "type": "BUSINESS_LICENSE",
            "filename": "license.pdf",
            "uploadedAt": "2023-01-01T00:00:00Z"
          }
        ],
        "payments": [
          {
            "id": "uuid",
            "amount": 100.00,
            "status": "COMPLETED",
            "timestamp": "2023-01-02T00:00:00Z"
          }
        ],
        "statusHistory": [
          {
            "status": "DRAFT",
            "timestamp": "2023-01-01T00:00:00Z"
          },
          {
            "status": "SUBMITTED",
            "timestamp": "2023-01-02T00:00:00Z"
          }
        ],
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-02T00:00:00Z"
      }
    }
  }
  ```
- **Error Response**: (404 Not Found)
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Application not found"
    }
  }
  ```

#### Update Application

- **URL**: `/applications/:id`
- **Method**: `PUT`
- **Auth Required**: Yes
- **URL Parameters**:
  - `id`: Application ID
- **Request Body**: (partial updates supported)
  ```json
  {
    "businessName": "Updated Business Name",
    "contactEmail": "new-contact@example.com"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "application": {
        "id": "uuid",
        "businessName": "Updated Business Name",
        "contactEmail": "new-contact@example.com",
        "updatedAt": "2023-01-03T00:00:00Z"
      }
    }
  }
  ```
- **Error Response**: (403 Forbidden)
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "Cannot update a submitted application"
    }
  }
  ```

#### Submit Application

- **URL**: `/applications/:id/submit`
- **Method**: `POST`
- **Auth Required**: Yes
- **URL Parameters**:
  - `id`: Application ID
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "application": {
        "id": "uuid",
        "status": "SUBMITTED",
        "submittedAt": "2023-01-03T00:00:00Z"
      }
    }
  }
  ```
- **Error Response**: (400 Bad Request)
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Cannot submit application",
      "details": {
        "payment": "Payment is required before submission"
      }
    }
  }
  ```

#### Upload Document

- **URL**: `/applications/:id/documents`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content Type**: `multipart/form-data`
- **URL Parameters**:
  - `id`: Application ID
- **Form Data**:
  - `documentType`: Type of document (BUSINESS_LICENSE, ID_PROOF, etc.)
  - `file`: The file to upload
- **Success Response**: (201 Created)
  ```json
  {
    "success": true,
    "data": {
      "document": {
        "id": "uuid",
        "type": "BUSINESS_LICENSE",
        "filename": "license.pdf",
        "size": 1024,
        "uploadedAt": "2023-01-03T00:00:00Z"
      }
    }
  }
  ```

#### Process Payment

- **URL**: `/applications/:id/payment`
- **Method**: `POST`
- **Auth Required**: Yes
- **URL Parameters**:
  - `id`: Application ID
- **Request Body**:
  ```json
  {
    "amount": 100.00,
    "paymentMethod": "BANK_TRANSFER",
    "paymentProof": "base64-encoded-image" // Optional
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "payment": {
        "id": "uuid",
        "amount": 100.00,
        "status": "PENDING_VERIFICATION",
        "timestamp": "2023-01-03T00:00:00Z"
      }
    }
  }
  ```

#### Get Permit Document

- **URL**: `/applications/:id/permit`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `id`: Application ID
- **Success Response**: Binary PDF file with appropriate headers
- **Error Response**: (404 Not Found)
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Permit document not found. Application may not be approved yet."
    }
  }
  ```

### Admin Endpoints

#### Get All Users (Admin)

- **URL**: `/admin/users`
- **Method**: `GET`
- **Auth Required**: Yes (Admin role)
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Results per page (default: 10)
  - `query` (optional): Search by name or email
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "users": [
        {
          "id": "uuid",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "role": "USER",
          "createdAt": "2023-01-01T00:00:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 50,
        "pages": 5
      }
    }
  }
  ```

#### Get All Applications (Admin)

- **URL**: `/admin/applications`
- **Method**: `GET`
- **Auth Required**: Yes (Admin role)
- **Query Parameters**:
  - `status` (optional): Filter by status
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Results per page (default: 10)
  - `sortBy` (optional): Sort field (default: "createdAt")
  - `sortOrder` (optional): "asc" or "desc" (default: "desc")
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "applications": [
        {
          "id": "uuid",
          "status": "SUBMITTED",
          "permitType": "BUSINESS",
          "businessName": "Example Business",
          "submittedAt": "2023-01-02T00:00:00Z",
          "user": {
            "id": "uuid",
            "email": "user@example.com",
            "fullName": "John Doe"
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 100,
        "pages": 10
      }
    }
  }
  ```

#### Update Application Status (Admin)

- **URL**: `/admin/applications/:id/status`
- **Method**: `PUT`
- **Auth Required**: Yes (Admin role)
- **URL Parameters**:
  - `id`: Application ID
- **Request Body**:
  ```json
  {
    "status": "APPROVED",
    "notes": "Application meets all requirements"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "application": {
        "id": "uuid",
        "status": "APPROVED",
        "updatedAt": "2023-01-05T00:00:00Z"
      }
    }
  }
  ```

#### Verify Payment (Admin)

- **URL**: `/admin/applications/:id/verify-payment`
- **Method**: `POST`
- **Auth Required**: Yes (Admin role)
- **URL Parameters**:
  - `id`: Application ID
- **Request Body**:
  ```json
  {
    "verified": true,
    "notes": "Payment confirmation received"
  }
  ```
- **Success Response**: (200 OK)
  ```json
  {
    "success": true,
    "data": {
      "payment": {
        "id": "uuid",
        "status": "VERIFIED",
        "verifiedAt": "2023-01-05T00:00:00Z",
        "verifiedBy": "admin@example.com"
      }
    }
  }
  ```

### System Status

#### Health Check

- **URL**: `/health/liveness`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**: (200 OK)
  ```json
  {
    "status": "UP",
    "timestamp": "2023-01-05T00:00:00Z"
  }
  ```

#### Readiness Check

- **URL**: `/health/readiness`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**: (200 OK)
  ```json
  {
    "status": "READY",
    "components": {
      "database": "UP",
      "storage": "UP",
      "email": "UP"
    },
    "timestamp": "2023-01-05T00:00:00Z"
  }
  ```

## Error Codes

- `VALIDATION_ERROR`: Invalid input data
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource does not exist
- `INVALID_CREDENTIALS`: Wrong username or password
- `INVALID_TOKEN`: Token is invalid or expired
- `DUPLICATE_RESOURCE`: Resource already exists
- `PAYMENT_REQUIRED`: Payment needed before proceeding
- `SERVER_ERROR`: Unexpected server error
- `SERVICE_UNAVAILABLE`: External service unavailable
- `RATE_LIMITED`: Too many requests
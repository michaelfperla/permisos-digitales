# Applications API

Complete documentation for permit application management endpoints.

## Overview

The Applications API allows users to create, manage, and track their permit applications through the entire lifecycle from creation to permit generation.

## Base URL
```
/applications
```

## Authentication
All application endpoints require authentication with role-based access:
- **Client role**: Can manage their own applications
- **Admin role**: Can view and manage all applications

---

## Create Application

### POST /applications

Create a new preliminary permit application.

**Authentication**: Required (Client role)  
**CSRF**: Required  
**Rate Limit**: Standard API rate limit

#### Request Body
```json
{
  "nombre_completo": "Juan Pérez García",
  "curp_rfc": "PEGJ850101HDFRNN09",
  "domicilio": "Calle Principal 123, Col. Centro, Ciudad de México",
  "marca": "Toyota",
  "linea": "Corolla",
  "color": "Rojo",
  "numero_serie": "JTDBL40E899012345",
  "numero_motor": "2ZR1234567",
  "ano_modelo": "2024",
  "email": "juan.perez@example.com"
}
```

#### Validation Rules
| Field | Rules | Description |
|-------|-------|-------------|
| `nombre_completo` | Required, 2-100 chars | Full name of applicant |
| `curp_rfc` | Required, 13-18 chars | CURP or RFC identifier |
| `domicilio` | Required, 10-200 chars | Complete address |
| `marca` | Required, 2-50 chars | Vehicle brand |
| `linea` | Required, 2-50 chars | Vehicle model/line |
| `color` | Required, 3-30 chars | Vehicle color |
| `numero_serie` | Required, 17 chars, alphanumeric | VIN (auto-uppercased) |
| `numero_motor` | Required, 5-20 chars | Engine number |
| `ano_modelo` | Required, 4 digits | Model year (1900-current+1) |
| `email` | Required, valid email | Contact email |

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "applicationId": 12345,
    "status": "AWAITING_PAYMENT",
    "customerId": "cus_abc123def456",
    "amount": 150,
    "expiresAt": "2025-06-25T12:00:00.000Z"
  },
  "message": "Application created successfully. Please proceed with payment."
}
```

#### Error Responses
```json
// Validation Error (422)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "numero_serie",
          "message": "VIN must be exactly 17 characters",
          "code": "INVALID_LENGTH"
        }
      ]
    }
  }
}

// Duplicate Application (409)
{
  "success": false,
  "error": {
    "code": "DUPLICATE_APPLICATION",
    "message": "An active application already exists for this VIN"
  }
}
```

---

## Get User Applications

### GET /applications

Retrieve all applications for the authenticated user.

**Authentication**: Required  
**CSRF**: Not required  
**Pagination**: Supported

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `status` | string | - | Filter by status |
| `sort` | string | createdAt | Sort field |
| `order` | string | desc | Sort order (asc/desc) |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": 12345,
        "status": "PERMIT_READY",
        "nombre_completo": "Juan Pérez García",
        "marca": "Toyota",
        "linea": "Corolla",
        "numero_serie": "JTDBL40E899012345",
        "created_at": "2025-06-20T10:00:00.000Z",
        "permit_valid_until": "2026-06-20T23:59:59.000Z",
        "permit_url": "/applications/12345/pdf-url/permiso",
        "receipt_url": "/applications/12345/pdf-url/recibo"
      }
    ],
    "expiringPermits": [
      {
        "id": 12340,
        "daysUntilExpiration": 5,
        "permit_valid_until": "2025-06-29T23:59:59.000Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## Get Pending Payment Applications

### GET /applications/pending-payment

Retrieve applications awaiting payment.

**Authentication**: Required  
**CSRF**: Not required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": 12346,
        "status": "AWAITING_PAYMENT",
        "amount": 150,
        "created_at": "2025-06-24T08:00:00.000Z",
        "expires_at": "2025-06-25T08:00:00.000Z",
        "customer_id": "cus_abc123def456"
      }
    ]
  }
}
```

---

## Get Application Status

### GET /applications/:id/status

Get detailed status information for a specific application.

**Authentication**: Required  
**CSRF**: Not required  
**Ownership**: User must own the application

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Application ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "application": {
      "id": 12345,
      "status": "PAYMENT_PROCESSING",
      "vehicle": {
        "marca": "Toyota",
        "linea": "Corolla",
        "color": "Rojo",
        "numero_serie": "JTDBL40E899012345",
        "ano_modelo": "2024"
      },
      "owner": {
        "nombre_completo": "Juan Pérez García",
        "curp_rfc": "PEGJ850101HDFRNN09"
      },
      "dates": {
        "created_at": "2025-06-24T10:00:00.000Z",
        "updated_at": "2025-06-24T10:30:00.000Z",
        "permit_valid_until": null
      }
    },
    "statusInfo": {
      "message": "Payment is being processed",
      "canEdit": true,
      "canRenew": false,
      "canDownload": false,
      "nextSteps": "Complete payment to proceed with permit generation"
    },
    "paymentInfo": {
      "method": "oxxo",
      "reference": "123456789012",
      "expiresAt": "2025-06-26T10:00:00.000Z",
      "voucherUrl": "https://payments.stripe.com/oxxo/voucher/..."
    },
    "queueStatus": null
  }
}
```

#### Status-Specific Response Fields

##### When status is `IN_QUEUE` or `PROCESSING_DOCUMENTS`:
```json
{
  "queueStatus": {
    "position": 5,
    "estimatedWaitTime": "10-15 minutes",
    "state": "waiting"
  }
}
```

##### When status is `PERMIT_READY`:
```json
{
  "documents": {
    "permiso": "/applications/12345/pdf-url/permiso",
    "recibo": "/applications/12345/pdf-url/recibo",
    "certificado": "/applications/12345/pdf-url/certificado",
    "placas": "/applications/12345/pdf-url/placas"
  }
}
```

---

## Update Application

### PUT /applications/:id

Update application details (only allowed in PAYMENT_PROCESSING status).

**Authentication**: Required  
**CSRF**: Required  
**Ownership**: User must own the application

#### Request Body
Any of the original application fields can be updated:
```json
{
  "domicilio": "Nueva Calle 456, Col. Reforma, Ciudad de México",
  "color": "Azul"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "application": {
      // Updated application object
    }
  },
  "message": "Application updated successfully"
}
```

#### Error Response (403 Forbidden)
```json
{
  "success": false,
  "error": {
    "code": "UPDATE_NOT_ALLOWED",
    "message": "Application can only be updated while payment is processing"
  }
}
```

---

## Download Permit Documents

### GET /applications/:id/download/:type

Download permit documents as PDF files.

**Authentication**: Required  
**CSRF**: Not required  
**Ownership**: User must own the application

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Application ID |
| `type` | string | Document type: `permiso`, `recibo`, `certificado`, `placas` |

#### Success Response
- **Status**: 200 OK
- **Content-Type**: application/pdf
- **Content-Disposition**: attachment; filename="permiso_12345.pdf"
- **Body**: Binary PDF data

#### Error Responses
```json
// Document Not Found (404)
{
  "success": false,
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document not found or not yet generated"
  }
}

// Application Not Ready (403)
{
  "success": false,
  "error": {
    "code": "PERMIT_NOT_READY",
    "message": "Permit documents are not yet available"
  }
}
```

---

## Get PDF URL

### GET /applications/:id/pdf-url/:type

Get a secure temporary URL for viewing permit documents.

**Authentication**: Required  
**CSRF**: Not required  
**Ownership**: User must own the application

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Application ID |
| `type` | string | Document type: `permiso`, `recibo`, `certificado`, `placas` |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "url": "https://storage.permisos-digitales.com/permits/12345/permiso.pdf?token=...",
    "expiresIn": 3600,
    "documentType": "permiso"
  }
}
```

---

## Check Renewal Eligibility

### GET /applications/:id/renewal-eligibility

Check if a permit is eligible for renewal.

**Authentication**: Required  
**CSRF**: Not required  
**Ownership**: User must own the application

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "daysUntilExpiration": -2,
    "expirationDate": "2025-06-22T23:59:59.000Z",
    "message": "Permit expired 2 days ago. You can renew it now."
  }
}
```

#### Eligibility Rules
- **Eligible**: 7 days before expiration to 15 days after expiration
- **Not Eligible**: More than 7 days before expiration or more than 15 days after

---

## Renew Application

### POST /applications/:id/renew

Create a renewal application based on an existing permit.

**Authentication**: Required  
**CSRF**: Required  
**Ownership**: User must own the original application

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "applicationId": 12347,
    "status": "AWAITING_PAYMENT",
    "amount": 150,
    "originalApplicationId": 12345
  },
  "message": "Renewal application created. Please proceed with payment."
}
```

#### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "NOT_ELIGIBLE_FOR_RENEWAL",
    "message": "This permit is not eligible for renewal at this time"
  }
}
```

---

## Application Status Codes

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `AWAITING_PAYMENT` | Application created, waiting for payment | Make payment |
| `PAYMENT_PROCESSING` | Payment initiated but not confirmed | Complete payment, Edit application |
| `PAYMENT_RECEIVED` | Payment confirmed | Automatic queue entry |
| `IN_QUEUE` | Queued for PDF generation | Wait for processing |
| `PROCESSING_DOCUMENTS` | Generating permit documents | Wait for completion |
| `PERMIT_READY` | Documents ready for download | Download permits, Renew (if eligible) |
| `ACTIVE` | Permit is active and valid | Monitor expiration, Renew (if eligible) |
| `EXPIRED` | Permit has expired | Renew (within 15 days) |
| `ERROR_GENERATING_PERMIT` | PDF generation failed | Contact support |
| `FAILED` | Application failed | Contact support |

---

## Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `APPLICATION_NOT_FOUND` | Application doesn't exist | Check application ID |
| `UNAUTHORIZED_ACCESS` | User doesn't own application | Use correct user account |
| `INVALID_STATUS` | Operation not allowed in current status | Check allowed actions |
| `DUPLICATE_APPLICATION` | Active application exists for VIN | Complete or cancel existing |
| `PAYMENT_EXPIRED` | Payment window expired | Create new application |

---

**Last Updated**: June 24, 2025 | **Version**: 2.0
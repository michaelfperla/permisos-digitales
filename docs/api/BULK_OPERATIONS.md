# Bulk Operations API Documentation

## Overview

The Bulk Operations API allows administrators to perform batch operations on multiple applications and users efficiently. All bulk operations are processed asynchronously and provide operation tracking.

## Authentication

All bulk operation endpoints require:
- Valid authentication session
- Admin portal access (`isAdminPortal`)
- CSRF token for POST/DELETE requests

## Operation Limits

- Applications: Maximum 100 per operation
- Users: Maximum 500 per operation
- Cleanup: Maximum 1000 applications per operation

## Endpoints

### 1. Bulk Update Application Status

Update the status of multiple applications at once.

**Endpoint:** `POST /api/admin/bulk/applications/status`

**Request Body:**
```json
{
  "applicationIds": [1, 2, 3, 4, 5],
  "status": "PERMIT_READY",
  "reason": "Batch processing completed",
  "notify": true
}
```

**Parameters:**
- `applicationIds` (required): Array of application IDs (max 100)
- `status` (required): New status from valid application statuses
- `reason` (optional): Reason for status change
- `notify` (optional): Send email notifications to users (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440000",
    "message": "Operación iniciada",
    "total": 5,
    "trackingUrl": "/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2. Bulk Regenerate PDFs

Queue PDF regeneration for multiple applications.

**Endpoint:** `POST /api/admin/bulk/applications/regenerate-pdf`

**Request Body:**
```json
{
  "applicationIds": [10, 20, 30]
}
```

**Parameters:**
- `applicationIds` (required): Array of application IDs (max 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440001",
    "message": "Operación iniciada",
    "total": 3,
    "trackingUrl": "/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440001"
  }
}
```

### 3. Bulk Send Email Reminders

Send email reminders to users for multiple applications.

**Endpoint:** `POST /api/admin/bulk/applications/send-reminder`

**Request Body:**
```json
{
  "applicationIds": [100, 101, 102],
  "reminderType": "payment_reminder"
}
```

**Parameters:**
- `applicationIds` (required): Array of application IDs (max 100)
- `reminderType` (optional): Type of reminder
  - `payment_reminder` (default)
  - `permit_ready`
  - `expiration_reminder`
  - `custom`

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440002",
    "message": "Operación iniciada",
    "total": 3,
    "trackingUrl": "/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440002"
  }
}
```

### 4. Bulk Export Users

Export user data to CSV format.

**Endpoint:** `POST /api/admin/bulk/users/export`

**Request Body:**
```json
{
  "userIds": [1, 2, 3, 4, 5],
  "includeApplications": true
}
```

**Parameters:**
- `userIds` (required): Array of user IDs (max 500)
- `includeApplications` (optional): Include application details in export (default: false)

**Response:**
- Content-Type: `text/csv; charset=utf-8`
- File download with user data in CSV format

### 5. Bulk Email Users

Send emails to multiple users.

**Endpoint:** `POST /api/admin/bulk/users/email`

**Request Body:**
```json
{
  "userIds": [10, 20, 30],
  "subject": "Important System Update",
  "message": "Dear user, we have important updates regarding your permit...",
  "template": "custom"
}
```

**Parameters:**
- `userIds` (required): Array of user IDs (max 500)
- `subject` (required): Email subject (max 200 characters)
- `message` (required): Email message body (max 5000 characters)
- `template` (optional): Email template to use (default: "custom")

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440003",
    "message": "Operación iniciada",
    "total": 3,
    "trackingUrl": "/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440003"
  }
}
```

### 6. Bulk Cleanup Applications

Delete old expired applications and their associated files.

**Endpoint:** `DELETE /api/admin/bulk/applications/cleanup`

**Request Body:**
```json
{
  "daysOld": 90,
  "statuses": ["EXPIRED", "PAYMENT_EXPIRED"],
  "dryRun": true
}
```

**Parameters:**
- `daysOld` (optional): Minimum age in days (default: 90, minimum: 30)
- `statuses` (optional): Array of statuses to clean up
  - Valid values: `EXPIRED`, `PAYMENT_EXPIRED`, `CANCELLED`, `PAYMENT_FAILED`
  - Default: `["EXPIRED", "PAYMENT_EXPIRED", "CANCELLED"]`
- `dryRun` (optional): Preview what would be deleted without actually deleting (default: true)

**Response (Dry Run):**
```json
{
  "success": true,
  "data": {
    "message": "Modo de prueba - no se eliminaron aplicaciones",
    "count": 25,
    "dryRun": true,
    "preview": [
      {
        "id": 100,
        "status": "EXPIRED",
        "createdAt": "2023-01-15T10:30:00Z",
        "userEmail": "user@example.com"
      }
    ]
  }
}
```

**Response (Actual Cleanup):**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440004",
    "message": "Limpieza iniciada",
    "total": 25,
    "trackingUrl": "/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440004"
  }
}
```

### 7. Get Operation Status

Check the status of any bulk operation.

**Endpoint:** `GET /api/admin/bulk/status/:operationId`

**Parameters:**
- `operationId` (required): The operation ID returned from any bulk operation

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "bulk_op_550e8400-e29b-41d4-a716-446655440000",
    "type": "bulk_status_update",
    "status": "completed",
    "total": 100,
    "processed": 100,
    "succeeded": 95,
    "failed": 5,
    "errors": [
      {
        "applicationId": "123",
        "error": "Aplicación no encontrada"
      }
    ],
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:31:30Z",
    "adminId": 1,
    "parameters": {
      "status": "PERMIT_READY",
      "reason": "Batch processing completed",
      "notify": true
    },
    "duration": 90,
    "successRate": "95.00%"
  }
}
```

## Operation Types

- `bulk_status_update`: Bulk application status update
- `bulk_pdf_regeneration`: Bulk PDF regeneration
- `bulk_send_reminders`: Bulk email reminder sending
- `bulk_email_users`: Bulk user email
- `bulk_cleanup_applications`: Bulk application cleanup

## Operation Statuses

- `processing`: Operation is currently running
- `completed`: Operation finished successfully

## Error Handling

All bulk operations continue processing even if individual items fail. The operation status will include:
- Total number of items processed
- Number of successful operations
- Number of failed operations
- Error details for each failed item

## Best Practices

1. **Use Dry Run**: For destructive operations like cleanup, always run with `dryRun: true` first to preview the impact.

2. **Monitor Progress**: Use the operation status endpoint to track progress, especially for large batches.

3. **Handle Failures**: Check the operation status for failed items and handle them individually if needed.

4. **Respect Limits**: Don't try to bypass operation limits by making multiple simultaneous requests.

5. **Notification Consideration**: Be cautious when using `notify: true` for large batches to avoid overwhelming users with emails.

## Examples

### Example: Bulk Update Status with Notification

```bash
# Get CSRF token
CSRF_TOKEN=$(curl -s -X GET "https://api.permisosdigitales.com.mx/api/admin/csrf-token" \
  -H "Cookie: $SESSION_COOKIE" | jq -r '.csrfToken')

# Perform bulk status update
curl -X POST "https://api.permisosdigitales.com.mx/api/admin/bulk/applications/status" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "applicationIds": [100, 101, 102, 103, 104],
    "status": "PERMIT_READY",
    "reason": "Permits processed and ready for download",
    "notify": true
  }'
```

### Example: Check Operation Progress

```bash
# Check operation status
curl -X GET "https://api.permisosdigitales.com.mx/api/admin/bulk/status/bulk_op_550e8400-e29b-41d4-a716-446655440000" \
  -H "Cookie: $SESSION_COOKIE"
```

### Example: Cleanup Old Applications (Dry Run)

```bash
# Preview cleanup operation
curl -X DELETE "https://api.permisosdigitales.com.mx/api/admin/bulk/applications/cleanup" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "daysOld": 180,
    "statuses": ["EXPIRED", "CANCELLED"],
    "dryRun": true
  }'
```
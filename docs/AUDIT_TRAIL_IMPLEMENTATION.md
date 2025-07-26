# Audit Trail and Activity Logging System

## Overview
A comprehensive audit trail and activity logging system has been implemented for the admin panel to track all administrative actions, monitor security events, and maintain compliance.

## Database Schema

### Tables Created

1. **admin_audit_logs**
   - Tracks all admin actions with detailed change history
   - Fields: id, admin_id, action, entity_type, entity_id, changes (JSONB), ip_address, user_agent, request_id, session_id, metadata, created_at
   - Indexes on: admin_id, entity_type, entity_id, action, created_at, ip_address

2. **admin_security_events**
   - Monitors security-related events and suspicious activities
   - Fields: id, admin_id, event_type, severity, description, ip_address, user_agent, metadata, resolved, resolved_at, resolved_by, created_at
   - Indexes on: admin_id, event_type, severity, created_at, resolved, ip_address

### Enums Created
- `admin_audit_action`: Predefined action types (login, logout, failed_login, view, create, update, delete, etc.)
- `admin_security_event_type`: Security event types (failed_login_attempt, suspicious_activity, unauthorized_access, etc.)
- `security_severity`: Severity levels (info, warning, critical)

## Components

### 1. Audit Service (`src/services/audit.service.js`)
Core service that handles:
- Logging admin actions with change tracking
- Security event detection and logging
- Activity summaries and reporting
- Entity history tracking
- Export functionality (CSV/JSON)

Key methods:
- `logAdminAction()`: Log any admin action
- `getAuditLogs()`: Retrieve logs with filtering
- `getAdminActivity()`: Get admin activity summary
- `getEntityHistory()`: Track changes to specific entities
- `logSecurityEvent()`: Log security-related events
- `exportAuditLogs()`: Export audit data

### 2. Audit Controller (`src/controllers/admin-audit.controller.js`)
RESTful endpoints for audit functionality:
- `GET /admin/audit-logs`: List audit logs with filtering
- `GET /admin/audit-logs/export`: Export audit logs
- `GET /admin/audit-logs/stats`: Get audit statistics
- `GET /admin/audit-logs/:entityType/:entityId`: Get entity history
- `GET /admin/activity/:adminId`: Get specific admin's activity
- `GET /admin/my-activity`: Get current admin's activity
- `GET /admin/security-events`: List security events
- `POST /admin/security-events/:eventId/resolve`: Resolve security event

### 3. Audit Logging Middleware (`src/middleware/audit-logging.middleware.js`)
Automatic logging middleware that:
- Intercepts admin API calls
- Automatically logs actions based on route patterns
- Tracks failed login attempts
- Extracts change data from requests

### 4. Integration Points

#### Admin Controller Integration
- Dashboard stats viewing
- Application list viewing
- Application details viewing
- PDF generation triggering

#### User Management Integration
- User list viewing
- User details viewing
- User modifications

#### Authentication Integration
- Successful admin logins
- Failed admin login attempts
- Admin logouts

## Security Features

### 1. Automatic Security Event Detection
- **Failed Login Monitoring**: Tracks failed login attempts and triggers warnings after threshold
- **Bulk Operation Detection**: Monitors large-scale operations
- **Rapid Access Detection**: Identifies unusual access patterns
- **IP Address Tracking**: Monitors access from new/unusual IP addresses

### 2. Security Thresholds
- Failed login attempts: 5 within 1 hour
- Bulk operation threshold: 50+ records
- Rapid access threshold: 100+ requests per minute
- Large data export threshold: 1000+ records

### 3. Alert System
- Critical security events trigger immediate alerts
- Security team notification for high-severity events
- Automatic tracking of resolution status

## Usage Examples

### Viewing Audit Logs
```bash
GET /admin/audit-logs?action=update&entityType=user&startDate=2025-01-01
```

### Viewing Admin Activity
```bash
GET /admin/activity/123?startDate=2025-01-01&endDate=2025-01-31
```

### Exporting Audit Logs
```bash
GET /admin/audit-logs/export?format=csv&entityType=application
```

### Viewing Entity History
```bash
GET /admin/audit-logs/application/456
```

### Monitoring Security Events
```bash
GET /admin/security-events?severity=warning&resolved=false
```

## Data Privacy

### Sensitive Data Handling
- Passwords, tokens, and API keys are automatically redacted
- Credit card information is never logged
- Personal data is sanitized before logging
- Changes tracking excludes sensitive fields

### Data Retention
- Audit logs should be retained according to compliance requirements
- Regular archival of old logs recommended
- Security events should be reviewed regularly

## Performance Considerations

### Caching
- Admin activity summaries cached for 5 minutes
- Redis used for rate limiting and activity tracking
- Efficient indexing for fast queries

### Optimization
- Pagination on all list endpoints
- Indexed columns for common queries
- JSONB for efficient change storage
- Async logging to prevent blocking

## Compliance Benefits

1. **Accountability**: Every admin action is tracked
2. **Traceability**: Complete history of entity changes
3. **Security Monitoring**: Real-time detection of suspicious activities
4. **Audit Reports**: Easy export for compliance audits
5. **Access Control**: Track who accessed what and when

## Future Enhancements

1. **Dashboard Integration**: Real-time audit activity dashboard
2. **Advanced Analytics**: Pattern detection and anomaly identification
3. **Automated Responses**: Automatic account lockout on suspicious activity
4. **Integration with SIEM**: Export to security information systems
5. **Role-Based Filtering**: Audit log access based on admin roles

## Migration Instructions

Run the migration to create the audit tables:
```bash
npm run migrate up
```

The audit system will automatically start logging once the migration is complete and the server is restarted.
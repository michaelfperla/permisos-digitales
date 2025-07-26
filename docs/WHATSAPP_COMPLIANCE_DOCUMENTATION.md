# WhatsApp Business API Compliance Documentation

## Overview

This document outlines the compliance measures implemented in Permisos Digitales for WhatsApp Business API integration, ensuring adherence to Meta's policies and data protection regulations.

## Table of Contents

1. [Compliance Summary](#compliance-summary)
2. [Data Collection and Consent](#data-collection-and-consent)
3. [Message Types and Usage](#message-types-and-usage)
4. [Opt-Out Mechanisms](#opt-out-mechanisms)
5. [Data Retention and Deletion](#data-retention-and-deletion)
6. [Security Measures](#security-measures)
7. [User Rights](#user-rights)
8. [Audit Trail](#audit-trail)
9. [Technical Implementation](#technical-implementation)

## Compliance Summary

### ✅ Meta Requirements Met
- **Business Verification**: Legal entity registered as "Permisos Digitales"
- **Message Types**: Transactional messages only (no marketing)
- **Opt-Out Support**: Multiple opt-out commands supported
- **Data Protection**: GDPR and Mexican privacy law compliant
- **User Consent**: Explicit opt-in required
- **Data Retention**: 90-day policy for conversations
- **Rate Limiting**: Implemented to prevent spam

### 📋 Legal Compliance
- **Mexican Law**: Ley Federal de Protección de Datos Personales (LFPDPPP)
- **State Law**: Ley 466 de Protección de Datos Personales del Estado de Guerrero
- **International**: GDPR-compliant practices

## Data Collection and Consent

### What We Collect
1. **Phone Number**: WhatsApp-enabled phone number
2. **Conversation Data**: Messages exchanged during permit application
3. **Timestamps**: When messages were sent/received
4. **User Profile**: Name from WhatsApp profile (if shared)

### Consent Mechanism
```javascript
// Consent is tracked when user provides WhatsApp number
whatsapp_consent_date: TIMESTAMP
whatsapp_consent_method: 'web' | 'whatsapp' | 'admin'
whatsapp_consent_ip: IP address of consent
```

### Consent Storage
- Stored in `users` table with timestamp
- Audit trail in `whatsapp_consent_audit` table
- Can be revoked at any time

## Message Types and Usage

### Allowed Message Types
1. **Payment Confirmations**
   - Sent immediately after successful payment
   - Contains transaction details

2. **Permit Ready Notifications**
   - Sent when permit PDF is generated
   - Includes secure download link (48-hour expiry)

3. **Application Status Updates**
   - Processing confirmations
   - Error notifications

4. **User-Initiated Conversations**
   - Responses to user commands
   - Form collection for permit applications

### Prohibited Uses
- ❌ Marketing messages
- ❌ Promotional content
- ❌ Third-party advertisements
- ❌ Bulk messaging campaigns
- ❌ Messages outside business context

## Opt-Out Mechanisms

### Supported Commands
Users can opt-out using any of these commands:
- `STOP`
- `BAJA`
- `DETENER`
- `CANCELAR SUSCRIPCION`
- `NO MAS MENSAJES`

### Opt-Out Process
1. User sends opt-out command
2. System immediately:
   - Adds phone to `whatsapp_optout_list`
   - Sets `whatsapp_opted_out = true` in user record
   - Removes phone number from user profile
   - Logs action in audit trail
3. Sends confirmation message
4. Blocks all future messages

### Opt-Out Storage
```sql
whatsapp_optout_list:
  - phone_number (unique)
  - user_id
  - opted_out_at
  - opt_out_source
  - opt_out_reason
```

## Data Retention and Deletion

### Retention Periods
| Data Type | Retention Period | Reason |
|-----------|-----------------|---------|
| Conversations (Redis) | 1 hour | Technical session management |
| Notification Records | 90 days | Service quality monitoring |
| Consent Audit Logs | 2 years | Legal compliance |
| Deleted User Archives | 5 years | Legal requirements |
| Opt-Out List | Permanent | Compliance requirement |

### Automatic Deletion
- Daily job runs at 2 AM (`whatsapp-data-retention.job.js`)
- Deletes data past retention period
- Archives required data before deletion

### User-Requested Deletion
Users can request immediate deletion via:
1. **API Endpoint**: `DELETE /api/user/account`
2. **WhatsApp Command**: Coming soon
3. **Email Request**: datospersonales@permisosdigitales.com.mx

### Deletion Process
```javascript
// Function: delete_user_whatsapp_data(user_id)
1. Delete all WhatsApp notifications
2. Delete consent audit records
3. Clear WhatsApp phone from profile
4. Add to permanent opt-out list
5. Return deletion summary
```

## Security Measures

### Data Protection
1. **Encryption in Transit**: All WhatsApp messages use end-to-end encryption
2. **Secure Storage**: Phone numbers stored in encrypted RDS database
3. **Access Control**: Role-based access to WhatsApp data
4. **Audit Logging**: All data access is logged

### Rate Limiting
- 20 messages per minute per user
- Prevents spam and abuse
- Automatic blocking for violations

### Phone Number Validation
```javascript
// Mexican WhatsApp format: 52XXXXXXXXXX
validateWhatsAppPhone(phone) {
  return /^52\d{10}$/.test(phone);
}
```

## User Rights

### ARCO Rights (Mexican Law)
1. **Acceso (Access)**: Users can request all their WhatsApp data
2. **Rectificación (Rectification)**: Users can correct their phone number
3. **Cancelación (Cancellation)**: Users can delete their WhatsApp data
4. **Oposición (Opposition)**: Users can opt-out of WhatsApp service

### Implementation
- **Data Export**: `GET /api/user/data-export`
- **Update Phone**: `PUT /api/user/whatsapp-notifications`
- **Delete Account**: `DELETE /api/user/account`
- **Opt-Out**: Send "STOP" via WhatsApp

### Response Times
- Opt-out: Immediate
- Data requests: Within 20 business days
- Deletion: Immediate (with confirmations)

## Audit Trail

### What We Track
```javascript
whatsapp_consent_audit:
  - user_id
  - phone_number
  - action: 'consent_given' | 'consent_revoked' | 'opted_out'
  - previous_state (JSON)
  - new_state (JSON)
  - ip_address
  - user_agent
  - source: 'web' | 'whatsapp' | 'admin'
  - timestamp
```

### Audit Events
1. Consent given (opt-in)
2. Consent revoked (opt-out)
3. Phone number changed
4. Data deletion requested
5. Admin actions on user data

## Technical Implementation

### Database Schema Additions
```sql
-- User consent tracking
ALTER TABLE users ADD:
  - whatsapp_consent_date TIMESTAMP
  - whatsapp_opted_out BOOLEAN DEFAULT FALSE
  - whatsapp_optout_date TIMESTAMP
  - whatsapp_consent_ip VARCHAR(45)
  - whatsapp_consent_method VARCHAR(20)

-- Opt-out management
CREATE TABLE whatsapp_optout_list
CREATE TABLE whatsapp_consent_audit
CREATE TABLE deleted_users_archive
```

### Key Files
- `/src/services/whatsapp/simple-whatsapp.service.js` - Main WhatsApp service
- `/src/controllers/user.controller.js` - User data management
- `/src/jobs/whatsapp-data-retention.job.js` - Retention policy enforcement
- `/src/db/migrations/20250125_whatsapp_consent_tracking.sql` - Database changes

### API Endpoints
```
DELETE /api/user/account - Delete user account
GET /api/user/data-export - Export all user data
PUT /api/user/whatsapp-notifications - Toggle WhatsApp service
```

## Monitoring and Reporting

### Metrics Tracked
- Total opt-ins/opt-outs per day
- Message delivery rates
- Consent audit trail
- Data retention compliance

### Compliance Reports
Monthly reports include:
- Active WhatsApp users
- Opt-out rates
- Data deletion requests
- Retention policy execution

## Contact Information

### Data Protection Officer
- Email: datospersonales@permisosdigitales.com.mx
- Phone: +52 55 4943 0313

### Technical Support
- Email: soporte@permisosdigitales.com.mx
- WhatsApp: +52 55 4943 0313

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-25 | Initial compliance implementation |

## Appendix: Legal References

1. **Meta WhatsApp Business Policy**: https://www.whatsapp.com/legal/business-policy
2. **Mexican Privacy Law**: http://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
3. **Guerrero State Law 466**: https://congresogro.gob.mx/
4. **GDPR Guidelines**: https://gdpr.eu/
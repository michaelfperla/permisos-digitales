# Database Data Type Analysis - Based on JavaScript Code Usage

This document analyzes the actual data types for all database columns based on how they're used in the JavaScript code, SQL queries, and data passed to/from the database.

## Table: permit_applications

### Primary Key and IDs
- **id**: INTEGER/SERIAL
  - Evidence: Used in WHERE clauses with numeric comparisons, CAST(pa.id AS TEXT) shows it's numeric
  - Never generated in code, uses database auto-increment
  
- **user_id**: INTEGER NOT NULL
  - Evidence: Foreign key to users.id, passed as numeric userId parameter
  - JOIN condition: `pa.user_id = u.id`

### Status Fields
- **status**: VARCHAR(50) NOT NULL
  - Evidence: Compared to string constants like 'PERMIT_READY', 'AWAITING_PAYMENT'
  - Values from ApplicationStatus constants (all uppercase strings)
  
### Personal Information
- **nombre_completo**: VARCHAR(255)
  - Evidence: Used with ILIKE for pattern matching, user's full name
  
- **curp_rfc**: VARCHAR(20)
  - Evidence: Used with ILIKE for pattern matching, Mexican tax ID format
  
- **domicilio**: TEXT
  - Evidence: Address field, likely longer text

### Vehicle Information
- **marca**: VARCHAR(100)
  - Evidence: Used with ILIKE for pattern matching, vehicle brand
  
- **linea**: VARCHAR(100)
  - Evidence: Used with ILIKE for pattern matching, vehicle model/line
  
- **ano_modelo**: INTEGER
  - Evidence: Year value, used in numeric contexts
  
- **color**: VARCHAR(50)
  - Evidence: Vehicle color, short text field
  
- **numero_serie**: VARCHAR(50)
  - Evidence: VIN/serial number
  
- **numero_motor**: VARCHAR(50)
  - Evidence: Engine number

### Financial Fields
- **importe**: DECIMAL(10,2)
  - Evidence: Monetary amount, used for payment values
  - Passed as numeric values in JavaScript
  
- **payment_reference**: VARCHAR(100)
  - Evidence: Stores OXXO reference numbers and payment identifiers

### Date/Time Fields
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  - Evidence: Uses CURRENT_TIMESTAMP, date arithmetic with INTERVAL
  
- **updated_at**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - Evidence: Updated with NOW() or CURRENT_TIMESTAMP
  
- **fecha_vencimiento**: DATE
  - Evidence: `fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')`
  - Date arithmetic suggests DATE type
  
- **fecha_expedicion**: DATE
  - Evidence: Permit issue date
  
- **expires_at**: TIMESTAMP
  - Evidence: `expires_at > NOW()` comparison
  
- **payment_initiated_at**: TIMESTAMP
  - Evidence: Timestamp for payment start

### File Paths
- **permit_file_path**: VARCHAR(500)
  - Evidence: Stores S3 or local file paths
  
- **certificado_file_path**: VARCHAR(500)
  - Evidence: Certificate file path
  
- **placas_file_path**: VARCHAR(500)
  - Evidence: License plate file path

### Queue Management Fields
- **queue_status**: VARCHAR(20)
  - Evidence: Values like 'queued', 'processing', 'completed', 'failed'
  
- **queue_position**: INTEGER
  - Evidence: Numeric position in queue
  
- **queue_entered_at**: TIMESTAMP
  - Evidence: When entered queue
  
- **queue_started_at**: TIMESTAMP
  - Evidence: When processing started
  
- **queue_completed_at**: TIMESTAMP
  - Evidence: When processing completed
  
- **queue_duration_ms**: INTEGER
  - Evidence: Duration in milliseconds
  
- **queue_error**: TEXT
  - Evidence: Error message storage
  
- **queue_job_id**: VARCHAR(100)
  - Evidence: Bull queue job identifier

### Error Tracking Fields
- **puppeteer_error_at**: TIMESTAMP
  - Evidence: `(NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours'`
  
- **puppeteer_error_message**: TEXT
  - Evidence: Used with LIKE for pattern matching on error messages
  
- **puppeteer_screenshot_path**: VARCHAR(500)
  - Evidence: Screenshot file path

### Administrative Fields
- **admin_resolution_notes**: TEXT
  - Evidence: Long text for admin notes
  
- **resolved_by_admin**: INTEGER
  - Evidence: Foreign key to users.id
  
- **resolved_at**: TIMESTAMP
  - Evidence: Resolution timestamp

### Payment Processing
- **payment_processor_order_id**: VARCHAR(255)
  - Evidence: Stores Stripe payment intent IDs
  
- **folio**: VARCHAR(50)
  - Evidence: Government-issued folio number

### Renewal Fields
- **renewed_from_id**: INTEGER
  - Evidence: Self-referencing foreign key to permit_applications.id
  
- **renewal_count**: INTEGER DEFAULT 0
  - Evidence: Numeric counter

### Constraints
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- FOREIGN KEY (resolved_by_admin) REFERENCES users(id)
- FOREIGN KEY (renewed_from_id) REFERENCES permit_applications(id)
- NOT NULL: user_id, status, created_at
- CHECK: status IN (ApplicationStatus values)

## Table: users

### Primary Key
- **id**: INTEGER/SERIAL
  - Evidence: Used in numeric comparisons, auto-generated

### Authentication
- **email**: VARCHAR(255) UNIQUE NOT NULL
  - Evidence: `WHERE email = $1`, used as unique identifier
  
- **password_hash**: VARCHAR(255) NOT NULL
  - Evidence: Stores bcrypt hash

### Personal Information
- **first_name**: VARCHAR(100)
  - Evidence: Used with ILIKE for pattern matching
  
- **last_name**: VARCHAR(100)
  - Evidence: Used with ILIKE for pattern matching
  
- **phone**: VARCHAR(20)
  - Evidence: Phone number storage

### Account Management
- **account_type**: VARCHAR(20)
  - Evidence: User account type classification
  
- **is_admin_portal**: BOOLEAN DEFAULT FALSE
  - Evidence: Boolean flag for admin access
  
- **role**: VARCHAR(50)
  - Evidence: User role designation
  
- **account_status**: VARCHAR(20) DEFAULT 'active'
  - Evidence: Values like 'active', 'suspended', 'locked'
  
- **is_email_verified**: BOOLEAN DEFAULT FALSE
  - Evidence: Email verification status

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- **updated_at**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **last_login_at**: TIMESTAMP
  - Evidence: Login tracking

### Email Verification
- **email_verification_token**: VARCHAR(255)
  - Evidence: Verification token storage
  
- **email_verification_expires**: TIMESTAMP
  - Evidence: Token expiration

### Administrative
- **created_by**: INTEGER
  - Evidence: Foreign key to users.id, tracks who created the account

### Constraints
- PRIMARY KEY (id)
- UNIQUE (email)
- FOREIGN KEY (created_by) REFERENCES users(id)
- NOT NULL: email, password_hash

## Table: payment_events

### Primary Key
- **id**: INTEGER/SERIAL (implied)
  - Evidence: Not explicitly referenced but standard practice

### Foreign Keys
- **application_id**: INTEGER NOT NULL
  - Evidence: References permit_applications.id
  
- **order_id**: VARCHAR(255) NOT NULL
  - Evidence: Stores payment processor order/intent IDs

### Event Data
- **event_type**: VARCHAR(50) NOT NULL
  - Evidence: Values like 'oxxo.payment.created', 'payment.succeeded'
  
- **event_data**: JSONB NOT NULL
  - Evidence: `JSON.stringify(eventData)` used, JSONB operators ->>, ->

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### Constraints
- FOREIGN KEY (application_id) REFERENCES permit_applications(id)
- NOT NULL: application_id, order_id, event_type, event_data

## Table: webhook_events

### Primary Key
- **event_id**: VARCHAR(255) PRIMARY KEY
  - Evidence: `ON CONFLICT (event_id)`, Stripe event IDs

### Event Data
- **event_type**: VARCHAR(100) NOT NULL
  - Evidence: Webhook event types
  
- **event_data**: JSONB NOT NULL
  - Evidence: JSON event payload
  
- **processing_status**: VARCHAR(20) NOT NULL DEFAULT 'pending'
  - Evidence: Values 'pending', 'processed', 'failed'
  - Type casting: `$1::varchar`

### Processing Fields
- **last_error**: TEXT
  - Evidence: Error message storage
  
- **retry_count**: INTEGER DEFAULT 0
  - Evidence: `retry_count + 1` arithmetic
  
- **processed_at**: TIMESTAMP
  - Evidence: Set when status = 'processed'

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### Constraints
- PRIMARY KEY (event_id)
- UNIQUE (event_id) for ON CONFLICT

## Table: security_audit_log

### Primary Key
- **id**: INTEGER/SERIAL
  - Evidence: RETURNING id in INSERT

### Audit Fields
- **user_id**: INTEGER
  - Evidence: Can be NULL for anonymous actions
  
- **action_type**: VARCHAR(50) NOT NULL
  - Evidence: Values like 'failed_login', 'csrf_violation'
  
- **ip_address**: VARCHAR(45) NOT NULL
  - Evidence: IPv4/IPv6 address storage
  
- **user_agent**: TEXT
  - Evidence: Browser user agent string
  
- **details**: JSONB
  - Evidence: `JSON.stringify(details)`, `details::jsonb ->> 'email'`

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### Constraints
- FOREIGN KEY (user_id) REFERENCES users(id)
- Indexes on: ip_address, action_type, created_at for performance

## Table: password_reset_tokens

### Primary Key
- **id**: INTEGER/SERIAL (implied)

### Token Fields
- **user_id**: INTEGER NOT NULL
  - Evidence: Foreign key to users.id
  
- **token**: VARCHAR(255) NOT NULL UNIQUE
  - Evidence: Reset token storage
  
- **expires_at**: TIMESTAMP NOT NULL
  - Evidence: `NOW() + INTERVAL $3 * '1 hour'::INTERVAL`
  
- **used_at**: TIMESTAMP
  - Evidence: NULL until used, then set to CURRENT_TIMESTAMP

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### Constraints
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE (token)
- Index on token for fast lookups

## Table: payment_recovery_attempts

### Primary Key
- **id**: INTEGER/SERIAL
  - Evidence: RETURNING id in DELETE, never inserted by code

### Recovery Fields
- **application_id**: INTEGER NOT NULL
  - Evidence: Foreign key to permit_applications.id
  
- **payment_intent_id**: VARCHAR(255) NOT NULL
  - Evidence: Stripe payment intent ID
  
- **attempt_count**: INTEGER DEFAULT 1
  - Evidence: `payment_recovery_attempts.attempt_count + 1`
  
- **last_attempt_time**: TIMESTAMP NOT NULL
  - Evidence: `new Date()` passed from JavaScript
  
- **last_error**: TEXT
  - Evidence: Error message storage, can be NULL
  
- **recovery_status**: VARCHAR(50) NOT NULL DEFAULT 'recovering'
  - Evidence: Values 'pending', 'recovering', 'succeeded', 'failed', 'max_attempts_reached'

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- **updated_at**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Constraints
- PRIMARY KEY (id)
- UNIQUE (application_id, payment_intent_id)
- FOREIGN KEY (application_id) REFERENCES permit_applications(id)

## Table: email_queue

### Primary Key
- **id**: INTEGER/SERIAL (implied from Knex usage)

### Email Fields
- **recipient_email**: VARCHAR(255) NOT NULL
- **recipient_name**: VARCHAR(255)
- **subject**: VARCHAR(500) NOT NULL
- **template_name**: VARCHAR(100)
- **template_data**: JSONB
- **html_body**: TEXT
- **text_body**: TEXT

### Queue Management
- **status**: VARCHAR(20) NOT NULL DEFAULT 'pending'
  - Evidence: Values 'pending', 'processing', 'sent', 'failed'
  
- **priority**: VARCHAR(10) DEFAULT 'normal'
  - Evidence: Values like 'high', 'normal', 'low'
  
- **scheduled_for**: TIMESTAMP
  - Evidence: NULL for immediate, timestamp for scheduled
  
- **next_retry_at**: TIMESTAMP
  - Evidence: Retry scheduling
  
- **retry_count**: INTEGER DEFAULT 0
- **metadata**: JSONB

### Timestamps
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- **updated_at**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **sent_at**: TIMESTAMP
- **failed_at**: TIMESTAMP

### Constraints
- NOT NULL: recipient_email, subject, status
- Indexes on: status, priority, scheduled_for for queue processing

## Table: email_reminders

### Primary Key
- **id**: INTEGER/SERIAL (implied)

### Reminder Fields
- **application_id**: INTEGER NOT NULL
- **user_id**: INTEGER NOT NULL
- **reminder_type**: VARCHAR(50) NOT NULL
  - Evidence: Values like 'expiration_warning'
  
- **email_address**: VARCHAR(255) NOT NULL
- **expires_at**: TIMESTAMP NOT NULL

### Timestamps
- **sent_at**: TIMESTAMP NOT NULL
- **created_at**: TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- **updated_at**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Constraints
- UNIQUE (application_id, reminder_type) for ON CONFLICT
- FOREIGN KEY (application_id) REFERENCES permit_applications(id)
- FOREIGN KEY (user_id) REFERENCES users(id)

## Key PostgreSQL Features Used

1. **JSONB Data Type**:
   - event_data, details, template_data, metadata fields
   - Operators: ->>, ->, ::jsonb casting

2. **Date/Time Operations**:
   - INTERVAL arithmetic: `NOW() + INTERVAL '30 days'`
   - CURRENT_DATE, CURRENT_TIMESTAMP, NOW()
   - EXTRACT(EPOCH FROM ...) for millisecond calculations

3. **Advanced SQL**:
   - CTEs (WITH clauses) for complex queries
   - Window functions: ROW_NUMBER() OVER (PARTITION BY...)
   - ON CONFLICT for upserts
   - FOR UPDATE NOWAIT/SKIP LOCKED for row locking

4. **Type Casting**:
   - ::numeric, ::varchar, ::date, ::INTERVAL
   - CAST(column AS TEXT)

5. **String Operations**:
   - ILIKE for case-insensitive matching
   - CONCAT for string concatenation
   - || operator for concatenation

## Data Type Summary

- **IDs**: INTEGER with SERIAL/auto-increment (no UUIDs used)
- **Status/Type fields**: VARCHAR with appropriate lengths
- **Timestamps**: TIMESTAMP for precise time tracking
- **Dates**: DATE for date-only fields (fecha_vencimiento)
- **Money**: DECIMAL(10,2) for amounts
- **JSON Data**: JSONB for flexible structured data
- **File Paths**: VARCHAR(500) for S3/local paths
- **Long Text**: TEXT for descriptions, errors, notes
- **Booleans**: BOOLEAN for flags
- **Counters**: INTEGER for numeric counts
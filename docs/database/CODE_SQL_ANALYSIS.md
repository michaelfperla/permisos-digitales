# Code SQL Analysis - Exact SQL Queries from Repository Files

This document contains the exact SQL queries found in the repository files. Only actual SQL strings and column references are documented - no assumptions about data types or structures.

## application.repository.js

### Table: permit_applications

#### SELECT Query with JOIN (lines 21-34):
```sql
SELECT COUNT(*)
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id

SELECT pa.id, pa.status, pa.created_at,
       pa.payment_reference, pa.nombre_completo, pa.marca, pa.linea, pa.ano_modelo,
       u.email as user_email
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
```
**Columns**: id, status, created_at, payment_reference, nombre_completo, marca, linea, ano_modelo, user_id
**Joins**: users ON pa.user_id = u.id
**Special features**: WHERE conditions with date casting, ILIKE pattern matching, CAST(pa.id AS TEXT)

#### SELECT Query (lines 98-122):
```sql
SELECT
  id,
  status,
  nombre_completo,
  marca,
  linea,
  ano_modelo,
  color,
  numero_serie,
  numero_motor,
  curp_rfc,
  domicilio,
  importe,
  folio,
  fecha_vencimiento,
  created_at,
  updated_at,
  permit_file_path,
  certificado_file_path,
  placas_file_path
FROM permit_applications
WHERE user_id = $1
ORDER BY created_at DESC
```

#### SELECT Query - Expiring Permits (lines 136-153):
```sql
SELECT
  id,
  status,
  nombre_completo,
  marca,
  linea,
  ano_modelo,
  fecha_vencimiento,
  created_at
FROM permit_applications
WHERE user_id = $1
  AND status = 'PERMIT_READY'
  AND fecha_vencimiento IS NOT NULL
  AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')
  AND fecha_vencimiento >= CURRENT_DATE
```
**Special features**: PostgreSQL INTERVAL, CURRENT_DATE

#### SELECT Query - Pending Payments (lines 167-184):
```sql
SELECT
  id,
  status,
  nombre_completo,
  marca,
  linea,
  ano_modelo,
  importe,
  created_at,
  expires_at,
  payment_initiated_at
FROM permit_applications
WHERE user_id = $1
  AND status IN ('AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING')
  AND expires_at > NOW()
```

#### SELECT Query - Dashboard Stats (lines 198-210):
```sql
SELECT status, COUNT(*) as count
FROM permit_applications
GROUP BY status

SELECT COUNT(*) as count
FROM permit_applications
WHERE status = $1
```

#### SELECT Query - Queue Status (lines 233-244):
```sql
SELECT 
  queue_status,
  queue_position,
  queue_entered_at,
  queue_started_at,
  queue_completed_at,
  queue_duration_ms,
  queue_error
FROM permit_applications
WHERE id = $1
```

#### SELECT Query - Failed Applications with Complex JOIN (lines 287-342):
```sql
SELECT 
  pa.id,
  pa.user_id,
  CONCAT(u.first_name, ' ', u.last_name) as user_name,
  u.email as user_email,
  u.phone as user_phone,
  pa.puppeteer_error_at as error_time,
  pa.puppeteer_error_message as error_message,
  pa.puppeteer_screenshot_path as screenshot_path,
  -- additional columns omitted for brevity
  CASE 
    WHEN pa.puppeteer_error_message LIKE '%timeout%' THEN 'TIMEOUT'
    -- more CASE statements
  END as error_category,
  CASE 
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours' THEN 'CRITICAL'
    -- more CASE statements
  END as severity
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status = $1
  AND pa.puppeteer_error_at IS NOT NULL
```
**Special features**: CONCAT, CASE statements, INTERVAL calculations

#### UPDATE Query (lines 391-400):
```sql
UPDATE permit_applications
SET 
  admin_resolution_notes = $1,
  resolved_by_admin = $2,
  resolved_at = $3,
  updated_at = NOW()
WHERE id = $4
```

#### SELECT Query with OXXO Details JOIN (lines 459-472):
```sql
SELECT
  app.*,
  p.event_data ->> 'oxxoReference' AS oxxo_reference,
  p.event_data ->> 'hostedVoucherUrl' AS hosted_voucher_url,
  p.event_data ->> 'expiresAt' AS oxxo_expires_at
FROM permit_applications app
LEFT JOIN payment_events p ON app.id = p.application_id 
  AND p.event_type = 'oxxo.payment.created'
  AND app.payment_processor_order_id = p.order_id
WHERE app.id = $1
```
**Special features**: JSONB operator ->>, LEFT JOIN with multiple conditions

#### INSERT Query - Renewal Application (lines 644-651):
```sql
INSERT INTO permit_applications (
  user_id, nombre_completo, curp_rfc, domicilio,
  marca, linea, color, numero_serie, numero_motor,
  ano_modelo, renewed_from_id, renewal_count, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id, status, created_at
```

#### SELECT Query with FOR UPDATE Lock (lines 911-917):
```sql
SELECT id, status, payment_processor_order_id, user_id, folio
FROM permit_applications 
WHERE id = $1 
FOR UPDATE NOWAIT
```
**Special features**: FOR UPDATE NOWAIT row locking

#### UPDATE Query - Puppeteer Error (lines 946-956):
```sql
UPDATE permit_applications 
SET status = $1,
    puppeteer_error_message = $2,
    puppeteer_error_at = $3,
    puppeteer_screenshot_path = $4,
    queue_status = 'failed',
    updated_at = NOW()
WHERE id = $5
```

#### SELECT Query - Expiring Permits with User Info JOIN (lines 1225-1244):
```sql
SELECT
  pa.id as application_id,
  pa.folio,
  pa.marca,
  pa.linea,
  pa.ano_modelo,
  pa.fecha_vencimiento,
  (pa.fecha_vencimiento - CURRENT_DATE) AS days_remaining,
  u.email as user_email,
  u.first_name,
  u.last_name
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status = 'PERMIT_READY'
  AND pa.fecha_vencimiento IS NOT NULL
  AND pa.fecha_vencimiento > CURRENT_DATE
  AND pa.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 day' * $1)
```

## payment.repository.js

### Table: payment_events

#### INSERT Query (lines 22-25):
```sql
INSERT INTO payment_events (application_id, order_id, event_type, event_data, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
RETURNING *
```
**Columns**: application_id, order_id, event_type, event_data, created_at
**Special features**: JSONB data type for event_data (JSON.stringify used)

### Table: permit_applications

#### UPDATE Query with OXXO Reference (lines 50-58):
```sql
UPDATE permit_applications
SET payment_processor_order_id = $1,
    status = $2,
    payment_reference = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $4
RETURNING *
```

#### SELECT Query (lines 124-127):
```sql
SELECT * FROM permit_applications
WHERE payment_processor_order_id = $1
```

#### SELECT Query - Payment Info (lines 154-163):
```sql
SELECT
  payment_processor_order_id as order_id,
  status,
  payment_reference,
  'stripe' as payment_method,
  updated_at
FROM permit_applications
WHERE id = $1
```

#### SELECT Query with JOIN - Pending Payments (lines 175-185):
```sql
SELECT pa.id, pa.status, pa.created_at, pa.updated_at,
       pa.payment_processor_order_id, pa.nombre_completo as applicant_name,
       pa.marca, pa.linea, pa.ano_modelo, pa.importe as amount,
       u.email as applicant_email, pa.curp_rfc
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status = $1
ORDER BY pa.updated_at DESC
LIMIT $2 OFFSET $3
```

### Table: webhook_events

#### SELECT Query (lines 197-201):
```sql
SELECT * FROM webhook_events
WHERE event_id = $1
```

#### INSERT Query with ON CONFLICT (lines 212-217):
```sql
INSERT INTO webhook_events (event_id, event_type, event_data, processing_status, created_at)
VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (event_id) DO NOTHING
RETURNING *
```
**Special features**: ON CONFLICT clause

#### UPDATE Query (lines 238-246):
```sql
UPDATE webhook_events 
SET processing_status = $1::varchar,
    last_error = $2,
    processed_at = CASE WHEN $1::varchar = 'processed' THEN CURRENT_TIMESTAMP ELSE processed_at END,
    retry_count = CASE WHEN $1::varchar = 'failed' THEN retry_count + 1 ELSE retry_count END
WHERE event_id = $3
RETURNING *
```
**Special features**: Type casting ::varchar, CASE statements

#### SELECT Query - Expiring OXXO Payments with CTE (lines 476-511):
```sql
WITH latest_oxxo_events AS (
  SELECT
    pe.application_id,
    pe.order_id,
    pe.event_data->>'oxxoReference' as oxxo_reference,
    (pe.event_data->>'expiresAt')::numeric as expires_at,
    ROW_NUMBER() OVER (PARTITION BY pe.application_id ORDER BY pe.created_at DESC) as rn
  FROM payment_events pe
  WHERE pe.event_type = 'oxxo.payment.created'
  AND (pe.event_data->>'expiresAt')::numeric IS NOT NULL
)
SELECT
  pa.id as application_id,
  pa.user_id,
  -- additional columns
  le.order_id,
  le.oxxo_reference,
  le.expires_at,
  to_timestamp(le.expires_at) as expires_at_date
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
JOIN latest_oxxo_events le ON pa.id = le.application_id AND le.rn = 1
WHERE pa.status = $1
  AND le.expires_at > $2
  AND le.expires_at <= $3
```
**Special features**: CTE (WITH clause), Window function (ROW_NUMBER), JSONB operators, type casting

## user.repository.js

### Table: users

#### SELECT Query (line 12):
```sql
SELECT * FROM users WHERE email = $1
```

#### SELECT Query with Pagination (lines 59-63):
```sql
SELECT id, email, first_name, last_name, account_type, is_admin_portal, created_at, updated_at
FROM users
WHERE 1=1
```
**Additional WHERE clauses**: account_type, ILIKE pattern matching on email/first_name/last_name

#### INSERT Query (lines 115-120):
```sql
INSERT INTO users
(email, password_hash, first_name, last_name, account_type, created_by, is_admin_portal)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, email, first_name, last_name, account_type, is_admin_portal, created_at
```

#### UPDATE Query (lines 140-145):
```sql
UPDATE users
SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2
RETURNING id
```

### Table: security_audit_log

#### SELECT Query (lines 161-167):
```sql
SELECT id, action_type, ip_address, user_agent, details, created_at
FROM security_audit_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
```

#### SELECT Query with LEFT JOIN (lines 191-201):
```sql
SELECT
  u.id, u.email, u.first_name, u.last_name,
  u.account_type, u.is_admin_portal, u.created_at, u.updated_at,
  u.role, u.created_by,
  creator.first_name as created_by_first_name,
  creator.last_name as created_by_last_name
FROM users u
LEFT JOIN users creator ON u.created_by = creator.id
WHERE u.id = $1
```

#### UPDATE Query - Email Verification (lines 228-237):
```sql
UPDATE users 
SET email_verification_token = $1, 
    email_verification_expires = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $3
RETURNING id, email
```

### Table: password_reset_tokens

#### DELETE Query (lines 263-265):
```sql
DELETE FROM password_reset_tokens WHERE user_id = $1
```

#### INSERT Query (lines 269-273):
```sql
INSERT INTO password_reset_tokens (user_id, token, expires_at)
VALUES ($1, $2, $3)
RETURNING token
```

#### Complex SELECT Query with Aggregation (lines 296-320):
```sql
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.is_email_verified,
  u.account_status,
  u.created_at,
  u.last_login_at,
  prt.expires_at,
  prt.used_at,
  COUNT(DISTINCT prt_active.id) as active_reset_tokens,
  MAX(prt_active.created_at) as last_reset_request
FROM password_reset_tokens prt
INNER JOIN users u ON prt.user_id = u.id
LEFT JOIN password_reset_tokens prt_active ON u.id = prt_active.user_id 
  AND prt_active.expires_at > CURRENT_TIMESTAMP 
  AND prt_active.used_at IS NULL
WHERE prt.token = $1
GROUP BY u.id, u.email, u.first_name, u.last_name, 
         u.is_email_verified, u.account_status, 
         u.created_at, u.last_login_at,
         prt.expires_at, prt.used_at
```

#### Transaction-based Password Reset (lines 487-533):
```sql
BEGIN

SELECT 
  u.id,
  prt.expires_at,
  prt.used_at
FROM password_reset_tokens prt
INNER JOIN users u ON prt.user_id = u.id
WHERE prt.token = $1

UPDATE users
SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2

UPDATE password_reset_tokens
SET used_at = CURRENT_TIMESTAMP
WHERE token = $1

COMMIT
```
**Special features**: Transaction control (BEGIN, COMMIT, ROLLBACK)

## security.repository.js

### Table: security_audit_log

#### INSERT Query (lines 24-29):
```sql
INSERT INTO security_audit_log
(user_id, action_type, ip_address, user_agent, details)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, action_type, created_at
```
**Columns**: user_id, action_type, ip_address, user_agent, details (JSONB)

#### SELECT Query with Time Window (lines 55-61):
```sql
SELECT COUNT(*) as attempt_count
FROM security_audit_log
WHERE ip_address = $1
  AND action_type = $2
  AND created_at > NOW() - ($3 || ' minute')::INTERVAL
```
**Special features**: String concatenation with ||, INTERVAL casting

#### SELECT Queries for Suspicious Activity (lines 82-113):
```sql
SELECT ip_address, COUNT(*) as count
FROM security_audit_log
WHERE action_type = 'failed_login'
  AND created_at > NOW() - ($2 || ' hour')::INTERVAL
GROUP BY ip_address
HAVING COUNT(*) >= $1
ORDER BY count DESC

SELECT ip_address, user_agent, details, created_at
FROM security_audit_log
WHERE action_type = 'csrf_violation'
  AND created_at > NOW() - INTERVAL $1 * '1 hour'::INTERVAL
ORDER BY created_at DESC
```

### Table: password_reset_tokens

#### INSERT Query (lines 138-143):
```sql
INSERT INTO password_reset_tokens
(user_id, token, expires_at)
VALUES ($1, $2, NOW() + INTERVAL $3 * '1 hour'::INTERVAL)
RETURNING id, token, expires_at
```

#### SELECT Query with JOIN (lines 160-167):
```sql
SELECT prt.*, u.email
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
WHERE prt.token = $1
  AND prt.expires_at > NOW()
  AND prt.used_at IS NULL
```

#### SELECT Query with JSONB Operator (lines 240-246):
```sql
SELECT COUNT(*) as attempt_count
FROM security_audit_log
WHERE action_type = 'failed_login'
  AND details::jsonb ->> 'email' = $1
  AND created_at > NOW() - INTERVAL $2 * '1 minute'::INTERVAL
```
**Special features**: JSONB type casting and ->> operator

## monitoring.repository.js

### Table: queue_metrics

#### SELECT Query (lines 15-28):
```sql
SELECT 
  id,
  queue_length,
  active_jobs,
  average_wait_time_ms,
  average_processing_time_ms,
  total_completed,
  total_failed,
  created_at
FROM queue_metrics
WHERE created_at > NOW() - INTERVAL $1
ORDER BY created_at DESC
```

### Table: permit_applications (monitoring queries)

#### SELECT Query - Stuck Applications (lines 45-59):
```sql
SELECT 
  id,
  status,
  created_at,
  updated_at,
  queue_entered_at,
  queue_started_at,
  queue_status,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 as hours_since_update
FROM permit_applications
WHERE status IN ('PAYMENT_RECEIVED', 'GENERATING_PERMIT')
  AND updated_at < NOW() - INTERVAL $1 || ' hours'
ORDER BY created_at DESC
LIMIT 50
```
**Special features**: EXTRACT(EPOCH FROM ...) for time calculations

#### SELECT Query - Queue Health Aggregation (lines 76-92):
```sql
SELECT 
  COUNT(CASE WHEN queue_status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as failed_count,
  COUNT(*) as total_processed,
  ROUND(
    COUNT(CASE WHEN queue_status = 'failed' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as failure_rate_percent,
  AVG(queue_duration_ms) as avg_processing_time_ms,
  AVG(EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at)) * 1000) as avg_wait_time_ms,
  COUNT(CASE WHEN queue_status = 'processing' THEN 1 END) as currently_processing,
  COUNT(CASE WHEN queue_status = 'queued' THEN 1 END) as currently_queued
FROM permit_applications
WHERE queue_completed_at > NOW() - INTERVAL '1 hour'
  OR queue_status IN ('processing', 'queued')
```
**Special features**: CASE in COUNT, NULLIF, numeric casting, ROUND

#### SELECT Query - System Stats (lines 117-130):
```sql
SELECT 
  COUNT(*) as total_applications,
  COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_count,
  COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted_count,
  -- multiple similar COUNT CASE statements
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as created_last_24h,
  COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour
FROM permit_applications
```

#### SELECT Query - Metrics Summary (lines 211-226):
```sql
SELECT 
  AVG(queue_length) as avg_queue_length,
  MAX(queue_length) as max_queue_length,
  AVG(active_jobs) as avg_active_jobs,
  MAX(active_jobs) as max_active_jobs,
  AVG(average_wait_time_ms) as avg_wait_time_ms,
  AVG(average_processing_time_ms) as avg_processing_time_ms,
  SUM(total_completed) as total_completed,
  SUM(total_failed) as total_failed,
  COUNT(*) as metrics_count,
  MIN(created_at) as period_start,
  MAX(created_at) as period_end
FROM queue_metrics
WHERE created_at > NOW() - INTERVAL $1
```

## queue.repository.js

### Table: email_queue

#### Knex Query Builder Usage (lines 31-45):
```javascript
this.db('email_queue')
  .insert({
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    subject,
    template_name: templateName,
    template_data: templateData,
    html_body: htmlBody,
    text_body: textBody,
    priority,
    scheduled_for: scheduledFor,
    metadata,
    status: 'pending'
  })
  .returning('*')
```
**Note**: This file uses Knex.js query builder instead of raw SQL

#### Knex Query - Get Next Batch (lines 71-87):
```javascript
this.db('email_queue')
  .where('status', 'pending')
  .andWhere(function() {
    this.whereNull('scheduled_for')
      .orWhere('scheduled_for', '<=', now);
  })
  .andWhere(function() {
    this.whereNull('next_retry_at')
      .orWhere('next_retry_at', '<=', now);
  })
  .orderBy([
    { column: 'priority', order: 'asc' },
    { column: 'created_at', order: 'asc' }
  ])
  .limit(limit)
  .forUpdate()
  .skipLocked()
```
**Special features**: forUpdate(), skipLocked() for row locking

### Table: email_history

#### Knex Raw Query (lines 299-310):
```javascript
this.db('email_history')
  .select(this.db.raw(`
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
    COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
    COUNT(CASE WHEN status = 'complained' THEN 1 END) as complained,
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked
  `))
  .where('created_at', '>=', since)
  .first()
```

### Tables: email_templates, email_blacklist

#### Knex Queries (lines 329-360, 384-430):
```javascript
// email_templates
this.db('email_templates')
  .where('name', name)
  .where('active', true)
  .first()

// email_blacklist
this.db('email_blacklist')
  .insert({
    email: email.toLowerCase(),
    reason,
    details
  })
  .returning('*')
```

## reminder.repository.js

### Table: email_reminders

#### SELECT Query with JOIN - Expiring Permits (lines 29-45):
```sql
SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status IN ($1, $2, $3)
AND pa.expires_at BETWEEN NOW() + INTERVAL '1 day' * $4 AND NOW() + INTERVAL '1 day' * $5
AND pa.expires_at > NOW()
ORDER BY pa.expires_at ASC
```

#### INSERT Query with ON CONFLICT (lines 80-88):
```sql
INSERT INTO email_reminders (application_id, user_id, reminder_type, email_address, expires_at, sent_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (application_id, reminder_type) 
DO UPDATE SET 
  sent_at = EXCLUDED.sent_at,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```
**Special features**: ON CONFLICT with DO UPDATE, EXCLUDED pseudo-table

#### SELECT Query - Reminder Stats (lines 126-135):
```sql
SELECT 
  reminder_type,
  COUNT(*) as count,
  DATE(sent_at) as date
FROM email_reminders
WHERE sent_at >= NOW() - INTERVAL '1 day' * $1
GROUP BY reminder_type, DATE(sent_at)
ORDER BY date DESC, reminder_type
```
**Special features**: DATE() function

#### SELECT Query with LEFT JOIN - Applications Needing Reminders (lines 182-198):
```sql
SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
LEFT JOIN email_reminders er ON pa.id = er.application_id AND er.reminder_type = 'expiration_warning'
WHERE pa.status IN ($1, $2, $3)
AND pa.expires_at BETWEEN NOW() + INTERVAL '4 hours' AND NOW() + INTERVAL '5 hours'
AND pa.expires_at > NOW()
AND er.id IS NULL
ORDER BY pa.expires_at ASC
```
**Special features**: LEFT JOIN with NULL check to find missing records

#### DELETE Query - Cleanup (lines 291-294):
```sql
DELETE FROM email_reminders
WHERE sent_at < NOW() - INTERVAL '1 day' * $1
```

## Special PostgreSQL Features Used

1. **JSONB Operations**:
   - `->>' operator for extracting text from JSONB
   - `::jsonb` casting
   - Storing JSON data with JSON.stringify()

2. **Time/Date Operations**:
   - INTERVAL with dynamic values
   - CURRENT_DATE, CURRENT_TIMESTAMP, NOW()
   - EXTRACT(EPOCH FROM ...)
   - Date arithmetic with + and -

3. **Advanced SQL Features**:
   - CTEs (WITH clause)
   - Window functions (ROW_NUMBER() OVER)
   - CASE statements in SELECT and aggregations
   - ON CONFLICT for upsert operations
   - FOR UPDATE NOWAIT for row locking
   - Transaction control (BEGIN, COMMIT, ROLLBACK)

4. **String Operations**:
   - ILIKE for case-insensitive pattern matching
   - String concatenation with ||
   - CONCAT function

5. **Type Casting**:
   - `::numeric`, `::varchar`, `::date`
   - CAST(column AS TEXT)

6. **Aggregate Functions**:
   - COUNT with CASE conditions
   - AVG, SUM, MIN, MAX
   - GROUP BY with HAVING
   - NULLIF for division by zero protection
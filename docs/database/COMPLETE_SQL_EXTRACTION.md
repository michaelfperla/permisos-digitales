# Complete SQL Query Extraction from Permisos Digitales Codebase

This document contains every SQL query found in the JavaScript codebase, organized by file location.

## Table of Contents
1. [Repository Files](#repository-files)
2. [Service Files](#service-files)
3. [Controller Files](#controller-files)
4. [Job Files](#job-files)
5. [Database Schema Summary](#database-schema-summary)

---

## Repository Files

### /src/repositories/application.repository.js

#### 1. Count Applications with Filters
**Location:** Lines 20-25
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*)
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE 1=1
```
**Tables:** permit_applications, users
**Columns:** pa.user_id, u.id
**Join:** INNER JOIN on user_id

#### 2. Get Applications with Pagination
**Location:** Lines 27-34
**Type:** SELECT
```sql
SELECT pa.id, pa.status, pa.created_at,
       pa.payment_reference, pa.nombre_completo, pa.marca, pa.linea, pa.ano_modelo,
       u.email as user_email
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE 1=1
```
**Tables:** permit_applications, users
**Columns:** pa.id, pa.status, pa.created_at, pa.payment_reference, pa.nombre_completo, pa.marca, pa.linea, pa.ano_modelo, u.email
**Additional Filters:** Dynamic WHERE clauses for status, date range, search term

#### 3. Find Applications by User ID
**Location:** Lines 98-122
**Type:** SELECT
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
**Tables:** permit_applications
**Columns:** id, status, nombre_completo, marca, linea, ano_modelo, color, numero_serie, numero_motor, curp_rfc, domicilio, importe, folio, fecha_vencimiento, created_at, updated_at, permit_file_path, certificado_file_path, placas_file_path

#### 4. Find Expiring Permits
**Location:** Lines 136-153
**Type:** SELECT
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
ORDER BY fecha_vencimiento ASC
```
**Tables:** permit_applications
**Columns:** id, status, nombre_completo, marca, linea, ano_modelo, fecha_vencimiento, created_at
**Special Features:** PostgreSQL INTERVAL syntax, CURRENT_DATE function

#### 5. Find Pending Payment Applications
**Location:** Lines 167-184
**Type:** SELECT
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
ORDER BY created_at DESC
```
**Tables:** permit_applications
**Columns:** id, status, nombre_completo, marca, linea, ano_modelo, importe, created_at, expires_at, payment_initiated_at

#### 6. Dashboard Statistics - Status Counts
**Location:** Lines 198-203
**Type:** SELECT (GROUP BY)
```sql
SELECT status, COUNT(*) as count
FROM permit_applications
GROUP BY status
```
**Tables:** permit_applications
**Columns:** status

#### 7. Dashboard Statistics - Pending Count
**Location:** Lines 205-210
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as count
FROM permit_applications
WHERE status = $1
```
**Tables:** permit_applications
**Columns:** status

#### 8. Get Queue Status
**Location:** Lines 233-244
**Type:** SELECT
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
**Tables:** permit_applications
**Columns:** queue_status, queue_position, queue_entered_at, queue_started_at, queue_completed_at, queue_duration_ms, queue_error

#### 9. Get Queued Applications
**Location:** Lines 260-270
**Type:** SELECT
```sql
SELECT 
  id,
  queue_status,
  queue_position,
  queue_entered_at,
  queue_started_at
FROM permit_applications
WHERE queue_status IN ('queued', 'processing')
ORDER BY queue_position ASC
```
**Tables:** permit_applications
**Columns:** id, queue_status, queue_position, queue_entered_at, queue_started_at

#### 10. Get Failed Applications with Complex Analysis
**Location:** Lines 286-340
**Type:** SELECT (Complex)
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
  pa.marca,
  pa.linea,
  pa.ano_modelo,
  pa.color,
  pa.numero_serie,
  pa.numero_motor,
  pa.nombre_completo,
  pa.curp_rfc,
  pa.domicilio,
  pa.importe,
  pa.admin_resolution_notes as admin_notes,
  pa.resolved_at,
  pa.resolved_by_admin,
  CASE 
    WHEN pa.puppeteer_error_message LIKE '%timeout%' THEN 'TIMEOUT'
    WHEN pa.puppeteer_error_message LIKE '%login%' OR pa.puppeteer_error_message LIKE '%auth%' THEN 'AUTH_FAILURE'
    WHEN pa.puppeteer_error_message LIKE '%portal%' OR pa.puppeteer_error_message LIKE '%elemento no encontrado%' THEN 'PORTAL_CHANGED'
    ELSE 'UNKNOWN'
  END as error_category,
  CASE 
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours' THEN 'CRITICAL'
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '24 hours' THEN 'HIGH'
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '12 hours' THEN 'MEDIUM'
    ELSE 'LOW'
  END as severity,
  CASE 
    WHEN pa.puppeteer_error_message LIKE '%timeout%' THEN 'El portal está lento. Intente nuevamente más tarde.'
    WHEN pa.puppeteer_error_message LIKE '%login%' THEN 'Credenciales incorrectas. Verifique configuración.'
    WHEN pa.puppeteer_error_message LIKE '%elemento no encontrado%' THEN 'El portal ha cambiado. Actualice el código.'
    ELSE 'Error desconocido. Revise manualmente.'
  END as suggestion,
  true as admin_review_required
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status = $1
  AND pa.puppeteer_error_at IS NOT NULL
ORDER BY 
  CASE 
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '48 hours' THEN 1
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '24 hours' THEN 2
    WHEN (NOW() - pa.puppeteer_error_at) > INTERVAL '12 hours' THEN 3
    ELSE 4
  END,
  pa.puppeteer_error_at DESC
```
**Tables:** permit_applications, users
**Special Features:** CONCAT function, CASE statements, complex ORDER BY, INTERVAL calculations

#### 11. Mark Application as Resolved
**Location:** Lines 390-400
**Type:** UPDATE
```sql
UPDATE permit_applications
SET 
  admin_resolution_notes = $1,
  resolved_by_admin = $2,
  resolved_at = $3,
  updated_at = NOW()
WHERE id = $4
```
**Tables:** permit_applications
**Columns:** admin_resolution_notes, resolved_by_admin, resolved_at, updated_at

#### 12. Dynamic Application Update
**Location:** Lines 437-441
**Type:** UPDATE (Dynamic)
```sql
UPDATE permit_applications
SET {dynamic fields}, updated_at = ${paramCount}
WHERE id = ${paramCount}
```
**Tables:** permit_applications
**Note:** Dynamic field updates based on input

#### 13. Find Application with OXXO Details
**Location:** Lines 459-472
**Type:** SELECT (with JSONB)
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
ORDER BY p.created_at DESC
LIMIT 1
```
**Tables:** permit_applications, payment_events
**Special Features:** JSONB operators (->>, ->>), LEFT JOIN with multiple conditions

#### 14. Find Application for Download
**Location:** Lines 489-493
**Type:** SELECT
```sql
SELECT user_id, status, permit_file_path, certificado_file_path, placas_file_path
FROM permit_applications 
WHERE id = $1
```
**Tables:** permit_applications
**Columns:** user_id, status, permit_file_path, certificado_file_path, placas_file_path

#### 15. Update Application Status
**Location:** Lines 511-515
**Type:** UPDATE
```sql
UPDATE permit_applications 
SET status = $1, updated_at = CURRENT_TIMESTAMP 
WHERE id = $2
```
**Tables:** permit_applications
**Columns:** status, updated_at

#### 16. Get Application for State Validation
**Location:** Lines 539-541
**Type:** SELECT (with FOR UPDATE)
```sql
SELECT id, status, payment_processor_order_id FROM permit_applications WHERE id = $1 FOR UPDATE
```
**Tables:** permit_applications
**Columns:** id, status, payment_processor_order_id
**Special Features:** FOR UPDATE row lock

#### 17. Create Renewal Application
**Location:** Lines 644-651
**Type:** INSERT
```sql
INSERT INTO permit_applications (
  user_id, nombre_completo, curp_rfc, domicilio,
  marca, linea, color, numero_serie, numero_motor,
  ano_modelo, renewed_from_id, renewal_count, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id, status, created_at
```
**Tables:** permit_applications
**Columns:** user_id, nombre_completo, curp_rfc, domicilio, marca, linea, color, numero_serie, numero_motor, ano_modelo, renewed_from_id, renewal_count, status

#### 18. Update Queue Status (Dynamic)
**Location:** Lines 742-746
**Type:** UPDATE (Dynamic)
```sql
UPDATE permit_applications 
SET {dynamic fields including queue_status, queue_position, etc.}
WHERE id = ${paramCount}
```
**Tables:** permit_applications
**Columns:** status, queue_status, queue_position, queue_entered_at, queue_started_at, queue_completed_at, queue_duration_ms, queue_job_id, updated_at

#### 19. Update Queue Error
**Location:** Lines 767-773
**Type:** UPDATE
```sql
UPDATE permit_applications 
SET queue_status = $1,
    queue_error = $2,
    updated_at = NOW()
WHERE id = $3
```
**Tables:** permit_applications
**Columns:** queue_status, queue_error, updated_at

#### 20. Update Permit Generated
**Location:** Lines 851-855
**Type:** UPDATE (Complex)
```sql
UPDATE permit_applications 
SET {dynamic fields including permit_file_path, certificado_file_path, etc.}
WHERE id = ${paramCount}
```
**Tables:** permit_applications
**Columns:** status, permit_file_path, certificado_file_path, placas_file_path, folio, fecha_expedicion, fecha_vencimiento, queue_status, queue_completed_at, updated_at

#### 21. Get Application Queue Status
**Location:** Lines 872-876
**Type:** SELECT
```sql
SELECT status, queue_status, queue_position, queue_error
FROM permit_applications 
WHERE id = $1
```
**Tables:** permit_applications
**Columns:** status, queue_status, queue_position, queue_error

#### 22. Get Application Status Only
**Location:** Lines 893
**Type:** SELECT
```sql
SELECT status FROM permit_applications WHERE id = $1
```
**Tables:** permit_applications
**Columns:** status

#### 23. Get Application with Row Lock (NOWAIT)
**Location:** Lines 911-916
**Type:** SELECT (with FOR UPDATE NOWAIT)
```sql
SELECT id, status, payment_processor_order_id, user_id, folio
FROM permit_applications 
WHERE id = $1 
FOR UPDATE NOWAIT
```
**Tables:** permit_applications
**Columns:** id, status, payment_processor_order_id, user_id, folio
**Special Features:** FOR UPDATE NOWAIT for non-blocking lock

#### 24. Update Puppeteer Error
**Location:** Lines 946-955
**Type:** UPDATE
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
**Tables:** permit_applications
**Columns:** status, puppeteer_error_message, puppeteer_error_at, puppeteer_screenshot_path, queue_status, updated_at

#### 25. Save Puppeteer Screenshot
**Location:** Lines 1047-1054
**Type:** UPDATE
```sql
UPDATE permit_applications 
SET puppeteer_screenshot_path = $2,
    puppeteer_error_message = COALESCE($3, puppeteer_error_message),
    puppeteer_error_at = COALESCE(puppeteer_error_at, NOW()),
    updated_at = NOW()
WHERE id = $1
```
**Tables:** permit_applications
**Columns:** puppeteer_screenshot_path, puppeteer_error_message, puppeteer_error_at, updated_at
**Special Features:** COALESCE function

#### 26. Get Application for Generation
**Location:** Lines 1077-1087
**Type:** SELECT
```sql
SELECT 
  id, user_id, status, queue_status,
  nombre_completo, curp_rfc, domicilio,
  marca, linea, ano_modelo, color,
  numero_serie, numero_motor, importe,
  payment_reference, payment_processor_order_id,
  created_at, updated_at
FROM permit_applications
WHERE id = $1
```
**Tables:** permit_applications
**Columns:** id, user_id, status, queue_status, nombre_completo, curp_rfc, domicilio, marca, linea, ano_modelo, color, numero_serie, numero_motor, importe, payment_reference, payment_processor_order_id, created_at, updated_at

#### 27. Get Expiring Permits for User
**Location:** Lines 1190-1201
**Type:** SELECT
```sql
SELECT 
  id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento,
  (fecha_vencimiento - CURRENT_DATE) AS days_remaining
FROM permit_applications
WHERE user_id = $1
  AND status = 'PERMIT_READY'
  AND fecha_vencimiento IS NOT NULL
  AND fecha_vencimiento > CURRENT_DATE
  AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 day' * $2)
ORDER BY fecha_vencimiento ASC
```
**Tables:** permit_applications
**Columns:** id, marca, linea, ano_modelo, fecha_expedicion, fecha_vencimiento
**Special Features:** Date arithmetic with INTERVAL

#### 28. Get Expiring Permits with User Info
**Location:** Lines 1225-1244
**Type:** SELECT (with JOIN)
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
ORDER BY pa.fecha_vencimiento ASC
```
**Tables:** permit_applications, users
**Columns:** pa.id, pa.folio, pa.marca, pa.linea, pa.ano_modelo, pa.fecha_vencimiento, u.email, u.first_name, u.last_name

#### 29. Find Pending PDF Generation
**Location:** Lines 1263-1280
**Type:** SELECT
```sql
SELECT 
  id,
  user_id,
  payment_processor_order_id,
  status,
  queue_status,
  created_at,
  updated_at
FROM permit_applications
WHERE status = $1
  AND (queue_status IS NULL OR queue_status IN ('failed', 'error'))
  AND payment_processor_order_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at ASC, created_at ASC
LIMIT $2
```
**Tables:** permit_applications
**Columns:** id, user_id, payment_processor_order_id, status, queue_status, created_at, updated_at

---

### /src/repositories/payment.repository.js

#### 30. Create Payment Event
**Location:** Lines 21-25
**Type:** INSERT
```sql
INSERT INTO payment_events (application_id, order_id, event_type, event_data, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
RETURNING *
```
**Tables:** payment_events
**Columns:** application_id, order_id, event_type, event_data, created_at

#### 31. Update Payment Order with OXXO Reference
**Location:** Lines 50-58
**Type:** UPDATE
```sql
UPDATE permit_applications
SET payment_processor_order_id = $1,
    status = $2,
    payment_reference = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $4
RETURNING *
```
**Tables:** permit_applications
**Columns:** payment_processor_order_id, status, payment_reference, updated_at

#### 32. Update Payment Order without OXXO
**Location:** Lines 62-69
**Type:** UPDATE
```sql
UPDATE permit_applications
SET payment_processor_order_id = $1,
    status = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $3
RETURNING *
```
**Tables:** permit_applications
**Columns:** payment_processor_order_id, status, updated_at

#### 33. Update Payment Status
**Location:** Lines 95-101
**Type:** UPDATE
```sql
UPDATE permit_applications
SET status = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $2
RETURNING *
```
**Tables:** permit_applications
**Columns:** status, updated_at

#### 34. Find by Order ID
**Location:** Lines 124-127
**Type:** SELECT
```sql
SELECT * FROM permit_applications
WHERE payment_processor_order_id = $1
```
**Tables:** permit_applications
**Columns:** All columns (*)

#### 35. Find by ID
**Location:** Lines 139-142
**Type:** SELECT
```sql
SELECT * FROM permit_applications
WHERE id = $1
```
**Tables:** permit_applications
**Columns:** All columns (*)

#### 36. Get Payment by Application ID
**Location:** Lines 154-163
**Type:** SELECT
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
**Tables:** permit_applications
**Columns:** payment_processor_order_id, status, payment_reference, updated_at

#### 37. Get Pending Payments
**Location:** Lines 175-185
**Type:** SELECT (with JOIN)
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
**Tables:** permit_applications, users
**Columns:** pa.id, pa.status, pa.created_at, pa.updated_at, pa.payment_processor_order_id, pa.nombre_completo, pa.marca, pa.linea, pa.ano_modelo, pa.importe, u.email, pa.curp_rfc

#### 38. Find Webhook Event
**Location:** Lines 197-200
**Type:** SELECT
```sql
SELECT * FROM webhook_events
WHERE event_id = $1
```
**Tables:** webhook_events
**Columns:** All columns (*)

#### 39. Create Webhook Event (with ON CONFLICT)
**Location:** Lines 212-217
**Type:** INSERT
```sql
INSERT INTO webhook_events (event_id, event_type, event_data, processing_status, created_at)
VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (event_id) DO NOTHING
RETURNING *
```
**Tables:** webhook_events
**Columns:** event_id, event_type, event_data, processing_status, created_at
**Special Features:** ON CONFLICT clause

#### 40. Update Webhook Event Status
**Location:** Lines 238-246
**Type:** UPDATE
```sql
UPDATE webhook_events 
SET processing_status = $1::varchar,
    last_error = $2,
    processed_at = CASE WHEN $1::varchar = 'processed' THEN CURRENT_TIMESTAMP ELSE processed_at END,
    retry_count = CASE WHEN $1::varchar = 'failed' THEN retry_count + 1 ELSE retry_count END
WHERE event_id = $3
RETURNING *
```
**Tables:** webhook_events
**Columns:** processing_status, last_error, processed_at, retry_count
**Special Features:** CASE statements, type casting

#### 41. Count Pending Payments
**Location:** Lines 260-264
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as count
FROM permit_applications
WHERE status = $1
```
**Tables:** permit_applications
**Columns:** status

#### 42. Log Payment Event
**Location:** Lines 281-286
**Type:** INSERT
```sql
INSERT INTO payment_events
(application_id, order_id, event_type, event_data, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
RETURNING *
```
**Tables:** payment_events
**Columns:** application_id, order_id, event_type, event_data, created_at

#### 43. Check if Event Processed
**Location:** Lines 359-363
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as count
FROM webhook_events
WHERE event_id = $1
```
**Tables:** webhook_events
**Columns:** event_id

#### 44. Mark Event as Processed
**Location:** Lines 386-391
**Type:** INSERT
```sql
INSERT INTO webhook_events
(event_id, event_type, processed_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
RETURNING *
```
**Tables:** webhook_events
**Columns:** event_id, event_type, processed_at

#### 45. Try Record Event (with ON CONFLICT)
**Location:** Lines 423-429
**Type:** INSERT
```sql
INSERT INTO webhook_events
(event_id, event_type, processed_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT (event_id) DO NOTHING
RETURNING id
```
**Tables:** webhook_events
**Columns:** event_id, event_type, processed_at
**Special Features:** ON CONFLICT clause

#### 46. Get Expiring OXXO Payments (with CTE)
**Location:** Lines 476-511
**Type:** SELECT (Complex with CTE)
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
  pa.nombre_completo,
  pa.marca,
  pa.linea,
  pa.ano_modelo,
  pa.importe as amount,
  u.email as user_email,
  u.first_name,
  u.last_name,
  u.phone,
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
ORDER BY le.expires_at ASC
```
**Tables:** payment_events, permit_applications, users
**Special Features:** CTE (WITH clause), ROW_NUMBER() window function, JSONB operators, type casting

---

### /src/repositories/user.repository.js

#### 47. Find User by Email
**Location:** Line 12
**Type:** SELECT
```sql
SELECT * FROM users WHERE email = $1
```
**Tables:** users
**Columns:** All columns (*)

#### 48. Count Users with Filters
**Location:** Line 58
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) FROM users WHERE 1=1
```
**Tables:** users
**Additional Filters:** Dynamic WHERE clauses for account_type and search

#### 49. Find Users with Pagination
**Location:** Lines 59-63
**Type:** SELECT
```sql
SELECT id, email, first_name, last_name, account_type, is_admin_portal, created_at, updated_at
FROM users
WHERE 1=1
```
**Tables:** users
**Columns:** id, email, first_name, last_name, account_type, is_admin_portal, created_at, updated_at
**Additional:** Dynamic filters and ORDER BY created_at DESC

#### 50. Create User
**Location:** Lines 115-120
**Type:** INSERT
```sql
INSERT INTO users
(email, password_hash, first_name, last_name, account_type, created_by, is_admin_portal)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, email, first_name, last_name, account_type, is_admin_portal, created_at
```
**Tables:** users
**Columns:** email, password_hash, first_name, last_name, account_type, created_by, is_admin_portal

#### 51. Update Password
**Location:** Lines 140-145
**Type:** UPDATE
```sql
UPDATE users
SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2
RETURNING id
```
**Tables:** users
**Columns:** password_hash, updated_at

#### 52. Get Security Events
**Location:** Lines 161-167
**Type:** SELECT
```sql
SELECT id, action_type, ip_address, user_agent, details, created_at
FROM security_audit_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
```
**Tables:** security_audit_log
**Columns:** id, action_type, ip_address, user_agent, details, created_at

#### 53. Check Email Exists
**Location:** Line 179
**Type:** SELECT
```sql
SELECT 1 FROM users WHERE email = $1
```
**Tables:** users
**Columns:** email (checking existence)

#### 54. Get User Details with Creator Info
**Location:** Lines 191-201
**Type:** SELECT (with LEFT JOIN)
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
**Tables:** users (self-join)
**Columns:** u.id, u.email, u.first_name, u.last_name, u.account_type, u.is_admin_portal, u.created_at, u.updated_at, u.role, u.created_by, creator.first_name, creator.last_name

#### 55. Update Email Verification
**Location:** Lines 228-237
**Type:** UPDATE
```sql
UPDATE users 
SET email_verification_token = $1, 
    email_verification_expires = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $3
RETURNING id, email
```
**Tables:** users
**Columns:** email_verification_token, email_verification_expires, updated_at

#### 56. Delete Existing Password Reset Tokens
**Location:** Lines 263-266
**Type:** DELETE
```sql
DELETE FROM password_reset_tokens WHERE user_id = $1
```
**Tables:** password_reset_tokens
**Columns:** user_id

#### 57. Create Password Reset Token
**Location:** Lines 269-274
**Type:** INSERT
```sql
INSERT INTO password_reset_tokens (user_id, token, expires_at)
VALUES ($1, $2, $3)
RETURNING token
```
**Tables:** password_reset_tokens
**Columns:** user_id, token, expires_at

#### 58. Find User by Reset Token (Complex)
**Location:** Lines 296-320
**Type:** SELECT (Complex with aggregations)
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
**Tables:** password_reset_tokens, users
**Special Features:** Multiple JOINs, GROUP BY, COUNT(DISTINCT), MAX aggregation

#### 59. Find User for Password Reset
**Location:** Lines 343-364
**Type:** SELECT (with LEFT JOIN and aggregations)
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
  COUNT(DISTINCT prt.id) as active_reset_tokens,
  MAX(prt.created_at) as last_reset_request
FROM users u
LEFT JOIN password_reset_tokens prt ON u.id = prt.user_id 
  AND prt.expires_at > CURRENT_TIMESTAMP 
  AND prt.used_at IS NULL
WHERE LOWER(u.email) = LOWER($1)
GROUP BY u.id, u.email, u.first_name, u.last_name, 
         u.is_email_verified, u.account_status, 
         u.created_at, u.last_login_at
```
**Tables:** users, password_reset_tokens
**Special Features:** LOWER function for case-insensitive search

#### 60. Invalidate Reset Token
**Location:** Lines 386-391
**Type:** UPDATE
```sql
UPDATE password_reset_tokens
SET used_at = CURRENT_TIMESTAMP
WHERE token = $1
```
**Tables:** password_reset_tokens
**Columns:** used_at

#### 61. Update User Password
**Location:** Lines 412-416
**Type:** UPDATE
```sql
UPDATE users
SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2
```
**Tables:** users
**Columns:** password_hash, updated_at

#### 62. Cleanup Expired Tokens
**Location:** Lines 436-439
**Type:** DELETE
```sql
DELETE FROM password_reset_tokens
WHERE expires_at < CURRENT_TIMESTAMP
```
**Tables:** password_reset_tokens
**Columns:** expires_at

#### 63. Log Security Event
**Location:** Lines 462-466
**Type:** INSERT
```sql
INSERT INTO security_audit_log (user_id, action_type, ip_address, details, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
```
**Tables:** security_audit_log
**Columns:** user_id, action_type, ip_address, details, created_at

#### 64. Execute Password Reset (Transaction)
**Location:** Lines 488-496
**Type:** SELECT (in transaction)
```sql
SELECT 
  u.id,
  prt.expires_at,
  prt.used_at
FROM password_reset_tokens prt
INNER JOIN users u ON prt.user_id = u.id
WHERE prt.token = $1
```
**Tables:** password_reset_tokens, users
**Columns:** u.id, prt.expires_at, prt.used_at

#### 65. Update Password in Transaction
**Location:** Lines 519-524
**Type:** UPDATE (in transaction)
```sql
UPDATE users
SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2
```
**Tables:** users
**Columns:** password_hash, updated_at

#### 66. Mark Token as Used in Transaction
**Location:** Lines 527-531
**Type:** UPDATE (in transaction)
```sql
UPDATE password_reset_tokens
SET used_at = CURRENT_TIMESTAMP
WHERE token = $1
```
**Tables:** password_reset_tokens
**Columns:** used_at

---

### /src/repositories/payment-recovery.repository.js

#### 67. Upsert Recovery Attempt
**Location:** Lines 15-33
**Type:** INSERT with ON CONFLICT
```sql
INSERT INTO payment_recovery_attempts (
  application_id, 
  payment_intent_id, 
  attempt_count, 
  last_attempt_time, 
  last_error,
  recovery_status
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (application_id, payment_intent_id) 
DO UPDATE SET
  attempt_count = payment_recovery_attempts.attempt_count + 1,
  last_attempt_time = EXCLUDED.last_attempt_time,
  last_error = EXCLUDED.last_error,
  recovery_status = EXCLUDED.recovery_status,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```
**Tables:** payment_recovery_attempts
**Columns:** application_id, payment_intent_id, attempt_count, last_attempt_time, last_error, recovery_status, updated_at
**Special Features:** ON CONFLICT with DO UPDATE

#### 68. Get Recovery Attempt
**Location:** Lines 61-64
**Type:** SELECT
```sql
SELECT * FROM payment_recovery_attempts
WHERE application_id = $1 AND payment_intent_id = $2
```
**Tables:** payment_recovery_attempts
**Columns:** All columns (*)

#### 69. Update Recovery Status
**Location:** Lines 83-90
**Type:** UPDATE
```sql
UPDATE payment_recovery_attempts
SET recovery_status = $1,
    last_error = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE application_id = $3 AND payment_intent_id = $4
RETURNING *
```
**Tables:** payment_recovery_attempts
**Columns:** recovery_status, last_error, updated_at

#### 70. Get Stuck Recovery Attempts
**Location:** Lines 110-119
**Type:** SELECT (with JOIN and INTERVAL)
```sql
SELECT pra.*, pa.status as application_status, pa.user_id
FROM payment_recovery_attempts pra
JOIN permit_applications pa ON pra.application_id = pa.id
WHERE pra.recovery_status IN ('pending', 'recovering')
AND pra.last_attempt_time < NOW() - ($1 || ' minute')::INTERVAL
AND pra.attempt_count < 3
ORDER BY pra.last_attempt_time ASC
LIMIT 100
```
**Tables:** payment_recovery_attempts, permit_applications
**Special Features:** String concatenation for INTERVAL, type casting

#### 71. Cleanup Old Recovery Attempts
**Location:** Lines 134-139
**Type:** DELETE
```sql
DELETE FROM payment_recovery_attempts
WHERE created_at < NOW() - INTERVAL $1 * '1 day'::INTERVAL
AND recovery_status IN ('succeeded', 'failed', 'max_attempts_reached')
RETURNING id
```
**Tables:** payment_recovery_attempts
**Columns:** created_at, recovery_status
**Special Features:** INTERVAL arithmetic

#### 72. Get Recovery Statistics
**Location:** Lines 155-165
**Type:** SELECT (with aggregations)
```sql
SELECT 
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN recovery_status = 'succeeded' THEN 1 END) as successful_recoveries,
  COUNT(CASE WHEN recovery_status = 'failed' THEN 1 END) as failed_recoveries,
  COUNT(CASE WHEN recovery_status = 'max_attempts_reached' THEN 1 END) as max_attempts_reached,
  COUNT(CASE WHEN recovery_status IN ('pending', 'recovering') THEN 1 END) as in_progress,
  AVG(attempt_count) as avg_attempts
FROM payment_recovery_attempts
WHERE created_at > NOW() - INTERVAL $1 * '1 hour'::INTERVAL
```
**Tables:** payment_recovery_attempts
**Special Features:** Multiple COUNT with CASE, AVG aggregation

---

### /src/repositories/security.repository.js

#### 73. Log Security Activity
**Location:** Lines 24-29
**Type:** INSERT
```sql
INSERT INTO security_audit_log
(user_id, action_type, ip_address, user_agent, details)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, action_type, created_at
```
**Tables:** security_audit_log
**Columns:** user_id, action_type, ip_address, user_agent, details

#### 74. Count Recent Activities
**Location:** Lines 55-61
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as attempt_count
FROM security_audit_log
WHERE ip_address = $1
  AND action_type = $2
  AND created_at > NOW() - ($3 || ' minute')::INTERVAL
```
**Tables:** security_audit_log
**Columns:** ip_address, action_type, created_at
**Special Features:** String concatenation for INTERVAL

#### 75. Get Failed Login IPs
**Location:** Lines 82-90
**Type:** SELECT (GROUP BY, HAVING)
```sql
SELECT ip_address, COUNT(*) as count
FROM security_audit_log
WHERE action_type = 'failed_login'
  AND created_at > NOW() - ($2 || ' hour')::INTERVAL
GROUP BY ip_address
HAVING COUNT(*) >= $1
ORDER BY count DESC
```
**Tables:** security_audit_log
**Columns:** ip_address, action_type, created_at
**Special Features:** GROUP BY, HAVING clause

#### 76. Get Rate Limit Events
**Location:** Lines 94-102
**Type:** SELECT (GROUP BY, HAVING)
```sql
SELECT ip_address, COUNT(*) as count
FROM security_audit_log
WHERE action_type = 'rate_limit_exceeded'
  AND created_at > NOW() - ($2 || ' hour')::INTERVAL
GROUP BY ip_address
HAVING COUNT(*) >= $1
ORDER BY count DESC
```
**Tables:** security_audit_log
**Columns:** ip_address, action_type, created_at

#### 77. Get CSRF Violations
**Location:** Lines 106-112
**Type:** SELECT
```sql
SELECT ip_address, user_agent, details, created_at
FROM security_audit_log
WHERE action_type = 'csrf_violation'
  AND created_at > NOW() - INTERVAL $1 * '1 hour'::INTERVAL
ORDER BY created_at DESC
```
**Tables:** security_audit_log
**Columns:** ip_address, user_agent, details, created_at

#### 78. Create Password Reset Token (security.repository)
**Location:** Lines 138-143
**Type:** INSERT
```sql
INSERT INTO password_reset_tokens
(user_id, token, expires_at)
VALUES ($1, $2, NOW() + INTERVAL $3 * '1 hour'::INTERVAL)
RETURNING id, token, expires_at
```
**Tables:** password_reset_tokens
**Columns:** user_id, token, expires_at
**Special Features:** INTERVAL arithmetic

#### 79. Find Valid Reset Token
**Location:** Lines 160-167
**Type:** SELECT (with JOIN)
```sql
SELECT prt.*, u.email
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
WHERE prt.token = $1
  AND prt.expires_at > NOW()
  AND prt.used_at IS NULL
```
**Tables:** password_reset_tokens, users
**Columns:** prt.*, u.email

#### 80. Mark Reset Token as Used
**Location:** Lines 184-189
**Type:** UPDATE
```sql
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE token = $1
RETURNING id
```
**Tables:** password_reset_tokens
**Columns:** used_at

#### 81. Get Failed Login Attempts by Email
**Location:** Lines 241-246
**Type:** SELECT (with JSONB)
```sql
SELECT COUNT(*) as attempt_count
FROM security_audit_log
WHERE action_type = 'failed_login'
  AND details::jsonb ->> 'email' = $1
  AND created_at > NOW() - INTERVAL $2 * '1 minute'::INTERVAL
```
**Tables:** security_audit_log
**Columns:** action_type, details, created_at
**Special Features:** JSONB operator ->>, type casting

#### 82. Get Security Events for User
**Location:** Lines 282-287
**Type:** SELECT
```sql
SELECT id, action_type, ip_address, user_agent, details, created_at
FROM security_audit_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
```
**Tables:** security_audit_log
**Columns:** id, action_type, ip_address, user_agent, details, created_at

---

### /src/repositories/base.repository.js

#### 83. Find by ID (Generic)
**Location:** Line 12
**Type:** SELECT
```sql
SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1
```
**Tables:** Dynamic (any table)
**Columns:** All columns (*)

#### 84. Find All with Criteria (Generic)
**Location:** Lines 58-64
**Type:** SELECT
```sql
SELECT * FROM ${this.tableName}
${whereClause}
${orderClause}
${limitClause}
${offsetClause}
```
**Tables:** Dynamic (any table)
**Special Features:** Dynamic WHERE, ORDER BY, LIMIT, OFFSET

#### 85. Create Record (Generic)
**Location:** Lines 98-102
**Type:** INSERT
```sql
INSERT INTO ${this.tableName} (${columnNames})
VALUES (${placeholders})
RETURNING *
```
**Tables:** Dynamic (any table)
**Columns:** Dynamic based on input

#### 86. Update Record (Generic)
**Location:** Lines 132-137
**Type:** UPDATE
```sql
UPDATE ${this.tableName}
SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
WHERE ${this.primaryKey} = $${values.length + 1}
RETURNING *
```
**Tables:** Dynamic (any table)
**Columns:** Dynamic based on input plus updated_at

#### 87. Delete Record (Generic)
**Location:** Line 150
**Type:** DELETE
```sql
DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING ${this.primaryKey}
```
**Tables:** Dynamic (any table)

#### 88. Count Records (Generic)
**Location:** Line 174
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) FROM ${this.tableName} ${whereClause}
```
**Tables:** Dynamic (any table)

---

### /src/repositories/monitoring.repository.js

#### 89. Get Queue Metrics
**Location:** Lines 15-28
**Type:** SELECT
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
**Tables:** queue_metrics
**Columns:** id, queue_length, active_jobs, average_wait_time_ms, average_processing_time_ms, total_completed, total_failed, created_at

#### 90. Get Stuck Applications
**Location:** Lines 45-60
**Type:** SELECT
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
**Tables:** permit_applications
**Special Features:** EXTRACT(EPOCH) for time calculations

#### 91. Get Queue Health
**Location:** Lines 76-92
**Type:** SELECT (Complex aggregations)
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
**Tables:** permit_applications
**Special Features:** Multiple COUNT with CASE, ROUND, NULLIF, EXTRACT(EPOCH)

#### 92. Get System Stats
**Location:** Lines 117-130
**Type:** SELECT (Multiple COUNT with CASE)
```sql
SELECT 
  COUNT(*) as total_applications,
  COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_count,
  COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted_count,
  COUNT(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 END) as payment_pending_count,
  COUNT(CASE WHEN status = 'PAYMENT_RECEIVED' THEN 1 END) as payment_received_count,
  COUNT(CASE WHEN status = 'GENERATING_PERMIT' THEN 1 END) as generating_permit_count,
  COUNT(CASE WHEN status = 'PERMIT_READY' THEN 1 END) as permit_ready_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as created_last_24h,
  COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour
FROM permit_applications
```
**Tables:** permit_applications
**Columns:** status, created_at, updated_at

#### 93. Get Processing Times
**Location:** Lines 147-162
**Type:** SELECT
```sql
SELECT 
  id,
  status,
  queue_duration_ms,
  EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at)) * 1000 as wait_time_ms,
  queue_entered_at,
  queue_started_at,
  queue_completed_at,
  queue_status
FROM permit_applications
WHERE queue_completed_at IS NOT NULL
  AND queue_duration_ms IS NOT NULL
ORDER BY queue_completed_at DESC
LIMIT $1
```
**Tables:** permit_applications
**Columns:** id, status, queue_duration_ms, queue_entered_at, queue_started_at, queue_completed_at, queue_status

#### 94. Get Metrics Summary
**Location:** Lines 211-226
**Type:** SELECT (Aggregations)
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
**Tables:** queue_metrics
**Special Features:** Multiple aggregation functions

---

### /src/repositories/queue.repository.js

**Note:** This file uses a different database interface (this.db) which appears to be Knex.js query builder, not raw SQL. The queries are built programmatically. Key operations include:
- Email queue management
- Email history tracking
- Email template management
- Email blacklist management

---

### /src/repositories/reminder.repository.js

#### 95. Get Expiring Permits for Reminders
**Location:** Lines 29-37
**Type:** SELECT (with JOIN)
```sql
SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status IN ($1, $2, $3)
AND pa.expires_at BETWEEN NOW() + INTERVAL '1 day' * $4 AND NOW() + INTERVAL '1 day' * $5
AND pa.expires_at > NOW()
ORDER BY pa.expires_at ASC
```
**Tables:** permit_applications, users
**Columns:** All from permit_applications plus user details
**Special Features:** BETWEEN with INTERVAL arithmetic

#### 96. Get Application for Reminder Update
**Location:** Lines 65-71
**Type:** SELECT
```sql
SELECT pa.id, pa.user_id, u.email, pa.expires_at
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
WHERE pa.id = $1
```
**Tables:** permit_applications, users
**Columns:** pa.id, pa.user_id, u.email, pa.expires_at

#### 97. Update Reminder Sent (with ON CONFLICT)
**Location:** Lines 80-88
**Type:** INSERT with ON CONFLICT
```sql
INSERT INTO email_reminders (application_id, user_id, reminder_type, email_address, expires_at, sent_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (application_id, reminder_type) 
DO UPDATE SET 
  sent_at = EXCLUDED.sent_at,
  updated_at = CURRENT_TIMESTAMP
RETURNING *
```
**Tables:** email_reminders
**Columns:** application_id, user_id, reminder_type, email_address, expires_at, sent_at, updated_at

#### 98. Get Reminder Stats by Type
**Location:** Lines 126-135
**Type:** SELECT (GROUP BY)
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
**Tables:** email_reminders
**Columns:** reminder_type, sent_at
**Special Features:** DATE() function

#### 99. Get Pending Reminders Count
**Location:** Lines 139-153
**Type:** SELECT (with FILTER)
```sql
SELECT 
  COUNT(*) FILTER (WHERE expires_at BETWEEN NOW() + INTERVAL '4 hours' AND NOW() + INTERVAL '5 hours') as expiration_warnings,
  COUNT(*) FILTER (WHERE expires_at BETWEEN NOW() + INTERVAL '1 hour' AND NOW() + INTERVAL '2 hours') as final_warnings
FROM permit_applications pa
WHERE status IN ($1, $2, $3)
AND expires_at > NOW()
```
**Tables:** permit_applications
**Special Features:** COUNT with FILTER clause

#### 100. Get Total Reminders Sent
**Location:** Lines 156-160
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as total_sent
FROM email_reminders
WHERE sent_at >= NOW() - INTERVAL '1 day' * $1
```
**Tables:** email_reminders
**Columns:** sent_at

#### 101. Get Applications Needing Expiration Warning
**Location:** Lines 182-192
**Type:** SELECT (with LEFT JOIN)
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
**Tables:** permit_applications, users, email_reminders
**Special Features:** LEFT JOIN with NULL check

#### 102. Get Applications Needing Final Warning
**Location:** Lines 201-212
**Type:** SELECT (with LEFT JOIN)
```sql
SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
FROM permit_applications pa
JOIN users u ON pa.user_id = u.id
LEFT JOIN email_reminders er ON pa.id = er.application_id AND er.reminder_type = 'final_warning'
WHERE pa.status IN ($1, $2, $3)
AND pa.expires_at BETWEEN NOW() + INTERVAL '1 hour' AND NOW() + INTERVAL '2 hours'
AND pa.expires_at > NOW()
AND er.id IS NULL
ORDER BY pa.expires_at ASC
```
**Tables:** permit_applications, users, email_reminders

#### 103. Check if Reminder Sent
**Location:** Lines 242-246
**Type:** SELECT (COUNT)
```sql
SELECT COUNT(*) as count
FROM email_reminders
WHERE application_id = $1 AND reminder_type = $2
```
**Tables:** email_reminders
**Columns:** application_id, reminder_type

#### 104. Get Reminder History
**Location:** Lines 262-268
**Type:** SELECT (with JOIN)
```sql
SELECT er.*, u.email as user_email, u.first_name, u.last_name
FROM email_reminders er
JOIN users u ON er.user_id = u.id
WHERE er.application_id = $1
ORDER BY er.sent_at DESC
```
**Tables:** email_reminders, users
**Columns:** All from email_reminders plus user details

#### 105. Cleanup Old Reminders
**Location:** Lines 291-294
**Type:** DELETE
```sql
DELETE FROM email_reminders
WHERE sent_at < NOW() - INTERVAL '1 day' * $1
```
**Tables:** email_reminders
**Columns:** sent_at

---

## Service Files

### /src/services/payment-monitoring.service.js
No direct SQL queries - uses in-memory data structures

### /src/services/webhook-retry.service.js
No direct SQL queries - uses paymentRepository methods

### /src/db/index.js

#### 106. Test Database Connection
**Location:** Line 147
**Type:** SELECT
```sql
SELECT NOW()
```
**Tables:** None (system query)
**Purpose:** Test database connectivity

---

## Controller Files

Most controllers use repository methods rather than direct SQL queries. Key controllers that may have SQL:

### /src/controllers/application.controller.js
- Uses applicationRepository methods

### /src/controllers/auth.controller.js
- Uses userRepository methods

### /src/controllers/admin.controller.js
- Uses various repository methods

---

## Job Files

### /src/jobs/application-cleanup.job.js
- Likely uses repository methods for cleanup

### /src/jobs/payment-reconciliation.js
- Uses payment repository methods

### /src/jobs/permit-expiration-notifications.js
- Uses application repository methods

### /src/jobs/scheduled-verification.js
- Uses repository methods for verification

---

## Database Schema Summary

Based on all SQL queries extracted, here are the identified tables and their columns:

### 1. **permit_applications**
Primary table for permit applications with extensive columns:
- **Identity**: id, user_id
- **Status**: status, queue_status, payment_initiated_at, expires_at
- **Personal Info**: nombre_completo, curp_rfc, domicilio
- **Vehicle Info**: marca, linea, ano_modelo, color, numero_serie, numero_motor
- **Payment**: importe, payment_reference, payment_processor_order_id
- **Permit Info**: folio, fecha_expedicion, fecha_vencimiento
- **Files**: permit_file_path, certificado_file_path, placas_file_path
- **Queue**: queue_position, queue_entered_at, queue_started_at, queue_completed_at, queue_duration_ms, queue_error, queue_job_id
- **Puppeteer/Automation**: puppeteer_error_message, puppeteer_error_at, puppeteer_screenshot_path
- **Admin**: admin_resolution_notes, resolved_by_admin, resolved_at
- **Renewal**: renewed_from_id, renewal_count
- **Timestamps**: created_at, updated_at

### 2. **users**
User account information:
- **Identity**: id, email, password_hash
- **Personal**: first_name, last_name, phone
- **Account**: account_type, is_admin_portal, role, account_status
- **Verification**: is_email_verified, email_verification_token, email_verification_expires
- **Activity**: last_login_at, created_by
- **Timestamps**: created_at, updated_at

### 3. **payment_events**
Payment event logging:
- id, application_id, order_id, event_type
- event_data (JSONB)
- created_at

### 4. **webhook_events**
Webhook processing tracking:
- id, event_id, event_type
- event_data (JSONB)
- processing_status, last_error
- processed_at, retry_count
- created_at

### 5. **payment_recovery_attempts**
Payment recovery tracking:
- id, application_id, payment_intent_id
- attempt_count, last_attempt_time
- last_error, recovery_status
- created_at, updated_at

### 6. **security_audit_log**
Security event logging:
- id, user_id, action_type
- ip_address, user_agent
- details (JSONB)
- created_at

### 7. **password_reset_tokens**
Password reset management:
- id, user_id, token
- expires_at, used_at
- created_at

### 8. **email_reminders**
Email reminder tracking:
- id, application_id, user_id
- reminder_type, email_address
- expires_at, sent_at
- created_at, updated_at

### 9. **queue_metrics**
Queue performance metrics:
- id
- queue_length, active_jobs
- average_wait_time_ms, average_processing_time_ms
- total_completed, total_failed
- created_at

### 10. **email_queue** (from queue.repository.js)
Email queue management:
- id, recipient_email, recipient_name
- subject, template_name
- template_data, html_body, text_body
- priority, scheduled_for
- status, ses_message_id
- attempts, max_attempts
- last_attempt_at, next_retry_at
- error_message, error_details
- metadata
- created_at, updated_at, processed_at

### 11. **email_history** (from queue.repository.js)
Email delivery history:
- id, queue_id
- recipient_email, recipient_name
- subject, template_name
- status, ses_message_id
- sent_at, delivered_at, bounced_at
- complained_at, opened_at, clicked_at
- from_email, reply_to
- metadata
- created_at

### 12. **email_templates** (from queue.repository.js)
Email template management:
- id, name
- subject, html_template, text_template
- variables, active, version
- created_at, updated_at

### 13. **email_blacklist** (from queue.repository.js)
Email blacklist:
- id, email
- reason, details
- created_at

## Key PostgreSQL Features Used

1. **JSONB Operations**: ->> operator for extracting JSON fields
2. **Window Functions**: ROW_NUMBER() OVER (PARTITION BY...)
3. **CTEs (Common Table Expressions)**: WITH clauses
4. **Date/Time Functions**: NOW(), CURRENT_DATE, CURRENT_TIMESTAMP
5. **Interval Arithmetic**: INTERVAL '1 day', date calculations
6. **Aggregations**: COUNT, SUM, AVG, MAX, MIN with CASE statements
7. **Advanced Clauses**: ON CONFLICT DO UPDATE/NOTHING, FOR UPDATE/NOWAIT
8. **String Functions**: CONCAT, LOWER, LIKE pattern matching
9. **Type Casting**: ::numeric, ::varchar, ::INTERVAL
10. **Special Functions**: COALESCE, NULLIF, EXTRACT(EPOCH)
11. **Filters**: COUNT(*) FILTER (WHERE...)
12. **Self Joins**: users table joining to itself for creator info

## Query Patterns

1. **Pagination**: Most list queries use LIMIT/OFFSET
2. **Soft Updates**: Many updates only change specific fields
3. **Status Tracking**: Extensive use of status fields and state transitions
4. **Audit Trail**: Timestamps on all major operations
5. **Error Handling**: Detailed error tracking with messages and screenshots
6. **Queue Management**: Sophisticated queue status and timing tracking
7. **Security**: Comprehensive audit logging and rate limiting
8. **Data Integrity**: Use of transactions and row locks where needed
# Accurate Code Schema Analysis - Based on SQL Queries Only

This document analyzes ONLY what the actual SQL queries in the code reference. No assumptions about data types or table structures.

## payment_recovery_attempts Table

Source: `src/repositories/payment-recovery.repository.js`

### SQL Evidence:

1. **INSERT Query (lines 16-24)**:
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
```

**Columns explicitly referenced:**
- application_id
- payment_intent_id
- attempt_count
- last_attempt_time
- last_error
- recovery_status

2. **ON CONFLICT Clause (line 25)**:
```sql
ON CONFLICT (application_id, payment_intent_id)
```
**Shows:** Unique constraint on (application_id, payment_intent_id)

3. **UPDATE in ON CONFLICT (lines 26-31)**:
```sql
DO UPDATE SET
  attempt_count = payment_recovery_attempts.attempt_count + 1,
  last_attempt_time = EXCLUDED.last_attempt_time,
  last_error = EXCLUDED.last_error,
  recovery_status = EXCLUDED.recovery_status,
  updated_at = CURRENT_TIMESTAMP
```
**Additional column:** updated_at

4. **SELECT Query (lines 62-64)**:
```sql
SELECT * FROM payment_recovery_attempts
WHERE application_id = $1 AND payment_intent_id = $2
```

5. **UPDATE Query (lines 84-89)**:
```sql
UPDATE payment_recovery_attempts
SET recovery_status = $1,
    last_error = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE application_id = $3 AND payment_intent_id = $4
RETURNING *
```

6. **SELECT with JOIN (lines 111-119)**:
```sql
SELECT pra.*, pa.status as application_status, pa.user_id
FROM payment_recovery_attempts pra
JOIN permit_applications pa ON pra.application_id = pa.id
WHERE pra.recovery_status IN ('pending', 'recovering')
AND pra.last_attempt_time < NOW() - ($1 || ' minute')::INTERVAL
AND pra.attempt_count < 3
```
**Shows:** 
- JOIN to permit_applications on pra.application_id = pa.id
- Uses PostgreSQL interval syntax

7. **DELETE Query (lines 135-138)**:
```sql
DELETE FROM payment_recovery_attempts
WHERE created_at < NOW() - INTERVAL $1 * '1 day'::INTERVAL
AND recovery_status IN ('succeeded', 'failed', 'max_attempts_reached')
RETURNING id
```
**Additional columns:** created_at, id (returned but never inserted)

8. **Aggregate Query (lines 156-165)**:
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

### What the Code Passes as Values:
- application_id: integer (applicationId parameter)
- payment_intent_id: string (paymentIntentId parameter)
- attempt_count: integer (attemptData.attemptCount || 1)
- last_attempt_time: Date (attemptData.lastAttemptTime || new Date())
- last_error: string or null (attemptData.lastError || null)
- recovery_status: string (attemptData.recoveryStatus || 'recovering')

### What We Can Determine:
1. Table has these columns: application_id, payment_intent_id, attempt_count, last_attempt_time, last_error, recovery_status, updated_at, created_at, id
2. Unique constraint on (application_id, payment_intent_id)
3. application_id references permit_applications.id
4. Has an 'id' column (seen in DELETE's RETURNING clause)
5. Uses PostgreSQL-specific features (intervals)

### What We CANNOT Determine from Code:
1. Whether 'id' is integer or UUID (code never generates or inserts it)
2. Exact SQL data types of columns
3. Whether there are other columns not referenced in queries

## permit_applications Table

Source: `src/repositories/application.repository.js`

### Columns Referenced in SQL:
- id (used in WHERE and JOIN conditions)
- user_id (foreign key to users.id)
- status (varchar - compared to string constants like 'PERMIT_READY')
- payment_reference
- nombre_completo
- marca
- linea
- ano_modelo
- color
- numero_serie
- numero_motor
- curp_rfc
- domicilio
- importe
- folio
- fecha_vencimiento
- created_at
- updated_at
- permit_file_path
- certificado_file_path
- placas_file_path
- expires_at
- payment_initiated_at
- queue_status
- queue_position
- queue_entered_at
- queue_started_at
- queue_completed_at
- queue_duration_ms
- queue_error
- puppeteer_error_at
- puppeteer_error_message
- puppeteer_screenshot_path
- admin_resolution_notes
- resolved_by_admin
- resolved_at
- renewed_from_id (self-referencing foreign key)
- renewal_count

### Special SQL Features Used:
- INTERVAL calculations: `fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')`
- CONCAT function: `CONCAT(u.first_name, ' ', u.last_name)`
- CASE statements for computed columns
- ILIKE for case-insensitive search
- CAST(pa.id AS TEXT) for text conversion

## Key Findings:

1. **No UUID Generation in Code**: The code never generates UUIDs. If a table has UUID primary keys, they must be generated by the database.

2. **payment_recovery_attempts**: 
   - Code expects an 'id' column (seen in RETURNING clause)
   - But code never inserts or generates this id
   - Could be integer or UUID - code doesn't care

3. **Foreign Key Relationships**:
   - payment_recovery_attempts.application_id -> permit_applications.id
   - permit_applications.user_id -> users.id
   - permit_applications.resolved_by_admin -> users.id
   - permit_applications.renewed_from_id -> permit_applications.id

4. **PostgreSQL-Specific Features**:
   - INTERVAL syntax
   - JSONB operators (->>, ->, ::numeric casting)
   - Window functions (ROW_NUMBER() OVER)
   - CTEs (WITH clauses)
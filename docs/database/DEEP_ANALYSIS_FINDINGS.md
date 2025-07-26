# Deep Database Analysis - Complete Findings

## Critical Discovery: Missing Schema Exports

The agents reported creating `PRODUCTION_SCHEMA.md` and `LOCAL_SCHEMA.md` files, but these files **do not exist**. This means we cannot compare the actual production/local schemas with what the code expects.

## Tables Referenced in Code

Based on thorough analysis of SQL queries, the code references these 16 tables:

1. **users** - User accounts and authentication
2. **permit_applications** - Main application data (uses Spanish column names)
3. **payment_events** - Payment event tracking
4. **webhook_events** - Stripe webhook events
5. **security_audit_log** - Security audit trail
6. **password_reset_tokens** - Password reset tracking
7. **email_reminders** - Application reminder tracking
8. **queue_metrics** - PDF queue performance metrics
9. **payment_recovery_attempts** - Failed payment recovery
10. **pdf_generation_history** - PDF generation audit trail
11. **email_queue** - Email sending queue
12. **email_history** - Sent email history
13. **email_templates** - Email template storage
14. **email_blacklist** - Blocked email addresses
15. **sessions** - User session management
16. **pgmigrations** - Database migration tracking (system table)

## Confirmed Issues from Code Analysis

### 1. Missing Column: `password_reset_tokens.used_at`

**Evidence** (user.repository.js line 436):
```sql
AND prt_active.used_at IS NULL
```
The code queries this column but it doesn't exist in the schema.

### 2. Column Name Mismatch: `email_reminders.email_address`

**Evidence** (reminder.repository.js line 81):
```sql
INSERT INTO email_reminders (application_id, user_id, reminder_type, email_address, expires_at, sent_at)
```
The code expects `email_address` column, not `email_sent_to`.

### 3. Broken Migration: Performance Indexes

Migration `2025070300000_add_performance_indexes.js` tries to create indexes on non-existent columns:
- `payment_events.payment_intent_id`
- `payment_events.status`

### 4. `queue_metrics` Structure Issue

**Code expects individual columns** (monitoring.repository.js lines 18-23):
```sql
SELECT 
  queue_length,
  active_jobs,
  average_wait_time_ms,
  average_processing_time_ms,
  total_completed,
  total_failed
```

But the migration might only provide generic JSONB structure.

## Key Insights

### No UUID Generation in Code
- The code **never** generates UUIDs
- No uuid libraries imported
- BaseRepository doesn't generate primary keys
- Code relies entirely on database auto-generation
- Therefore: UUID vs Integer primary key type is **irrelevant** to the code

### Query Patterns
- Raw SQL queries using `pg` library
- Some repositories use query builder pattern (email queue)
- PostgreSQL-specific features heavily used:
  - INTERVAL syntax
  - JSONB operators (->>, ->)
  - Window functions
  - CTEs (WITH clauses)

### Foreign Key Relationships
All confirmed from JOIN queries:
- `permit_applications.user_id` → `users.id`
- `payment_recovery_attempts.application_id` → `permit_applications.id`
- `permit_applications.resolved_by_admin` → `users.id`
- `permit_applications.renewed_from_id` → `permit_applications.id` (self-ref)
- `email_reminders.user_id` → `users.id`
- `email_reminders.application_id` → `permit_applications.id`

## What We Still Don't Know

1. **Which 2 extra tables are in production** - Without the schema exports, we can't identify them
2. **Exact column data types** - Code doesn't specify, only JavaScript types passed
3. **All columns in each table** - Code only references columns it uses
4. **Default values and constraints** - Not visible from SQL queries

## Action Items

1. **CRITICAL**: Re-export production and local schemas - the files are missing!
2. **Fix Missing Column**: Add `used_at` to `password_reset_tokens`
3. **Fix Column Name**: Rename to `email_address` in `email_reminders` 
4. **Fix Migration**: Remove or update indexes for non-existent columns
5. **Verify Structure**: Check if `queue_metrics` has individual columns or JSONB

## Summary

The initial analysis claiming UUID mismatches was **incorrect**. The real issues are:
- One missing column (`used_at`)
- One column name mismatch (`email_address`)
- One broken migration
- Missing schema export files preventing complete analysis
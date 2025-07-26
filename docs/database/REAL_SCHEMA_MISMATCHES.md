# Real Schema Mismatches - Code vs Production

Based on actual SQL query analysis, not assumptions.

## Confirmed Findings:

### 1. No UUID Generation in Code
- **Finding**: The code NEVER generates UUIDs
- **Evidence**: No uuid libraries imported, no UUID generation code found
- **Conclusion**: If production uses UUID primary keys, they must be database-generated

### 2. payment_recovery_attempts Table

**What the code expects (from SQL queries):**
- Columns: application_id, payment_intent_id, attempt_count, last_attempt_time, last_error, recovery_status, updated_at, created_at, id
- Unique constraint on (application_id, payment_intent_id)
- Has an 'id' column (seen in DELETE RETURNING clause)

**What production has:**
- Uses integer sequence for id: `payment_recovery_attempts_id_seq`

**Verdict**: ✅ NO MISMATCH - Code doesn't care if id is integer or UUID

### 3. Primary Key Types - THE REAL STORY

After thorough analysis:
- Code NEVER generates any primary keys
- Code uses whatever the database provides via RETURNING clauses
- The BaseRepository just inserts data without generating ids

**Therefore**: Whether a table uses integer or UUID primary keys is irrelevant to the code.

## ACTUAL Critical Issues Found:

### 1. Missing Column: password_reset_tokens.used_at

**Evidence from code** (`user.repository.js` line 436):
```sql
LEFT JOIN password_reset_tokens prt_active ON u.id = prt_active.user_id 
  AND prt_active.expires_at > CURRENT_TIMESTAMP 
  AND prt_active.used_at IS NULL
```

**Issue**: Code queries for `used_at` column that doesn't exist in production

### 2. Possible Column Name Mismatch

Need to verify if production has these exact column names:
- `email_reminders.email_sent_to` vs `email_address` (code might use either)
- Check actual usage in reminder service

### 3. Migration Issues (from previous analysis)

Migration `2025070300000_add_performance_indexes.js` tries to create indexes on:
- `payment_events.payment_intent_id` (column doesn't exist)
- `payment_events.status` (column doesn't exist)

## What Actually Needs Fixing:

1. **Add missing column**:
   ```sql
   ALTER TABLE password_reset_tokens ADD COLUMN used_at TIMESTAMP;
   ```

2. **Fix or remove broken migration** that references non-existent columns

3. **Verify email_reminders column names** match what the code uses

## What Does NOT Need Fixing:

1. **UUID vs Integer primary keys** - Code doesn't care
2. **Table names** - All match correctly (webhook_events, security_audit_log, sessions)
3. **Most column references** - They exist and match

## Summary:

The initial analysis was wrong because it assumed:
- Code generates UUIDs (it doesn't)
- Code cares about primary key types (it doesn't)
- Table name mismatches (they actually match)

The real issues are much smaller:
- One missing column (password_reset_tokens.used_at)
- One broken migration
- Need to verify one column name
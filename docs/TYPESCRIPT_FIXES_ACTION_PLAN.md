# TypeScript Fixes - Action Plan

## Immediate Actions (Start Here)

### 1. Install Missing Dependencies (5 minutes)
```bash
cd frontend
npm install --save-dev @types/jest @types/mocha
```

### 2. Fix Critical Missing Imports (30 minutes)
These are blocking the build completely:

#### FormDebugger Import
```typescript
// File: src/components/forms/FormWizard.tsx
// Line 4: import FormDebugger from '../debug/FormDebugger';
// Action: Either create the missing component or remove the import
```

#### useAuth Import  
```typescript
// File: src/components/layout/Sidebar/Sidebar.tsx
// Line 6: import useAuth from '../../../hooks/useAuth';
// Action: Fix the import path or create the missing hook
```

### 3. Fix Legacy Status Values in Tests (45 minutes)
Run this command to find all files:
```bash
grep -r "PENDING_PAYMENT\|PROOF_REJECTED\|PROOF_SUBMITTED" src/
```

**Replace these values**:
- `PENDING_PAYMENT` → `AWAITING_OXXO_PAYMENT`
- `PROOF_REJECTED` → `PAYMENT_FAILED`
- `PROOF_SUBMITTED` → Remove (no longer used)

**Key files to update**:
- `src/components/permit/__tests__/StatusTimeline.test.tsx`
- `src/pages/__tests__/PermitRenewalPage.test.tsx`
- Any other test files found by the grep command

### 4. Fix ApplicationDetails Interface Issues (60 minutes)

#### Problem
Many components expect properties that no longer exist in the current system.

#### Solution
Create a backward-compatible interface:

```typescript
// File: src/services/applicationService.ts
// Add this interface:

interface LegacyApplicationDetails extends ApplicationDetails {
  // Legacy properties for backward compatibility
  paymentReference?: string;
  payment_rejection_reason?: string;
  payment_proof_uploaded_at?: string;
  permit_file_path?: string;
  recibo_file_path?: string;
  certificado_file_path?: string;
  placas_file_path?: string;
}

// Update ApplicationStatusResponse to use the legacy interface:
export interface ApplicationStatusResponse {
  application: LegacyApplicationDetails;
  // ... other properties
}
```

## Phase 2: Type Safety Improvements (2-3 hours)

### 1. Fix Mock Data Types
Update all mock data to match current interfaces:

```typescript
// File: src/test/mocks/applicationService.ts
// Fix ano_modelo type (should be number, not string)
// Remove legacy properties
// Update status values
```

### 2. Fix Component Prop Types
Update components that have type mismatches:

```typescript
// File: src/components/permit/RenewalEligibility.tsx
// Fix Application type mismatch

// File: src/pages/CompletePermitFormPage.tsx  
// Fix email property issue in ApplicationFormData
```

### 3. Clean Up Type Assertions
Replace `as any` with proper types:

```typescript
// Instead of:
(applicationData?.application as any)?.paymentReference

// Use:
(applicationData?.application as LegacyApplicationDetails)?.paymentReference
```

## Phase 3: Test Fixes (1-2 hours)

### 1. Update Test Utilities
```typescript
// File: src/test/test-utils.tsx
// Already fixed - verify it works correctly
```

### 2. Fix Test Data
Update all test files to use current types and status values.

### 3. Fix Test Imports
Many test files have incorrect import paths - fix these systematically.

## Phase 4: Configuration & Polish (1 hour)

### 1. Fix Vite Configuration
```typescript
// File: vite.config.ts
// Fix import.meta.env issue
```

### 2. Clean Up Unused Variables
Remove variables prefixed with `_` that are marked as unused.

### 3. Fix Icon Component Issues
```typescript
// File: src/shared/components/ui/Icon/MigrationExample.tsx
// Remove style prop or add it to IconProps interface
```

## Verification Steps

After each phase, run these commands:

```bash
# Check error count
npm run build 2>&1 | grep -c "error TS"

# Check for specific error types
npm run build 2>&1 | grep "Cannot find module" | wc -l
npm run build 2>&1 | grep "not assignable to type" | wc -l
npm run build 2>&1 | grep "does not exist on type" | wc -l
```

## Expected Timeline

- **Phase 1**: 2-3 hours → Should reduce errors to ~150
- **Phase 2**: 2-3 hours → Should reduce errors to ~80  
- **Phase 3**: 1-2 hours → Should reduce errors to ~30
- **Phase 4**: 1 hour → Should reduce errors to 0-10

**Total Estimated Time**: 6-9 hours

## Success Criteria

✅ **Phase 1 Complete**: Build runs without "Cannot find module" errors
✅ **Phase 2 Complete**: No "not assignable to type" errors for core interfaces  
✅ **Phase 3 Complete**: All tests can be imported and run
✅ **Phase 4 Complete**: Clean build with 0 TypeScript errors

## Emergency Shortcuts

If you need a working build quickly:

### Option 1: Disable Strict Type Checking
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false
  }
}
```

### Option 2: Add Global Type Declarations
```typescript
// src/types/global.d.ts
declare module '*' {
  const content: any;
  export default content;
}
```

### Option 3: Suppress Specific Errors
```typescript
// Add to files with persistent errors:
// @ts-ignore
// or
// eslint-disable-next-line @typescript-eslint/no-explicit-any
```

**Note**: These shortcuts should only be used temporarily and proper fixes should be implemented as soon as possible.

## Getting Help

If you get stuck:

1. **Check the git history**: `git log --oneline -10` to see recent changes
2. **Compare with working version**: Check if there's a working branch to compare against
3. **Focus on one error type**: Don't try to fix everything at once
4. **Use TypeScript playground**: Test complex type definitions online
5. **Check the original interfaces**: Look at the backend API to understand expected types

## Contact

For questions about the architecture decisions or if you need clarification on any of the changes made, refer to the commit messages and the main documentation file: `docs/TYPESCRIPT_ERROR_FIXES.md`

# Comprehensive Code Audit Execution Plan

## Overview

This document provides a systematic approach to conducting a comprehensive code audit of the Permisos Digitales application, focusing on removing dead code, unused dependencies, and obsolete features while ensuring no active functionality is broken.

## Phase 1: Preparation and Analysis (Day 1)

### 1.1 Install Required Tools

```bash
# Backend analysis tools
npm install --save-dev depcheck jsinspect

# Frontend analysis tools  
cd frontend
npm install --save-dev unimported ts-unused-exports purifycss-webpack uncss
cd ..
```

### 1.2 Run Automated Analysis

```bash
# Run comprehensive code audit
npm run audit:full

# Run database analysis (requires database connection)
npm run audit:database

# Additional manual checks
cd frontend
npx depcheck --json > ../audit-results/frontend-deps.json
npx ts-unused-exports tsconfig.json > ../audit-results/unused-exports.txt
npx unimported > ../audit-results/unimported-files.txt
cd ..

npx depcheck --json > audit-results/backend-deps.json
```

### 1.3 Create Audit Results Directory

```bash
mkdir -p audit-results
```

## Phase 2: Dependency Cleanup (Day 2)

### 2.1 Backend Dependencies to Remove

**Confirmed for Removal (Frontend-only packages in backend):**
```bash
npm uninstall @chakra-ui/react @emotion/react @emotion/styled framer-motion
```

**Investigate and Potentially Remove:**
```bash
# Check usage before removing
grep -r "body-parser" src/
npm uninstall body-parser  # If Express built-in is sufficient

grep -r "memorystore" src/
npm uninstall memorystore  # If only used in development
```

### 2.2 Frontend Dependencies to Investigate

```bash
cd frontend

# Check if these are actually used
npm ls @types/uuid
npm ls uuid
grep -r "uuid" src/

# Check framer-motion usage after Chakra UI removal
grep -r "framer-motion" src/
```

### 2.3 Update Package.json Files

Remove unused dependencies identified in Phase 1 analysis.

## Phase 3: Dead Code Removal (Days 3-4)

### 3.1 Remove Deprecated Components

**Frontend Components to Remove:**
- Search and remove any remaining references to:
  - `HeroPermitCard`
  - `PermitsOverview` 
  - `TodaysFocus`
  - `GuidanceCenter`

```bash
# Search for deprecated components
cd frontend
grep -r "HeroPermitCard" src/
grep -r "PermitsOverview" src/
grep -r "TodaysFocus" src/
grep -r "GuidanceCenter" src/
```

### 3.2 Remove Deprecated Files

```bash
# Remove deprecated CSS file
rm frontend/src/styles/mobile-touch-targets.css

# Update imports that reference the removed file
grep -r "mobile-touch-targets" frontend/src/
```

### 3.3 Clean Up Type Definitions

Edit `frontend/src/types/permisos.ts`:
- Remove deprecated interfaces marked with `@deprecated`
- Remove `FocusItemProps` and `PermitCardProps` interfaces

### 3.4 Remove "Mis Documentos" Functionality

```bash
# Search for any remaining references
grep -r "Mis Documentos" frontend/src/
grep -r "mis-documentos" frontend/src/
```

## Phase 4: Database Schema Cleanup (Day 5)

### 4.1 Analyze Database Schema

```bash
npm run audit:database
```

### 4.2 Remove Deprecated Database Elements

**Tables to Investigate:**
- `payment_verification_log` (exists in backup but not current schema)

**Columns to Remove (if they exist):**
- `payment_proof_uploaded_at` from `permit_applications`
- Any other deprecated payment verification columns

### 4.3 Create Cleanup Migration

```bash
npm run migrate:create cleanup_deprecated_schema
```

Example migration content:
```sql
-- Remove deprecated columns if they exist
ALTER TABLE permit_applications DROP COLUMN IF EXISTS payment_proof_uploaded_at;
ALTER TABLE permit_applications DROP COLUMN IF EXISTS payment_verified_by;
ALTER TABLE permit_applications DROP COLUMN IF EXISTS payment_verified_at;
ALTER TABLE permit_applications DROP COLUMN IF EXISTS payment_rejection_reason;

-- Drop deprecated table if it exists
DROP TABLE IF EXISTS payment_verification_log;
```

## Phase 5: CSS and Styling Cleanup (Day 6)

### 5.1 Remove Unused CSS Modules

```bash
cd frontend
# Find CSS modules that aren't imported
find src -name "*.module.css" | while read css_file; do
  module_name=$(basename "$css_file" .module.css)
  if ! grep -r "from.*${module_name}.*module\.css" src/ > /dev/null; then
    echo "Potentially unused: $css_file"
  fi
done
```

### 5.2 Clean Up CSS Variables

Review `frontend/src/styles/variables.css` for unused CSS custom properties.

### 5.3 Remove Chakra UI Remnants

```bash
# Search for any remaining Chakra UI references
grep -r "chakra" frontend/src/
grep -r "emotion" frontend/src/
grep -r "useColorMode" frontend/src/
```

## Phase 6: Route and API Cleanup (Day 7)

### 6.1 Frontend Route Analysis

```bash
cd frontend
# Find unused page components
find src/pages -name "*.tsx" | while read page; do
  component=$(basename "$page" .tsx)
  if ! grep -r "$component" src/ --exclude-dir=pages > /dev/null; then
    echo "Potentially unused page: $page"
  fi
done
```

### 6.2 Backend API Endpoint Analysis

```bash
# Find unused route files
find src/routes -name "*.js" | while read route; do
  route_name=$(basename "$route" .js)
  if ! grep -r "$route_name" src/server.js src/routes/index.js > /dev/null; then
    echo "Potentially unused route: $route"
  fi
done

# Find unused middleware
find src/middleware -name "*.js" | while read middleware; do
  middleware_name=$(basename "$middleware" .js)
  if ! grep -r "$middleware_name" src/ --exclude-dir=middleware > /dev/null; then
    echo "Potentially unused middleware: $middleware"
  fi
done
```

## Phase 7: Testing and Validation (Day 8)

### 7.1 Run All Tests

```bash
# Backend tests
npm test

# Frontend tests  
cd frontend
npm test
cd ..
```

### 7.2 Manual Testing

- Test all major user flows
- Verify admin functionality
- Test payment processing
- Verify permit generation

### 7.3 Performance Testing

```bash
cd frontend
npm run build
# Analyze bundle size
npx vite-bundle-analyzer dist
```

## Phase 8: Documentation and Cleanup (Day 9)

### 8.1 Update Documentation

- Update README.md with removed features
- Update API documentation
- Update component documentation

### 8.2 Final Cleanup

```bash
# Remove audit tools if no longer needed
npm uninstall depcheck jsinspect

cd frontend  
npm uninstall unimported ts-unused-exports purifycss-webpack uncss
cd ..

# Clean up audit results
rm -rf audit-results/
```

## Safety Checklist

Before removing any code or dependencies:

- [ ] Verify the item is not referenced anywhere in the codebase
- [ ] Check if it's used in tests
- [ ] Ensure it's not required for build processes
- [ ] Confirm it's not needed for deployment
- [ ] Test the application after removal
- [ ] Have a rollback plan ready

## Risk Mitigation

1. **Create a backup branch** before starting major removals
2. **Remove items incrementally** and test after each removal
3. **Keep detailed logs** of what was removed and why
4. **Have database backups** before schema changes
5. **Test thoroughly** in a staging environment first

## Success Metrics

- Reduced bundle size (frontend)
- Fewer dependencies in package.json files
- Cleaner codebase with no dead code
- Improved build times
- Maintained functionality and test coverage
- Updated documentation reflecting current state

## Post-Audit Maintenance

- Set up automated dependency checking in CI/CD
- Regular code reviews to prevent dead code accumulation
- Quarterly dependency audits
- Documentation of architectural decisions

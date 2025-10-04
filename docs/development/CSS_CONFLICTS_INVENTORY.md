# CSS Conflicts Inventory - Immediate Action Required

## CRITICAL CONFLICTS IDENTIFIED

### 1. Primary Color Mismatch
- **File 1**: `frontend/src/styles/variables.css:8` → `--color-primary: #a72b31`
- **File 2**: `frontend/src/styles/design-system.css:13` → `--color-brand: #B5384D` 
- **Status**: `design-system.css` is UNUSED (only referenced in demo routes)
- **Action**: Remove `design-system.css` safely

### 2. Z-Index Conflicts
- **Variables.css** (lines 213-223): Proper z-index scale with CSS variables
- **MobileNavigation.module.css**: Hardcoded values (1000, 1001, 1002, 1003)
- **MobileNavigation.fix.css**: Mixed approach (some variables, some hardcoded)
- **Action**: Migrate mobile navigation to use variables.css z-index scale

### 3. Breakpoint Inconsistencies
- **Variables.css**: `--breakpoint-xs: 360px, --breakpoint-md: 768px`
- **Components**: Hardcoded `(max-width: 768px)`, `(max-width: 360px)`
- **Action**: Replace hardcoded breakpoints with CSS variables

### 4. Font Size Conflicts
- **Variables.css**: `--font-size-base: 1rem`
- **Design-system.css**: `--font-size-base: 1rem` (same) but different mobile override
- **Mobile overrides**: Different approaches in multiple files
- **Action**: Consolidate mobile font size strategy

### 5. Spacing System Conflicts
- **Variables.css**: Uses `--space-1` through `--space-9` system
- **Design-system.css**: Uses `--spacing-xs` through `--spacing-3xl` system
- **Action**: Standardize on variables.css spacing system

## FILES NEEDING IMMEDIATE ATTENTION

### High Priority (Production Impact)
1. `frontend/src/components/navigation/MobileNavigation/MobileNavigation.module.css`
2. `frontend/src/components/navigation/MobileNavigation/MobileNavigation.fix.css` 
3. `frontend/src/styles/mobile-form-utilities.css`
4. `frontend/src/styles/text-standardization.css`

### Medium Priority (Cleanup)
1. `frontend/src/styles/design-system.css` - REMOVE (unused)
2. `frontend/src/styles/button-styles.css` - Check for hardcoded breakpoints
3. All `*.module.css` files with hardcoded breakpoints

## SAFE REMOVAL CANDIDATES
- `design-system.css` - Only used in demo routes, safe to remove
- `MobileNavigation.fix.css` - Indicates unresolved issues, needs investigation

## IMMEDIATE ACTION STEPS (Safe & Non-Breaking)

### Step 1: Remove Unused CSS (Safe)
- Delete `design-system.css` (unused in production)

### Step 2: Add Transitional Variables (Additive)
- Add missing z-index variables to components
- Keep old values as fallbacks initially

### Step 3: Update Import Order (Test First)
- Ensure variables.css loads before all other CSS
- Test on staging before production

### Step 4: Component-by-Component Migration
- Start with MobileNavigation (most critical)
- Test each change in isolation
- Keep rollback plan ready
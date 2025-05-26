# Icon Component Migration Strategy

This document outlines a comprehensive strategy for migrating from direct react-icons usage to the new centralized Icon component.

## Migration Phases

### Phase 1: Core Components (1-2 days)

Start with the most frequently used shared components:

1. **Toast Component**

   - Update `Toast.tsx` to use the Icon component for status icons and close button
   - Ensure tests still pass after migration

2. **Button Component**

   - Update `Button.tsx` to wrap icons in the Icon component
   - This will automatically apply to all buttons in the application

3. **Navigation Components**
   - Update sidebar navigation icons in `UserLayout.tsx` and `AdminLayout.tsx`
   - Update mobile navigation components

### Phase 2: Dashboard Components (2-3 days)

Focus on high-visibility dashboard components:

1. **HeroPermitCard**

   - Update status icons and action button icons

2. **PermitsOverview**

   - Update CTA icons and status indicators

3. **TodaysFocus**

   - Update all status and action icons

4. **GuidanceCenter**
   - Update utility icons and action indicators

### Phase 3: Form and Table Components (2-3 days)

Update form-related components:

1. **Form Controls**

   - Update icons in Input, Select, Checkbox components

2. **Table Components**

   - Update sort icons, action icons, and status indicators in tables

3. **Pagination**
   - Update navigation arrows and indicators

### Phase 4: Remaining Components (3-4 days)

Systematically update all remaining components:

1. **Modal Components**

   - Update close icons and action indicators

2. **Card Components**

   - Update card icons and action buttons

3. **Utility Components**
   - Update any remaining utility components with icons

### Phase 5: Testing and Refinement (2-3 days)

Comprehensive testing and refinement:

1. **Visual Testing**

   - Verify all icons appear correctly across the application
   - Check responsive behavior on different screen sizes

2. **Functional Testing**

   - Ensure all interactive behaviors still work as expected
   - Verify accessibility with screen readers

3. **Performance Testing**
   - Check for any performance impacts
   - Optimize if necessary

## Finding Existing Usages

Use the following search patterns in your IDE to find all react-icons usages:

1. **Import Statements**

   - `import { Fa` (Font Awesome icons)
   - `import { Bs` (Bootstrap icons)
   - `import { Md` (Material Design icons)
   - `import { Io` (Ionicons)
   - `import { Gi` (Game icons)

2. **JSX Usage**

   - `<Fa` (Font Awesome components)
   - `<Bs` (Bootstrap components)
   - `<Md` (Material Design components)

3. **Dynamic Icon Rendering**
   - Search for functions that return icon components
   - Look for switch statements that select different icons

## Transformation Patterns

### Basic Transformation

```tsx
// Before
<FaCheckCircle />

// After
<Icon IconComponent={FaCheckCircle} />
```

### With Existing Class Names

```tsx
// Before
<FaCheckCircle className="status-icon" />

// After
<Icon IconComponent={FaCheckCircle} className="status-icon" />
```

### With Inline Styles

```tsx
// Before
<FaCheckCircle style={{ fontSize: '24px', color: 'red' }} />

// After
<Icon IconComponent={FaCheckCircle} size="24px" color="red" />
```

### With Event Handlers

```tsx
// Before
<FaCheckCircle onClick={handleClick} />

// After
<Icon IconComponent={FaCheckCircle} onClick={handleClick} />
```

### In Button Components

```tsx
// Before
<Button icon={<FaDownload />}>Download</Button>

// After
<Button icon={<Icon IconComponent={FaDownload} />}>Download</Button>
```

### Dynamic Icon Selection

```tsx
// Before
const getIcon = (type) => {
  switch (type) {
    case 'success':
      return <FaCheckCircle />;
    case 'error':
      return <FaExclamationCircle />;
    default:
      return <FaInfoCircle />;
  }
};

// After
const getIcon = (type) => {
  switch (type) {
    case 'success':
      return <Icon IconComponent={FaCheckCircle} />;
    case 'error':
      return <Icon IconComponent={FaExclamationCircle} />;
    default:
      return <Icon IconComponent={FaInfoCircle} />;
  }
};
```

## Considerations for Existing Custom Styling

### CSS Modules

If you have CSS that targets icon elements directly, update selectors:

```css
/* Before */
.container svg {
  margin-right: 8px;
}

/* After */
.container .iconBase {
  margin-right: 8px;
}
```

### Inline Styles

Map inline styles to Icon props:

- `fontSize` → `size` prop
- `color` → `color` prop
- Other styles → Keep as inline styles on the Icon component

### Global Classes

If using global classes for icons, you can:

1. Keep applying them via the `className` prop
2. Consider migrating to the standardized sizing system

## Incremental Approach

For a smooth transition:

1. **Start with new components**: Use the Icon component for all new development
2. **Migrate by feature area**: Update one feature or page at a time
3. **Prioritize high-visibility areas**: Start with components that appear frequently
4. **Update shared components first**: Components like Button, Toast, etc.

## Effort Estimation

- **Total components to update**: ~50-60 components
- **Estimated time per component**: 15-30 minutes
- **Total estimated effort**: 15-30 hours (2-4 days of focused work)

This can be spread across multiple developers or done incrementally over a longer period.

## Rollback Plan

If issues arise:

1. Keep both approaches working side by side during migration
2. Test thoroughly before committing changes
3. If needed, revert to direct react-icons usage in problematic components

## Success Criteria

The migration is successful when:

1. All direct react-icons usage is replaced with the Icon component
2. Visual appearance is consistent with the previous implementation
3. All functionality works as expected
4. All tests pass
5. No performance regressions are observed

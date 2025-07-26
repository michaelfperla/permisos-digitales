# Icon Component Migration Guide

This guide provides a step-by-step approach to migrate from direct react-icons usage to the new centralized Icon component.

## Why Migrate?

The new Icon component provides several benefits:

- **Consistent styling** across the application
- **Standardized sizing** with predefined options
- **Improved accessibility** with proper ARIA attributes
- **Easier maintenance** when icon styling needs to change
- **Better developer experience** with clear props and documentation

## Migration Steps

### 1. Find Existing Icon Usages

Use search functionality in your IDE to find all instances of react-icons imports and usage:

- Search for `import { Fa` to find Font Awesome icons
- Search for `import { Bs` to find Bootstrap icons
- Search for `import { Md` to find Material Design icons
- Search for other icon libraries as needed

### 2. Update Imports

For each file using react-icons:

1. Keep the original icon import
2. Add import for the Icon component:

```tsx
// Before
import { FaCheckCircle } from 'react-icons/fa';

// After
import { FaCheckCircle } from 'react-icons/fa';
import Icon from '@/shared/components/ui/Icon';
```

### 3. Replace Direct Usage with Icon Component

#### Basic Replacement

```tsx
// Before
<FaCheckCircle />

// After
<Icon IconComponent={FaCheckCircle} />
```

#### With Existing Class Names

```tsx
// Before
<FaCheckCircle className="status-icon" />

// After
<Icon IconComponent={FaCheckCircle} className="status-icon" />
```

#### With Inline Styles

```tsx
// Before
<FaCheckCircle style={{ fontSize: '24px', color: 'red' }} />

// After
<Icon IconComponent={FaCheckCircle} size="24px" color="red" />
```

#### With Event Handlers or Other Props

```tsx
// Before
<FaCheckCircle onClick={handleClick} data-testid="check-icon" />

// After
<Icon
  IconComponent={FaCheckCircle}
  onClick={handleClick}
  data-testid="check-icon"
/>
```

### 4. Handle Special Cases

#### Icons in Buttons

When using the Button component with an icon:

```tsx
// Before
<Button icon={<FaDownload />}>Download</Button>

// After
<Button icon={<Icon IconComponent={FaDownload} />}>Download</Button>
```

#### Standalone Icons that Convey Meaning

For icons that convey meaning without accompanying text:

```tsx
// Before
<FaExclamationCircle aria-label="Warning" role="img" />

// After
<Icon
  IconComponent={FaExclamationCircle}
  decorative={false}
  ariaLabel="Warning"
/>
```

### 5. Update CSS if Needed

If you have CSS that targets icon elements directly, you may need to update selectors:

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

## Incremental Migration Strategy

For large codebases, consider an incremental approach:

1. **Start with new components**: Use the Icon component for all new development
2. **Migrate by feature area**: Update one feature or page at a time
3. **Prioritize high-visibility areas**: Start with components that appear frequently
4. **Update shared components first**: Components like Button, Toast, etc.

## Testing After Migration

After migrating icons in a component:

1. Visually verify that icons appear with correct size and color
2. Check that interactive behaviors still work
3. Verify accessibility with screen readers if applicable
4. Run existing tests to ensure functionality is preserved

## Common Patterns to Look For

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

### Icon with Dynamic Color

```tsx
// Before
<FaCircle style={{ color: status === 'active' ? 'green' : 'red' }} />

// After
<Icon
  IconComponent={FaCircle}
  color={status === 'active' ? 'green' : 'red'}
/>
```

# Icon Component

The Icon component provides a standardized way to use icons throughout the application, ensuring consistent styling, sizing, and accessibility.

## Features

- **Consistent Styling**: All icons use the same base styling for alignment and display
- **Standardized Sizes**: Predefined sizes (xs, sm, md, lg, xl) for consistent icon sizing
- **Custom Sizing**: Support for custom sizes using any valid CSS size value
- **Color Control**: Apply any color to icons using CSS variables or direct color values
- **Accessibility**: Built-in accessibility support with proper ARIA attributes

## Usage

### Basic Usage

```tsx
import Icon from '@/shared/components/ui/Icon';
import { FaCheckCircle } from 'react-icons/fa';

// Basic usage with default size (md)
<Icon IconComponent={FaCheckCircle} />

// With predefined size
<Icon IconComponent={FaCheckCircle} size="lg" />

// With custom size
<Icon IconComponent={FaCheckCircle} size="2rem" />

// With color
<Icon IconComponent={FaCheckCircle} color="var(--color-success)" />

// With custom class
<Icon IconComponent={FaCheckCircle} className="custom-icon-class" />
```

### Accessibility

By default, icons are treated as decorative elements with `aria-hidden="true"`. For icons that convey meaning:

```tsx
// Non-decorative icon with accessibility label
<Icon IconComponent={FaExclamationCircle} decorative={false} ariaLabel="Warning" />
```

## Props

| Prop            | Type                                             | Default     | Description                                              |
| --------------- | ------------------------------------------------ | ----------- | -------------------------------------------------------- |
| `IconComponent` | `React.ComponentType<any>`                       | (required)  | The icon component from react-icons                      |
| `size`          | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| string` | `'md'`      | Size of the icon                                         |
| `color`         | `string`                                         | (inherited) | Color of the icon                                        |
| `className`     | `string`                                         | `''`        | Additional CSS class names                               |
| `ariaLabel`     | `string`                                         | `undefined` | Accessibility label (required when `decorative={false}`) |
| `decorative`    | `boolean`                                        | `true`      | Whether the icon is purely decorative                    |

## Size Reference

| Size | Value    |
| ---- | -------- |
| `xs` | 0.75rem  |
| `sm` | 0.875rem |
| `md` | 1rem     |
| `lg` | 1.25rem  |
| `xl` | 1.5rem   |

## Migration from Direct react-icons Usage

When migrating from direct react-icons usage to the Icon component:

1. Import the Icon component: `import Icon from '@/shared/components/ui/Icon';`
2. Replace direct icon usage with the Icon component:

```tsx
// Before
import { FaCheckCircle } from 'react-icons/fa';
<FaCheckCircle className="icon" />;

// After
import Icon from '@/shared/components/ui/Icon';
import { FaCheckCircle } from 'react-icons/fa';
<Icon IconComponent={FaCheckCircle} className="icon" />;
```

3. Map existing size/color styles to Icon props:

```tsx
// Before
<FaCheckCircle style={{ fontSize: '24px', color: 'red' }} />

// After
<Icon IconComponent={FaCheckCircle} size="24px" color="red" />
```

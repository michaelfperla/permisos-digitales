import React, { ReactNode } from 'react';
import styles from './ResponsiveContainer.module.css';

/**
 * Props for the ResponsiveContainer component
 *
 * @interface ResponsiveContainerProps
 */
export interface ResponsiveContainerProps {
  /**
   * The content to be rendered inside the container
   */
  children: ReactNode;

  /**
   * Additional CSS class names to apply to the container
   */
  className?: string;

  /**
   * Whether to use fluid width (100% with padding) or fixed width (max-width at breakpoints)
   * - 'fluid': Container will always be 100% width with padding
   * - 'fixed': Container will have max-width constraints at different breakpoints
   * @default 'fixed'
   */
  type?: 'fluid' | 'fixed';

  /**
   * Whether to add responsive padding to the container
   * When true, applies padding that adapts to screen size using fluid spacing variables
   * @default true
   */
  withPadding?: boolean;

  /**
   * Maximum width of the container (only applies when type='fixed')
   * - 'sm': 540px max-width
   * - 'md': 720px max-width
   * - 'lg': 960px max-width
   * - 'xl': 1140px max-width
   * - 'xxl': 1200px max-width (equivalent to the global .container class)
   * - 'none': No max-width constraint
   * @default 'xl'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'none';
}

/**
 * ResponsiveContainer component for creating standardized responsive layouts
 *
 * This is the standard container solution for the application, replacing the
 * global .container, .container-responsive, and .container-mobile classes.
 *
 * Features:
 * - Configurable max-width at different breakpoints
 * - Support for both fluid and fixed width modes
 * - Responsive padding that adapts to screen size
 * - Consistent with design system tokens and breakpoints
 *
 * Usage examples:
 * ```tsx
 * // Basic usage (fixed width with xl max-width and padding)
 * <ResponsiveContainer>
 *   <YourContent />
 * </ResponsiveContainer>
 *
 * // Equivalent to the global .container class (1200px max-width)
 * <ResponsiveContainer maxWidth="xxl">
 *   <YourContent />
 * </ResponsiveContainer>
 *
 * // Fluid container with padding (100% width)
 * <ResponsiveContainer type="fluid">
 *   <YourContent />
 * </ResponsiveContainer>
 *
 * // Fixed width container without padding
 * <ResponsiveContainer withPadding={false}>
 *   <YourContent />
 * </ResponsiveContainer>
 * ```
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
  type = 'fixed',
  withPadding = true,
  maxWidth = 'xl',
}) => {
  // Create an array of class names to apply
  const classNames = [];

  // Add the base container type class (fixed or fluid)
  classNames.push(type === 'fixed' ? styles.fixed : styles.fluid);

  // Add padding class if withPadding is true
  if (withPadding) {
    classNames.push(styles.withPadding);
  }

  // Add max-width class if type is fixed and maxWidth is specified
  if (type === 'fixed' && maxWidth !== 'none') {
    // Convert maxWidth to the correct CSS class name format
    // e.g., 'xxl' becomes 'maxXXL'
    const maxWidthClass = `max${maxWidth.toUpperCase()}`;

    // Only add the class if it exists in the styles object
    if (styles[maxWidthClass]) {
      classNames.push(styles[maxWidthClass]);
    }
  }

  // Add any additional custom classes
  if (className) {
    classNames.push(className);
  }

  // Join all classes with spaces
  const containerClasses = classNames.join(' ');

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
};

export default ResponsiveContainer;

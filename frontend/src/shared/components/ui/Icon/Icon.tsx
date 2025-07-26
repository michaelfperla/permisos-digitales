import React from 'react';

import styles from './Icon.module.css';
import { logger } from '../../../../utils/logger';

export interface IconProps {
  /**
   * The icon component to render (from react-icons)
   * Example: FaCheckCircle, BsCalendarFill
   */
  IconComponent: React.ComponentType<any>;

  /**
   * Size of the icon
   * - xs: extra small (0.75rem)
   * - sm: small (0.875rem)
   * - md: medium (1rem) - default
   * - lg: large (1.25rem)
   * - xl: extra large (1.5rem)
   * - Or a custom size string (e.g., '2rem', '24px')
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;

  /**
   * Color of the icon
   * Can be a CSS variable (e.g., 'var(--color-primary)') or a direct color value
   */
  color?: string;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Accessibility label for the icon
   * Should be provided when the icon is used without accompanying text
   */
  ariaLabel?: string;

  /**
   * Whether the icon is purely decorative (true) or semantically meaningful (false)
   * If true, sets aria-hidden="true"
   * Default: true
   */
  decorative?: boolean;
}

/**
 * Icon component for consistent icon rendering throughout the application
 *
 * @example
 * // Basic usage
 * import { FaCheckCircle } from 'react-icons/fa';
 * <Icon IconComponent={FaCheckCircle} />
 *
 * @example
 * // With size and color
 * import { BsCalendarFill } from 'react-icons/bs';
 * <Icon IconComponent={BsCalendarFill} size="lg" color="var(--color-primary)" />
 *
 * @example
 * // With custom size
 * import { FaUser } from 'react-icons/fa';
 * <Icon IconComponent={FaUser} size="2rem" />
 *
 * @example
 * // Non-decorative icon with accessibility label
 * import { FaExclamationCircle } from 'react-icons/fa';
 * <Icon IconComponent={FaExclamationCircle} decorative={false} ariaLabel="Warning" />
 */
const Icon: React.FC<IconProps> = ({
  IconComponent,
  size = 'md',
  color,
  className = '',
  ariaLabel,
  decorative = true,
  ...restProps
}) => {
  // Determine the CSS class for predefined sizes
  const sizeClass = ['xs', 'sm', 'md', 'lg', 'xl'].includes(size as string)
    ? styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`]
    : '';

  // Combine CSS classes
  const combinedClasses = [styles.iconBase, sizeClass, className].filter(Boolean).join(' ');

  // Prepare inline styles for custom sizes and colors
  const inlineStyles: React.CSSProperties = {};

  // Apply custom size if not using a predefined size
  if (size && !sizeClass) {
    inlineStyles.fontSize = size;
  }

  // Apply color if provided
  if (color) {
    inlineStyles.color = color;
  }

  // Prepare accessibility attributes
  const a11yProps: {
    'aria-hidden'?: boolean;
    'aria-label'?: string;
    role?: string;
  } = {};

  if (decorative) {
    a11yProps['aria-hidden'] = true;
  } else {
    if (ariaLabel) {
      a11yProps['aria-label'] = ariaLabel;
      a11yProps.role = 'img';
    } else {
      logger.warn('Icon is marked as non-decorative but no ariaLabel was provided');
      a11yProps['aria-hidden'] = true;
    }
  }

  return (
    <span className={combinedClasses} style={inlineStyles} {...a11yProps} {...restProps}>
      <IconComponent />
    </span>
  );
};

export default Icon;

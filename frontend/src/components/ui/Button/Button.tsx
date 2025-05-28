import React, { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';

import styles from './Button.module.css';
import Icon from '../../../shared/components/ui/Icon';

// Type for props that are common to all button types
type CommonButtonProps = {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'info' | 'warning' | 'text';
  /**
   * Button size
   */
  size?: 'default' | 'small' | 'large' | 'icon';
  /**
   * Button content - optional for icon-only buttons
   */
  children?: React.ReactNode;
  /**
   * Additional class names
   */
  className?: string;
  /**
   * Icon to display with the button text
   */
  icon?: ReactNode;
  /**
   * Whether the icon should be displayed after the text instead of before
   */
  iconAfter?: boolean;
};

// Type for button-specific props
type ButtonElementProps = CommonButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonButtonProps> & {
    /**
     * HTML button type attribute
     */
    htmlType?: 'button' | 'submit' | 'reset';
    to?: never;
    href?: never;
  };

// Type for Link-specific props
type LinkElementProps = CommonButtonProps &
  Omit<LinkProps, keyof CommonButtonProps> & {
    /**
     * React Router Link destination
     */
    to: LinkProps['to'];
    htmlType?: never;
    href?: never;
  };

// Type for anchor-specific props
type AnchorElementProps = CommonButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonButtonProps> & {
    /**
     * HTML anchor href attribute
     */
    href: string;
    htmlType?: never;
    to?: never;
  };

// Union type for all possible button props
export type ButtonProps = ButtonElementProps | LinkElementProps | AnchorElementProps;

/**
 * Button component using the "Soft & Trustworthy" design set
 * Applies global button styles from button-styles.css directly
 * Can render as a button, Link, or anchor based on props
 */
const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>((props, ref) => {
  const {
    variant = 'primary',
    size = 'default',
    children,
    className,
    icon,
    iconAfter = false,
    ...rest
  } = props;

  // Determine global variant class based on props.variant
  let globalVariantClass = '';
  if (variant) {
    globalVariantClass = `btn-${variant}`; // e.g., btn-primary, btn-secondary
  }

  // Determine global size class based on props.size
  let globalSizeClass = '';
  if (size && size !== 'default') {
    globalSizeClass = `btn-${size === 'small' ? 'sm' : size === 'large' ? 'lg' : size}`; // e.g., btn-sm, btn-lg, btn-icon
  }

  // Keep the module classes for component-specific styling
  // These are now empty placeholders in Button.module.css but we keep them for future component-specific styling if needed
  const moduleVariantClass = variant ? styles[variant] : '';
  const moduleSizeClass = size !== 'default' ? styles[size] : '';

  const combinedClasses = [
    'btn', // Apply the global base button class
    globalVariantClass, // Apply the global variant class (e.g., 'btn-primary')
    globalSizeClass, // Apply the global size class (e.g., 'btn-sm')
    styles.buttonStandard, // Keep for any component-specific structural styles
    moduleVariantClass, // Keep for any component-specific variant styles
    moduleSizeClass, // Keep for any component-specific size styles
    size === 'icon' && !children ? styles.iconOnly : '', // Special class for icon-only buttons
    className || '', // User-provided additional classes
  ]
    .filter(Boolean)
    .join(' ');

  // Prepare content with icon
  // Using only our component-specific buttonContent class
  // The spacing between icon and text is now handled by the gap property in the parent .btn class

  // Wrap icon with Icon component if it's not already wrapped
  const processedIcon =
    icon &&
    React.isValidElement(icon) &&
    // Check if the icon is already an Icon component
    icon.type !== Icon &&
    // Check if it's not a span that might be wrapping an Icon component
    (typeof icon.type !== 'string' || icon.type !== 'span') ? (
      <Icon
        IconComponent={() => icon}
        size={size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'md'}
      />
    ) : (
      icon
    );

  const content = (
    <span className={styles.buttonContent}>
      {processedIcon && !iconAfter && <span className={styles.buttonIcon}>{processedIcon}</span>}
      {children && <span className={styles.buttonText}>{children}</span>}
      {processedIcon && iconAfter && <span className={styles.buttonIcon}>{processedIcon}</span>}
    </span>
  );

  // Render as Link if 'to' prop is provided
  if ('to' in props && props.to !== undefined) {
    return (
      <Link
        className={combinedClasses}
        to={props.to}
        {...(rest as Omit<
          LinkElementProps,
          'variant' | 'size' | 'children' | 'className' | 'to' | 'icon' | 'iconAfter'
        >)}
      >
        {content}
      </Link>
    );
  }

  // Render as anchor if 'href' prop is provided
  if ('href' in props && props.href !== undefined) {
    return (
      <a
        className={combinedClasses}
        href={props.href}
        {...(rest as Omit<
          AnchorElementProps,
          'variant' | 'size' | 'children' | 'className' | 'href' | 'icon' | 'iconAfter'
        >)}
      >
        {content}
      </a>
    );
  }

  // Default: render as button
  const { htmlType = 'button', ...buttonProps } = rest as ButtonElementProps;

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={combinedClasses}
      type={htmlType}
      {...(buttonProps as Omit<
        ButtonElementProps,
        'variant' | 'size' | 'children' | 'className' | 'htmlType' | 'icon' | 'iconAfter'
      >)}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;

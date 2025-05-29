import React, { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';

import styles from './Button.module.css';
import Icon from '../../../shared/components/ui/Icon';

type CommonButtonProps = {
  /** Button visual style */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'info' | 'warning' | 'text';
  /** Button size */
  size?: 'default' | 'small' | 'large' | 'icon';
  /** Button content */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Icon to display with button */
  icon?: ReactNode;
  /** Display icon after text instead of before */
  iconAfter?: boolean;
};

type ButtonElementProps = CommonButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonButtonProps> & {
    /** HTML button type */
    htmlType?: 'button' | 'submit' | 'reset';
    to?: never;
    href?: never;
  };

type LinkElementProps = CommonButtonProps &
  Omit<LinkProps, keyof CommonButtonProps> & {
    /** React Router destination */
    to: LinkProps['to'];
    htmlType?: never;
    href?: never;
  };

type AnchorElementProps = CommonButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonButtonProps> & {
    /** External link URL */
    href: string;
    htmlType?: never;
    to?: never;
  };

export type ButtonProps = ButtonElementProps | LinkElementProps | AnchorElementProps;

/**
 * Versatile button component that can render as button, Link, or anchor.
 * Supports icons, multiple variants, and consistent styling.
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

  let globalVariantClass = '';
  if (variant) {
    globalVariantClass = `btn-${variant}`;
  }

  let globalSizeClass = '';
  if (size && size !== 'default') {
    globalSizeClass = `btn-${size === 'small' ? 'sm' : size === 'large' ? 'lg' : size}`;
  }

  const moduleVariantClass = variant ? styles[variant] : '';
  const moduleSizeClass = size !== 'default' ? styles[size] : '';

  const combinedClasses = [
    'btn',
    globalVariantClass,
    globalSizeClass,
    styles.buttonStandard,
    moduleVariantClass,
    moduleSizeClass,
    size === 'icon' && !children ? styles.iconOnly : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  // Wrap icon with Icon component if needed
  const processedIcon =
    icon &&
    React.isValidElement(icon) &&
    icon.type !== Icon &&
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

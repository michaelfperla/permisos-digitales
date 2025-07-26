import React from 'react';
import { Link } from 'react-router-dom';

import styles from './TextLogo.module.css';

interface TextLogoProps {
  /**
   * Optional className to apply additional styles
   */
  className?: string;

  /**
   * Optional link to navigate to when clicked
   * If not provided, will use '/' as default
   */
  to?: string;

  /**
   * Optional onClick handler
   */
  onClick?: () => void;

  /**
   * Optional variant to determine styling
   * 'default' - Standard styling
   * 'light' - Light color scheme for dark backgrounds
   */
  variant?: 'default' | 'light';

  /**
   * Whether to show only the first part of the logo ("Permisos")
   * Useful for collapsed sidebars
   */
  compact?: boolean;

  /**
   * Whether to show only the initials ("PD")
   * Takes precedence over compact prop
   * Useful for collapsed sidebars with minimal width
   */
  initialsOnly?: boolean;
}

/**
 * TextLogo component that displays the "Permisos Digitales" logo text
 * with consistent styling across the application
 */
const TextLogo: React.FC<TextLogoProps> = ({
  className = '',
  to = '/',
  onClick,
  variant = 'default',
  compact = false,
  initialsOnly = false,
}) => {
  const variantClass = variant === 'light' ? styles.light : '';
  const initialsClass = initialsOnly ? styles.initialsLogo : '';

  if (initialsOnly) {
    return (
      <Link
        to={to}
        className={`${styles.textLogo} ${variantClass} ${initialsClass} ${className}`}
        onClick={onClick}
      >
        P<span className={styles.secondInitial}>D</span>
      </Link>
    );
  }

  return (
    <Link to={to} className={`${styles.textLogo} ${variantClass} ${className}`} onClick={onClick}>
      Permisos{!compact && <span className={styles.secondWord}> Digitales</span>}
    </Link>
  );
};

export default TextLogo;

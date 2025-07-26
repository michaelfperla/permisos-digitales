import React, { ReactNode } from 'react';

import styles from './ResponsiveContainer.module.css';

export interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  type?: 'fluid' | 'fixed';
  withPadding?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'none';
}

/**
 * Standardized responsive container with configurable max-width and padding.
 * Supports both fluid and fixed width modes with breakpoint-based constraints.
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
  type = 'fixed',
  withPadding = true,
  maxWidth = 'xl',
}) => {
  const classNames = [];

  classNames.push(type === 'fixed' ? styles.fixed : styles.fluid);

  if (withPadding) {
    classNames.push(styles.withPadding);
  }

  if (type === 'fixed' && maxWidth !== 'none') {
    const maxWidthClass = `max${maxWidth.toUpperCase()}`;

    if (styles[maxWidthClass]) {
      classNames.push(styles[maxWidthClass]);
    }
  }

  if (className) {
    classNames.push(className);
  }

  const containerClasses = classNames.join(' ');

  return <div className={containerClasses}>{children}</div>;
};

export default ResponsiveContainer;

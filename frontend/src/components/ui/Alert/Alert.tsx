import React from 'react';
import styles from './Alert.module.css';

export interface AlertProps {
  /**
   * Alert variant
   */
  variant: 'success' | 'error' | 'warning' | 'info';
  /**
   * Alert content
   */
  children: React.ReactNode;
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Alert component using the "Soft & Trustworthy" design set
 */
const Alert: React.FC<AlertProps> = ({
  variant,
  children,
  className,
}) => {
  const alertClasses = [
    styles.alert,
    styles[variant],
    className || ''
  ].filter(Boolean).join(' ');
  
  return (
    <div className={alertClasses}>
      {children}
    </div>
  );
};

export default Alert;

import React from 'react';

import styles from './Alert.module.css';

export interface AlertProps {
  variant: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

/**
 * Alert component for displaying contextual messages
 */
const Alert: React.FC<AlertProps> = ({ variant, children, className }) => {
  const alertClasses = [styles.alert, styles[variant], className || ''].filter(Boolean).join(' ');

  return <div className={alertClasses}>{children}</div>;
};

export default Alert;

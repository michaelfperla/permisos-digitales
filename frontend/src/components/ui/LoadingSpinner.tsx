import React from 'react';

import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  /**
   * Variant of the spinner
   * - 'page': Full page centered spinner (default)
   * - 'inline': Small inline spinner for buttons
   */
  variant?: 'page' | 'inline';
  /**
   * Size of the inline spinner
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Color of the spinner (CSS color value)
   */
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  variant = 'page',
  size = 'md',
  color 
}) => {
  if (variant === 'inline') {
    return (
      <span 
        className={`${styles.inlineSpinner} ${styles[`size-${size}`]}`}
        style={color ? { borderTopColor: color, borderRightColor: color } : undefined}
        role="status"
        aria-label="Loading"
      />
    );
  }

  return (
    <div className={styles.spinnerContainer} data-testid="loading-spinner">
      <div className={styles.spinner}></div>
    </div>
  );
};

export default LoadingSpinner;

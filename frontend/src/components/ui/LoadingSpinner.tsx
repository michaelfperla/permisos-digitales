import React from 'react';

import styles from './LoadingSpinner.module.css';

const LoadingSpinner: React.FC = () => {
  return (
    <div className={styles.spinnerContainer} data-testid="loading-spinner">
      <div className={styles.spinner}></div>
    </div>
  );
};

export default LoadingSpinner;

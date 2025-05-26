import React from 'react';
import { Outlet } from 'react-router-dom';

import styles from './HomeLayout.module.css';

/**
 * Home Layout Component
 * A layout without header and footer for the HomePage component
 * since it includes its own custom header and footer
 */
const HomeLayout: React.FC = () => {
  // Add a class to the body element to remove padding-top
  React.useEffect(() => {
    document.body.classList.add('home-body');

    // Clean up when component unmounts
    return () => {
      document.body.classList.remove('home-body');
    };
  }, []);

  return (
    <div className={styles.layoutContainer}>
      <main className={styles.mainContent}>
        <Outlet /> {/* Child route components render here */}
      </main>
    </div>
  );
};

export default HomeLayout;

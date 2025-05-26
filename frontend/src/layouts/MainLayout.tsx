import React from 'react';
import { Outlet } from 'react-router-dom';

import styles from './MainLayout.module.css';
import { MobileNavigation } from '../components/mobile';
import useResponsive from '../hooks/useResponsive';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const MainLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isMdDown } = useResponsive(); // Using isMdDown which corresponds to max-width: 768px

  return (
    <div className={styles.layoutContainer}>
      {/* Main content area - full width by default */}
      <main className={`${styles.mainContentFullWidth} ${isMdDown ? styles.hasBottomNav : ''}`}>
        <Outlet /> {/* Child route components render here */}
      </main>

      {/* Mobile Navigation - Only shown on mobile devices */}
      {isMdDown && (
        <div className={styles.mobileNavContainer}>
          <MobileNavigation type="bottom" isAuthenticated={isAuthenticated} />
        </div>
      )}
    </div>
  );
};

export default MainLayout;

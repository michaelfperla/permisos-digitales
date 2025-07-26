import React from 'react';
import useResponsive from '../hooks/useResponsive';
import UserPermitsPage from './UserPermitsPage';
import MobileUserPermitsPage from './MobileUserPermitsPage';

/**
 * Responsive wrapper that switches between mobile and desktop user permits views
 */
const ResponsiveUserPermitsPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  
  return isMdDown ? <MobileUserPermitsPage /> : <UserPermitsPage />;
};

export default ResponsiveUserPermitsPage;
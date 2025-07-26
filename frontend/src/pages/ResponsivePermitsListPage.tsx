import React from 'react';
import useResponsive from '../hooks/useResponsive';
import PermitsListPage from './PermitsListPage';
import MobilePermitsListPage from './MobilePermitsListPage';

/**
 * Responsive wrapper that switches between mobile and desktop permit list views
 */
const ResponsivePermitsListPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  
  return isMdDown ? <MobilePermitsListPage /> : <PermitsListPage />;
};

export default ResponsivePermitsListPage;
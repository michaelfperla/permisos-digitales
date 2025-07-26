import React from 'react';
import useResponsive from '../hooks/useResponsive';
import PermitDetailsPage from './PermitDetailsPage';
import MobilePermitDetailsPage from './MobilePermitDetailsPage';

/**
 * Responsive wrapper that switches between mobile and desktop permit details views
 */
const ResponsivePermitDetailsPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  
  return isMdDown ? <MobilePermitDetailsPage /> : <PermitDetailsPage />;
};

export default ResponsivePermitDetailsPage;
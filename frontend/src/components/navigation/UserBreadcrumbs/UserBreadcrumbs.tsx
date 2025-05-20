import React from 'react';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';
import useBreadcrumbs from '../../../hooks/useBreadcrumbs';
import useResponsive from '../../../hooks/useResponsive';
import styles from './UserBreadcrumbs.module.css';

interface UserBreadcrumbsProps {
  className?: string;
}

/**
 * User-specific breadcrumbs component
 * 
 * Uses the useBreadcrumbs hook to generate breadcrumbs for user pages.
 * Only visible on desktop (768px+).
 */
const UserBreadcrumbs: React.FC<UserBreadcrumbsProps> = ({ className = '' }) => {
  const breadcrumbs = useBreadcrumbs({ isAdmin: false });
  const { isMdDown } = useResponsive();
  
  // Don't render breadcrumbs on mobile
  if (isMdDown) {
    return null;
  }
  
  return (
    <div className={`${styles.userBreadcrumbs} ${className}`}>
      <Breadcrumbs items={breadcrumbs} />
    </div>
  );
};

export default UserBreadcrumbs;

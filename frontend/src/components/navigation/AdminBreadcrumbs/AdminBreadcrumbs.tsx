import React from 'react';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';
import useBreadcrumbs from '../../../hooks/useBreadcrumbs';
import styles from './AdminBreadcrumbs.module.css';

interface AdminBreadcrumbsProps {
  className?: string;
}

/**
 * Admin-specific breadcrumbs component
 * 
 * Uses the useBreadcrumbs hook with isAdmin=true to generate
 * breadcrumbs for admin pages.
 */
const AdminBreadcrumbs: React.FC<AdminBreadcrumbsProps> = ({ className = '' }) => {
  const breadcrumbs = useBreadcrumbs({ isAdmin: true });
  
  return (
    <div className={`${styles.adminBreadcrumbs} ${className}`}>
      <Breadcrumbs items={breadcrumbs} />
    </div>
  );
};

export default AdminBreadcrumbs;

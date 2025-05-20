import React from 'react';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';
import useBreadcrumbs from '../../../hooks/useBreadcrumbs';
import styles from './ClientBreadcrumbs.module.css';

interface ClientBreadcrumbsProps {
  className?: string;
}

/**
 * Client-specific breadcrumbs component
 * 
 * Uses the useBreadcrumbs hook with isAdmin=false to generate
 * breadcrumbs for client-facing pages.
 */
const ClientBreadcrumbs: React.FC<ClientBreadcrumbsProps> = ({ className = '' }) => {
  const breadcrumbs = useBreadcrumbs({ isAdmin: false });
  
  return (
    <div className={`${styles.clientBreadcrumbs} ${className}`}>
      <Breadcrumbs items={breadcrumbs} />
    </div>
  );
};

export default ClientBreadcrumbs;

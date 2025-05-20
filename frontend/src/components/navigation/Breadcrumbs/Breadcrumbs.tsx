import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaChevronRight, FaClipboardList, FaUser, FaTachometerAlt, FaUsers, FaEllipsisH } from 'react-icons/fa';
import { IconType } from '../../../utils/breadcrumbsConfig';
import styles from './Breadcrumbs.module.css';

export interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  iconType?: IconType;
}

/**
 * Helper function to convert icon type to React component
 */
const getIconComponent = (iconType?: IconType) => {
  if (!iconType) return null;

  switch (iconType) {
    case 'home':
      return <FaHome className={styles.homeIcon} />;
    case 'clipboard':
      return <FaClipboardList />;
    case 'user':
      return <FaUser />;
    case 'dashboard':
      return <FaTachometerAlt />;
    case 'users':
      return <FaUsers />;
    default:
      return null;
  }
};

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHomeIcon?: boolean;
  className?: string;
  separator?: React.ReactNode;
  maxItems?: number;
  /**
   * Whether to use a condensed view on mobile devices
   * When true, only shows the first and last items on small screens
   */
  mobileCondensed?: boolean;
}

/**
 * Breadcrumbs component for navigation
 *
 * Displays a trail of links showing the user's current location in the application hierarchy.
 * Can be configured with custom items, icons, and separators.
 * Optimized for mobile devices with condensed view option.
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items = [],
  showHomeIcon = true,
  className = '',
  separator = <FaChevronRight className={styles.separator} />,
  maxItems = 0,
  mobileCondensed = true,
}) => {
  const location = useLocation();
  const [isMobileView, setIsMobileView] = useState(false);

  // Effect to handle window resize and detect mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 480); // Using the small breakpoint
    };

    // Initial check
    checkMobileView();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobileView);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobileView);
    };
  }, []);

  const combinedClassName = `${styles.breadcrumbs} ${className}`;

  // Determine which items to display
  let displayItems = items;

  // If maxItems is set, truncate the list
  if (maxItems > 0 && items.length > maxItems) {
    displayItems = [...items.slice(0, 1), ...items.slice(items.length - (maxItems - 1))];
  }

  // For mobile view with more than 2 items, show only first and last with ellipsis
  if (isMobileView && mobileCondensed && items.length > 2) {
    displayItems = [items[0], items[items.length - 1]];
  }

  return (
    <nav aria-label="breadcrumb" className={combinedClassName}>
      <ol className={styles.breadcrumbsList}>
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isFirst = index === 0;
          const showEllipsis = isMobileView && mobileCondensed && isFirst && items.length > 2;

          return (
            <React.Fragment key={item.path}>
              <li
                className={`${styles.breadcrumbItem} ${isLast ? styles.active : ''}`}
                aria-current={isLast ? 'page' : undefined}
              >
                {!isLast ? (
                  <Link
                    to={item.path}
                    className={`${styles.breadcrumbLink} touch-friendly`}
                  >
                    {isFirst && showHomeIcon && !item.icon && !item.iconType
                      ? <FaHome className={styles.homeIcon} />
                      : item.icon || (item.iconType ? getIconComponent(item.iconType) : null)}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <span className={styles.breadcrumbText}>
                    {item.icon || (item.iconType ? getIconComponent(item.iconType) : null)}
                    <span>{item.label}</span>
                  </span>
                )}
              </li>
              {!isLast && (
                <li className={styles.separatorItem} aria-hidden="true">
                  {showEllipsis ? <FaEllipsisH className={styles.ellipsis} /> : separator}
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

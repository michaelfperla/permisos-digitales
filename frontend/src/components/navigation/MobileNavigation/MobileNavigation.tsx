import React, { useState, useEffect } from 'react';
import { FaHome, FaClipboardList, FaUser, FaBars, FaTimes } from 'react-icons/fa';
import { NavLink, useLocation } from 'react-router-dom';

import styles from './MobileNavigation.module.css';
import Icon from '../../../shared/components/ui/Icon';

interface MobileNavigationProps {
  /**
   * Whether the user is authenticated
   */
  isAuthenticated?: boolean;
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Navigation type: 'bottom' for fixed bottom navigation, 'drawer' for slide-in drawer
   */
  type?: 'bottom' | 'drawer';
}

/**
 * Mobile Navigation Component
 *
 * Provides a responsive navigation experience optimized for mobile devices.
 * Supports both bottom navigation bar and slide-in drawer patterns.
 */
const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isAuthenticated = false,
  className = '',
  type = 'bottom',
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // Close drawer when escape key is pressed
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Define the type for navigation items
  interface NavItem {
    to: string;
    label: string;
    icon: React.ReactNode;
    isActive?: (_pathname: string) => boolean;
  }

  // Custom isActive function for the home button
  const isHomeActive = (pathname: string): boolean => {
    if (isAuthenticated) {
      return pathname === '/dashboard';
    } else {
      return pathname === '/';
    }
  };

  // Navigation items based on authentication status
  const navItems: NavItem[] = [
    {
      to: isAuthenticated ? '/dashboard' : '/',
      label: 'Inicio',
      icon: <Icon IconComponent={FaHome} className={styles.navIcon} size="md" />,
      isActive: isHomeActive,
    },
    ...(isAuthenticated
      ? [
          {
            to: '/permits',
            label: 'Mis Solicitudes',
            icon: <Icon IconComponent={FaClipboardList} className={styles.navIcon} size="md" />,
          },
          {
            to: '/profile',
            label: 'Mi Perfil',
            icon: <Icon IconComponent={FaUser} className={styles.navIcon} size="md" />,
          },
        ]
      : []),
  ];

  // Render bottom navigation bar
  if (type === 'bottom') {
    return (
      <nav className={`${styles.bottomNav} ${className}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              // Use custom isActive function if provided, otherwise use the default isActive from NavLink
              const active = item.isActive ? item.isActive(location.pathname) : isActive;
              return `${styles.bottomNavItem} ${active ? styles.active : ''}`;
            }}
            end
          >
            {item.icon}
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  // Render drawer navigation
  return (
    <>
      {/* Hamburger menu button */}
      <button
        className={styles.menuButton}
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open navigation menu"
      >
        <Icon IconComponent={FaBars} size="md" />
      </button>

      {/* Drawer overlay */}
      {isDrawerOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer navigation */}
      <nav className={`${styles.drawer} ${isDrawerOpen ? styles.open : ''} ${className}`}>
        <div className={styles.drawerHeader}>
          <button
            className={styles.closeButton}
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation menu"
          >
            <Icon IconComponent={FaTimes} size="md" />
          </button>
        </div>

        <ul className={styles.drawerNav}>
          {navItems.map((item) => (
            <li key={item.to} className={styles.drawerNavItem}>
              <NavLink
                to={item.to}
                className={({ isActive }) => {
                  // Use custom isActive function if provided, otherwise use the default isActive from NavLink
                  const active = item.isActive ? item.isActive(location.pathname) : isActive;
                  return `${styles.drawerNavLink} ${active ? styles.active : ''}`;
                }}
                end
              >
                {item.icon}
                <span className={styles.drawerNavLabel}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};

export default MobileNavigation;

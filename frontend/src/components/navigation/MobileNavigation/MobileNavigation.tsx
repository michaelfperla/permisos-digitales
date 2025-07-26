import React, { useState, useEffect } from 'react';
import { FaHome, FaClipboardList, FaUser, FaBars, FaTimes, FaSignOutAlt, FaPlus, FaShieldAlt, FaFileAlt, FaEnvelope } from 'react-icons/fa';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import styles from './MobileNavigation.module.css';
import Button from '../../ui/Button/Button';
import TextLogo from '../../ui/TextLogo/TextLogo';
import Icon from '../../../shared/components/ui/Icon';
import { useUserAuth } from '../../../shared/hooks/useAuth';
import { logger } from '../../../utils/logger';

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
  const navigate = useNavigate();
  const { user, logout } = useUserAuth();

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  };

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
    to?: string;
    label: string;
    icon: React.ComponentType;
    isActive?: (_pathname: string) => boolean;
    action?: () => void;
    type?: 'link' | 'button';
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
      icon: FaHome,
      isActive: isHomeActive,
      type: 'link' as const,
    },
    ...(isAuthenticated
      ? [
          {
            to: '/permits',
            label: 'Mis Permisos',
            icon: FaClipboardList,
            type: 'link' as const,
          },
          {
            to: '/permits/complete',
            label: 'Nuevo Permiso',
            icon: FaPlus,
            type: 'link' as const,
          },
          {
            to: '/profile',
            label: 'Mi Perfil',
            icon: FaUser,
            type: 'link' as const,
          },
          {
            label: 'Cerrar Sesión',
            icon: FaSignOutAlt,
            action: handleLogout,
            type: 'button' as const,
          },
        ]
      : []),
  ];

  // Render bottom navigation bar
  if (type === 'bottom') {
    return (
      <nav className={`${styles.bottomNav} ${className}`}>
        {navItems.map((item, index) => {
          const key = item.to || `button-${index}`;
          
          if (item.type === 'button') {
            return (
              <Button
                key={key}
                variant="text"
                onClick={item.action}
                className={`${styles.bottomNavItem}`}
                icon={<Icon IconComponent={item.icon} className={styles.navIcon} size="md" />}
              >
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </Button>
            );
          }
          
          return (
            <NavLink
              key={key}
              to={item.to!}
              className={({ isActive }) => {
                // Use custom isActive function if provided, otherwise use the default isActive from NavLink
                const active = item.isActive ? item.isActive(location.pathname) : isActive;
                return `${styles.bottomNavItem} ${active ? styles.active : ''}`;
              }}
              end
            >
              <Icon IconComponent={item.icon} className={styles.navIcon} size="md" />
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    );
  }

  // Render drawer navigation
  return (
    <>
      {/* Hamburger menu button */}
      <Button
        variant="text"
        size="icon"
        className={styles.menuButton}
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open navigation menu"
        icon={<Icon IconComponent={FaBars} size="md" />}
      />

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
          <TextLogo to="/dashboard" variant="light" />
          <Button
            variant="text"
            size="icon"
            className={styles.closeButton}
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation menu"
            icon={<Icon IconComponent={FaTimes} />}
          />
        </div>

        {isAuthenticated && user && (
          <div className={styles.drawerUser}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.first_name} {user.last_name}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
          </div>
        )}

        <ul className={styles.drawerNav}>
          {navItems.filter(item => item.type !== 'button').map((item, index) => {
            const key = item.to || `link-${index}`;
            
            return (
              <li key={key} className={styles.drawerNavItem}>
                <NavLink
                  to={item.to!}
                  className={({ isActive }) => {
                    const active = item.isActive ? item.isActive(location.pathname) : isActive;
                    return `${styles.drawerNavLink} ${active ? styles.active : ''}`;
                  }}
                  onClick={() => setIsDrawerOpen(false)}
                  end
                >
                  <Icon IconComponent={item.icon} className={styles.drawerNavIcon} />
                  <span className={styles.drawerNavLabel}>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Legal Links Section - Only show for authenticated users */}
        {isAuthenticated && (
          <div className={styles.drawerLegalLinks}>
            <NavLink
              to="/contacto"
              className={styles.drawerLegalLink}
              onClick={() => setIsDrawerOpen(false)}
            >
              <Icon IconComponent={FaEnvelope} className={styles.drawerLegalIcon} />
              <span>Contacto</span>
            </NavLink>
            <NavLink
              to="/terminos-y-condiciones"
              className={styles.drawerLegalLink}
              onClick={() => setIsDrawerOpen(false)}
            >
              <Icon IconComponent={FaFileAlt} className={styles.drawerLegalIcon} />
              <span>Términos y Condiciones</span>
            </NavLink>
            <NavLink
              to="/politica-de-privacidad"
              className={styles.drawerLegalLink}
              onClick={() => setIsDrawerOpen(false)}
            >
              <Icon IconComponent={FaShieldAlt} className={styles.drawerLegalIcon} />
              <span>Política de Privacidad</span>
            </NavLink>
          </div>
        )}

        {isAuthenticated && (
          <div className={styles.drawerFooter}>
            <div className={styles.footerActions}>
              <Button
                variant="primary"
                onClick={() => {
                  handleLogout();
                  setIsDrawerOpen(false);
                }}
                icon={<Icon IconComponent={FaSignOutAlt} />}
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default MobileNavigation;

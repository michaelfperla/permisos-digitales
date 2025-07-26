import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaTachometerAlt, FaClipboardList, FaUserCircle, FaSignOutAlt,
  FaTimes, FaPlus, FaChevronLeft, FaChevronRight, FaQuestionCircle,
  FaShieldAlt, FaFileContract
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

import styles from './UserLayout.module.css';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Button from '../components/ui/Button/Button';
import TextLogo from '../components/ui/TextLogo/TextLogo';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const UserLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isMdDown } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(!isMdDown);
  const [showOverlay, setShowOverlay] = useState(false);

  const sidebarCloseButtonRef = useRef<HTMLButtonElement>(null);
  const userSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSidebarOpen(!isMdDown);
  }, [isMdDown]);

  useEffect(() => {
    if (isMdDown) {
      if (sidebarOpen) {
        setShowOverlay(true);
        document.body.style.overflow = 'hidden';
        setTimeout(() => sidebarCloseButtonRef.current?.focus(), 100);
      } else {
        document.body.style.overflow = '';
        const timer = setTimeout(() => setShowOverlay(false), 300);
        return () => clearTimeout(timer);
      }
    } else {
      setShowOverlay(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, isMdDown]);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const closeSidebarAndFocusHamburger = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleLogout = async () => {
    if (isMdDown && sidebarOpen) setSidebarOpen(false);
    await logout();
    navigate('/login');
  };

  const handleNavLinkClick = () => {
    if (isMdDown) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (sidebarOpen && isMdDown && userSidebarRef.current) {
      const focusableElements = Array.from(
        userSidebarRef.current.querySelectorAll(
          'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el instanceof HTMLElement && el.offsetParent !== null) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const trapFocus = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        } else if (e.key === 'Escape') {
            closeSidebarAndFocusHamburger();
        }
      };

      document.addEventListener('keydown', trapFocus);
      return () => {
        document.removeEventListener('keydown', trapFocus);
      };
    }
  }, [sidebarOpen, isMdDown, closeSidebarAndFocusHamburger]); // Added closeSidebarAndFocusHamburger to deps

  const isDesktopCollapsed = !sidebarOpen && !isMdDown;

  const userNavItems: NavLinkItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: <Icon IconComponent={FaTachometerAlt} className={styles.navIcon} /> },
    { to: "/permits", label: "Mis Permisos", icon: <Icon IconComponent={FaClipboardList} className={styles.navIcon} /> },
    { to: "/permits/complete", label: "Nuevo Permiso", icon: <Icon IconComponent={FaPlus} className={styles.navIcon} /> },
    { to: "/profile", label: "Mi Perfil", icon: <Icon IconComponent={FaUserCircle} className={styles.navIcon} /> },
    { to: "/contacto", label: "Soporte", icon: <Icon IconComponent={FaQuestionCircle} className={styles.navIcon} /> },
    { to: "/terminos-y-condiciones", label: "Términos", icon: <Icon IconComponent={FaFileContract} className={styles.navIcon} /> },
    { to: "/politica-de-privacidad", label: "Privacidad", icon: <Icon IconComponent={FaShieldAlt} className={styles.navIcon} /> },
  ];
  
  // Debug log to verify changes are loaded
  console.log('[UserLayout] Navigation items with new links:', userNavItems);

  // Mobile navigation items (logout is handled in sidebar footer, not here)
  const mobileNavItems: NavLinkItem[] = userNavItems;


  return (
    <div className={styles.userLayout}>
      {isMdDown && (
        <AppHeaderMobile
          logoPath="/dashboard"
          navLinks={mobileNavItems}
          externalPanelControl={true}
          onExternalPanelToggle={toggleSidebar}
          isExternalPanelOpen={sidebarOpen}
        />
      )}

      {showOverlay && isMdDown && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={closeSidebarAndFocusHamburger}
          aria-hidden="true"
        />
      )}

      <aside
        ref={userSidebarRef}
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''} ${isMdDown ? styles.mobile : ''}`}
        aria-hidden={isMdDown ? !sidebarOpen : undefined}
        role={isMdDown ? "dialog" : undefined}
        aria-modal={isMdDown ? sidebarOpen : undefined}
        aria-label={isMdDown ? "Menú de usuario" : undefined}
      >
        <div className={styles.sidebarHeader}>
          {!isMdDown && (
            <div className={styles.sidebarLogo}>
              <TextLogo
                to="/dashboard"
                className={styles.textLogoInSidebar}
                variant="light"
                compact={isDesktopCollapsed}
                initialsOnly={isDesktopCollapsed}
              />
            </div>
          )}
          {isMdDown && (
            <>
              <div className={styles.panelLogoContainerInSidebar}>
                <TextLogo to="/dashboard" variant="light" />
              </div >
              <Button
                ref={sidebarCloseButtonRef}
                variant="text"
                size="icon"
                className={styles.sidebarPanelCloseButton}
                onClick={closeSidebarAndFocusHamburger}
                aria-label="Cerrar menú"
                icon={<Icon IconComponent={FaTimes} size="lg" color="var(--color-white)" />}
              />
            </>
          )}
        </div>

        <div className={styles.sidebarUser}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.first_name} {user?.last_name}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {userNavItems.map(item => (
            <NavLink
              key={item.to.toString()}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
              onClick={handleNavLinkClick}
            >
              {item.icon}
              <span className={styles.navText}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerActions}>
            {!isMdDown && (
              <Button
                variant="text"
                size="icon"
                className={styles.sidebarToggleButton}
                onClick={toggleSidebar}
                icon={sidebarOpen ?
                  <Icon IconComponent={FaChevronLeft} size="sm" color="rgba(255, 255, 255, 0.7)" /> :
                  <Icon IconComponent={FaChevronRight} size="sm" color="rgba(255, 255, 255, 0.7)" />
                }
                aria-label={sidebarOpen ? "Contraer menú" : "Expandir menú"}
              />
            )}
            <Button
              variant="primary"
              className={styles.logoutButton}
              onClick={handleLogout}
              icon={<Icon IconComponent={FaSignOutAlt} size="md" />}
            >
              <span className={styles.logoutText}>Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </aside>

      <main className={`
        ${styles.mainContent}
        ${!isMdDown && !sidebarOpen ? styles.expanded : ''}
        ${isMdDown ? styles.mobileContentPadded : ''}
      `}>
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;
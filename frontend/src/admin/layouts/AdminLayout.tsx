import React, { useState, useEffect, useRef } from 'react';
import {
  FaTachometerAlt,
  FaClipboardList,
  FaCheckCircle,
  FaHistory,
  FaUsers,
  FaSignOutAlt,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

import styles from './AdminLayout.module.css';
import AppHeaderMobile from '../../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Button from '../../components/ui/Button/Button';
import TextLogo from '../../components/ui/TextLogo/TextLogo';
import useResponsive from '../../hooks/useResponsive';
import Icon from '../../shared/components/ui/Icon';
import { useAdminAuth as useAuth } from '../../shared/hooks/useAuth';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isMdDown } = useResponsive(); // Check if we're on mobile (below 768px)
  const [sidebarOpen, setSidebarOpen] = useState(!isMdDown); // Open by default on desktop, closed on mobile
  const [showOverlay, setShowOverlay] = useState(false);

  // Refs for accessibility and focus management
  const sidebarCloseButtonRef = useRef<HTMLButtonElement>(null);
  const adminSidebarRef = useRef<HTMLElement>(null);

  // Computed property for desktop collapsed state
  const isDesktopCollapsed = !isMdDown && !sidebarOpen;

  // Update sidebar state when screen size changes
  useEffect(() => {
    setSidebarOpen(!isMdDown);
  }, [isMdDown]);

  // Show/hide overlay with slight delay for animation and manage body scroll
  useEffect(() => {
    if (isMdDown) {
      if (sidebarOpen) {
        setShowOverlay(true);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        // Focus the close button for accessibility
        setTimeout(() => sidebarCloseButtonRef.current?.focus(), 100);
      } else {
        document.body.style.overflow = ''; // Restore scrolling
        // Delay hiding the overlay to allow for animation
        const timer = setTimeout(() => {
          setShowOverlay(false);
        }, 300); // Match transition duration
        return () => clearTimeout(timer);
      }
    } else {
      setShowOverlay(false);
      document.body.style.overflow = ''; // Ensure body scroll is normal on desktop
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, isMdDown]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = async () => {
    await logout();
    // Redirect to login page
    navigate('/login');
  };

  // Close sidebar when clicking on a link (mobile only)
  const handleNavLinkClick = () => {
    if (isMdDown) {
      setSidebarOpen(false);
    }
  };

  // Close sidebar and focus the hamburger button (for accessibility)
  const closeSidebarAndFocusHamburger = () => {
    setSidebarOpen(false);
    // Focus the hamburger button after animation completes
    setTimeout(() => {
      const hamburgerButton = document.querySelector('[aria-label="Abrir menú"]') as HTMLElement;
      hamburgerButton?.focus();
    }, 300);
  };

  return (
    <div className={styles.adminLayout}>
      {/* Mobile Header - Only visible on mobile */}
      {isMdDown && (
        <AppHeaderMobile
          logoPath="/admin"
          navLinks={[]}
          externalPanelControl={true}
          onExternalPanelToggle={toggleSidebar}
          isExternalPanelOpen={sidebarOpen}
        />
      )}

      {/* Overlay - Only visible on mobile when sidebar is open */}
      {showOverlay && isMdDown && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={closeSidebarAndFocusHamburger}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={adminSidebarRef}
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''} ${isMdDown ? styles.mobile : ''}`}
        aria-hidden={isMdDown ? !sidebarOpen : undefined}
        role={isMdDown ? 'dialog' : undefined}
        aria-modal={isMdDown ? sidebarOpen : undefined}
        aria-label={isMdDown ? 'Menú de administrador' : undefined}
      >
        <div className={styles.sidebarHeader}>
          {/* Desktop: Show full logo or initials */}
          {!isMdDown && (
            <div className={styles.sidebarLogo}>
              <TextLogo
                to="/admin"
                className={styles.textLogo}
                variant="light"
                compact={isDesktopCollapsed}
                initialsOnly={isDesktopCollapsed}
              />
            </div>
          )}
          {/* Mobile: Show logo and close button */}
          {isMdDown && (
            <>
              <div className={styles.sidebarLogo}>
                <TextLogo to="/admin" className={styles.textLogo} variant="light" />
              </div>
              <Button
                ref={sidebarCloseButtonRef}
                variant="text"
                size="icon"
                className={styles.sidebarCloseButton}
                onClick={closeSidebarAndFocusHamburger}
                icon={<Icon IconComponent={FaTimes} size="lg" color="var(--color-white)" />}
                aria-label="Cerrar menú"
              />
            </>
          )}
        </div>

        <div className={styles.sidebarUser}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user?.first_name} {user?.last_name}
            </span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <Icon IconComponent={FaTachometerAlt} className={styles.navIcon} />
            <span className={styles.navText}>Dashboard</span>
          </NavLink>

          <NavLink
            to="/applications"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <Icon IconComponent={FaClipboardList} className={styles.navIcon} />
            <span className={styles.navText}>Solicitudes</span>
          </NavLink>

          <NavLink
            to="/users"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <Icon IconComponent={FaUsers} className={styles.navIcon} />
            <span className={styles.navText}>Usuarios</span>
          </NavLink>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerActions}>
            {/* Desktop Toggle Button - Only visible on desktop */}
            {!isMdDown && (
              <Button
                variant="text"
                size="icon"
                className={styles.sidebarToggleButton}
                onClick={toggleSidebar}
                icon={
                  sidebarOpen ? (
                    <Icon
                      IconComponent={FaChevronLeft}
                      size="sm"
                      color="rgba(255, 255, 255, 0.5)"
                    />
                  ) : (
                    <Icon
                      IconComponent={FaChevronRight}
                      size="sm"
                      color="rgba(255, 255, 255, 0.5)"
                    />
                  )
                }
                aria-label={sidebarOpen ? 'Contraer menú' : 'Expandir menú'}
              />
            )}

            <Button
              variant="danger"
              className={styles.logoutButton}
              onClick={handleLogout}
              icon={<Icon IconComponent={FaSignOutAlt} size="lg" />}
            >
              <span className={styles.logoutText}>Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`
        ${styles.mainContent}
        ${!isMdDown && !sidebarOpen ? styles.expanded : ''}
        ${isMdDown ? styles.mobileContent : ''}
      `}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

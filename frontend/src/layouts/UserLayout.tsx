import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaClipboardList,
  FaFileAlt,
  FaUserCircle,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaCar,
  FaPlus,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import useAuth from '../hooks/useAuth';
import useResponsive from '../hooks/useResponsive';
import styles from './UserLayout.module.css';
import Button from '../components/ui/Button/Button';
import MobileHeader from '../components/navigation/MobileHeader';
import TextLogo from '../components/ui/TextLogo/TextLogo';

const UserLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isMdDown } = useResponsive(); // Check if we're on mobile (below 768px)
  const [sidebarOpen, setSidebarOpen] = useState(!isMdDown); // Open by default on desktop, closed on mobile
  const [showOverlay, setShowOverlay] = useState(false);

  // Update sidebar state when screen size changes
  useEffect(() => {
    setSidebarOpen(!isMdDown);
  }, [isMdDown]);

  // Show/hide overlay with slight delay for animation
  useEffect(() => {
    if (isMdDown) {
      if (sidebarOpen) {
        setShowOverlay(true);
      } else {
        // Delay hiding the overlay to allow for animation
        const timer = setTimeout(() => {
          setShowOverlay(false);
        }, 300); // Match transition duration
        return () => clearTimeout(timer);
      }
    } else {
      setShowOverlay(false);
    }
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

  // Determine if we should show the initials-only logo (PD)
  const isDesktopCollapsed = !sidebarOpen && !isMdDown;

  return (
    <div className={styles.userLayout}>
      {/* Mobile Header - Only visible on mobile */}
      {isMdDown && (
        <MobileHeader
          onMenuToggle={toggleSidebar}
          logoPath="/dashboard"
        />
      )}

      {/* Overlay - Only visible on mobile when sidebar is open */}
      {showOverlay && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''} ${isMdDown ? styles.mobile : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>
            <TextLogo
              to="/dashboard"
              className={styles.textLogo}
              variant="light"
              compact={isDesktopCollapsed}
              initialsOnly={isDesktopCollapsed}
            />
          </div>
          {isMdDown && (
            <Button
              variant="text"
              size="icon"
              className={styles.sidebarCloseButton}
              onClick={toggleSidebar}
              icon={<FaTimes />}
              aria-label="Cerrar menú"
            />
          )}
        </div>



        <div className={styles.sidebarUser}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.first_name} {user?.last_name}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaTachometerAlt className={styles.navIcon} />
            <span className={styles.navText}>Dashboard</span>
          </NavLink>

          <NavLink
            to="/permits"
            end
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaClipboardList className={styles.navIcon} />
            <span className={styles.navText}>Mis Permisos</span>
          </NavLink>

          <NavLink
            to="/permits/complete"
            end
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaPlus className={styles.navIcon} />
            <span className={styles.navText}>Nuevo Permiso</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaUserCircle className={styles.navIcon} />
            <span className={styles.navText}>Mi Perfil</span>
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
                icon={sidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
                aria-label={sidebarOpen ? "Contraer menú" : "Expandir menú"}
              />
            )}

            <Button
              variant="danger"
              className={styles.logoutButton}
              onClick={handleLogout}
              icon={<FaSignOutAlt className={styles.logoutIcon} />}
            >
              <span className={styles.logoutText}>Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`
        ${styles.mainContent}
        ${sidebarOpen && !isMdDown ? '' : styles.expanded}
        ${isMdDown ? styles.mobileContent : ''}
      `}>
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaClipboardList,
  FaCheckCircle,
  FaHistory,
  FaUsers,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import useAuth from '../hooks/useAuth';
import useResponsive from '../../hooks/useResponsive';
import styles from './AdminLayout.module.css';
import Button from '../../components/ui/Button/Button';
import TextLogo from '../../components/ui/TextLogo/TextLogo';
import MobileHeader from '../../components/navigation/MobileHeader';

const AdminLayout: React.FC = () => {
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

  return (
    <div className={styles.adminLayout}>
      {/* Mobile Header - Only visible on mobile */}
      {isMdDown && (
        <MobileHeader
          onMenuToggle={toggleSidebar}
          logoPath="/admin"
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
              to="/admin"
              className={styles.textLogo}
              variant="light"
              compact={!sidebarOpen}
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
            to="/"
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
            to="/applications"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaClipboardList className={styles.navIcon} />
            <span className={styles.navText}>Solicitudes</span>
          </NavLink>

          <NavLink
            to="/pending-verifications"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaCheckCircle className={styles.navIcon} />
            <span className={styles.navText}>Verificaciones Pendientes</span>
          </NavLink>

          <NavLink
            to="/verification-history"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaHistory className={styles.navIcon} />
            <span className={styles.navText}>Historial</span>
          </NavLink>

          <NavLink
            to="/users"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
            onClick={handleNavLinkClick}
          >
            <FaUsers className={styles.navIcon} />
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

export default AdminLayout;

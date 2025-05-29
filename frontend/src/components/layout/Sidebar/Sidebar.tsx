import React from 'react';
import { FaHome, FaClipboardList, FaUser, FaInfoCircle, FaQuestionCircle } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';

import styles from './Sidebar.module.css';
import { useUserAuth } from '../../../shared/hooks/useAuth';
import Icon from '../../../shared/components/ui/Icon';

interface SidebarProps {
  isMobileView: boolean;
  onCloseMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileView, onCloseMobile }) => {
  const { isAuthenticated, user } = useUserAuth();

  // Handle link click on mobile to close sidebar
  const handleLinkClick = () => {
    if (isMobileView) {
      onCloseMobile();
    }
  };

  return (
    <div className={styles.sidebarContent}>
      {/* User info section - only show when authenticated */}
      {isAuthenticated && (
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.first_name?.charAt(0)}
              {user?.last_name?.charAt(0)}
            </div>
            <div className={styles.userName}>
              {user?.first_name} {user?.last_name}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className={styles.sidebarNav}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={handleLinkClick}
            >
              <Icon IconComponent={FaHome} className={styles.navIcon} size="md" />
              <span className={styles.navText}>Inicio</span>
            </NavLink>
          </li>

          {isAuthenticated ? (
            // Authenticated user links
            <>
              <li className={styles.navItem}>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <Icon IconComponent={FaClipboardList} className={styles.navIcon} size="md" />
                  <span className={styles.navText}>Mis Solicitudes</span>
                </NavLink>
              </li>
              <li className={styles.navItem}>
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <Icon IconComponent={FaUser} className={styles.navIcon} size="md" />
                  <span className={styles.navText}>Mi Perfil</span>
                </NavLink>
              </li>
            </>
          ) : (
            // Non-authenticated user links
            <li className={styles.navItem}>
              <NavLink
                to="/solicitar-permiso"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={handleLinkClick}
              >
                <Icon IconComponent={FaClipboardList} className={styles.navIcon} size="md" />
                <span className={styles.navText}>Solicitar Permiso</span>
              </NavLink>
            </li>
          )}

          {/* Common links for all users */}
          <li className={styles.navItem}>
            <NavLink
              to="/acerca-de"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={handleLinkClick}
            >
              <Icon IconComponent={FaInfoCircle} className={styles.navIcon} size="md" />
              <span className={styles.navText}>Acerca de</span>
            </NavLink>
          </li>
          <li className={styles.navItem}>
            <NavLink
              to="/ayuda"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={handleLinkClick}
            >
              <Icon IconComponent={FaQuestionCircle} className={styles.navIcon} size="md" />
              <span className={styles.navText}>Ayuda</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;

import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaQuestionCircle,
  FaUserCircle,
  FaSignOutAlt
} from 'react-icons/fa';
import { BsX } from 'react-icons/bs';
import styles from './GuidanceCenter.module.css';
import useAuth from '../../hooks/useAuth';

/**
 * Props for the GuidanceCenter component
 * For MVP, this component doesn't take any specific functional props,
 * but it's prepared to accept them in the future.
 */
interface GuidanceCenterProps {
  onClose?: () => void; // Will be used in the future for mobile close functionality
}

/**
 * GuidanceCenter Component
 *
 * Serves as the content for the right-hand panel ('Guidance & Resource Center')
 * in the Permit Harmony Engine dashboard.
 */
const GuidanceCenter: React.FC<GuidanceCenterProps> = ({ onClose }) => {
  // Get the logout function from auth context
  const { logout } = useAuth();

  // Placeholder handler for the close button
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    // For MVP, this is just a placeholder
    console.log('Close button clicked');
  };

  // Handler for logout button
  const handleLogout = async () => {
    try {
      await logout();
      // Logout is handled by the auth context, which will redirect to login page
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className={styles.container}>
      {/* Main Panel Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Guía y Recursos</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Cerrar panel de guía"
        >
          <BsX className={styles.closeIcon} />
        </button>
      </div>

      {/* Quick Utilities Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Accesos Directos</h4>
        <ul className={styles.utilityList}>
          <li className={styles.utilityItem}>
            <Link to="/profile" className={styles.utilityLinkAsButton}>
              <div className="icon-text-align">
                <FaUserCircle className={styles.utilityIcon} />
                <span>Mi Perfil</span>
              </div>
            </Link>
          </li>
          {/* Temporarily removed for MVP
          <li className={styles.utilityItem}>
            <Link to="#vehicles" className={styles.utilityLinkAsButton}>
              <div className="icon-text-align">
                <FaCar className={styles.utilityIcon} />
                <span>Administrar Mis Vehículos</span>
              </div>
            </Link>
          </li>
          <li className={styles.utilityItem}>
            <Link to="#billing" className={styles.utilityLinkAsButton}>
              <div className="icon-text-align">
                <FaCreditCard className={styles.utilityIcon} />
                <span>Pagos y Facturación</span>
              </div>
            </Link>
          </li>
          */}
          <li className={styles.utilityItem}>
            <Link to="/help" className={styles.utilityLinkAsButton}>
              <div className="icon-text-align">
                <FaQuestionCircle className={styles.utilityIcon} />
                <span>Centro de Ayuda</span>
              </div>
            </Link>
          </li>
          <li className={styles.utilityItem}>
            <button
              type="button"
              className={styles.utilityLinkAsButton}
              onClick={handleLogout}
            >
              <div className="icon-text-align">
                <FaSignOutAlt className={styles.utilityIcon} />
                <span>Cerrar Sesión</span>
              </div>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default GuidanceCenter;

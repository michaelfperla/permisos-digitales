import React from 'react';
import { FaBars } from 'react-icons/fa';
import styles from './MobileHeader.module.css';
import Button from '../../ui/Button/Button';
import TextLogo from '../../ui/TextLogo';

interface MobileHeaderProps {
  /**
   * Function to call when the menu button is clicked
   */
  onMenuToggle: () => void;

  /**
   * Destination path for the TextLogo
   * If not provided, will use default path ('/')
   */
  logoPath?: string;
}

/**
 * Mobile Header Component
 *
 * Displays a header for mobile views with a hamburger menu button
 * and the TextLogo component centered in the header.
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuToggle,
  logoPath
}) => {
  return (
    <header className={styles.mobileHeader}>
      <div className={styles.menuButtonContainer}>
        <Button
          variant="text"
          size="icon"
          className={styles.menuButton}
          onClick={onMenuToggle}
          icon={<FaBars />}
          aria-label="Abrir menú de navegación"
        />
      </div>

      <div className={styles.logoContainer}>
        <TextLogo
          to={logoPath || '/'}
          className={styles.logo}
          variant="default"
        />
      </div>

      {/* Empty div to balance the layout */}
      <div className={styles.spacer}></div>
    </header>
  );
};

export default MobileHeader;

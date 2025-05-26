import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { FaBars, FaTimes } from 'react-icons/fa';
import { Link, To, useLocation } from 'react-router-dom';

import styles from './AppHeaderMobile.module.css';
import TextLogo from '../../ui/TextLogo'; // Assuming this path is correct

export interface NavLinkItem {
  to: To;
  label: string;
  type?: 'link' | 'button-primary' | 'button-secondary';
  onClick?: () => void;
  isActive?: (_pathname: string, _to: To) => boolean; // Custom active check
  icon?: ReactNode; // Optional icon for nav links
}

interface AppHeaderMobileProps {
  logoPath?: string;
  navLinks: NavLinkItem[];
  /**
   * For UserLayout: if true, AppHeaderMobile only provides the bar and toggle,
   * and doesn't render its own panel. The parent handles the panel.
   */
  externalPanelControl?: boolean;
  /**
   * For UserLayout: callback to toggle the external panel.
   */
  onExternalPanelToggle?: () => void;
  /**
   * For UserLayout: state of the external panel.
   */
  isExternalPanelOpen?: boolean;
  children?: ReactNode; // For optional footer content in the panel
}

const AppHeaderMobile: React.FC<AppHeaderMobileProps> = ({
  logoPath = '/',
  navLinks,
  externalPanelControl = false,
  onExternalPanelToggle,
  isExternalPanelOpen,
  children,
}) => {
  const [isInternalMenuOpen, setIsInternalMenuOpen] = useState(false);
  const location = useLocation();

  const isEffectivelyOpen = externalPanelControl ? isExternalPanelOpen : isInternalMenuOpen;

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelCloseButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null); // Ref for the menu panel itself

  const openMenu = () => {
    if (externalPanelControl && onExternalPanelToggle) {
      onExternalPanelToggle();
    } else {
      setIsInternalMenuOpen(true);
    }
  };

  const closeMenu = () => {
    if (externalPanelControl && onExternalPanelToggle) {
      // Parent is responsible for closing, but we can still request focus return
      onExternalPanelToggle();
    } else {
      setIsInternalMenuOpen(false);
    }
    menuButtonRef.current?.focus();
  };

  // Effect for body scroll and initial focus in panel
  useEffect(() => {
    if (isEffectivelyOpen) {
      document.body.style.overflow = 'hidden';
      if (!externalPanelControl) {
        // Only focus internal panel's elements
        setTimeout(() => panelCloseButtonRef.current?.focus(), 100);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEffectivelyOpen, externalPanelControl]);

  // Effect for Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isEffectivelyOpen) {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEffectivelyOpen, closeMenu]);

  // Focus trapping for internal panel
  useEffect(() => {
    if (isInternalMenuOpen && menuPanelRef.current && !externalPanelControl) {
      const focusableElements = Array.from(
        menuPanelRef.current.querySelectorAll(
          'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el instanceof HTMLElement && el.offsetParent !== null) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Set initial focus to close button (already handled by openMenu)
      // firstElement.focus();

      const trapFocus = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', trapFocus);
      return () => {
        document.removeEventListener('keydown', trapFocus);
      };
    }
  }, [isInternalMenuOpen, externalPanelControl]);

  return (
    <>
      <header
        className={`${styles.headerBar} ${isEffectivelyOpen ? styles.menuIsOpenActually : ''}`}
      >
        <div className={styles.logoContainer}>
          <TextLogo to={logoPath} />
        </div>
        <button
          ref={menuButtonRef}
          className={styles.menuToggleButton}
          onClick={openMenu} // Always opens
          aria-label="Abrir menú de navegación"
          aria-expanded={isEffectivelyOpen}
          aria-controls={!externalPanelControl ? 'app-mobile-menu-panel' : undefined}
        >
          {/* The icon in the header bar is always FaBars now.
              If it's controlling an external panel that is open,
              the parent (UserLayout) would be responsible for potentially changing this icon
              or hiding this header bar if its own header takes over.
              For simplicity, we'll keep it FaBars. The visual cue for "open"
              will be the panel itself or changes to the UserLayout's header.
          */}
          <FaBars className={styles.hamburgerIcon} />
        </button>
      </header>

      {!externalPanelControl && (
        <div
          className={`${styles.menuPanelContainer} ${isInternalMenuOpen ? styles.isOpen : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          id="app-mobile-menu-panel"
        >
          <div
            className={styles.menuOverlay}
            onClick={closeMenu}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                closeMenu();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Cerrar menú"
          />
          <nav
            ref={menuPanelRef}
            className={styles.menuPanel}
            aria-label="Navegación principal móvil"
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelLogoContainer}>
                <TextLogo to={logoPath} />
              </div>
              <button
                ref={panelCloseButtonRef}
                className={styles.panelCloseButton}
                onClick={closeMenu}
                aria-label="Cerrar menú"
              >
                <FaTimes className={styles.closeIcon} />
              </button>
            </div>
            <ul className={styles.linkList}>
              {navLinks.map((link, index) => {
                const isActive = link.isActive
                  ? link.isActive(location.pathname, link.to)
                  : location.pathname ===
                    (typeof link.to === 'string' ? link.to : link.to.pathname);

                let linkClass = styles.navLinkBase;
                if (link.type === 'button-primary')
                  linkClass += ` ${styles.navButton} ${styles.navButtonPrimary}`;
                else if (link.type === 'button-secondary')
                  linkClass += ` ${styles.navButton} ${styles.navButtonSecondary}`;
                else linkClass += ` ${styles.navLinkText}`;

                if (
                  isActive &&
                  link.type !== 'button-primary' &&
                  link.type !== 'button-secondary'
                ) {
                  linkClass += ` ${styles.activeLink}`;
                }

                return (
                  <li key={typeof link.to === 'string' ? link.to : link.to.pathname + index}>
                    <Link
                      to={link.to}
                      className={linkClass}
                      onClick={() => {
                        if (link.onClick) link.onClick();
                        closeMenu();
                      }}
                    >
                      {link.icon && <span className={styles.navLinkIcon}>{link.icon}</span>}
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {children && <div className={styles.panelFooter}>{children}</div>}
          </nav>
        </div>
      )}
    </>
  );
};

export default AppHeaderMobile;

import React, { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { FaBars, FaTimes } from 'react-icons/fa';
import { Link, To, useLocation } from 'react-router-dom';

import styles from './AppHeaderMobile.module.css';
import TextLogo from '../../ui/TextLogo'; // Assuming this path is correct
import Button from '../../ui/Button/Button';
import Icon from '../../../shared/components/ui/Icon';

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

  const closeMenu = useCallback(() => {
    if (externalPanelControl && onExternalPanelToggle) {
      // Parent is responsible for closing, but we can still request focus return
      onExternalPanelToggle();
    } else {
      setIsInternalMenuOpen(false);
    }
    menuButtonRef.current?.focus();
  }, [externalPanelControl, onExternalPanelToggle]);

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
        <Button
          ref={menuButtonRef}
          variant="text"
          size="icon"
          className={styles.menuToggleButton}
          onClick={openMenu} // Always opens
          aria-label="Abrir menú de navegación"
          aria-expanded={isEffectivelyOpen}
          aria-controls={!externalPanelControl ? 'app-mobile-menu-panel' : undefined}
          icon={<Icon IconComponent={FaBars} className={styles.hamburgerIcon} />}
        />
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
              <Button
                ref={panelCloseButtonRef}
                variant="text"
                size="icon"
                className={styles.panelCloseButton}
                onClick={closeMenu}
                aria-label="Cerrar menú"
                icon={<Icon IconComponent={FaTimes} className={styles.closeIcon} />}
              />
            </div>
            <ul className={styles.linkList}>
              {navLinks
                .filter(link => link.type !== 'button-primary' && link.type !== 'button-secondary')
                .map((link, index) => {
                  const isActive = link.isActive
                    ? link.isActive(location.pathname, link.to)
                    : location.pathname ===
                      (typeof link.to === 'string' ? link.to : link.to.pathname || '');

                  let linkClass = styles.navLinkBase + ` ${styles.navLinkText}`;

                  if (isActive) {
                    linkClass += ` ${styles.activeLink}`;
                  }

                  return (
                    <li key={typeof link.to === 'string' ? link.to : (link.to.pathname || '') + index}>
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

            {/* Footer with action buttons */}
            {navLinks.some(link => link.type === 'button-primary' || link.type === 'button-secondary') && (
              <div className={styles.panelFooter}>
                <div className={styles.footerButtons}>
                  {navLinks
                    .filter(link => link.type === 'button-primary' || link.type === 'button-secondary')
                    .map((link, index) => {
                      let linkClass = styles.navLinkBase + ` ${styles.navButton}`;
                      if (link.type === 'button-primary')
                        linkClass += ` ${styles.navButtonPrimary}`;
                      else if (link.type === 'button-secondary')
                        linkClass += ` ${styles.navButtonSecondary}`;

                      return (
                        <Link
                          key={typeof link.to === 'string' ? link.to : (link.to.pathname || '') + index}
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
                      );
                    })}
                </div>
              </div>
            )}
            {children && <div className={styles.panelFooter}>{children}</div>}
          </nav>
        </div>
      )}
    </>
  );
};

export default AppHeaderMobile;

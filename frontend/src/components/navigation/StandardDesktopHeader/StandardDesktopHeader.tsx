import React from 'react';
import { Link } from 'react-router-dom';

import styles from './StandardDesktopHeader.module.css';
import Button from '../../ui/Button/Button';
import TextLogo from '../../ui/TextLogo/TextLogo';

export interface HeaderNavLink {
  to: string;
  label: string;
  type?: 'link' | 'button-primary' | 'button-secondary';
}

interface StandardDesktopHeaderProps {
  logoPath?: string;
  navLinks?: HeaderNavLink[];
  className?: string;
}

const StandardDesktopHeader: React.FC<StandardDesktopHeaderProps> = ({
  logoPath = '/',
  navLinks = [],
  className = '',
}) => {
  return (
    <header className={`${styles.desktopHeader} ${className}`}>
      <div className={styles.headerContent}>
        <TextLogo to={logoPath} />
        
        {navLinks.length > 0 && (
          <nav className={styles.headerNav}>
            <div className={styles.headerLinks}>
              {navLinks.map((link, index) => {
                if (link.type === 'button-primary') {
                  return (
                    <Link key={index} to={link.to}>
                      <Button variant="primary" size="small">
                        {link.label}
                      </Button>
                    </Link>
                  );
                }
                
                if (link.type === 'button-secondary') {
                  return (
                    <Link key={index} to={link.to}>
                      <Button variant="secondary" size="small">
                        {link.label}
                      </Button>
                    </Link>
                  );
                }
                
                // Default to link type
                return (
                  <Link
                    key={index}
                    to={link.to}
                    className={styles.headerLink}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default StandardDesktopHeader;

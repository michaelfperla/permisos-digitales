import React from 'react';
import { Link } from 'react-router-dom';

import styles from './Footer.module.css';

/**
 * Application footer with copyright and navigation links
 */
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.appFooter}>
      <div className={styles.footerContainer}>
        <p className={styles.copyrightText}>
          © {currentYear} Permisos Digitales. Todos los derechos reservados.
        </p>

        <div className={styles.footerLinks}>
          <Link to="/politica-de-privacidad" className={styles.footerLink}>
            Privacidad
          </Link>
          <Link to="/terminos-y-condiciones" className={styles.footerLink}>
            Términos
          </Link>
          <Link to="/contacto" className={styles.footerLink}>
            Contacto
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

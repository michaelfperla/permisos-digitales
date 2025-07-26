import React from 'react';
import { Link } from 'react-router-dom';

import styles from './Footer.module.css';

/**
 * Application footer with navigation links
 */
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.appFooter}>
      <div className={styles.footerContainer}>
        <div className={styles.footerMain}>
          {/* Services - Public facing */}
          <div className={styles.footerSection}>
            <h4 className={styles.footerSectionTitle}>Servicios</h4>
            <nav className={styles.footerNav}>
              <Link to="/register" className={styles.footerLink}>
                Obtener Permiso
              </Link>
              <a 
                href="https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/verificar-permiso" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                Verificar Permiso Oficial
              </a>
              <Link to="/login" className={styles.footerLink}>
                Acceder a Mi Cuenta
              </Link>
            </nav>
          </div>

          {/* Information */}
          <div className={styles.footerSection}>
            <h4 className={styles.footerSectionTitle}>Información</h4>
            <nav className={styles.footerNav}>
              <Link to="/contacto" className={styles.footerLink}>
                Contacto
              </Link>
              <Link to="/terminos-y-condiciones" className={styles.footerLink}>
                Términos y Condiciones
              </Link>
              <Link to="/politica-de-privacidad" className={styles.footerLink}>
                Política de Privacidad
              </Link>
              <Link to="/eliminar-datos" className={styles.footerLink}>
                Eliminar Datos
              </Link>
            </nav>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className={styles.footerBottom}>
          <p className={styles.copyrightText}>
            © {currentYear} Permisos Digitales. Todos los derechos reservados.
          </p>
          <p className={styles.supportText}>
            Soporte: contacto@permisosdigitales.com.mx | WhatsApp: +52 55 4943 0313
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
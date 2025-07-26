import React from 'react';
import { FaEnvelope, FaMapMarkerAlt, FaClock, FaHome, FaFileAlt, FaShieldAlt, FaWhatsapp } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import styles from './LegalPage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import StandardDesktopHeader, {
  HeaderNavLink,
} from '../components/navigation/StandardDesktopHeader';
import Card from '../components/ui/Card/Card';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon/Icon';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const ContactPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  const { isAuthenticated } = useAuth();

  const mobileNavLinks: NavLinkItem[] = [
    { to: '/', label: 'Inicio', icon: <Icon IconComponent={FaHome} size="sm" /> },
    { to: '/contacto', label: 'Contacto', icon: <Icon IconComponent={FaEnvelope} size="sm" /> },
    { to: '/terminos-y-condiciones', label: 'Términos y Condiciones', icon: <Icon IconComponent={FaFileAlt} size="sm" /> },
    { to: '/politica-de-privacidad', label: 'Política de Privacidad', icon: <Icon IconComponent={FaShieldAlt} size="sm" /> },
    { to: '/login', label: 'Iniciar Sesión', type: 'button-primary' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  const desktopNavLinks: HeaderNavLink[] = [
    { to: '/login', label: 'Iniciar Sesión', type: 'link' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  return (
    <div className={styles.legalPageContainer}>
      {!isAuthenticated && (
        isMdDown ? (
          <AppHeaderMobile logoPath="/" navLinks={mobileNavLinks} />
        ) : (
          <StandardDesktopHeader logoPath="/" navLinks={desktopNavLinks} />
        )
      )}

      <main className={isAuthenticated ? styles.legalContentNoHeader : styles.legalContent}>
        <h1 className={styles.legalTitle}>CONTACTO</h1>
        <p className={styles.legalDate}>
          Estamos aquí para ayudarte con cualquier duda sobre tu permiso digital
        </p>

        <div className={styles.contactGrid}>
          <Card>
            <div className={styles.contactCard}>
              <h2 className={styles.contactCardHeader}>
                <Icon IconComponent={FaEnvelope} size="md" />
                Correo Electrónico
              </h2>
              <p className={styles.contactCardDescription}>
                Para consultas generales, soporte técnico y asistencia:
              </p>
              <p className={styles.contactEmail}>
                <a href="mailto:contacto@permisosdigitales.com.mx" className="text-link">
                  contacto@permisosdigitales.com.mx
                </a>
              </p>
            </div>
          </Card>

          <Card>
            <div className={styles.contactCard}>
              <h2 className={styles.contactCardHeader}>
                <Icon IconComponent={FaWhatsapp} size="md" />
                WhatsApp
              </h2>
              <p className={styles.contactCardDescription}>
                Para atención rápida y directa por WhatsApp:
              </p>
              <p className={styles.contactEmail}>
                <a 
                  href="https://wa.me/525549430313?text=Hola,%20necesito%20ayuda%20con%20mi%20permiso%20digital"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  +52 55 4943 0313
                </a>
              </p>
              <p className={styles.contactNote}>
                Horario de atención: Lunes a Domingo 9:00 AM - 6:00 PM
              </p>
            </div>
          </Card>

          <Card>
            <div className={styles.contactCard}>
              <h2 className={styles.contactCardHeader}>
                <Icon IconComponent={FaClock} size="md" />
                Horarios de Atención
              </h2>
              <p className={styles.contactOpeningHours}>
                Nuestro equipo de soporte está disponible para atenderte:
              </p>
              <div className={styles.contactHoursGrid}>
                <p><strong>Lunes a Domingo:</strong> 9:00 AM - 6:00 PM</p>
              </div>
              <p className={styles.contactNote}>
                Tiempo de respuesta promedio: 2-4 horas en días hábiles
              </p>
            </div>
          </Card>



          <Card>
            <div className={styles.contactCard}>
              <h2 className={styles.contactCardHeader}>
                <Icon IconComponent={FaMapMarkerAlt} size="md" />
                Oficinas Gubernamentales
              </h2>
              <p className={styles.contactCardDescription}>
                Para trámites presenciales y consultas oficiales:
              </p>
              <div className={styles.contactAddress}>
                <p><strong>Dirección:</strong></p>
                <p>Palacio Municipal S/N, Col. Centro</p>
                <p>C.P. 40130, Huitzuco de los Figueroa, Guerrero</p>
              </div>
            </div>
          </Card>
        </div>

        <section className={styles.legalSection}>
          <h2>Preguntas Frecuentes</h2>
          <p>
            Antes de contactarnos, te recomendamos revisar nuestras preguntas frecuentes que pueden
            resolver tus dudas de manera inmediata.
          </p>
          <Link to="/ayuda" className={styles.headerLink}>
            Ver Preguntas Frecuentes
          </Link>
        </section>

        <section className={styles.legalSection}>
          <h2>Soporte Técnico</h2>
          <p>
            Si experimentas problemas técnicos con la plataforma, incluye la siguiente información
            en tu mensaje:
          </p>
          <ul className={styles.legalList}>
            <li>Descripción detallada del problema</li>
            <li>Navegador web que estás utilizando</li>
            <li>Dispositivo (computadora, tablet, móvil)</li>
            <li>Pasos que realizaste antes del problema</li>
            <li>Capturas de pantalla si es posible</li>
          </ul>
        </section>
      </main>

      {!isAuthenticated && <Footer />}
    </div>
  );
};

export default ContactPage;

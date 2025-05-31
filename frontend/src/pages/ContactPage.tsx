import React from 'react';
import { FaEnvelope, FaMapMarkerAlt, FaClock, FaHome, FaFileAlt, FaShieldAlt } from 'react-icons/fa';
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

const ContactPage: React.FC = () => {
  const { isMdDown } = useResponsive();

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
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={mobileNavLinks} />
      ) : (
        <StandardDesktopHeader logoPath="/" navLinks={desktopNavLinks} />
      )}

      <main className={styles.legalContent}>
        <h1 className={styles.legalTitle}>CONTACTO</h1>
        <p className={styles.legalDate}>
          Estamos aquí para ayudarte con cualquier duda sobre tu permiso digital
        </p>

        <div style={{ display: 'grid', gap: '2rem', marginTop: '2rem' }}>
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Icon IconComponent={FaEnvelope} size="md" />
                Correo Electrónico
              </h2>
              <p style={{ marginBottom: '0.5rem' }}>
                Para consultas generales, soporte técnico y asistencia:
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--bs-primary)' }}>
                <a href="mailto:contacto@permisosdigitales.com.mx">
                  contacto@permisosdigitales.com.mx
                </a>
              </p>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Icon IconComponent={FaClock} size="md" />
                Horarios de Atención
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                Nuestro equipo de soporte está disponible para atenderte:
              </p>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <p><strong>Lunes a Viernes:</strong> 8:00 AM - 6:00 PM</p>
                <p><strong>Sábados:</strong> 9:00 AM - 2:00 PM</p>
                <p><strong>Domingos:</strong> Cerrado</p>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                Tiempo de respuesta promedio: 2-4 horas en días hábiles
              </p>
            </div>
          </Card>



          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Icon IconComponent={FaMapMarkerAlt} size="md" />
                Oficinas Gubernamentales
              </h2>
              <p style={{ marginBottom: '1rem' }}>
                Para trámites presenciales y consultas oficiales:
              </p>
              <div style={{ lineHeight: '1.6' }}>
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
          <div style={{ marginTop: '1rem' }}>
            <Link to="/dashboard" className={styles.headerLink}>
              Ver Preguntas Frecuentes
            </Link>
          </div>
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

      <Footer />
    </div>
  );
};

export default ContactPage;

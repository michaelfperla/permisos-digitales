import React from 'react';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import styles from './LegalPage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Card from '../components/ui/Card/Card';
import TextLogo from '../components/ui/TextLogo/TextLogo';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon/Icon';

const ContactPage: React.FC = () => {
  const { isMdDown } = useResponsive();

  const authNavLinks: NavLinkItem[] = [
    { to: '/login', label: 'Iniciar Sesión', type: 'link' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  return (
    <div className={styles.legalPageContainer}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={authNavLinks} />
      ) : (
        <header className={styles.desktopHeader}>
          <div className={styles.headerContent}>
            <TextLogo />
            <div className={styles.headerLinks}>
              <Link to="/login" className={styles.headerLink}>
                Iniciar Sesión
              </Link>
              <Link to="/register" className={styles.headerLink}>
                Registrarse
              </Link>
            </div>
          </div>
        </header>
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
                <Icon IconComponent={FaPhone} size="md" />
                Teléfono
              </h2>
              <p style={{ marginBottom: '0.5rem' }}>
                Atención telefónica para consultas urgentes:
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--bs-primary)' }}>
                <a href="tel:+527273330142">(727) 333-0142</a>
              </p>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Icon IconComponent={FaClock} size="md" />
                Horarios de Atención
              </h2>
              <div style={{ lineHeight: '1.6' }}>
                <p><strong>Lunes a Viernes:</strong> 8:00 AM - 6:00 PM</p>
                <p><strong>Sábados:</strong> 9:00 AM - 2:00 PM</p>
                <p><strong>Domingos:</strong> Cerrado</p>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--bs-gray-600)' }}>
                * Horario de la zona centro de México (GMT-6)
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
                <p>Calle Benito Juárez No. 4, Col. Centro</p>
                <p>C.P. 40140, Huitzuco de los Figueroa, Guerrero</p>
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

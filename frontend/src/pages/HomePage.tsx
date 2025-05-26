import React, { useState } from 'react';
import {
  BsRocket,
  BsShieldCheck,
  BsPeopleFill,
  BsFillLockFill,
  BsPlus,
  BsDash,
} from 'react-icons/bs';
import { Link } from 'react-router-dom';

import styles from './HomePage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, {
  NavLinkItem,
} from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Button from '../components/ui/Button/Button';
import Card from '../components/ui/Card/Card';
import TextLogo from '../components/ui/TextLogo';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon';

const HomePage: React.FC = () => {
  const [openAccordionId, setOpenAccordionId] = useState<number | null>(null);
  const { isMdDown } = useResponsive();

  const homeNavLinks: NavLinkItem[] = [
    { to: '/register', label: 'Crear cuenta', type: 'button-secondary' },
    { to: '/login', label: 'Entrar', type: 'link' },
  ];

  const faqs = [
    {
      id: 1,
      question: '¿Qué es un permiso digital de circulación?',
      answer:
        'Un permiso digital de circulación es un documento oficial que te permite circular legalmente con un vehículo que aún no tiene placas permanentes. Es una alternativa moderna y eficiente a los permisos tradicionales en papel.',
    },
    {
      id: 2,
      question: '¿Cuánto tiempo tarda en procesarse mi solicitud?',
      answer:
        'Tu permiso se genera automáticamente después de completar la solicitud y el pago. Con tarjeta es inmediato. Con pago en OXXO, se generará cuando se confirme que pagaste.',
    },
    {
      id: 3,
      question: '¿Qué documentos necesito para solicitar un permiso?',
      answer:
        'Necesitas tener listos: la factura o carta factura del vehículo, tu identificación oficial vigente, y el pago.',
    },
    {
      id: 4,
      question: '¿Por cuánto tiempo es válido el permiso?',
      answer:
        'El permiso es válido por 30 días naturales desde que se expide. Tramites hechos Sabado y Domingo tiene fecha de Viernes.',
    },
    {
      id: 5,
      question: '¿Puedo renovar mi permiso si expira?',
      answer:
        'Sí, puedes renovarlo solo tienes que actualizar tu información y pagar otra vez. Te recomendamos iniciar la renovación al menos 3 días antes de que venza tu permiso actual.',
    },
  ];

  const handleAccordionToggle = (id: number) => {
    setOpenAccordionId(openAccordionId === id ? null : id);
  };

  return (
    // Apply conditional padding class to the pageWrapper
    <div className={`${styles.pageWrapper} ${isMdDown ? styles.pageWrapperMobilePadded : ''}`}>
      {isMdDown && <AppHeaderMobile logoPath="/" navLinks={homeNavLinks} />}

      <div className={styles.mainPane}>
        {!isMdDown && (
          <div className={styles.paneHeader}>
            <TextLogo />
            <div className={styles.desktopNavLinks}>
              <Link to="/register">
                <Button variant="secondary">Crear cuenta</Button>
              </Link>
              <a href="/login" className={styles.navLink}>
                Entrar
              </a>
            </div>
          </div>
        )}

        {/* No longer need .paneHeroContentMobilePadded here, as .pageWrapper handles the main spacing */}
        <div className={styles.paneHeroContent}>
          <h1>Permisos Digitales de Circulación</h1>
          <p className={styles.subtitle}>
            La forma rápida y segura de circular mientras obtienes tus placas.
          </p>
          <div className={styles.heroAction}>
            <Link to="/register">
              <Button variant="primary" size="large">
                Solicitar Permiso Ahora
              </Button>
            </Link>
          </div>
        </div>

        <div className={styles.overlappingContent}>
          {/* Stats Section */}
          <section className={styles.statsSection}>
            <h2 className={styles.statsHeading}>Únete a Miles de Usuarios Satisfechos</h2>
            <div className={styles.valuePropsGrid}>
              <Link to="/register" className={styles.cardLink}>
                <Card hoverable>
                  <div className={styles.statCard}>
                    <div className={styles.statIconContainer}>
                      <div className={styles.statCardIcon}>
                        <Icon IconComponent={BsPeopleFill} size="xl" className={styles.statIcon} />
                      </div>
                    </div>
                    <h3 className={styles.statTitle}>+10,000 Permisos Emitidos</h3>
                    <p className={styles.statDescription}>
                      Miles de usuarios confían en nuestra plataforma segura y eficiente cada mes.
                    </p>
                  </div>
                </Card>
              </Link>
              <Link to="/register" className={styles.cardLink}>
                <Card hoverable>
                  <div className={styles.statCard}>
                    <div className={styles.statIconContainer}>
                      <div className={styles.statCardIcon}>
                        <Icon IconComponent={BsRocket} size="xl" className={styles.statIcon} />
                      </div>
                    </div>
                    <h3 className={styles.statTitle}>Proceso Rápido Garantizado</h3>
                    <p className={styles.statDescription}>
                      Completa tu solicitud y recibe tu permiso temporal en minutos, no en días.
                    </p>
                  </div>
                </Card>
              </Link>
              <Link to="/register" className={styles.cardLink}>
                <Card hoverable>
                  <div className={styles.statCard}>
                    <div className={styles.statIconContainer}>
                      <div className={styles.statCardIcon}>
                        <Icon IconComponent={BsShieldCheck} size="xl" className={styles.statIcon} />
                      </div>
                    </div>
                    <h3 className={styles.statTitle}>Seguro, Válido y Confiable</h3>
                    <p className={styles.statDescription}>
                      Protegemos tus datos y aseguramos la validez oficial de tu permiso de
                      circulación.
                    </p>
                  </div>
                </Card>
              </Link>
            </div>
          </section>

          {/* How It Works Timeline */}
          <section className={styles.howItWorksTimeline}>
            <h2>¿Cómo funciona? Es muy sencillo</h2>
            <div className={styles.timelineContainer}>
              <div className={styles.timelineStep}>
                <div className={styles.stepIndicatorTimeline}>1</div>
                <h3 className={styles.stepTitleTimeline}>1. Solicita Fácilmente</h3>
                <p className={styles.stepDescriptionTimeline}>
                  Completa el formulario en línea con los datos de tu vehículo.
                </p>
              </div>
              <div className={styles.timelineConnector}></div>
              <div className={styles.timelineStep}>
                <div className={styles.stepIndicatorTimeline}>2</div>
                <h3 className={styles.stepTitleTimeline}>2. Realiza el Pago</h3>
                <p className={styles.stepDescriptionTimeline}>
                  Paga con tarjeta para procesamiento inmediato o en OXXO (se procesa cuando se
                  confirme el pago).
                </p>
              </div>
              <div className={styles.timelineConnector}></div>
              <div className={styles.timelineStep}>
                <div className={styles.stepIndicatorTimeline}>3</div>
                <h3 className={styles.stepTitleTimeline}>3. Descarga tu Permiso</h3>
                <p className={styles.stepDescriptionTimeline}>
                  Una vez procesado el pago, descarga e imprime tu permiso oficial para circular
                  legalmente.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className={styles.faqSection}>
            <h2>Preguntas Frecuentes</h2>
            <div className={styles.accordionContainer}>
              {faqs.map((faq) => (
                <div key={faq.id} className={styles.accordionItem}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => handleAccordionToggle(faq.id)}
                    aria-expanded={openAccordionId === faq.id}
                  >
                    <span className={styles.accordionTitle}>{faq.question}</span>
                    <span className={styles.accordionIcon}>
                      {openAccordionId === faq.id ? (
                        <Icon IconComponent={BsDash} size="md" />
                      ) : (
                        <Icon IconComponent={BsPlus} size="md" />
                      )}
                    </span>
                  </button>
                  <div
                    className={`${styles.accordionPanel} ${openAccordionId === faq.id ? styles.accordionPanelOpen : ''}`}
                  >
                    <div className={styles.accordionContent}>{faq.answer}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Security Section */}
          <section className={styles.securitySection}>
            <h2>Tu Seguridad es Prioridad</h2>
            <div className={styles.securityIconWrapper}>
              <Icon IconComponent={BsFillLockFill} size="xl" className={styles.securityIcon} />
            </div>
            <p className={styles.securityText}>
              Permisos Digitales implementa múltiples capas de seguridad para proteger tu
              información. Utilizamos conexiones cifradas <strong>HTTPS</strong>, almacenamiento
              seguro de contraseñas con <strong>bcrypt</strong>,{' '}
              <strong>validación estricta de datos</strong>, y protección contra ataques web comunes
              mediante cabeceras de seguridad avanzadas. Nuestro sistema incluye protección{' '}
              <strong>CSRF</strong>, <strong>limitación de intentos de acceso</strong>, y un{' '}
              <strong>registro detallado de actividades</strong> de seguridad. Cada solicitud es
              validada cuidadosamente para garantizar la integridad de tus datos y el cumplimiento
              de los estándares de seguridad web modernos.
            </p>
          </section>

          {/* Final CTA Section */}
          <section className={styles.finalCtaSection}>
            <div className={styles.finalCtaContentWrapper}>
              <h2>Tu Permiso Digital en 3 Pasos</h2>
              <p className={styles.ctaSubtitle}>
                Solicita en línea, realiza el pago y descarga tu documento oficial. Ten a mano tu
                identificación y los datos de tu vehículo.
              </p>
              <div className={styles.ctaButtonWrapper}>
                <Link to="/register">
                  <Button variant="primary" size="large">
                    Solicitar Permiso Ahora
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button/Button';
import Card from '../components/ui/Card/Card';
import Footer from '../components/layout/Footer';
import TextLogo from '../components/ui/TextLogo';
import { BsRocket, BsShieldCheck, BsHeadset, BsPlus, BsDash, BsPeopleFill, BsFillLockFill } from 'react-icons/bs';
import { FaBars, FaTimes } from 'react-icons/fa';
import styles from './HomePage.module.css';

/**
 * Home Page Component
 * Implements the landing page with overlapping content structure and Set 2 styles
 */
const HomePage: React.FC = () => {
  // State to track which accordion item is open
  const [openAccordionId, setOpenAccordionId] = useState<number | null>(null);
  // State to track mobile menu visibility
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when clicking outside, pressing Escape, or on window resize
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest(`.${styles.mobileMenuContent}`) && !target.closest(`.${styles.menuButton}`)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Close menu when Escape key is pressed
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      // Close mobile menu when resizing to larger screens
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // Lock body scroll when menu is open
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // References for focus management
  const firstFocusableElementRef = React.useRef<HTMLAnchorElement>(null);
  const lastFocusableElementRef = React.useRef<HTMLAnchorElement>(null);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  // Handle tab key navigation within the mobile menu (focus trap)
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (!isMobileMenuOpen) return;

    // If shift + tab on first element, move to last element
    if (e.key === 'Tab' && e.shiftKey && document.activeElement === firstFocusableElementRef.current) {
      e.preventDefault();
      lastFocusableElementRef.current?.focus();
    }

    // If tab on last element, move to first element
    if (e.key === 'Tab' && !e.shiftKey && document.activeElement === lastFocusableElementRef.current) {
      e.preventDefault();
      firstFocusableElementRef.current?.focus();
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    // Focus management
    if (newState) {
      // Use setTimeout to ensure the menu is rendered before focusing
      setTimeout(() => {
        if (firstFocusableElementRef.current) {
          firstFocusableElementRef.current.focus();
        }
      }, 100);
    } else {
      // Return focus to the menu button when closing
      menuButtonRef.current?.focus();
    }
  };

  // FAQ data
  const faqs = [
    {
      id: 1,
      question: '¿Qué es un permiso digital de circulación?',
      answer: 'Un permiso digital de circulación es un documento oficial que te permite circular legalmente con un vehículo que aún no tiene placas permanentes. Es una alternativa moderna y eficiente a los permisos tradicionales en papel.'
    },
    {
      id: 2,
      question: '¿Cuánto tiempo tarda en procesarse mi solicitud?',
      answer: 'Tu permiso se genera automáticamente después de completar la solicitud y el pago. Con tarjeta es inmediato. Con pago en OXXO, se generará cuando se confirme que pagaste.'
    },
    {
      id: 3,
      question: '¿Qué documentos necesito para solicitar un permiso?',
      answer: 'Necesitas tener listos: la factura o carta factura del vehículo, tu identificación oficial vigente, y el pago.'
    },
    {
      id: 4,
      question: '¿Por cuánto tiempo es válido el permiso?',
      answer: 'El permiso es válido por 30 días naturales desde que se expide. Tramites hechos Sabado y Domingo tiene fecha de Viernes.'
    },
    {
      id: 5,
      question: '¿Puedo renovar mi permiso si expira?',
      answer: 'Sí, puedes renovarlo solo tienes que actualizar tu información y pagar otra vez. Te recomendamos iniciar la renovación al menos 3 días antes de que venza tu permiso actual.'
    }
  ];

  // Toggle accordion function
  const handleAccordionToggle = (id: number) => {
    setOpenAccordionId(openAccordionId === id ? null : id);
  };
  return (
    <div className={styles.pageWrapper}>
      {/* Main Content Pane */}
      <div className={styles.mainPane}>
        {/* Internal Header - directly inside mainPane */}
        <div className={styles.paneHeader}>
          <TextLogo />

          {/* Desktop Navigation - hidden on mobile */}
          <div className={styles.desktopNavLinks}>
            <Link to="/register">
              <Button variant="secondary">Crear cuenta</Button>
            </Link>
            <a href="/login" className={styles.navLink}>Entrar</a>
          </div>

          {/* Mobile Menu Button - only visible on mobile */}
          <button
            className={styles.menuButton}
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
            ref={menuButtonRef}
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>

          {/* Mobile Menu - hidden by default, shown when toggled */}
          <div
            className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ''}`}
            aria-hidden={!isMobileMenuOpen}
            role="dialog"
            aria-modal={isMobileMenuOpen}
            aria-label="Menú de navegación"
            onKeyDown={(e) => e.key === 'Escape' && setIsMobileMenuOpen(false)}
          >
            {/* Overlay for closing the menu when clicking outside */}
            <div
              className={styles.mobileMenuOverlay}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            <div className={styles.mobileMenuContent}>
              <Link
                to="/register"
                className={styles.mobileMenuButton}
                onClick={() => setIsMobileMenuOpen(false)}
                tabIndex={isMobileMenuOpen ? 0 : -1}
                ref={firstFocusableElementRef}
                onKeyDown={handleTabKey}
              >
                <Button variant="secondary">
                  Crear cuenta
                </Button>
              </Link>
              <a
                href="/login"
                className={styles.mobileMenuLink}
                onClick={() => setIsMobileMenuOpen(false)}
                tabIndex={isMobileMenuOpen ? 0 : -1}
                ref={lastFocusableElementRef}
                onKeyDown={handleTabKey}
              >
                Entrar
              </a>
            </div>
          </div>
        </div>

        {/* Hero Content Area - directly inside mainPane */}
        <div className={styles.paneHeroContent}>
          <h1>Permisos Digitales de Circulación</h1>
          <p className={styles.subtitle}>La forma rápida y segura de circular mientras obtienes tus placas.</p>
          <div className={styles.heroAction}>
            <Link to="/register">
              <Button variant="primary" size="large">Solicitar Permiso Ahora</Button>
            </Link>
          </div>
        </div>

        {/* Overlapping Content Section - directly inside mainPane */}
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
                        <BsPeopleFill size={36} className={styles.statIcon} />
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
                        <BsRocket size={36} className={styles.statIcon} />
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
                        <BsShieldCheck size={36} className={styles.statIcon} />
                      </div>
                    </div>
                    <h3 className={styles.statTitle}>Seguro, Válido y Confiable</h3>
                    <p className={styles.statDescription}>
                      Protegemos tus datos y aseguramos la validez oficial de tu permiso de circulación.
                    </p>
                  </div>
                </Card>
              </Link>
            </div>
          </section>

          {/* How It Works Timeline Section */}
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
                  Paga con tarjeta para procesamiento inmediato o en OXXO (se procesa cuando se confirme el pago).
                </p>
              </div>

              <div className={styles.timelineConnector}></div>

              <div className={styles.timelineStep}>
                <div className={styles.stepIndicatorTimeline}>3</div>
                <h3 className={styles.stepTitleTimeline}>3. Descarga tu Permiso</h3>
                <p className={styles.stepDescriptionTimeline}>
                  Una vez procesado el pago, descarga e imprime tu permiso oficial para circular legalmente.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className={styles.faqSection}>
            <h2>Preguntas Frecuentes</h2>
            <div className={styles.accordionContainer}>
              {faqs.map(faq => (
                <div key={faq.id} className={styles.accordionItem}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => handleAccordionToggle(faq.id)}
                    aria-expanded={openAccordionId === faq.id ? 'true' : 'false'}
                  >
                    <span className={styles.accordionTitle}>{faq.question}</span>
                    <span className={styles.accordionIcon}>
                      {openAccordionId === faq.id ? <BsDash size={20} /> : <BsPlus size={20} />}
                    </span>
                  </button>
                  <div
                    className={`${styles.accordionPanel} ${openAccordionId === faq.id ? styles.accordionPanelOpen : ''}`}
                  >
                    <div className={styles.accordionContent}>
                      {faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Security Spotlight Section */}
          <section className={styles.securitySection}>
            <h2>Tu Seguridad es Prioridad</h2>
            <div className={styles.securityIconWrapper}>
              <BsFillLockFill size={48} className={styles.securityIcon} />
            </div>
            <p className={styles.securityText}>
              Permisos Digitales implementa múltiples capas de seguridad para proteger tu información.
              Utilizamos conexiones cifradas <strong>HTTPS</strong>, almacenamiento seguro de contraseñas con <strong>bcrypt</strong>,
              <strong> validación estricta de datos</strong>, y protección contra ataques web comunes mediante cabeceras
              de seguridad avanzadas. Nuestro sistema incluye protección <strong>CSRF</strong>, <strong>limitación de intentos
              de acceso</strong>, y un <strong>registro detallado de actividades</strong> de seguridad. Cada solicitud es validada
              cuidadosamente para garantizar la integridad de tus datos y el cumplimiento de los
              estándares de seguridad web modernos.
            </p>
          </section>

          {/* Final Call to Action Section */}
          <section className={styles.finalCtaSection}>
            <div className={styles.finalCtaContentWrapper}>
              <h2>Tu Permiso Digital en 3 Pasos</h2>
              <p className={styles.ctaSubtitle}>
                Solicita en línea, realiza el pago y descarga tu documento oficial. Ten a mano tu identificación y los datos de tu vehículo.
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

        {/* Footer inside the main pane */}
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;

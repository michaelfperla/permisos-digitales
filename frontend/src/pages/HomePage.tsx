import React, { useState } from 'react';
import {
  BsRocket,
  BsShieldCheck,
  BsPeopleFill,
  BsFillLockFill,
  BsPlus,
  BsDash,
} from 'react-icons/bs';
import { FaHome, FaEnvelope, FaFileAlt, FaShieldAlt, FaMoneyBillWave } from 'react-icons/fa';
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
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';

const HomePage: React.FC = () => {
  const [openAccordionId, setOpenAccordionId] = useState<number | null>(null);
  const { isMdDown } = useResponsive();

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
    }).format(amount);
  };

  const homeNavLinks: NavLinkItem[] = [
    { to: '/', label: 'Inicio', icon: <Icon IconComponent={FaHome} size="sm" /> },
    { to: '/contacto', label: 'Contacto', icon: <Icon IconComponent={FaEnvelope} size="sm" /> },
    { to: '/terminos-y-condiciones', label: 'Términos y Condiciones', icon: <Icon IconComponent={FaFileAlt} size="sm" /> },
    { to: '/politica-de-privacidad', label: 'Política de Privacidad', icon: <Icon IconComponent={FaShieldAlt} size="sm" /> },
    { to: '/register', label: 'Crear cuenta', type: 'button-secondary' },
    { to: '/login', label: 'Entrar', type: 'button-primary' },
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
    <div className={`${styles.pageWrapper} ${isMdDown ? styles.pageWrapperMobilePadded : ''}`}>
      {isMdDown && <AppHeaderMobile logoPath="/" navLinks={homeNavLinks} />}

      <div className={styles.mainPane}>
        {!isMdDown && (
          <div className={styles.paneHeader}>
            <TextLogo />
            <div className={styles.desktopNavLinks}>
              <Link to="/register">
                <Button variant="secondary" size="small">Crear cuenta</Button>
              </Link>
              <Link to="/login">
                <Button variant="text" size="small">Entrar</Button>
              </Link>
            </div>
          </div>
        )}

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
          {/* Combined Social Proof & Pricing Section */}
          <section className={styles.socialProofPricingSection}>
            <div className={styles.socialProofPricingContainer}>
              <div className={styles.socialProofHeader}>
                <h2>Únete a Miles de Usuarios Satisfechos</h2>
                <p className={styles.socialProofSubtitle}>
                  Más de 10,000 permisos emitidos con la confianza de nuestros usuarios
                </p>
              </div>

              <div className={styles.socialProofStats}>
                <div className={styles.socialProofStat}>
                  <div className={styles.socialProofNumber}>+10,000</div>
                  <div className={styles.socialProofLabel}>Permisos Emitidos</div>
                </div>
                <div className={styles.socialProofStat}>
                  <div className={styles.socialProofNumber}>24/7</div>
                  <div className={styles.socialProofLabel}>Disponibilidad</div>
                </div>
                <div className={styles.socialProofStat}>
                  <div className={styles.socialProofNumber}>100%</div>
                  <div className={styles.socialProofLabel}>Validez Legal</div>
                </div>
              </div>

              <div className={styles.pricingCardContainer}>
                <div className={styles.pricingCard}>
                  <div className={styles.pricingHeader}>
                    <div className={styles.pricingBadge}>Precio Oficial</div>
                    <h3>Permiso Digital de Circulación</h3>
                    <div className={styles.pricingAmount}>
                      <span className={styles.pricingCurrency}>$</span>
                      <span className={styles.pricingNumber}>150</span>
                      <span className={styles.pricingCurrency}>MXN</span>
                    </div>
                    <p className={styles.pricingDescription}>Pago único • Sin mensualidades • Sin comisiones ocultas</p>
                  </div>
                  <div className={styles.pricingFeatures}>
                    <div className={styles.pricingFeature}>✓ Válido por 30 días naturales</div>
                    <div className={styles.pricingFeature}>✓ Procesamiento inmediato con tarjeta</div>
                    <div className={styles.pricingFeature}>✓ Documento oficial imprimible</div>
                    <div className={styles.pricingFeature}>✓ Soporte técnico incluido</div>
                  </div>
                  <div className={styles.pricingAction}>
                    <Link to="/register">
                      <Button variant="primary" size="large">
                        Solicitar Permiso Ahora
                      </Button>
                    </Link>
                    <p className={styles.pricingNote}>Procesamiento inmediato disponible</p>
                  </div>
                </div>
              </div>
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
              Tu información está protegida con <strong>tecnología de cifrado de nivel bancario</strong>.
              Procesamos pagos de forma segura y mantenemos tus datos privados conforme a las{' '}
              <strong>mejores prácticas de seguridad digital</strong>. Puedes solicitar tu permiso
              con la tranquilidad de que tu información personal y financiera está completamente
              protegida.
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

import React from 'react';
import {
  FaCheckCircle,
  FaEnvelope,
  FaArrowRight,
  FaInbox,
  FaInfoCircle,
  FaClock,
  FaLock,
  FaEnvelopeOpenText,
} from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

import styles from './PreVerificationPage.module.css';
import Alert from '../components/ui/Alert/Alert';
import Button from '../components/ui/Button/Button';
import Card from '../components/ui/Card/Card';

const PreVerificationPage: React.FC = () => {
  const location = useLocation();
  const email = location.state?.email || '';

  return (
    <div className={styles.verificationContainer}>
      <div className={styles.verificationHeader}>
        <FaCheckCircle className={styles.successIcon} />
        <h1 className={styles.title}>¡Cuenta creada exitosamente!</h1>
      </div>

      <Card className={styles.verificationCard}>
        <div className={styles.cardContent}>
          <div className={styles.emailIconWrapper}>
            <FaEnvelope className={styles.emailIcon} />
          </div>

          <h2 className={styles.verificationTitle}>Verifica tu correo electrónico</h2>

          <Alert variant="success" className={styles.verificationAlert}>
            <p className={styles.alertText}>
              Tu cuenta ha sido creada y estás a un paso de poder usar todos nuestros servicios.
            </p>
          </Alert>

          {email ? (
            <p className={styles.emailSentText}>
              Hemos enviado un correo de verificación a <strong>{email}</strong>.
            </p>
          ) : (
            <p className={styles.emailSentText}>
              Hemos enviado un correo de verificación a tu dirección de correo electrónico.
            </p>
          )}

          <div className={styles.instructionsSection}>
            <h3 className={styles.instructionsTitle}>
              <FaInbox className={styles.infoIcon} />
              Sigue estos pasos:
            </h3>
            <ol className={styles.instructionsList}>
              <li>Revisa tu bandeja de entrada (y la carpeta de spam)</li>
              <li>Abre el correo con asunto &quot;Verifica tu dirección de correo electrónico&quot;</li>
              <li>Haz clic en el botón o enlace de verificación</li>
              <li>¡Listo! Podrás iniciar sesión inmediatamente</li>
            </ol>
          </div>

          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>
              <FaInfoCircle className={styles.infoIcon} />
              Información importante:
            </h3>
            <ul className={styles.infoList}>
              <li>
                <FaClock className={styles.listItemIcon} /> El correo puede tardar hasta 5 minutos
                en llegar
              </li>
              <li>
                <FaEnvelopeOpenText className={styles.listItemIcon} /> El enlace de verificación
                estará activo durante 24 horas
              </li>
              <li>
                <FaLock className={styles.listItemIcon} /> No podrás iniciar sesión hasta verificar
                tu correo
              </li>
            </ul>
          </div>

          <div className={styles.actionsContainer}>
            <Link to="/login" className={styles.loginLink}>
              <Button variant="primary" className={styles.loginButton}>
                Ir a iniciar sesión <FaArrowRight className={styles.buttonIcon} />
              </Button>
            </Link>

            <Link to="/resend-verification" state={{ email }} className={styles.resendLink}>
              No recibí el correo de verificación
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PreVerificationPage;

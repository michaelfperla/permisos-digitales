import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BsExclamationTriangle, BsArrowLeft } from 'react-icons/bs';
import Button from '../components/ui/Button/Button';
import styles from './PaymentUploadPage.module.css';

// Temporary placeholder component until Stripe/Conekta integration is implemented
const PaymentUploadPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.pageContainer}>
      {/* Header with back button */}
      <header className={styles.header}>
        <Button
          variant="text"
          onClick={() => navigate('/dashboard')}
          icon={<BsArrowLeft />}
          className={styles.backButton}
        >
          Regresar
        </Button>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <BsExclamationTriangle />
          </div>
          <h2>Página en actualización</h2>
          <p>El sistema de pagos está siendo actualizado para mejorar su experiencia.</p>
          <p>Estamos implementando un nuevo sistema de pagos para hacer el proceso más rápido y seguro.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Regresar al Panel
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PaymentUploadPage;

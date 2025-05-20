import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import TextLogo from '../components/ui/TextLogo';
import styles from './VerificationLayout.module.css';

const VerificationLayout: React.FC = () => {
  return (
    <div className={styles.verificationPage}>
      <main className={styles.verificationContainer}>
        <div className={styles.logoContainer}>
          <TextLogo to="/" className={styles.logo} />
        </div>
        <Outlet /> {/* Child route components render here */}
      </main>
    </div>
  );
};

export default VerificationLayout;

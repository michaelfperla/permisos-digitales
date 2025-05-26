import React from 'react';
import { Outlet } from 'react-router-dom';

import styles from './VerificationLayout.module.css';
import AppHeaderMobile, {
  NavLinkItem,
} from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import TextLogo from '../components/ui/TextLogo/TextLogo';
import useResponsive from '../hooks/useResponsive';

const VerificationLayout: React.FC = () => {
  const { isMdDown } = useResponsive();

  const verificationNavLinks: NavLinkItem[] = [
    { to: '/login', label: 'Ir a iniciar sesión', type: 'link' },
    { to: '/resend-verification', label: 'Reenviar correo', type: 'link' }, // Shorter label
  ];

  return (
    <div className={styles.verificationPage}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={verificationNavLinks} />
      ) : (
        <header className={styles.desktopHeader}>
          <TextLogo to="/" />
        </header>
      )}

      <main className={styles.verificationContainer}>
        <Outlet />
      </main>
    </div>
  );
};

export default VerificationLayout;

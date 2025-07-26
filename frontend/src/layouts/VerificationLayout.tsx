import React from 'react';
import { Outlet } from 'react-router-dom';

import styles from './VerificationLayout.module.css';
import AppHeaderMobile, {
  NavLinkItem,
} from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import StandardDesktopHeader, {
  HeaderNavLink,
} from '../components/navigation/StandardDesktopHeader';
import useResponsive from '../hooks/useResponsive';

const VerificationLayout: React.FC = () => {
  const { isMdDown } = useResponsive();

  const mobileNavLinks: NavLinkItem[] = [
    { to: '/login', label: 'Ir a iniciar sesión', type: 'link' },
    { to: '/resend-verification', label: 'Reenviar correo', type: 'link' },
  ];

  const desktopNavLinks: HeaderNavLink[] = [
    { to: '/login', label: 'Iniciar Sesión', type: 'link' },
    { to: '/resend-verification', label: 'Reenviar Correo', type: 'link' },
  ];

  return (
    <div className={styles.verificationPage}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={mobileNavLinks} />
      ) : (
        <StandardDesktopHeader logoPath="/" navLinks={desktopNavLinks} />
      )}

      <main className={styles.verificationContainer}>
        <Outlet />
      </main>
    </div>
  );
};

export default VerificationLayout;

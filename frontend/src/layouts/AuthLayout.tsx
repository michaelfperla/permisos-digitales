import React from 'react';
import { Outlet } from 'react-router-dom';

import styles from './AuthLayout.module.css'; // We'll keep this for page-specific layout styles
import AppHeaderMobile, {
  NavLinkItem,
} from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Card from '../components/ui/Card/Card';
import TextLogo from '../components/ui/TextLogo/TextLogo';
import useResponsive from '../hooks/useResponsive';

const AuthLayout: React.FC = () => {
  const { isMdDown } = useResponsive();

  const authNavLinks: NavLinkItem[] = [
    { to: '/register', label: 'Crear cuenta', type: 'button-secondary' },
    { to: '/login', label: 'Entrar', type: 'link' },
  ];

  return (
    <div className={styles.authPage}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={authNavLinks} />
      ) : (
        <header className={styles.desktopHeader}>
          <TextLogo to="/" />
        </header>
      )}

      <main className={styles.authContainer}>
        <Card variant="auth" className={styles.authCardWrapper}>
          <Outlet />
        </Card>
      </main>
    </div>
  );
};

export default AuthLayout;

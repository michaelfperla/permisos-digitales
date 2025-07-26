import React from 'react';
import { Outlet } from 'react-router-dom';
import { FaHome, FaEnvelope, FaFileAlt, FaShieldAlt } from 'react-icons/fa';

import styles from './AuthLayout.module.css'; // We'll keep this for page-specific layout styles
import AppHeaderMobile, {
  NavLinkItem,
} from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import StandardDesktopHeader, {
  HeaderNavLink,
} from '../components/navigation/StandardDesktopHeader';
import Card from '../components/ui/Card/Card';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon/Icon';

const AuthLayout: React.FC = () => {
  const { isMdDown } = useResponsive();

  const mobileNavLinks: NavLinkItem[] = [
    { to: '/', label: 'Inicio', icon: <Icon IconComponent={FaHome} size="sm" /> },
    { to: '/contacto', label: 'Contacto', icon: <Icon IconComponent={FaEnvelope} size="sm" /> },
    { to: '/terminos-y-condiciones', label: 'Términos y Condiciones', icon: <Icon IconComponent={FaFileAlt} size="sm" /> },
    { to: '/politica-de-privacidad', label: 'Política de Privacidad', icon: <Icon IconComponent={FaShieldAlt} size="sm" /> },
    { to: '/register', label: 'Crear cuenta', type: 'button-secondary' },
    { to: '/login', label: 'Entrar', type: 'button-primary' },
  ];

  // For AuthLayout, we keep it minimal (logo only) to not distract from the auth forms
  const desktopNavLinks: HeaderNavLink[] = [];

  return (
    <div className={styles.authPage}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={mobileNavLinks} />
      ) : (
        <StandardDesktopHeader logoPath="/" navLinks={desktopNavLinks} />
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

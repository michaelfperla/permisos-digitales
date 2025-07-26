import React from 'react';

import AppHeaderMobile, {
  NavLinkItem,
} from '../../components/navigation/AppHeaderMobile/AppHeaderMobile';
import Card from '../../components/ui/Card/Card';
import TextLogo from '../../components/ui/TextLogo/TextLogo';
import useResponsive from '../../hooks/useResponsive';
import styles from '../../layouts/AuthLayout.module.css';

interface AdminAuthLayoutProps {
  children: React.ReactNode;
}

const AdminAuthLayout: React.FC<AdminAuthLayoutProps> = ({ children }) => {
  const { isMdDown } = useResponsive();

  const adminAuthNavLinks: NavLinkItem[] = [
    { to: '/login', label: 'Portal Cliente', type: 'button-secondary' },
    { to: '/admin/login', label: 'Entrar', type: 'link' },
  ];

  return (
    <div className={styles.authPage}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={adminAuthNavLinks} />
      ) : (
        <header className={styles.desktopHeader}>
          <TextLogo to="/" />
        </header>
      )}

      <main className={styles.authContainer}>
        <Card variant="auth" className={styles.authCardWrapper}>
          {children}
        </Card>
      </main>
    </div>
  );
};

export default AdminAuthLayout;

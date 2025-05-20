import React from 'react';
import { Outlet } from 'react-router-dom'; // Removed useLocation and Link as they were not used for Card
import Card from '../components/ui/Card/Card'; // Only import Card default export
import TextLogo from '../components/ui/TextLogo';
import styles from './AuthLayout.module.css'; // Assuming this file has .authPage, .authContainer, .authCardWrapper, .authLogo

const AuthLayout: React.FC = () => {
  // const location = useLocation(); // No longer needed for Card styling
  // const isRegisterPage = location.pathname === '/register'; // No longer needed for Card styling

  // The title for the auth card will be the TextLogo
  const cardTitle = <TextLogo to="/" className={styles.authLogo} />;

  return (
    <div className={styles.authPage}>
      <main className={styles.authContainer}>
        <Card
          variant="auth"
          className={styles.authCardWrapper} // For any additional layout styling on the Card itself
          title={cardTitle} // Pass TextLogo as the title prop
        >
          {/* The Outlet will be rendered inside the Card's body by default */}
          <Outlet /> {/* Child route components render in the Card's body */}
        </Card>
      </main>
    </div>
  );
};

export default AuthLayout;
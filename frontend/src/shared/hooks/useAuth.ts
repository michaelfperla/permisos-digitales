import { useContext } from 'react';

import {
  UserAuthContext,
  AdminAuthContext,
  UserAuthContextType,
  AdminAuthContextType,
} from '../contexts/AuthContext';

/**
 * Hook for accessing user authentication context
 */
export const useUserAuth = (): UserAuthContextType => {
  const context = useContext(UserAuthContext);

  if (context === undefined) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }

  return context;
};

/**
 * Hook for accessing admin authentication context
 */
export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);

  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }

  return context;
};

export default { useUserAuth, useAdminAuth };

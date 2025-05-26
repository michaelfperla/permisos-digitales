import { useContext } from 'react';

import {
  UserAuthContext,
  AdminAuthContext,
  UserAuthContextType,
  AdminAuthContextType,
} from '../contexts/AuthContext';

/**
 * Custom hook to use the user auth context
 * @returns The user auth context
 * @throws Error if used outside of a UserAuthProvider
 */
export const useUserAuth = (): UserAuthContextType => {
  const context = useContext(UserAuthContext);

  if (context === undefined) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }

  return context;
};

/**
 * Custom hook to use the admin auth context
 * @returns The admin auth context
 * @throws Error if used outside of an AdminAuthProvider
 */
export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);

  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }

  return context;
};

export default { useUserAuth, useAdminAuth };

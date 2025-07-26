import { useContext } from 'react';

import { ToastContext, ToastContextType } from '../contexts/ToastContext';

/**
 * Custom hook to use the toast context
 * @returns The toast context
 * @throws Error if used outside of a ToastProvider
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};

export default useToast;

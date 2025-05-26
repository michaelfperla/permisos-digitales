import React, { createContext, useState, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  ToastContainer,
  ToastItem,
  ToastType,
  ToastPosition,
} from '../../components/ui/Toast/index';

// Duración fija para todas las notificaciones: 3.3 segundos (3300ms)
const TOAST_DURATION = 3300;
// Tiempo mínimo entre toasts idénticos: 500ms
const TOAST_DEBOUNCE_TIME = 500;

/**
 * Interface for the ToastContext
 */
export interface ToastContextType {
  showToast: (
    message: string,
    type: ToastType,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
      };
    },
  ) => void;
  hideToast: (id: string) => void;
  setPosition: (position: ToastPosition) => void;
  position: ToastPosition;
}

/**
 * Create the ToastContext with default values
 */
export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
  setPosition: () => {},
  position: 'top-right',
});

/**
 * Props for the ToastProvider component
 */
export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * ToastProvider component for managing toast notifications
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [position] = useState<ToastPosition>('top-right');

  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const showToast = (
    message: string,
    type: ToastType = 'info',
    options?: {
      duration?: number; 
      action?: {
        label: string;
        onClick: () => void;
      };
    },
  ) => {
    const toastKey = `${message}-${type}`;
    const now = Date.now();

    const lastShownTime = recentToastsRef.current.get(toastKey);
    if (lastShownTime && now - lastShownTime < TOAST_DEBOUNCE_TIME) {
      return;
    }

    recentToastsRef.current.set(toastKey, now);

    recentToastsRef.current.forEach((timestamp, key) => {
      if (now - timestamp > 10000) {
        recentToastsRef.current.delete(key);
      }
    });

    const id = uuidv4();
    const duration = TOAST_DURATION;
    const action = options?.action;

    const hasDuplicate = toasts.some((toast) => toast.message === message && toast.type === type);

    if (!hasDuplicate) {
      console.debug('Creating new toast with type:', type); // Changed to debug

      const validType: ToastType = ['success', 'error', 'info', 'warning'].includes(type)
        ? (type as ToastType)
        : 'info';

      console.debug('Using toast type:', validType); // Changed to debug

      setToasts((prevToasts) => [
        ...prevToasts,
        {
          id,
          message,
          type: validType,
          duration,
          action,
        },
      ]);
    }
  };

  const hideToast = (id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  const setPosition = () => {
    console.warn(
      'setPosition está obsoleto. Las notificaciones siempre aparecerán en la esquina superior derecha.',
    );
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast, setPosition, position }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onClose={hideToast}
        position="top-right" 
        maxToasts={5}
      />
    </ToastContext.Provider>
  );
};

// Default export kept as ToastContext if that's how it's primarily consumed elsewhere.
// If ToastProvider is the main export, change this.
// Given the react-refresh warning points to ToastProvider (line 41),
// it suggests ToastProvider might be considered the primary component export.
// Let's assume the previous export default ToastContext was intentional for now.
// If you primarily import { ToastProvider } then making it the default is better.
export default ToastContext; 
// If you import { ToastProvider, ToastContext } from ... then having named exports is fine:
// export { ToastContext, ToastProvider };
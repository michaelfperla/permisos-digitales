import React, { createContext, useState, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  ToastContainer,
  ToastItem,
  ToastType,
  ToastPosition,
} from '../../components/ui/Toast/index';

const TOAST_DURATION = 3300;
const TOAST_DEBOUNCE_TIME = 500;

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

export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
  setPosition: () => {},
  position: 'top-right',
});

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Provider for managing toast notifications with debouncing and positioning
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
      console.debug('Creating new toast with type:', type);

      const validType: ToastType = ['success', 'error', 'info', 'warning'].includes(type)
        ? (type as ToastType)
        : 'info';

      console.debug('Using toast type:', validType);

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

export default ToastContext;
import React, { useMemo, memo } from 'react';

import Toast, { ToastType } from './Toast';
import styles from './Toast.module.css';

// Mantenemos el tipo para compatibilidad, pero siempre usaremos 'top-right'
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // Mantenemos como opcional para compatibilidad, pero siempre usaremos 3300ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onClose: (id: string) => void;
  position?: ToastPosition; // Mantenemos como opcional para compatibilidad, pero siempre usaremos 'top-right'
  maxToasts?: number;
}

const ToastContainer: React.FC<ToastContainerProps> = memo(
  ({
    toasts,
    onClose,
    position: _position = 'top-right', // Ignoramos este valor y siempre usamos 'top-right'
    maxToasts = 5,
  }) => {
    // Limit the number of toasts shown - memoized to prevent unnecessary calculations
    const visibleToasts = useMemo(() => toasts.slice(-maxToasts), [toasts, maxToasts]);

    if (toasts.length === 0) return null;

    // Siempre usamos la posición 'top-right' independientemente del valor pasado
    const positionClass = styles.topRight;

    return (
      <div
        className={`${styles.toastContainer} ${positionClass}`}
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
      >
        {visibleToasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            // No pasamos duration para usar el valor predeterminado de 3300ms
            action={toast.action}
            onClose={onClose}
          />
        ))}
      </div>
    );
  },
);

ToastContainer.displayName = 'ToastContainer';

export default ToastContainer;

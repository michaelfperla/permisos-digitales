import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ToastContainer, ToastItem, ToastType, ToastPosition } from '../../components/ui/Toast/index';

// Duración fija para todas las notificaciones: 3.3 segundos (3300ms)
const TOAST_DURATION = 3300;
// Tiempo mínimo entre toasts idénticos: 500ms
const TOAST_DEBOUNCE_TIME = 500;

// Context interface
interface ToastContextType {
  showToast: (
    message: string,
    type: ToastType,
    options?: {
      // Mantenemos duration como opcional para compatibilidad, pero siempre usaremos TOAST_DURATION
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => void;
  hideToast: (id: string) => void;
  // Mantenemos setPosition para compatibilidad, pero no tendrá efecto
  setPosition: (position: ToastPosition) => void;
  position: ToastPosition;
}

// Create context
const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
  setPosition: () => {},
  position: 'top-right',
});

// Toast provider component
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Mantenemos el estado position para compatibilidad, pero siempre será 'top-right'
  const [position] = useState<ToastPosition>('top-right');

  // Ref para rastrear toasts recientes y evitar duplicados
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  // Show a toast notification
  const showToast = (
    message: string,
    type: ToastType = 'info',
    options?: {
      duration?: number; // Ignoramos este valor
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => {
    // Crear una clave única basada en el mensaje y tipo
    const toastKey = `${message}-${type}`;
    const now = Date.now();

    // Verificar si ya se mostró un toast idéntico recientemente
    const lastShownTime = recentToastsRef.current.get(toastKey);
    if (lastShownTime && now - lastShownTime < TOAST_DEBOUNCE_TIME) {
      // Si se mostró recientemente, no mostrar otro
      return;
    }

    // Registrar este toast como mostrado recientemente
    recentToastsRef.current.set(toastKey, now);

    // Limpiar entradas antiguas (más de 10 segundos)
    recentToastsRef.current.forEach((timestamp, key) => {
      if (now - timestamp > 10000) {
        recentToastsRef.current.delete(key);
      }
    });

    const id = uuidv4();
    // Siempre usamos la duración fija de 3.3 segundos
    const duration = TOAST_DURATION;
    const action = options?.action;

    // Verificar si ya existe un toast con el mismo mensaje y tipo
    const hasDuplicate = toasts.some(toast =>
      toast.message === message && toast.type === type
    );

    if (!hasDuplicate) {
      // Add new toast to the array
      setToasts(prevToasts => [...prevToasts, {
        id,
        message,
        type,
        duration,
        action
      }]);
    }
  };

  // Hide a toast notification
  const hideToast = (id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  // Función vacía para mantener compatibilidad con la API existente
  const setPosition = () => {
    // No hacemos nada, siempre usamos 'top-right'
    console.warn('setPosition está obsoleto. Las notificaciones siempre aparecerán en la esquina superior derecha.');
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast, setPosition, position }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onClose={hideToast}
        position="top-right" // Siempre usamos 'top-right'
        maxToasts={5}
      />
    </ToastContext.Provider>
  );
};

// Custom hook to use the toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  return context;
};

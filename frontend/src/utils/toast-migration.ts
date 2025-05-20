/**
 * Toast Migration Utility
 *
 * Este archivo contiene funciones de utilidad para ayudar con la migración de la API antigua de toast a la nueva.
 * Proporciona una función wrapper que puede usarse para llamar a showToast con cualquiera de las dos APIs.
 *
 * NOTA: A partir de la estandarización, todas las notificaciones toast tienen una duración fija de 3.3 segundos
 * y aparecen en la esquina superior derecha. Los parámetros de duración y posición se ignoran.
 */

import { ToastType } from '../components/ui/Toast/index';

// Duración fija para todas las notificaciones: 3.3 segundos (3300ms)
const TOAST_DURATION = 3300;

/**
 * Función wrapper para showToast que soporta tanto la API antigua como la nueva
 *
 * @param showToast La función showToast del contexto
 * @param message El mensaje a mostrar
 * @param type El tipo de toast (success, error, info, warning)
 * @param durationOrOptions La duración en ms o un objeto de opciones (se ignora la duración)
 * @returns void
 */
export function showToastCompat(
  showToast: (
    message: string,
    type: ToastType,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => void,
  message: string,
  type: ToastType,
  durationOrOptions?: number | {
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
): void {
  // Si durationOrOptions es un objeto, extraemos solo la acción (ignoramos duration)
  if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
    showToast(message, type, {
      // Ignoramos duration y usamos el valor predeterminado (3.3s)
      action: durationOrOptions.action
    });
  } else {
    // Si es un número o undefined, no pasamos opciones adicionales
    showToast(message, type);
  }
}

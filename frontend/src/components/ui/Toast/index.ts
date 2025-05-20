// Export new Toast components
export { default as Toast } from './Toast';
export { default as ToastContainer } from './ToastContainer';
export type { ToastProps, ToastType } from './Toast';
export type { ToastItem, ToastPosition } from './ToastContainer';

// Re-export for backward compatibility
import Toast from './Toast';
import ToastContainer from './ToastContainer';
import { ToastType, ToastProps } from './Toast';
import { ToastItem, ToastPosition } from './ToastContainer';

// Default exports for direct access
export default {
  Toast,
  ToastContainer
};
